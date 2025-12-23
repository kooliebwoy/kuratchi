/**
 * Admin plugin - Kuratchi admin database management + superadmin capabilities
 * Multi-tenant organization management with superadmin role detection
 * 
 * Uses DatabaseContext abstraction for adapter-agnostic database access.
 */

import type { AuthPlugin, PluginContext, SessionContext } from '../core/plugin.js';
import type { RouteGuard } from '../utils/types.js';
import { hashPassword } from '../../utils/auth.js';
import { createDatabaseContext, type DatabaseContext } from '../../adapters/database-context.js';
import type { PluginAdapterConfig } from '../../adapters/types.js';

export interface AdminPluginOptions {
  /**
   * REQUIRED: Admin database schema
   * Must include tables: organizations, databases, dbApiTokens, organizationUsers, users
   * See src/lib/schema/admin.example.ts for reference structure
   */
  adminSchema: any;
  
  /**
   * OPTIONAL: Organization database schema for provisioning new org databases
   * If not provided, organization databases won't be auto-provisioned
   */
  organizationSchema?: any;
  
  /**
   * OPTIONAL: Explicit adapter configuration for admin database
   * Use d1Adapter({ binding: 'ADMIN_DB' }) or rpcAdapter({ binding: 'BACKEND' })
   * If not provided, falls back to adminDatabase binding name
   * 
   * @example
   * ```ts
   * adminPlugin({
   *   adminSchema,
   *   adapter: d1Adapter({ binding: 'ADMIN_DB' })
   * })
   * ```
   */
  adapter?: PluginAdapterConfig;
  
  /**
   * @deprecated Use adapter: d1Adapter({ binding: 'ADMIN_DB' }) instead
   * D1 database binding name - kept for backward compatibility
   */
  adminDatabase?: string;
  
  /**
   * OPTIONAL: Custom superadmin detection
   * Default: checks if admin users table role === 'superadmin'
   */
  isSuperadmin?: (ctx: SessionContext, adminDb: any) => Promise<boolean> | boolean;
  
  /**
   * OPTIONAL: Cookie name for org override (default: 'kuratchi_super_org')
   */
  superadminCookieName?: string;
  
  /**
   * OPTIONAL: Seed key for creating superadmins (reads from KURATCHI_SUPERADMIN_KEY env by default)
   */
  seedKey?: string;
  
  /**
   * OPTIONAL: Skip schema migrations for admin database (default: false)
   * Set to true if you manage admin schema migrations separately
   */
  skipMigrations?: boolean;
}

export function adminPlugin(options: AdminPluginOptions): AuthPlugin {
  // Validate required schema
  if (!options.adminSchema) {
    throw new Error(
      '[Admin Plugin] adminSchema is required. ' +
      'See src/lib/schema/admin.ts for reference structure.'
    );
  }
  
  // Lazy admin DB cache (per-worker singleton)
  let adminDbClient: any = null;
  
  return {
    name: 'admin',
    priority: 30, // After session, before most auth flows
    
    async onRequest(ctx: PluginContext) {
      if (!ctx.locals.kuratchi) ctx.locals.kuratchi = {};
      
      // Initialize superadmin state (will be populated in onSession)
      const cookieName = options.superadminCookieName || 'kuratchi_super_org';
      const existing = ctx.event.cookies.get(cookieName) || null;
      
      ctx.locals.kuratchi.superadmin = {
        __isSuperadmin: false,
        __orgOverride: existing,
        // Read-only helpers
        isSuperadmin: () => !!ctx.locals.kuratchi.superadmin.__isSuperadmin,
        getActiveOrgId: () => ctx.locals.kuratchi.superadmin.__orgOverride || ctx.locals.session?.organizationId || null,
        // Mutators (per-request only)
        setOrganization: (orgId: string | null, persist: boolean = true) => {
          ctx.locals.kuratchi.superadmin.__orgOverride = orgId;
          if (persist) {
            if (orgId) {
              const isHttps = new URL(ctx.event.request.url).protocol === 'https:';
              ctx.event.cookies.set(cookieName, orgId, {
                path: '/', httpOnly: true, sameSite: 'lax', secure: isHttps
              });
            } else {
              ctx.event.cookies.delete(cookieName, { path: '/' });
            }
          }
        },
        clearOrganization: () => {
          ctx.locals.kuratchi.superadmin.__orgOverride = null;
          ctx.event.cookies.delete(cookieName, { path: '/' });
        }
      };
      
      // Helper to get admin DB (lazy initialization)
      ctx.locals.kuratchi.getAdminDb = async () => {
        if (adminDbClient) return adminDbClient;
        
        const platform = (ctx.event as any).platform;
        
        // Determine binding name from explicit adapter or legacy adminDatabase option
        const bindingName = options.adapter?.type !== 'http' 
          ? (options.adapter as any)?.binding || options.adminDatabase
          : options.adminDatabase;
        
        if (!bindingName) {
          throw new Error('[AdminPlugin] adapter binding or adminDatabase is required');
        }
        
        const adapterType = options.adapter?.type || 'd1';
        console.log(`[AdminPlugin] Using ${adapterType} adapter with binding '${bindingName}'`);
        
        // Create a DatabaseContext for this plugin's adapter
        const adminDbContext = createDatabaseContext({
          adapter: adapterType,
          bindingName,
          env: platform?.env
        });
        
        // Use DatabaseContext to get admin database - adapter handles all the details
        adminDbClient = await adminDbContext.getAdminDatabase({
          schema: options.adminSchema,
          skipMigrations: options.skipMigrations ?? false
        });
        
        return adminDbClient;
      };
      
      // Wire admin DB getter into DatabaseContext for org database name resolution
      if (ctx.dbContext) {
        ctx.dbContext.setAdminDbGetter(ctx.locals.kuratchi.getAdminDb);
      }
      
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
          [key: string]: any;
        }) => {
          const adminDb = await ctx.locals.kuratchi.getAdminDb();
          if (!adminDb) throw new Error('[Admin] Admin DB not configured');
          
          const dbContext = ctx.dbContext;
          if (!dbContext) {
            throw new Error('[Admin] DatabaseContext not available. Ensure kuratchi() is configured with database settings.');
          }
          
          // Generate IDs
          const organizationId = crypto.randomUUID();
          const databaseId = crypto.randomUUID();
          const sanitizedName = orgData.organizationName
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .substring(0, 32);
          const databaseName = `org-${sanitizedName}-${crypto.randomUUID().substring(0, 8)}`;
          const now = new Date().toISOString();
          
          // 1. Create organization record
          const insertResult = await adminDb.organizations.insert({
            ...orgData,
            id: organizationId,
            created_at: now,
            updated_at: now,
            deleted_at: null
          });
          
          if (!insertResult?.success) {
            throw new Error(`[Admin] Failed to insert organization: ${insertResult?.error || 'Unknown error'}`);
          }
          
          // 2. Create organization database via DatabaseContext
          console.log('[Admin] Creating org database via DatabaseContext:', databaseName);
          const createResult = await dbContext.createOrgDatabase({
            organizationId,
            organizationName: orgData.organizationName,
            schema: options.organizationSchema,
            migrate: true
          });
          console.log('[Admin] ✓ Org database created');
          
          // 3. Store database record in admin DB
          await adminDb.databases.insert({
            id: databaseId,
            name: createResult.databaseName,
            dbuuid: null,
            workerName: null,
            r2BucketName: null,
            r2Binding: null,
            r2StorageDomain: null,
            organizationId: organizationId,
            isPrimary: true,
            isActive: true,
            isArchived: false,
            schemaVersion: 1,
            needsSchemaUpdate: false,
            created_at: now,
            updated_at: now
          });
          
          // 4. Get org database client and create first user
          const orgDb = await dbContext.getOrgDatabase({
            organizationId,
            schema: options.organizationSchema,
            skipMigrations: true // Already migrated during creation
          });
          
          if (!orgDb) {
            throw new Error('[Admin] Failed to get organization database client');
          }
          
          const userId = crypto.randomUUID();
          let password_hash: string | undefined;
          
          if (orgData.password) {
            const authSecret = ctx.env.KURATCHI_AUTH_SECRET;
            password_hash = await hashPassword(orgData.password, undefined, authSecret);
          }
          
          console.log('[Admin] Creating first user in org DB:', { userId, email: orgData.email });
          const userInsertResult = await orgDb.users.insert({
            id: userId,
            email: orgData.email,
            name: orgData.userName || orgData.organizationName,
            password_hash,
            role: 'owner',
            created_at: now,
            updated_at: now,
            deleted_at: null
          });
          
          if (!userInsertResult?.success) {
            throw new Error(`[Admin] Failed to create first user: ${userInsertResult?.error || 'Unknown error'}`);
          }
          console.log('[Admin] ✓ First user created');
          
          // 5. Create organizationUsers mapping
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
              name: createResult.databaseName
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
          
          // Get database records before soft deleting
          const dbsRes = await adminDb.databases
            .where({ organizationId: organizationId, deleted_at: { isNullish: true } })
            .many();
          const databases = dbsRes?.data ?? [];
          
          // Soft delete organization
          await adminDb.organizations
            .where({ id: organizationId })
            .update({ deleted_at: now });
          
          // Soft delete related databases
          await adminDb.databases
            .where({ organizationId: organizationId })
            .updateMany({ deleted_at: now });
          
          // Soft delete related tokens
          const dbIds = databases.map((db: any) => db.id);
          for (const dbId of dbIds) {
            await adminDb.dbApiTokens
              .where({ databaseId: dbId })
              .updateMany({ deleted_at: now });
          }
          
          // Soft delete organizationUsers mappings
          await adminDb.organizationUsers
            .where({ organizationId: organizationId })
            .updateMany({ deleted_at: now });
          
          return { success: true };
        },
        
        
        /**
         * Attach a database to an organization
         * Allows linking system-level databases to specific organizations
         */
        attachDatabase: async (params: {
          databaseId: string;
          organizationId: string;
        }) => {
          const adminDb = await ctx.locals.kuratchi.getAdminDb();
          if (!adminDb) throw new Error('[Admin] Admin DB not configured');
          
          const { databaseId, organizationId } = params;
          
          // Verify organization exists
          const { data: org } = await adminDb.organizations
            .where({ id: organizationId })
            .first();
          
          if (!org) {
            throw new Error(`[Admin] Organization not found: ${organizationId}`);
          }
          
          // Verify database exists
          const { data: db } = await adminDb.databases
            .where({ id: databaseId })
            .first();
          
          if (!db) {
            throw new Error(`[Admin] Database not found: ${databaseId}`);
          }
          
          // Attach database to organization
          const result = await adminDb.databases
            .where({ id: databaseId })
            .update({
              organizationId: organizationId,
              updated_at: new Date().toISOString()
            });
          
          if (!result.success) {
            throw new Error(`[Admin] Failed to attach database: ${result.error}`);
          }
          
          return {
            success: true,
            databaseId,
            organizationId
          };
        },
        
        /**
         * Detach a database from its organization
         * Makes it a system-level database (organizationId = null)
         */
        detachDatabase: async (databaseId: string) => {
          const adminDb = await ctx.locals.kuratchi.getAdminDb();
          if (!adminDb) throw new Error('[Admin] Admin DB not configured');
          
          // Verify database exists
          const { data: db } = await adminDb.databases
            .where({ id: databaseId })
            .first();
          
          if (!db) {
            throw new Error(`[Admin] Database not found: ${databaseId}`);
          }
          
          // Detach database (set organizationId to null)
          const result = await adminDb.databases
            .where({ id: databaseId })
            .update({
              organizationId: null,
              updated_at: new Date().toISOString()
            });
          
          if (!result.success) {
            throw new Error(`[Admin] Failed to detach database: ${result.error}`);
          }
          
          return {
            success: true,
            databaseId,
            previousOrganizationId: db.organizationId
          };
        },
        
        /**
         * Create a superadmin user with their own organization
         * A superadmin is an organization owner who also exists in the admin DB with role='superadmin'
         * 
         * @param orgData.email - User's email (required)
         * @param orgData.password - User's password (required)
         * @param orgData.name - User's name (required)
         * @param orgData.organizationName - Organization name (optional, defaults to "[name]'s Workspace")
         */
        createSuperadmin: async (orgData: {
          email: string;
          password: string;
          name: string;
          organizationName?: string;
        }) => {
          const { email, password, name, organizationName } = orgData;
          const adminDb = await ctx.locals.kuratchi.getAdminDb();
          if (!adminDb) throw new Error('[Admin] Admin DB not configured');
          
          const now = new Date().toISOString();
          const userId = crypto.randomUUID();
          const orgName = organizationName || `${name}'s Workspace`;
          
          console.log('[createSuperadmin] Starting for email:', email);
          
          try {
            // Check if user already exists in admin DB
            const { data: existingUser } = await adminDb.users
              .where({ email })
              .first();
            
            if (existingUser) {
              throw new Error(`User with email ${email} already exists in admin database`);
            }
            
            // 1. Create organization (handles database provisioning, org DB user creation, etc.)
            console.log('[createSuperadmin] Calling createOrganization...');
            const orgResult = await ctx.locals.kuratchi.auth.admin.createOrganization({
              organizationName: orgName,
              email,
              userName: name,
              password,
              status: 'active'
            });
            
            console.log('[createSuperadmin] ✓ Organization created:', orgResult.organization.id);
            
            // 2. Create user in admin DB with role: superadmin
            console.log('[createSuperadmin] Creating user in admin DB with role: superadmin');
            const authSecret = ctx.env.KURATCHI_AUTH_SECRET;
            const passwordHash = await hashPassword(password, undefined, authSecret);
            
            await adminDb.users.insert({
              id: userId,
              email,
              name,
              password_hash: passwordHash,
              role: 'superadmin',
              status: true,
              emailVerified: Date.now(),
              created_at: now,
              updated_at: now,
              deleted_at: null
            });
            
            console.log('[createSuperadmin] ✓ User created in admin DB');
            
            return {
              success: true,
              userId,
              organizationId: orgResult.organization.id,
              message: `Superadmin ${email} created with organization ${orgName}`
            };
          } catch (error: any) {
            console.error('[createSuperadmin] Error:', error);
            throw new Error(`Failed to create superadmin: ${error.message}`);
          }
        }
      };
    },
    
    async onSession(ctx: SessionContext) {
      const locals = ctx.locals as any;
      const getAdminDb = locals.kuratchi?.getAdminDb;
      if (!getAdminDb) return;

      let isSuper = false;
      try {
        const adminDb = await getAdminDb();
        if (!adminDb) return;

        if (options.isSuperadmin) {
          // Custom superadmin detection
          isSuper = !!(await options.isSuperadmin(ctx, adminDb));
        } else if (ctx.session?.email) {
          // Default detection: check admin users table for role === 'superadmin'
          // Superadmins exist in admin DB with role='superadmin' AND have their own organization
          const { data: adminUser } = await adminDb.users
            .where({ email: ctx.session.email })
            .first();

          isSuper = adminUser?.role === 'superadmin';
        }
      } catch (e) {
        console.warn('[AdminPlugin] Failed to determine superadmin:', e);
      }

      // Store the superadmin status - used by isSuperadmin() function
      locals.kuratchi.superadmin.__isSuperadmin = isSuper;
            
      // If not superadmin, clear any override cookie for safety
      if (!isSuper && locals.kuratchi.superadmin.__orgOverride) {
        locals.kuratchi.superadmin.clearOrganization();
      }
    }
  };
}

/**
 * Route guard: require superadmin role
 */
export function requireSuperadmin(): RouteGuard {
  return ({ locals }) => {
    const isSuper = locals?.kuratchi?.superadmin?.isSuperadmin?.();
    if (!isSuper) return new Response('Forbidden', { status: 403 });
  };
}

