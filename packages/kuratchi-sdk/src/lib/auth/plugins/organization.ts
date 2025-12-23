/**
 * Organization plugin - Multi-tenant organization database access
 * Uses DatabaseContext abstraction for adapter-agnostic database access.
 */

import type { AuthPlugin, PluginContext, SessionContext } from '../core/plugin.js';
import type { PluginAdapterConfig } from '../../adapters/types.js';

export interface OrganizationPluginOptions {
  /**
   * REQUIRED: Organization database schema
   * Must include tables: users, session, passwordResetTokens, emailVerificationToken, magicLinkTokens
   * See src/lib/schema/organization.ts for reference structure
   */
  organizationSchema: any;
  
  /**
   * OPTIONAL: Explicit adapter configuration for organization databases
   * Use rpcAdapter({ binding: 'KURATCHI_DATABASE' }) or d1Adapter({ binding: 'ORG_DB' })
   * If not provided, uses the global adapter from kuratchi() config
   * 
   * @example
   * ```ts
   * organizationPlugin({
   *   organizationSchema,
   *   adapter: rpcAdapter({ binding: 'KURATCHI_DATABASE' })
   * })
   * ```
   */
  adapter?: PluginAdapterConfig;
  
  /**
   * Skip schema synchronization on database access (default: false)
   * Set to true in production after initial deployment to improve performance
   */
  skipMigrations?: boolean;
}

export function organizationPlugin(options: OrganizationPluginOptions): AuthPlugin {
  // Validate required schema
  if (!options.organizationSchema) {
    throw new Error(
      '[Organization Plugin] organizationSchema is required. ' +
      'See src/lib/schema/organization.ts for reference structure.'
    );
  }
  
  return {
    name: 'organization',
    priority: 35, // After admin, before auth flows
    
    async onRequest(ctx: PluginContext) {
      if (!ctx.locals.kuratchi) ctx.locals.kuratchi = {};
      
      // Request-scoped ORM client cache
      const ormClientCache = new Map<string, any>();
      
      // Get DatabaseContext from plugin context
      const dbContext = ctx.dbContext;
      if (!dbContext) {
        throw new Error('[Organization Plugin] DatabaseContext not available. Ensure kuratchi() is configured.');
      }
      
      // Helper to get organization DB client
      ctx.locals.kuratchi.orgDatabaseClient = async (
        orgIdOverride?: string,
        callOptions?: { schema?: any; skipMigrations?: boolean }
      ) => {
        if (typeof window !== 'undefined') {
          throw new Error('[Organization] orgDatabaseClient() is server-only');
        }
        
        const session = ctx.locals.kuratchi.session;
        const superOrgId = ctx.locals.kuratchi?.superadmin?.getActiveOrgId?.();
        const organizationId = orgIdOverride || superOrgId || session?.organizationId;
        
        if (!organizationId) {
          console.warn('[Organization] No organizationId found in session or override.');
          return null;
        }
        
        // Check request-level cache first
        const cacheKey = `orm:${organizationId}`;
        if (ormClientCache.has(cacheKey)) {
          return ormClientCache.get(cacheKey);
        }
        
        const schema = callOptions?.schema || options.organizationSchema;
        const skipMigrations = callOptions?.skipMigrations ?? options.skipMigrations ?? false;
        
        // Use DatabaseContext (handles RPC vs HTTP internally)
        const orgDb = await dbContext.getOrgDatabase({
          organizationId,
          schema,
          skipMigrations
        });
        
        if (orgDb) {
          ormClientCache.set(cacheKey, orgDb);
        }
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
