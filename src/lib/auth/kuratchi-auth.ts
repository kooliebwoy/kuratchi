import { KuratchiD1 } from '../d1/index.js';
import { AuthService } from './AuthService.js';
import type { Handle } from '@sveltejs/kit';
import { createAuthHandle, type CreateAuthHandleOptions } from './sveltekit.js';
import { adminSchema } from './adminSchema.js';
import { organizationSchema } from '../org/organizationSchema.js';
import { validateAdminSchema, validateOrganizationSchema } from './schemaValidator.js'
import { drizzle as drizzleSqliteProxy } from 'drizzle-orm/sqlite-proxy';
import { and, desc, eq, isNull } from 'drizzle-orm';

interface AuthConfig {
    resendApiKey: string;
    emailFrom: string;
    origin: string;
    resendAudience?: string;
    authSecret: string;
    workersSubdomain: string;
    accountId: string;
    apiToken: string;
    // Bound admin D1 database (e.g., platform.env.DB)
    adminDb: any;
}

export class KuratchiAuth {
    private kuratchiD1: KuratchiD1;
    private adminDb: any;
    private organizationServices: Map<string, AuthService>;
    private config: AuthConfig;
    public signIn: {
        magicLink: {
            send: (email: string, options?: { redirectTo?: string; organizationId?: string }) => Promise<{ ok: true }>
        };
        oauth: {
            google: {
                startUrl: (params: { organizationId: string; redirectTo?: string }) => string;
            }
        };
    };
    
    constructor(
        config: AuthConfig
    ) {
        this.config = config;
        this.organizationServices = new Map();
        
        // Initialize KuratchiD1 instance
        this.kuratchiD1 = new KuratchiD1({
            apiToken: config.apiToken,
            accountId: config.accountId,
            workersSubdomain: config.workersSubdomain
        });
        
        // Initialize admin DB for admin operations
        const admin = config.adminDb as any;
        const isKuratchiClient = !!(admin && typeof admin.query === 'function' && (typeof admin.getDrizzleProxy === 'function' || typeof admin.drizzleProxy === 'function'));
        if (isKuratchiClient) {
            const proxy = (typeof admin.getDrizzleProxy === 'function') ? admin.getDrizzleProxy() : admin.drizzleProxy();
            this.adminDb = drizzleSqliteProxy(proxy, { schema: adminSchema });
        } else {
            throw new Error('Unsupported adminDb: expected KuratchiHttpClient');
        }

        // Validate admin DB contract using KuratchiHttpClient adapter
        const adminAdapter = {
            query: async (sql: string, params?: any[]) => {
                const res = await admin.query(sql, params || []);
                const results = (res && (res.results ?? res.data)) ?? [];
                return { success: res?.success !== false, results } as any;
            }
        };
        void validateAdminSchema(adminAdapter as any);

        // Batteries-included sign-in API (organization-aware)
        // Usage:
        //   await kuratchi.auth.signIn.magicLink.send('a@b.co', { redirectTo: '/', organizationId?: 'org...' })
        //   const url = kuratchi.auth.signIn.oauth.google.startUrl({ organizationId: 'org...', redirectTo: '/' })
        this.signIn = {
            magicLink: {
                send: async (email: string, options?: { redirectTo?: string; organizationId?: string }) => {
                    const redirectTo = options?.redirectTo;
                    let orgId: string | undefined = options?.organizationId;
                    if (!orgId) orgId = await this.findOrganizationIdByEmail(email);
                    if (!orgId) throw new Error('organization_not_found_for_email');

                    const auth = await this.getOrganizationAuthService(orgId);
                    const tokenData = await auth.createMagicLinkToken(email, redirectTo);
                    const origin = this.config.origin;
                    const link = `${origin}/auth/magic/callback?token=${encodeURIComponent(tokenData.token)}&org=${encodeURIComponent(orgId)}`;
                    await auth.sendMagicLink(email, link, { from: this.config.emailFrom });
                    return { ok: true } as const;
                }
            },
            oauth: {
                google: {
                    startUrl: (params: { organizationId: string; redirectTo?: string }) => {
                        const u = new URL(`${this.config.origin}/auth/oauth/google/start`);
                        u.searchParams.set('org', params.organizationId);
                        if (params.redirectTo) u.searchParams.set('redirectTo', params.redirectTo);
                        return u.toString();
                    }
                }
            }
        };
        }
    
        private buildEnv(adminClient: any) {
            return {
                ADMIN_DB: adminClient,
                RESEND_API_KEY: this.config.resendApiKey,
                EMAIL_FROM: this.config.emailFrom,
                ORIGIN: this.config.origin,
                RESEND_CLUTCHCMS_AUDIENCE: this.config.resendAudience || '',
                KURATCHI_AUTH_SECRET: this.config.authSecret
            };
        }
        
        private async findOrganizationIdByEmail(email: string): Promise<string | undefined> {
            try {
                const mapping = await this.adminDb.query.OrganizationUsers.findFirst({
                    where: and(
                        eq(adminSchema.OrganizationUsers.email, email),
                        isNull(adminSchema.OrganizationUsers.deleted_at)
                    )
                });
                return (mapping as any)?.organizationId || undefined;
            } catch {
                return undefined;
            }
        }
    
        /**
         * Get or create AuthService for a specific organization
         */
        private async getOrganizationAuthService(organizationId: string): Promise<AuthService> {
            if (!this.organizationServices.has(organizationId)) {
                // Resolve the organization's database name from admin DB
                const dbRecord = await this.adminDb.query.Databases.findFirst({
                    where: and(
                        eq(adminSchema.Databases.organizationId, organizationId),
                        isNull(adminSchema.Databases.deleted_at)
                    ),
                    orderBy: desc(adminSchema.Databases.created_at)
                });
                if (!dbRecord || !dbRecord.name) {
                    throw new Error(`No database found for organization ${organizationId}`);
                }

                const databaseName = dbRecord.name;

                // Determine API token by looking up latest valid DB token
                const tokenCandidates = await this.adminDb.query.DBApiTokens.findMany({
                    where: and(
                        eq(adminSchema.DBApiTokens.databaseId, dbRecord.id),
                        isNull(adminSchema.DBApiTokens.deleted_at),
                        eq(adminSchema.DBApiTokens.revoked, false)
                    ),
                    orderBy: desc(adminSchema.DBApiTokens.created_at)
                });
                const nowMs = Date.now();
                const isNotExpired = (exp: any) => {
                    if (!exp) return true; // no expiry
                    if (exp instanceof Date) return exp.getTime() > nowMs;
                    if (typeof exp === 'number') return exp > nowMs;
                    // attempt to parse if string
                    const t = new Date(exp as any).getTime();
                    return !Number.isNaN(t) ? t > nowMs : true;
                };
                const valid = tokenCandidates.find((t: any) => isNotExpired((t as any).expires));
                if (!valid) {
                    throw new Error(`No valid API token found for organization database ${dbRecord.id}`);
                }
                const effectiveToken = (valid as any).token as string;

                // Get client for organization database
                const organizationClient = this.kuratchiD1.getClient({
                    databaseName,
                    apiToken: effectiveToken!
                });
                
                // Validate organization DB contract
                await validateOrganizationSchema(organizationClient);

                // Get Drizzle proxy with organization schema
                const orgDrizzleProxy = this.kuratchiD1.getDrizzleClient({
                    databaseName,
                    apiToken: effectiveToken!
                });
                
                const drizzleDB = drizzleSqliteProxy(orgDrizzleProxy as any, { schema: organizationSchema });
                
                const authService = new AuthService(
                    drizzleDB as any,
                    this.buildEnv(organizationClient),
                    organizationSchema
                );
                
                this.organizationServices.set(organizationId, authService);
            }
            
            return this.organizationServices.get(organizationId)!;
        }
    
        // Admin operations using adminDb directly
        async createOrganization(data: any) {
            // 1) Create organization row
            const orgId = crypto.randomUUID();
            const [org] = await this.adminDb.insert(adminSchema.Organizations)
                .values({
                    ...data,
                    id: orgId
                })
                .returning();
            if (!org) throw new Error('Failed to create organization');

            // 2) Provision D1 database for this org
            const dbName = (org as any).organizationSlug || (org as any).organizationName || `org-${orgId}`;
            const { database, apiToken } = await this.kuratchiD1.createDatabase(String(dbName));

            // 3) Persist database metadata
            const dbId = crypto.randomUUID();
            const [dbRow] = await this.adminDb.insert(adminSchema.Databases)
                .values({
                    id: dbId,
                    name: database?.name ?? String(dbName),
                    dbuuid: database?.uuid ?? database?.id,
                    organizationId: org.id
                })
                .returning();
            if (!dbRow) throw new Error('Failed to persist organization database');

            // 4) Store API token for the org DB
            const [tokenRow] = await this.adminDb.insert(adminSchema.DBApiTokens)
                .values({
                    id: crypto.randomUUID(),
                    token: apiToken,
                    name: 'primary',
                    databaseId: dbRow.id
                })
                .returning();
            if (!tokenRow) throw new Error('Failed to persist organization DB API token');

            return org ?? null;
        }
    
        async listOrganizations() {
            return await this.adminDb.query.Organizations.findMany({
                where: isNull(adminSchema.Organizations.deleted_at),
                orderBy: desc(adminSchema.Organizations.created_at)
            });
        }
    
        async getOrganization(id: string) {
            return await this.adminDb.query.Organizations.findFirst({
                where: and(
                    eq(adminSchema.Organizations.id, id),
                    isNull(adminSchema.Organizations.deleted_at)
                )
            });
        }

        /**
         * Delete an organization: delete D1 database and soft-delete related admin records.
         */
        async deleteOrganization(organizationId: string) {
            // Find active database for this org
            const db = await this.adminDb.query.Databases.findFirst({
                where: and(
                    eq(adminSchema.Databases.organizationId, organizationId),
                    isNull(adminSchema.Databases.deleted_at)
                ),
                orderBy: desc(adminSchema.Databases.created_at)
            });

            // Best-effort delete in Cloudflare if we have a uuid
            if (db?.dbuuid) {
                try {
                    await this.kuratchiD1.deleteDatabase(db.dbuuid);
                } catch (e) {
                    console.error('Failed to delete Cloudflare D1 database for org', organizationId, e);
                }
            }

            const now = new Date().toISOString();

            // Soft-delete DB tokens for this DB
            if (db?.id) {
                await this.adminDb
                    .update(adminSchema.DBApiTokens)
                    .set({ revoked: true as any, deleted_at: now as any })
                    .where(eq(adminSchema.DBApiTokens.databaseId, db.id));

                // Soft-delete database row
                await this.adminDb
                    .update(adminSchema.Databases)
                    .set({ deleted_at: now as any })
                    .where(eq(adminSchema.Databases.id, db.id));
            }

            // Soft-delete organization
            await this.adminDb
                .update(adminSchema.Organizations)
                .set({ deleted_at: now as any })
                .where(eq(adminSchema.Organizations.id, organizationId));

            return true;
        }
    
    async authenticate(email: string, password: string) {
        const mapping = await this.adminDb.query.OrganizationUsers.findFirst({
            where: and(
                eq(adminSchema.OrganizationUsers.email, email),
                isNull(adminSchema.OrganizationUsers.deleted_at)
            ),
            with: { Organization: true }
        });
        if (!mapping || !mapping.organizationId) return null;
        
        // Get the organization to retrieve details
        const org = await this.getOrganization(mapping.organizationId);
        if (!org) return null;
        
        // Resolve organization AuthService using the per-database token from admin DB
        const orgAuth = await this.getOrganizationAuthService(mapping.organizationId);
        return orgAuth.createAuthSession(email, password);
    }

    /**
     * Return an organization-scoped AuthService without duplicating methods.
     * Usage: const auth = await kuratchi.auth.forOrganization(organizationId); await auth.createUser(...)
     */
    async forOrganization(
        organizationId: string
    ): Promise<AuthService> {
        return this.getOrganizationAuthService(organizationId);
    }

    /**
     * SvelteKit handle wrapper for clean usage: kuratchi.auth.handle()
     * Delegates to createAuthHandle() which reads env and ADMIN_DB from event.platform.env by default.
     */
    handle(options: CreateAuthHandleOptions = {}): Handle {
        // Delegate to createAuthHandle. It will read env via $env/dynamic/private
        // and build the admin Kuratchi HTTP client from KURATCHI_ADMIN_DB_NAME/TOKEN.
        return createAuthHandle({ ...options });
    }
}
