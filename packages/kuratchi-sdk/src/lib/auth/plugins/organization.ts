/**
 * Organization plugin - Multi-tenant organization database access
 * Optional plugin for per-organization data isolation
 */

import type { AuthPlugin, PluginContext, SessionContext } from '../core/plugin.js';
import { KuratchiDatabase } from '../../database/index.js';
import type { RequestEvent } from '@sveltejs/kit';
import { getCache, getRequestCache, CacheManager } from '../../cache/index.js';

export interface OrganizationPluginOptions {
  /**
   * REQUIRED: Organization database schema
   * Must include tables: users, session, passwordResetTokens, emailVerificationToken, magicLinkTokens
   * See src/lib/schema/organization.ts for reference structure
   */
  organizationSchema: any;
  
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
  
  // Cache for DB service (singleton across requests in same worker)
  let dbService: KuratchiDatabase | null = null;
  
  return {
    name: 'organization',
    priority: 35, // After admin, before auth flows
    
    async onRequest(ctx: PluginContext) {
      if (!ctx.locals.kuratchi) ctx.locals.kuratchi = {};
      
      // Initialize cache with platform (for KV access)
      const cache = getCache();
      const platform = ctx.event.platform as any;
      cache?.initializeKV(platform);
      
      // Get request-scoped cache for this request
      const requestCache = getRequestCache(ctx.locals);
      
      // Cache for ORM clients within this request
      const ormClientCache = new Map<string, any>();
      
      // Helper to get organization DB client
      ctx.locals.kuratchi.orgDatabaseClient = async (
        orgIdOverride?: string,
        callOptions?: { schema?: any; skipMigrations?: boolean }
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
        
        // Check request-level ORM client cache first (fastest)
        const ormCacheKey = `orm:${organizationId}`;
        if (ormClientCache.has(ormCacheKey)) {
          return ormClientCache.get(ormCacheKey);
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
        
        let databaseName: string;
        let workerName: string;
        let dbToken: string;
        
        // Try to get database metadata from cache
        const cachedMeta = cache 
          ? await cache.getOrgDatabaseMeta(organizationId, requestCache)
          : null;
        
        if (cachedMeta) {
          // Cache HIT - use cached metadata
          databaseName = cachedMeta.databaseName;
          workerName = cachedMeta.workerName;
          dbToken = cachedMeta.token;
          
          if (cache?.getConfig().debug) {
            console.log(`[Kuratchi Organization] Cache HIT for org: ${organizationId}`);
          }
        } else {
          // Cache MISS - lookup from admin DB
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
          
          databaseName = databases.name;
          workerName = databases.workerName;
          
          // Get token from dbApiTokens table (query for non-revoked token)
          const { data: tokenRecord } = await adminDb.dbApiTokens
            .where({ databaseId: databases.id, revoked: false })
            .first();
          
          if (!tokenRecord || !tokenRecord.token) {
            console.warn(`[Kuratchi Organization] No valid token found for database: ${databases.id}`);
            return null;
          }
          
          dbToken = tokenRecord.token;
          
          // Cache the metadata for future requests
          if (cache) {
            await cache.setOrgDatabaseMeta(organizationId, {
              databaseName,
              workerName,
              token: dbToken
            }, requestCache);
          }
        }
        
        // Use schema from call options or plugin config
        const schema = callOptions?.schema || options.organizationSchema;
        const skipMigrations = callOptions?.skipMigrations ?? options.skipMigrations ?? false;
        
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
          scriptName: workerName,
          skipMigrations
        });
        
        // Cache the ORM client for this request
        ormClientCache.set(ormCacheKey, orgDb);
        
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
