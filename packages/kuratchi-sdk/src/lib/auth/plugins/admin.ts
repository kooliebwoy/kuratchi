/**
 * Admin plugin - Kuratchi admin database management
 * Optional plugin for multi-tenant organization management
 */

import type { AuthPlugin, PluginContext } from '../core/plugin.js';
import { KuratchiDatabase } from '../../database/core/database.js';
import { createSignedDbToken } from '../../utils/token.js';
import { hashPassword } from '../../utils/auth.js';

export interface AdminPluginOptions {
  /**
   * Custom function to get admin DB client
   * If not provided, will auto-create from env variables
   */
  getAdminDb?: (event: any) => Promise<any> | any;
  
  /**
   * REQUIRED: Admin database schema
   * Must include tables: organizations, databases, dbApiTokens, organizationUsers
   * See src/lib/schema/admin.example.ts for reference structure
   */
  adminSchema: any;
  
  /**
   * OPTIONAL: Organization database schema for provisioning new org databases
   * If not provided, organization databases won't be auto-provisioned
   */
  organizationSchema?: any;
}

export function adminPlugin(options: AdminPluginOptions): AuthPlugin {
  // Validate required schema
  if (!options.adminSchema) {
    throw new Error(
      '[Admin Plugin] adminSchema is required. ' +
      'See src/lib/schema/admin.ts for reference structure.'
    );
  }
  
  // Lazy admin DB cache
  let adminDbClient: any = null;
  let dbService: KuratchiDatabase | null = null;
  
  return {
    name: 'admin',
    priority: 30, // After session, before most auth flows
    
    async onRequest(ctx: PluginContext) {
      if (!ctx.locals.kuratchi) ctx.locals.kuratchi = {};
      
      // Helper to get admin DB (lazy initialization)
      ctx.locals.kuratchi.getAdminDb = async () => {
        if (adminDbClient) return adminDbClient;
        
        // Use custom getter if provided
        if (options.getAdminDb) {
          adminDbClient = await options.getAdminDb(ctx.event);
          return adminDbClient;
        }
        
        // Auto-create from env
        const env = ctx.env;
        const adminDbName = env.KURATCHI_ADMIN_DB_NAME || 'kuratchi-admin';
        const adminDbToken = env.KURATCHI_ADMIN_DB_TOKEN;
        const workersSubdomain = env.CLOUDFLARE_WORKERS_SUBDOMAIN;
        const gatewayKey = env.KURATCHI_GATEWAY_KEY;
        
        // Validate required config for HTTP fallback
        if (!adminDbToken || !workersSubdomain || !gatewayKey) {
          console.warn(
            '[Kuratchi Admin] Admin DB not configured. ' +
            'Set KURATCHI_ADMIN_DB_TOKEN, CLOUDFLARE_WORKERS_SUBDOMAIN, and KURATCHI_GATEWAY_KEY, ' +
            'or add ADMIN_DB binding to wrangler.toml'
          );
          return null;
        }
        
        // Initialize DB service if needed
        if (!dbService && env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ACCOUNT_ID) {
          dbService = new KuratchiDatabase({
            apiToken: env.CLOUDFLARE_API_TOKEN,
            accountId: env.CLOUDFLARE_ACCOUNT_ID,
            workersSubdomain
          });
        }
        
        if (!dbService) {
          console.warn('[Kuratchi Admin] Unable to initialize database service');
          return null;
        }
        
        // Get ORM client (auto-detects D1, DO direct, or HTTP)
        adminDbClient = await dbService.ormClient({
          databaseName: adminDbName,
          dbToken: adminDbToken,
          gatewayKey,
          schema: options.adminSchema
        });
        
        return adminDbClient;
      };
      
      // Batteries-included admin operations namespace
      ctx.locals.kuratchi = ctx.locals.kuratchi || {} as any;
      ctx.locals.kuratchi.auth = ctx.locals.kuratchi.auth || {} as any;
      
      ctx.locals.kuratchi.auth.admin = {
        /**
         * List all organizations
         */
        listOrganizations: async () => {
          const adminDb = await ctx.locals.kuratchi.getAdminDb();
          if (!adminDb) throw new Error('[Admin] Admin DB not configured');
          
          // Query for non-deleted orgs using isNullish (handles both null and undefined)
          const res = await adminDb.organizations
            .where({ deleted_at: { isNullish: true } })
            .orderBy({ created_at: 'desc' })
            .many();
          return res?.data ?? [];
        },
        
        /**
         * Get a single organization by ID
         */
        getOrganization: async (id: string) => {
          const adminDb = await ctx.locals.kuratchi.getAdminDb();
          if (!adminDb) throw new Error('[Admin] Admin DB not configured');
          
          // Query for non-deleted org using whereAny for proper AND + OR logic
          const res = await adminDb.organizations
            .where({ id })
            .whereAny([
              { deleted_at: { is: null } },
              { deleted_at: { isNullish: true } }
            ])
            .first();
          return res?.data;
        },
        
        /**
         * Create a new organization with dedicated database.
         * Creates the first user in the org database and maps email -> organizationId.
         * 
         * @param orgData.organizationName - Organization name (required)
         * @param orgData.email - First user's email (required)
         * @param orgData.userName - First user's name (optional)
         * @param orgData.password - First user's password (optional, for credentials auth)
         * @param [key: string] - Any additional organization fields from your schema
         */
        createOrganization: async (orgData: {
          organizationName: string;
          email: string;
          userName?: string;
          password?: string;
          [key: string]: any;  // Allow any additional fields from schema
        }) => {
          const adminDb = await ctx.locals.kuratchi.getAdminDb();
          if (!adminDb) throw new Error('[Admin] Admin DB not configured');
          
          const env = ctx.env;
          const gatewayKey = env.KURATCHI_GATEWAY_KEY;
          const workersSubdomain = env.CLOUDFLARE_WORKERS_SUBDOMAIN;
          const accountId = env.CLOUDFLARE_ACCOUNT_ID;
          const apiToken = env.CLOUDFLARE_API_TOKEN;
          
          if (!gatewayKey) {
            throw new Error('[Admin] KURATCHI_GATEWAY_KEY not configured');
          }
          
          // Generate IDs using Web Crypto
          const organizationId = crypto.randomUUID();
          const databaseId = crypto.randomUUID();
          // Generate database name from organizationName (sanitized) or use UUID
          const sanitizedName = orgData.organizationName
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .substring(0, 32);
          const databaseName = `org-${sanitizedName}-${crypto.randomUUID().substring(0, 8)}`;
          const now = new Date().toISOString();
          
          // 1. Create organization record
          // ORM now handles schema validation automatically
          const insertResult = await adminDb.organizations.insert({
            ...orgData,                    // Spread all user fields
            id: organizationId,            // Override with generated ID
            created_at: now,               // System timestamp
            updated_at: now,               // System timestamp
            deleted_at: null               // Explicit null for soft-delete queries
          });
          
          if (!insertResult?.success) {
            const errorMsg = insertResult?.error || 'Unknown error';
            throw new Error(`[Admin] Failed to insert organization: ${errorMsg}`);
          }
          
          // 2. Provision database for organization
          let dbToken: string;
          
          // Try to provision via Durable Objects if credentials available
          if (workersSubdomain && accountId && apiToken) {
            try {
              const dbService = new KuratchiDatabase({
                workersSubdomain,
                accountId,
                apiToken,
                scriptName: env.KURATCHI_DO_SCRIPT_NAME || 'kuratchi-do-internal'
              });
              
              const result = await dbService.createDatabase({
                databaseName,
                gatewayKey,
                migrate: true,
                schema: options.organizationSchema
              });
              
              dbToken = result.token;
            } catch (error: any) {
              console.error('[Admin] Failed to provision database:', error.message);
              // Fallback: generate token manually
              dbToken = await createSignedDbToken(databaseName, gatewayKey, 365 * 24 * 60 * 60 * 1000);
            }
          } else {
            // No DO credentials, generate token manually
            dbToken = await createSignedDbToken(databaseName, gatewayKey, 365 * 24 * 60 * 60 * 1000);
          }
          
          // 3. Store database record in admin DB (matches schema: id, name, dbuuid, organizationId)
          await adminDb.databases.insert({
            id: databaseId,
            name: databaseName,
            dbuuid: databaseName, // Use name as UUID for now
            organizationId: organizationId,
            isActive: true,
            isArchived: false,
            schemaVersion: 1,
            needsSchemaUpdate: false,
            created_at: now,
            updated_at: now
          });
          
          // 4. Store database token in dbApiTokens table
          const tokenId = crypto.randomUUID();
          await adminDb.dbApiTokens.insert({
            id: tokenId,
            token: dbToken,
            name: `${orgData.organizationName} Database Token`,
            databaseId: databaseId,
            expires: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 year
            revoked: false,
            created_at: now,
            updated_at: now
          });
          
          // 5. Create first user in organization database
          const getOrgDb = ctx.locals.kuratchi?.orgDatabaseClient;
          if (!getOrgDb) {
            throw new Error('[Admin] Organization database client not configured');
          }
          
          const orgDb = await getOrgDb(organizationId);
          if (!orgDb) {
            throw new Error('[Admin] Failed to get organization database client');
          }
          
          const userId = crypto.randomUUID();
          let password_hash: string | undefined;
          
          // Hash password if provided (for credentials auth)
          // Use auth secret as pepper for consistency with credentials plugin verification
          if (orgData.password) {
            const authSecret = env.KURATCHI_AUTH_SECRET;
            password_hash = await hashPassword(orgData.password, undefined, authSecret);
          }
          
          // Create first user in organization database
          await orgDb.users.insert({
            id: userId,
            email: orgData.email,
            name: orgData.userName || orgData.organizationName,
            password_hash,
            role: 'owner',
            created_at: now,
            updated_at: now,
            deleted_at: null
          });
          
          // 6. Create organizationUsers mapping (email -> organizationId for auth lookup)
          await adminDb.organizationUsers.insert({
            id: crypto.randomUUID(),
            organizationId: organizationId,
            email: orgData.email,
            created_at: now,
            updated_at: now,
            deleted_at: null
          });
          
          return {
            success: true,
            organization: {
              id: organizationId,
              name: orgData.organizationName,
              email: orgData.email
            },
            database: {
              id: databaseId,
              name: databaseName,
              token: dbToken
            },
            user: {
              id: userId,
              email: orgData.email,
              name: orgData.userName || orgData.organizationName,
              role: 'owner'
            }
          };
        },
        
        /**
         * Delete an organization (soft delete)
         */
        deleteOrganization: async (organizationId: string) => {
          const adminDb = await ctx.locals.kuratchi.getAdminDb();
          if (!adminDb) throw new Error('[Admin] Admin DB not configured');
          
          const now = new Date().toISOString();
          
          // Soft delete organization
          await adminDb.organizations
            .where({ id: organizationId })
            .update({ deleted_at: now });
          
          // Soft delete related databases
          await adminDb.databases
            .where({ organizationId: organizationId })
            .updateMany({ deleted_at: now });
          
          // Soft delete related tokens
          const dbsRes = await adminDb.databases
            .where({ organizationId: organizationId })
            .many();
          const dbIds = (dbsRes?.data ?? []).map((db: any) => db.id);
          
          for (const dbId of dbIds) {
            await adminDb.dbApiTokens
              .where({ databaseId: dbId })
              .updateMany({ deleted_at: now });
          }
          
          return { success: true };
        },
        
        /**
         * Refresh database token for an organization
         * Generates new token and updates it in admin DB
         */
        refreshDatabaseToken: async (organizationId: string) => {
          const adminDb = await ctx.locals.kuratchi.getAdminDb();
          if (!adminDb) throw new Error('[Admin] Admin DB not configured');
          
          const env = ctx.env;
          const gatewayKey = env.KURATCHI_GATEWAY_KEY;
          
          if (!gatewayKey) {
            throw new Error('[Admin] KURATCHI_GATEWAY_KEY not configured');
          }
          
          // Get database record (non-deleted) using whereAny
          const { data: db } = await adminDb.databases
            .where({ organizationId: organizationId })
            .whereAny([
              { deleted_at: { is: null } },
              { deleted_at: { isNullish: true } }
            ])
            .first();
          
          if (!db) {
            throw new Error(`[Admin] No database found for organization: ${organizationId}`);
          }
          
          // Generate new token with 1-year TTL (renewable)
          const newToken = await createSignedDbToken(
            db.name, 
            gatewayKey,
            365 * 24 * 60 * 60 * 1000 // 1 year
          );
          
          // Update token in dbApiTokens table
          await adminDb.dbApiTokens
            .where({ databaseId: db.id, revoked: false })
            .update({ 
              token: newToken,
              expires: Date.now() + (365 * 24 * 60 * 60 * 1000),
              updated_at: new Date().toISOString()
            });
          
          return { 
            success: true, 
            databaseName: db.name,
            organizationId 
          };
        }
      };
    }
  };
}
