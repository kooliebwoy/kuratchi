import { KuratchiD1 } from '../d1/index.js';
import { AuthService } from './index.js';
import { adminSchema } from './adminSchema.js';
import { organizationSchema } from './organizationSchema.js';
import { validateAdminSchema, validateOrganizationSchema } from './schemaValidator.js'
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
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
    adminDatabaseName: string;
    adminDatabaseApiToken: string;
    adminApiToken: string; // API token for accessing tenant databases
}

export class KuratchiAuth {
    private kuratchiD1: KuratchiD1;
    private adminDb: DrizzleD1Database<typeof adminSchema>;
    private organizationServices: Map<string, AuthService>;
    private config: AuthConfig;
    
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
        
        // Initialize admin DB client (Drizzle over D1) for admin operations
        const adminClient = this.kuratchiD1.getClient({
            databaseName: config.adminDatabaseName,
            apiToken: config.adminDatabaseApiToken
        });
        this.adminDb = drizzle(adminClient as any, { schema: adminSchema });
        // Validate admin DB contract
        void validateAdminSchema(adminClient);
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
    
    /**
     * Get or create AuthService for a specific organization
     */
    private async getOrganizationAuthService(organizationId: string, organizationApiToken: string): Promise<AuthService> {
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

            // Get client for organization database
            const organizationClient = this.kuratchiD1.getClient({
                databaseName,
                apiToken: organizationApiToken
            });
            
            // Validate organization DB contract
            await validateOrganizationSchema(organizationClient);

            // Get Drizzle proxy with organization schema
            const drizzleProxy = this.kuratchiD1.getDrizzleClient({
                databaseName,
                apiToken: organizationApiToken
            });
            
            const drizzleDB = drizzle(drizzleProxy as any, { schema: organizationSchema });
            
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
        const [result] = await this.adminDb.insert(adminSchema.Organizations)
            .values({
                ...data,
                id: crypto.randomUUID()
            })
            .returning();
        return result ?? null;
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
        
        // Use the admin API token for now - in production this should be per-organization
        // TODO: Implement proper per-organization API token management
        const tenantApiToken = this.config.adminApiToken;
        
        const orgAuth = await this.getOrganizationAuthService(mapping.organizationId, tenantApiToken);
        return orgAuth.createAuthSession(email, password);
    }

    /**
     * Return an organization-scoped AuthService without duplicating methods.
     * Usage: const auth = await kuratchi.auth.forOrganization(organizationId); await auth.createUser(...)
     */
    async forOrganization(
        organizationId: string,
        options?: { apiToken?: string }
    ): Promise<AuthService> {
        const token = options?.apiToken || this.config.adminApiToken;
        return this.getOrganizationAuthService(organizationId, token);
    }
}
