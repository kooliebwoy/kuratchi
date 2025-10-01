import { KuratchiDatabase } from '../database/kuratchi-database.js';
import { env } from '$env/dynamic/private';
import { AuthService } from './auth-helper.js';
import { normalizeSchema } from '../orm/normalize.js';
import { createClientFromJsonSchema, type TableApi } from '../orm/kuratchi-orm.js';
import { adminSchemaDsl } from '../schema/admin.js';
import { organizationSchemaDsl } from '../schema/organization.js';
import type { AuthConfig, CreateAuthHandleOptions } from './types.js';
import { createAuthHandle } from './handle.js';
import type { Handle } from '@sveltejs/kit';

// Re-export types and handle from separate files
export type {
  SessionMutatorContext,
  SessionMutator,
  RouteGuardContext,
  RouteGuard,
  AuthHandleEnv,
  CreateAuthHandleOptions,
  AuthConfig
} from './types.js';
export { KURATCHI_SESSION_COOKIE, createAuthHandle } from './handle.js';

export class KuratchiAuth {
private kuratchiDO: KuratchiDatabase;
private adminDb: any;
private organizationServices: Map<string, AuthService>;
private organizationOrmClients: Map<string, Record<string, TableApi>>;
private config: AuthConfig;
public signIn: {
  magicLink: {
    send: (email: string, options?: { redirectTo?: string; organizationId?: string }) => Promise<{ success: true }>
  };
  credentials: {
    authenticate: (
      email: string,
      password: string,
      options?: { organizationId?: string; ipAddress?: string; userAgent?: string; redirectTo?: string }
    ) => Promise<
      | { success: true; cookie: string; user: any; session: any }
      | { success: false; error: 'invalid_credentials' }
    >
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
        // Prevent accidental exposure of secrets via console.log / util.inspect
        try {
            Object.defineProperty(this, 'config', { enumerable: false, configurable: false, writable: true });
        } catch {}
        this.organizationServices = new Map();
        this.organizationOrmClients = new Map();
        
        // Initialize KuratchiDatabase instance (DO-only)
        this.kuratchiDO = new KuratchiDatabase({
            apiToken: config.apiToken,
            accountId: config.accountId,
            workersSubdomain: config.workersSubdomain
        });
        
        // Initialize admin DB runtime client using database module
        if (!config.adminDbName || !config.adminDbToken || !config.gatewayKey) {
            throw new Error('KuratchiAuth requires adminDbName, adminDbToken, and gatewayKey');
        }
        const adminHttp = this.kuratchiDO.httpClient({
            databaseName: config.adminDbName,
            dbToken: config.adminDbToken,
            gatewayKey: config.gatewayKey
        });
        // Prefer a provided admin schema; fallback to bundled default (sync in constructor)
        const schema = this.resolveAdminSchemaDslSync();
        this.adminDb = createClientFromJsonSchema(
            (sql, params) => adminHttp.query(sql, params || []),
            schema as any
        ) as Record<string, TableApi>;

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
                    return { success: true } as const;
                }
            },
            credentials: {
                authenticate: async (
                    email: string,
                    password: string,
                    options?: { organizationId?: string; ipAddress?: string; userAgent?: string; redirectTo?: string }
                ) => {
                    let orgId: string | undefined = options?.organizationId;
                    if (!orgId) orgId = await this.findOrganizationIdByEmail(email);
                    if (!orgId) throw new Error('organization_not_found_for_email');

                    const auth = await this.getOrganizationAuthService(orgId);
                    const result = await auth.createAuthSession(
                        email,
                        password,
                        options?.ipAddress,
                        options?.userAgent,
                        orgId
                    );
                    if (!result) return { success: false as const, error: 'invalid_credentials' } as const;
                    return {
                        success: true as const,
                        cookie: result.sessionId,
                        user: result.user,
                        session: result.sessionData,
                    } as const;
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

        // Node.js inspect and JSON serialization redaction
        toJSON() {
            return {
                signIn: '[api]',
                // expose minimal safe surface
                forOrganization: '[function]',
                createOrganization: '[function]',
                listOrganizations: '[function]',
                getOrganization: '[function]',
                deleteOrganization: '[function]'
            } as any;
        }

        [Symbol.for('nodejs.util.inspect.custom')]() {
            return this.toJSON();
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
                const res = await (this.adminDb as any).organizationUsers.where({ email, deleted_at: { is: null } }).first();
                const mapping = (res as any)?.data;
                return (mapping as any)?.organizationId || undefined;
            } catch {
                return undefined;
            }
        }
        
        // Schema resolvers
        private resolveAdminSchemaDslSync() {
            if ((this as any).config?.adminSchema) {
                return normalizeSchema((this as any).config.adminSchema as any);
            }
            return normalizeSchema(adminSchemaDsl as any);
        }

        private async resolveOrganizationSchemaDsl(): Promise<any> {
            if ((this as any).config?.organizationSchema) {
                return normalizeSchema((this as any).config.organizationSchema as any);
            }
            // Try to auto-load from host app using a dynamic evaluator to avoid TS module resolution errors
            try {
                const path: any = '$lib/schema/organization';
                const mod: any = await (new Function('p', 'return import(p)'))(path);
                // Direct hits first (common patterns)
                const direct = mod?.schema || mod?.default || mod?.organizationSchemaDsl;
                if (direct && typeof direct === 'object' && direct.tables && typeof direct.tables === 'object') {
                    return normalizeSchema(direct as any);
                }
                // Heuristic: any named export with { tables: object }
                for (const [k, v] of Object.entries(mod || {})) {
                    if (v && typeof v === 'object' && (v as any).tables && typeof (v as any).tables === 'object') {
                        return normalizeSchema(v as any);
                    }
                }
            } catch (e: any) {
                console.log('[kuratchi][schema] Failed to import $lib/schema/organization:', e?.message || String(e));
            }
            return normalizeSchema(organizationSchemaDsl as any);
        }
    
        /**
         * Get or create AuthService for a specific organization
         */
        private async getOrganizationContext(organizationId: string, schemaOverride?: any): Promise<{ authService: AuthService; client: Record<string, TableApi> }> {
            const useCache = !schemaOverride;

            if (useCache && this.organizationServices.has(organizationId) && this.organizationOrmClients.has(organizationId)) {
                return {
                    authService: this.organizationServices.get(organizationId)!,
                    client: this.organizationOrmClients.get(organizationId)!
                };
            }

            const dbRes = await (this.adminDb as any).databases
                .where({ organizationId, deleted_at: { is: null } })
                .orderBy({ created_at: 'desc' })
                .first();
            const dbRecord = (dbRes as any)?.data;
            if (!dbRecord || !dbRecord.name) {
                throw new Error(`No database found for organization ${organizationId}`);
            }

            const databaseName = dbRecord.name;

            const tokenRes = await (this.adminDb as any).dbApiTokens
                .where({ databaseId: dbRecord.id, deleted_at: { is: null }, revoked: false })
                .orderBy({ created_at: 'desc' })
                .many();
            const tokenCandidates = (tokenRes as any)?.data ?? [];
            const nowMs = Date.now();
            const isNotExpired = (exp: any) => {
                if (!exp) return true;
                if (exp instanceof Date) return exp.getTime() > nowMs;
                if (typeof exp === 'number') return exp > nowMs;
                const t = new Date(exp as any).getTime();
                return !Number.isNaN(t) ? t > nowMs : true;
            };
            const valid = tokenCandidates.find((t: any) => isNotExpired((t as any).expires));
            if (!valid) {
                throw new Error(`No valid API token found for organization database ${dbRecord.id}`);
            }
            const effectiveToken = (valid as any).token as string;

            if (!this.config.gatewayKey) {
                throw new Error('[KuratchiAuth] gatewayKey is required in config to use DO-backed organization databases');
            }
            const orgSchema = schemaOverride ? normalizeSchema(schemaOverride as any) : await this.resolveOrganizationSchemaDsl();
            const orgClient = await this.kuratchiDO.client({
                databaseName,
                dbToken: effectiveToken!,
                gatewayKey: this.config.gatewayKey!,
                schema: orgSchema as any
            });
            const authService = new AuthService(orgClient as any, this.buildEnv(this.adminDb));

            if (useCache) {
                this.organizationServices.set(organizationId, authService);
                this.organizationOrmClients.set(organizationId, orgClient);
            }

            return { authService, client: orgClient };
        }

        private async getOrganizationAuthService(organizationId: string, schemaOverride?: any): Promise<AuthService> {
            const { authService } = await this.getOrganizationContext(organizationId, schemaOverride);
            return authService;
        }
    
        // Admin operations using adminDb directly
        // Creates organization, provisions DB, optionally migrates org schema, seeds initial user, and creates a session
        async createOrganization(
            data: any,
            options?: {
                migrate?: boolean; // default true
                // Optional gateway key for DO; if omitted, uses config.gatewayKey
                gatewayKey?: string;
            }
        ) {
            // 1) Get or create organization row idempotently (whitelist allowed columns)
            const src: any = data || {};
            let org: any | null = null;
            // Prefer matching by slug for idempotency if provided
            if (src.organizationSlug) {
                try {
                    const existing = await (this.adminDb as any).organizations
                        .where({ organizationSlug: src.organizationSlug, deleted_at: { is: null } } as any)
                        .first();
                    org = (existing as any)?.data || null;
                } catch {}
            }
            // If not found by slug, optionally match by email (soft heuristic)
            if (!org && src.email) {
                try {
                    const existing = await (this.adminDb as any).organizations
                        .where({ email: src.email, deleted_at: { is: null } } as any)
                        .first();
                    org = (existing as any)?.data || null;
                } catch {}
            }
            if (!org) {
                // Pre-insert uniqueness check for contact email (better DX)
                if (src.email) {
                    try {
                        const existing = await (this.adminDb as any).organizations
                            .where({ email: src.email, deleted_at: { is: null } })
                            .first();
                        if ((existing as any)?.data) {
                            throw new Error('organization_email_already_exists');
                        }
                    } catch (err) {
                        if (err instanceof Error && err.message.includes('already exists')) throw err;
                    }
                }
                const orgId = crypto.randomUUID();
                const orgValues: any = {
                    id: orgId,
                    organizationName: src.organizationName,
                    organizationSlug: src.organizationSlug,
                    email: src.email,
                    status: src.status ?? 'active',
                };
                try {
                    await (this.adminDb as any).organizations.insert(orgValues);
                    org = orgValues;
                } catch (e) {
                    // Handle race or prior creation: fetch by slug (preferred) or email
                    if (src.organizationSlug) {
                        const existing = await (this.adminDb as any).organizations
                            .where({ organizationSlug: src.organizationSlug, deleted_at: { is: null } } as any)
                            .first();
                        org = (existing as any)?.data || null;
                    }
                    if (!org && src.email) {
                        const existing = await (this.adminDb as any).organizations
                            .where({ email: src.email, deleted_at: { is: null } } as any)
                            .first();
                        org = (existing as any)?.data || null;
                    }
                    if (!org) throw e;
                }
            }

            // 2) Provision database idempotently (DO-only)
            const dbName = (org as any).organizationName || `org-${(org as any).id}`;

            // First check if database with this name already exists
            let dbRow: any | null = null;
            const dbId = crypto.randomUUID();
            
            const existing = await (this.adminDb as any).databases
                .where({ name: String(dbName), deleted_at: { is: null } } as any)
                .first();
                
            if ((existing as any)?.data) {
                dbRow = (existing as any).data;
            }

            // Check for existing valid API token to avoid re-provisioning
            let apiToken: string | null = null;
            let tokenRow: any | null = null;
            try {
                const tokenRes = await (this.adminDb as any).dbApiTokens
                    .where({ databaseId: dbRow.id, deleted_at: { is: null }, revoked: false } as any)
                    .orderBy({ created_at: 'desc' })
                    .many();
                const tokens = ((tokenRes as any)?.data ?? []) as any[];
                const now = Date.now();
                const notExpired = (exp: any) => {
                    if (!exp) return true;
                    if (exp instanceof Date) return exp.getTime() > now;
                    if (typeof exp === 'number') return exp > now;
                    const t = new Date(exp as any).getTime();
                    return Number.isNaN(t) ? true : t > now;
                };
                const valid = tokens.find((t) => notExpired((t as any).expires));
                if (valid) {
                    apiToken = (valid as any).token;
                    tokenRow = valid;
                }
            } catch {}

            let database: any = null;
            let provisioned = false;

            if (!apiToken) {
                const gatewayKey = options?.gatewayKey || this.config.gatewayKey;
                if (!gatewayKey) throw new Error('[KuratchiAuth] gatewayKey required to create DO-backed database');
                const orgSchema = await this.resolveOrganizationSchemaDsl();
                const res = await this.kuratchiDO.createDatabase({
                    databaseName: String(dbName),
                    gatewayKey,
                    migrate: options?.migrate !== false,
                    schema: orgSchema as any
                });
                apiToken = res.token;
                database = { name: res.databaseName };
                provisioned = true;
                
                // Insert database record with null dbuuid for DO
                await (this.adminDb as any).databases.insert({
                    id: dbId,
                    name: String(dbName),
                    dbuuid: null,
                    organizationId: org.id,
                    isActive: true
                });
                
                // Get the inserted record
                const inserted = await (this.adminDb as any).databases.where({ id: dbId } as any).first();
                dbRow = (inserted as any)?.data;

                // Insert API token for the org DB (since we just created it)
                const tokenId = crypto.randomUUID();
                tokenRow = {
                    id: tokenId,
                    token: apiToken!,
                    name: 'primary',
                    databaseId: dbRow.id,
                    revoked: false,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                await (this.adminDb as any).dbApiTokens.insert(tokenRow);
            }

            // 5) DO-only: no KV/R2/Queues provisioning

            // 6) Optionally migrate the organization's database schema
            // 6) Migrations applied during DO createDatabase() when migrate !== false

            // 7) Seed initial organization user and create a session
            // Build an organization-scoped AuthService using the just-provisioned DB
            const orgAuth = await this.getOrganizationAuthService((org as any).id);
            let createdUser: any = null;
            let sessionCookie: string | null = null;
            if (data?.email) {
                // Allow passing password; AuthService will hash if plain provided
                createdUser = await orgAuth.createUser({
                    email: data.email,
                    password: data.password,
                    name: data.name || data.organizationName || null,
                    firstName: data.firstName || null,
                    lastName: data.lastName || null,
                    role: data.role || 'owner'
                }, false);
                sessionCookie = await orgAuth.upsertSession({ userId: createdUser.id });
            }

            // 8) Create OrganizationUsers mapping in admin DB (idempotent)
            if (data?.email) {
                try {
                    // Check if mapping already exists
                    const existing = await (this.adminDb as any).organizationUsers
                        .where({ email: data.email, organizationId: org.id, deleted_at: { is: null } } as any)
                        .first();
                    if (!(existing as any)?.data) {
                        await (this.adminDb as any).organizationUsers.insert({
                            id: crypto.randomUUID(),
                            email: data.email,
                            organizationId: org.id,
                            organizationSlug: (org as any).organizationSlug || null
                        });
                    }
                } catch {
                    // Best-effort; ignore duplicate errors
                }
            }

            return {
                success: true as const,
                sessionCookie
            };
        }
    
        async listOrganizations() {
            const res = await (this.adminDb as any).organizations
                .where({ deleted_at: { is: null } })
                .orderBy({ created_at: 'desc' })
                .many();
            return (res as any)?.data ?? [];
        }
    
        async getOrganization(id: string) {
            const res = await (this.adminDb as any).organizations.where({ id, deleted_at: { is: null } } as any).first();
            return (res as any)?.data;
        }

        /**
         * Delete an organization: delete D1 database and soft-delete related admin records.
         */
        async deleteOrganization(organizationId: string) {
            // Find active database for this org
            const dbRes = await (this.adminDb as any).databases
                .where({ organizationId, deleted_at: { is: null } })
                .orderBy({ created_at: 'desc' })
                .first();
            const db = (dbRes as any)?.data;

            const now = new Date().toISOString();

            // Soft-delete DB tokens for this DB
            if (db?.id) {
                await (this.adminDb as any).dbApiTokens.where({ databaseId: db.id } as any).update({ revoked: true as any, deleted_at: now as any });
                await (this.adminDb as any).databases.where({ id: db.id } as any).update({ deleted_at: now as any });
            }

            // DO-only: no KV/R2/Queues resources to delete

            // Soft-delete organization
            await (this.adminDb as any).organizations.where({ id: organizationId } as any).update({ deleted_at: now as any });

            return true;
        }
    
    async authenticate(email: string, password: string) {
        const orgId = await this.findOrganizationIdByEmail(email);
        if (!orgId) return null;
        const org = await this.getOrganization(orgId);
        if (!org) return null;
        const orgAuth = await this.getOrganizationAuthService(orgId);
        return orgAuth.createAuthSession(email, password);
    }

    /**
     * Return an organization-scoped AuthService without duplicating methods.
     * Usage: const auth = await kuratchi.auth.forOrganization(organizationId); await auth.createUser(...)
     */
    async forOrganization(
        organizationId: string,
        options?: { schema?: any }
    ): Promise<AuthService> {
        // Prevent client-side usage which could expose credentials via instantiation side-effects
        if (typeof window !== 'undefined') {
            throw new Error('[KuratchiAuth] forOrganization() is server-only. Call this on the server (load, actions, endpoints).');
        }
        return this.getOrganizationAuthService(organizationId, options?.schema);
    }

    // Server-only accessor for admin ORM client
    getAdminDb(): Record<string, TableApi> {
        if (typeof window !== 'undefined') {
            throw new Error('[KuratchiAuth] getAdminDb() is server-only. Call this on the server (load, actions, endpoints).');
        }
        return this.adminDb as Record<string, TableApi>;
    }

    // Server-only accessor for organization ORM client
    async getOrganizationDb(organizationId: string, options?: { schema?: any }): Promise<Record<string, TableApi>> {
        if (typeof window !== 'undefined') {
            throw new Error('[KuratchiAuth] getOrganizationDb() is server-only. Call this on the server (load, actions, endpoints).');
        }
        const { client } = await this.getOrganizationContext(organizationId, options?.schema);
        return client;
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

// Convenience namespace API, colocated with the class to avoid polluting index.ts
function getAuthEnv() {
  const pick = (key: string) => {
    const v = env?.[key];
    return v !== undefined && v !== null && String(v).length > 0 ? String(v) : undefined;
  };
  return {
    RESEND_API_KEY: pick('RESEND_EMAIL_API_KEY') || pick('KURATCHI_RESEND_API_KEY') || pick('RESEND_API_KEY'),
    EMAIL_FROM: pick('KURATCHI_EMAIL_FROM') || pick('EMAIL_FROM'),
    ORIGIN: pick('KURATCHI_ORIGIN') || pick('ORIGIN'),
    RESEND_CLUTCHCMS_AUDIENCE: pick('KURATCHI_RESEND_CLUTCHCMS_AUDIENCE') || pick('RESEND_CLUTCHCMS_AUDIENCE'),
    KURATCHI_AUTH_SECRET: pick('KURATCHI_AUTH_SECRET')!,
    CLOUDFLARE_WORKERS_SUBDOMAIN: pick('KURATCHI_CLOUDFLARE_WORKERS_SUBDOMAIN') || pick('CLOUDFLARE_WORKERS_SUBDOMAIN')!,
    CLOUDFLARE_ACCOUNT_ID: pick('KURATCHI_CLOUDFLARE_ACCOUNT_ID') || pick('CLOUDFLARE_ACCOUNT_ID')!,
    CLOUDFLARE_API_TOKEN: pick('KURATCHI_CLOUDFLARE_API_TOKEN') || pick('CLOUDFLARE_API_TOKEN')!,
    GOOGLE_CLIENT_ID: pick('GOOGLE_CLIENT_ID'),
    GOOGLE_CLIENT_SECRET: pick('GOOGLE_CLIENT_SECRET'),
    KURATCHI_ADMIN_DB_NAME: pick('KURATCHI_ADMIN_DB_NAME'),
    KURATCHI_ADMIN_DB_TOKEN: pick('KURATCHI_ADMIN_DB_TOKEN'),
    KURATCHI_ADMIN_DB_ID: pick('KURATCHI_ADMIN_DB_ID'),
    KURATCHI_GATEWAY_KEY: pick('KURATCHI_GATEWAY_KEY')
  };
}

export const auth = {
  // Create an auth instance (reads env by default)
  instance(cfg?: Partial<AuthConfig>): KuratchiAuth {
    const authEnv = getAuthEnv();
    const required = ['KURATCHI_AUTH_SECRET', 'CLOUDFLARE_WORKERS_SUBDOMAIN', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'];
    const missing = required.filter(k => !authEnv[k as keyof typeof authEnv]);
    if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    return new KuratchiAuth({
      resendApiKey: cfg?.resendApiKey || authEnv.RESEND_API_KEY || '',
      emailFrom: cfg?.emailFrom || authEnv.EMAIL_FROM || '',
      origin: cfg?.origin || authEnv.ORIGIN || '',
      resendAudience: cfg?.resendAudience || authEnv.RESEND_CLUTCHCMS_AUDIENCE,
      authSecret: cfg?.authSecret || authEnv.KURATCHI_AUTH_SECRET!,
      workersSubdomain: cfg?.workersSubdomain || authEnv.CLOUDFLARE_WORKERS_SUBDOMAIN!,
      accountId: cfg?.accountId || authEnv.CLOUDFLARE_ACCOUNT_ID!,
      apiToken: cfg?.apiToken || authEnv.CLOUDFLARE_API_TOKEN!,
      adminDbName: cfg?.adminDbName || authEnv.KURATCHI_ADMIN_DB_NAME || 'kuratchi-admin',
      adminDbToken: cfg?.adminDbToken || authEnv.KURATCHI_ADMIN_DB_TOKEN || '',
      adminDbId: cfg?.adminDbId || authEnv.KURATCHI_ADMIN_DB_ID || '',
      gatewayKey: cfg?.gatewayKey || authEnv.KURATCHI_GATEWAY_KEY,
      // Allow callers to provide schema overrides when using admin()/instance() outside SvelteKit handle
      ...(cfg?.organizationSchema ? { organizationSchema: cfg.organizationSchema } : {}),
      ...(cfg?.adminSchema ? { adminSchema: cfg.adminSchema } : {})
    });
  },

  // Admin auth helper: auto-config from env
  async admin(cfg?: Partial<AuthConfig>) {
    const instance = auth.instance(cfg);
    return {
      instance,
      createOrganization: instance.createOrganization.bind(instance),
      listOrganizations: instance.listOrganizations.bind(instance),
      getOrganization: instance.getOrganization.bind(instance),
      deleteOrganization: instance.deleteOrganization.bind(instance),
      authenticate: instance.authenticate.bind(instance),
      forOrganization: instance.forOrganization.bind(instance),
      // Direct access to the organization's ORM client (server-only)
      getOrganizationDb: instance.getOrganizationDb.bind(instance),
      // Direct access to the admin ORM client (server-only)
      client: () => instance.getAdminDb()
    };
  },

    // SvelteKit handle helper
    handle(options: CreateAuthHandleOptions = {}) {
        return createAuthHandle(options);
    },

  // Sign-in helpers that auto-resolve organization
  signIn: {
    async magicLink(email: string, options?: { redirectTo?: string; organizationId?: string; instance?: KuratchiAuth }) {
      const instance = options?.instance || auth.instance();
      return instance.signIn.magicLink.send(email, options);
    },
    
    async credentials(email: string, password: string, options?: { organizationId?: string; ipAddress?: string; userAgent?: string; redirectTo?: string; instance?: KuratchiAuth }) {
      const instance = options?.instance || auth.instance();
      return instance.signIn.credentials.authenticate(email, password, options);
    },
    
    oauth: {
      google: {
        startUrl(params: { organizationId: string; redirectTo?: string; instance?: KuratchiAuth }) {
          const instance = params.instance || auth.instance();
          return instance.signIn.oauth.google.startUrl(params);
        }
      }
    }
  }
};
