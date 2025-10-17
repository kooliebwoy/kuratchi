/**
 * Organization plugin - Multi-tenant organization database access
 * Optional plugin for per-organization data isolation
 */

import type { AuthPlugin, PluginContext, SessionContext } from '../core/plugin.js';
import { KuratchiDatabase } from '../../database/index.js';
import type { RequestEvent } from '@sveltejs/kit';

export interface OrganizationPluginOptions {
  /**
   * REQUIRED: Organization database schema
   * Must include tables: users, session, passwordResetTokens, emailVerificationToken, magicLinkTokens
   * See src/lib/schema/organization.ts for reference structure
   */
  organizationSchema: any;
}

export function organizationPlugin(options: OrganizationPluginOptions): AuthPlugin {
  // Validate required schema
  if (!options.organizationSchema) {
    throw new Error(
      '[Organization Plugin] organizationSchema is required. ' +
      'See src/lib/schema/organization.ts for reference structure.'
    );
  }
  
  // Cache for DB service
  let dbService: KuratchiDatabase | null = null;
  
  return {
    name: 'organization',
    priority: 35, // After admin, before auth flows
    
    async onRequest(ctx: PluginContext) {
      if (!ctx.locals.kuratchi) ctx.locals.kuratchi = {};
      
      // Helper to get organization DB client
      ctx.locals.kuratchi.orgDatabaseClient = async (
        orgIdOverride?: string,
        callOptions?: { schema?: any }
      ) => {
        if (typeof window !== 'undefined') {
          throw new Error('[Kuratchi Organization] orgDatabaseClient() is server-only');
        }
        
        const session = ctx.locals.kuratchi.session;
        // Allow superadmin to override active organization for this request
        const superOrgId = ctx.locals.kuratchi?.superadmin?.getActiveOrgId?.();
        const organizationId = orgIdOverride || superOrgId || session?.organizationId;
        
        if (!organizationId) {
          console.warn(
            '[Kuratchi Organization] No organizationId found in session or override. ' +
            'User must be signed in with an organization.'
          );
          return null;
        }
        
        const env = ctx.env;
        const workersSubdomain = env.CLOUDFLARE_WORKERS_SUBDOMAIN;
        const gatewayKey = env.KURATCHI_GATEWAY_KEY;
        
        if (!workersSubdomain) {
          console.warn('[Kuratchi Organization] CLOUDFLARE_WORKERS_SUBDOMAIN not configured');
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
          console.warn('[Kuratchi Organization] Unable to initialize database service');
          return null;
        }
        
        // Get admin DB to lookup organization token
        const getAdminDb = ctx.locals.kuratchi.getAdminDb;
        if (!getAdminDb) {
          console.warn(
            '[Kuratchi Organization] Admin plugin not loaded. ' +
            'Add adminPlugin() before organizationPlugin()'
          );
          return null;
        }
        
        const adminDb = await getAdminDb();
        if (!adminDb) {
          return null;
        }
        
        // Lookup organization database record (using camelCase to match schema)
        const { data: databases } = await adminDb.databases
          .where({ organizationId: organizationId })
          .first();
        
        if (!databases) {
          console.warn(`[Kuratchi Organization] No database found for organization: ${organizationId}`);
          return null;
        }
        
        const databaseName = databases.name;
        const workerName = databases.workerName;
        
        // Get token from dbApiTokens table (query for non-revoked token)
        const { data: tokenRecord } = await adminDb.dbApiTokens
          .where({ databaseId: databases.id, revoked: false })
          .first();
        
        if (!tokenRecord || !tokenRecord.token) {
          console.warn(`[Kuratchi Organization] No valid token found for database: ${databases.id}`);
          return null;
        }
        
        const dbToken = tokenRecord.token;
        
        // Use schema from call options or plugin config
        const schema = callOptions?.schema || options.organizationSchema;
        
        if (!dbService) {
          console.warn('[Kuratchi Organization] DB service not initialized');
          return null;
        }
        
        // Get ORM client (auto-detects D1, DO direct, or HTTP)
        const orgDb = await dbService.ormClient({
          databaseName,
          dbToken,
          gatewayKey: gatewayKey || '',
          schema,
          scriptName: workerName
        });
        
        return orgDb;
      };
      
      // Batteries-included organization operations namespace
      ctx.locals.kuratchi.org = {
        /**
         * Create a new user in the organization database
         */
        createUser: async (userData: { email: string; password?: string; [key: string]: any }, orgIdOverride?: string) => {
          const orgDb = await ctx.locals.kuratchi.orgDatabaseClient(orgIdOverride);
          if (!orgDb) throw new Error('[Org] Organization DB not available');
          
          const userId = crypto.randomUUID();
          const now = new Date().toISOString();
          
          const userRecord = {
            id: userId,
            ...userData,
            created_at: now,
            updated_at: now
          };
          
          await orgDb.users.insert(userRecord);
          
          const res = await orgDb.users.where({ id: userId }).first();
          return res?.data;
        },
        
        /**
         * Get a user by ID
         */
        getUser: async (userId: string, orgIdOverride?: string) => {
          const orgDb = await ctx.locals.kuratchi.orgDatabaseClient(orgIdOverride);
          if (!orgDb) throw new Error('[Org] Organization DB not available');
          
          const res = await orgDb.users.where({ id: userId }).first();
          return res?.data;
        },
        
        /**
         * Get a user by email
         */
        getUserByEmail: async (email: string, orgIdOverride?: string) => {
          const orgDb = await ctx.locals.kuratchi.orgDatabaseClient(orgIdOverride);
          if (!orgDb) throw new Error('[Org] Organization DB not available');
          
          const res = await orgDb.users.where({ email }).first();
          return res?.data;
        },
        
        /**
         * List all users in the organization
         */
        listUsers: async (orgIdOverride?: string) => {
          const orgDb = await ctx.locals.kuratchi.orgDatabaseClient(orgIdOverride);
          if (!orgDb) throw new Error('[Org] Organization DB not available');
          
          const res = await orgDb.users
            .where({ deleted_at: { is: null } })
            .orderBy({ created_at: 'desc' })
            .many();
          return res?.data ?? [];
        },
        
        /**
         * Update a user
         */
        updateUser: async (userId: string, userData: Record<string, any>, orgIdOverride?: string) => {
          const orgDb = await ctx.locals.kuratchi.orgDatabaseClient(orgIdOverride);
          if (!orgDb) throw new Error('[Org] Organization DB not available');
          
          const now = new Date().toISOString();
          await orgDb.users.where({ id: userId }).update({ ...userData, updated_at: now });
          
          const res = await orgDb.users.where({ id: userId }).first();
          return res?.data;
        },
        
        /**
         * Delete a user (soft delete)
         */
        deleteUser: async (userId: string, orgIdOverride?: string) => {
          const orgDb = await ctx.locals.kuratchi.orgDatabaseClient(orgIdOverride);
          if (!orgDb) throw new Error('[Org] Organization DB not available');
          
          const now = new Date().toISOString();
          await orgDb.users.where({ id: userId }).update({ deleted_at: now });
          
          return { success: true };
        },
        
        /**
         * Create a role
         */
        createRole: async (roleData: { name: string; permissions?: string[]; [key: string]: any }, orgIdOverride?: string) => {
          const orgDb = await ctx.locals.kuratchi.orgDatabaseClient(orgIdOverride);
          if (!orgDb) throw new Error('[Org] Organization DB not available');
          
          if (!orgDb.roles) {
            throw new Error('[Org] Roles table not found in organization schema');
          }
          
          const roleId = crypto.randomUUID();
          const now = new Date().toISOString();
          
          await orgDb.roles.insert({
            id: roleId,
            ...roleData,
            created_at: now,
            updated_at: now
          });
          
          const res = await orgDb.roles.where({ id: roleId }).first();
          return res?.data;
        }
      };
    },
    
    async onSession(ctx: SessionContext) {
      // Could enrich session with organization data here if needed
    }
  };
}
