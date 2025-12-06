/**
 * Admin plugin - Kuratchi admin database management + superadmin capabilities
 * Multi-tenant organization management with superadmin role detection
 */

import type { AuthPlugin, PluginContext, SessionContext } from '../core/plugin.js';
import type { RouteGuard } from '../utils/types.js';
import { KuratchiDatabase } from '../../database/core/database.js';
import { createSignedDbToken } from '../../utils/token.js';
import { hashPassword } from '../../utils/auth.js';

export interface AdminPluginOptions {
  /**
   * OPTIONAL: D1 database binding name
   * Pass the binding name as a string: adminDatabase: 'ADMIN_DB'
   * SDK will look it up from event.platform.env at runtime
   * If not provided, defaults to 'DB', then falls back to HTTP mode
   */
  adminDatabase?: string;
  
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
        
        // Look up D1 binding from platform.env by name (SvelteKit dev mode)
        const platform = (ctx.event as any).platform;
        const bindingName = options.adminDatabase || 'DB';
        const d1Binding = platform?.env?.[bindingName];
        
        console.log('[AdminPlugin] Debug - platform:', !!platform);
        console.log('[AdminPlugin] Debug - platform.env:', !!platform?.env);
        console.log('[AdminPlugin] Debug - bindingName:', bindingName);
        console.log('[AdminPlugin] Debug - d1Binding:', !!d1Binding);
        console.log('[AdminPlugin] Debug - d1Binding.prepare:', typeof d1Binding?.prepare);
        
        // Check if D1 binding is available
        if (d1Binding && typeof d1Binding.prepare === 'function') {
          console.log('[AdminPlugin] Using D1 direct binding for', bindingName);
          const { createOrmClient } = await import('../../database/clients/orm-client.js');
          
          // Wrap D1 binding in D1Client interface
          const d1Client = {
            query: async (sql: string, params?: any[]) => {
              const stmt = d1Binding.prepare(sql).bind(...(params || []));
              const result = await stmt.all();
              return { success: true, results: result.results };
            },
            exec: async (sql: string) => {
              await d1Binding.exec(sql);
              return { success: true };
            },
            batch: async (queries: any[]) => {
              const stmts = queries.map((q: any) => d1Binding.prepare(q.query).bind(...(q.params || [])));
              await d1Binding.batch(stmts);
              return { success: true };
            },
            raw: async (sql: string, params?: any[]) => {
              const stmt = d1Binding.prepare(sql).bind(...(params || []));
              const result = await stmt.raw();
              return { success: true, results: result };
            },
            first: async (sql: string, params?: any[]) => {
              const stmt = d1Binding.prepare(sql).bind(...(params || []));
              const result = await stmt.first();
              return { success: true, data: result };
            }
          };
          
          adminDbClient = await createOrmClient({
            httpClient: d1Client,
            schema: options.adminSchema,
            databaseName: bindingName, // Use binding name as database name for consistency
            bindingName: bindingName // Pass the actual binding name for detection
          });
          
          return adminDbClient;
        }
        
        // Auto-create from env (HTTP mode)
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
            'or pass adminDatabase option'
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
        
        // Get ORM client via HTTP
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
          
          
          // Try to provision via D1 if credentials available
          if (!workersSubdomain || !accountId || !apiToken) {
            throw new Error('[Admin] Cloudflare credentials not configured (CLOUDFLARE_WORKERS_SUBDOMAIN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN)');
          }
          const dbService = new KuratchiDatabase({
            workersSubdomain: workersSubdomain,
            accountId: accountId,
            apiToken: apiToken,
            scriptName: 'kuratchi-d1'
          });
          
          // Provision R2 bucket for organization storage
          const sanitizedOrgName = orgData.organizationName
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .substring(0, 32);
          const r2BucketName = `org-${sanitizedOrgName}-${crypto.randomUUID().substring(0, 8)}`;
          const r2Binding = 'STORAGE';
          
          let r2Created = false;
          let r2StorageDomain: string | null = null;
          
          try {
            console.log('[Admin] Creating R2 bucket:', r2BucketName);
            const { CloudflareClient } = await import('../../utils/cloudflare.js');
            const cfClient = new CloudflareClient({
              apiToken: apiToken,
              accountId: accountId
            });
            const r2Result = await cfClient.createR2Bucket(r2BucketName);
            if (r2Result.success) {
              console.log('[Admin] ✓ R2 bucket created:', r2BucketName);
              r2Created = true;
              
              // Add custom storage domain if configured
              const bucketOriginHost = env.KURATCHI_BUCKET_ORIGIN_HOST;
              const bucketZoneId = env.KURATCHI_BUCKET_ZONE_ID;
              
              if (bucketOriginHost && bucketZoneId) {
                const storageDomain = `${sanitizedOrgName}.${bucketOriginHost}`;
                console.log('[Admin] Adding custom storage domain:', storageDomain);
                
                try {
                  // Use the r2 module's addCustomDomain function
                  const { addCustomDomain } = await import('../../r2/index.js');
                  const domainResult = await addCustomDomain(r2BucketName, storageDomain, {
                    apiToken,
                    accountId,
                    zoneId: bucketZoneId,
                    enabled: true
                  });
                  if (domainResult?.success) {
                    console.log('[Admin] ✓ Custom storage domain added:', storageDomain);
                    r2StorageDomain = storageDomain;
                  } else {
                    console.warn('[Admin] Failed to add custom storage domain:', domainResult?.errors);
                  }
                } catch (domainError) {
                  console.error('[Admin] Error adding custom storage domain:', domainError);
                }
              }
            } else {
              console.warn('[Admin] R2 bucket creation failed:', r2Result.errors);
            }
          } catch (r2Error: any) {
            console.error('[Admin] Failed to create R2 bucket:', r2Error.message);
            // Non-fatal: continue without R2
          }
          
          // Create database with organization schema
          const result = await dbService.createDatabase({
            databaseName,
            gatewayKey,
            migrate: true,
            schema: options.organizationSchema,
            schemaName: 'organization'  // Loads from /migrations-organization
          });
          
          const dbToken = result.token;
          const dbUuid = result.databaseId;
          const workerName = result.workerName;
          
          // Bind R2 bucket to worker if created
          if (r2Created && workerName && dbUuid) {
            try {
              console.log('[Admin] Binding R2 bucket to worker:', {
                workerName,
                bucketName: r2BucketName,
                binding: r2Binding
              });
              
              const { addWorkerBinding } = await import('../../r2/index.js');
              const bindResult = await addWorkerBinding(
                workerName,
                r2BucketName,
                r2Binding,
                dbUuid,
                gatewayKey,
                { apiToken, accountId }
              );
              
              if (bindResult?.success) {
                console.log('[Admin] ✓ R2 bucket bound to worker successfully');
              } else {
                console.warn('[Admin] Failed to bind R2 bucket to worker:', bindResult);
              }
            } catch (bindError) {
              console.error('[Admin] Error binding R2 bucket to worker:', bindError);
              // Non-fatal: bucket exists, worker may need redeployment
            }
          }
          
          // 3. Store database record in admin DB (matches schema: id, name, dbuuid, workerName, r2BucketName, r2Binding, r2StorageDomain, organizationId)
          await adminDb.databases.insert({
            id: databaseId,
            name: databaseName,
            dbuuid: dbUuid,
            workerName: workerName,
            r2BucketName: r2Created ? r2BucketName : null,
            r2Binding: r2Created ? r2Binding : null,
            r2StorageDomain: r2StorageDomain, // Custom domain for CDN access
            organizationId: organizationId,
            isPrimary: true,
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
          // Use the database credentials we just created instead of looking them up
          // (avoids race condition with eventual consistency)
          console.log('[Admin] Getting org DB client with direct credentials:', { databaseName, organizationId });
          const orgDb = await dbService.ormClient({
            databaseName,
            dbToken,
            gatewayKey: gatewayKey || '',
            schema: options.organizationSchema
          });
          
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
          console.log('[Admin] Creating first user in org DB:', { userId, email: orgData.email, organizationId });
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
            const errorMsg = userInsertResult?.error || 'Unknown error';
            console.error('[Admin] Failed to create user in org DB:', errorMsg);
            throw new Error(`[Admin] Failed to create first user in organization: ${errorMsg}`);
          }
          
          console.log('[Admin] ✓ First user created successfully in org DB');
          
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
          
          const env = ctx.env;
          const now = new Date().toISOString();
          
          // Get database records before soft deleting
          const dbsRes = await adminDb.databases
            .where({ organizationId: organizationId, deleted_at: { isNullish: true } })
            .many();
          const databases = dbsRes?.data ?? [];
          
          // Delete actual D1 databases and workers
          if (databases.length > 0 && env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_WORKERS_SUBDOMAIN) {
            const { KuratchiDatabase } = await import('../../database/index.js');
            const dbService = new KuratchiDatabase({
              apiToken: env.CLOUDFLARE_API_TOKEN,
              accountId: env.CLOUDFLARE_ACCOUNT_ID,
              workersSubdomain: env.CLOUDFLARE_WORKERS_SUBDOMAIN,
              scriptName: env.KURATCHI_DO_SCRIPT_NAME || 'kuratchi-do-internal'
            });
            
            for (const db of databases) {
              try {
                console.log(`[Admin] Deleting database and worker: ${db.name}`);
                await dbService.deleteDatabase({
                  databaseName: db.name,
                  databaseId: db.dbuuid
                });
              } catch (error: any) {
                console.warn(`[Admin] Failed to delete database ${db.name}:`, error.message);
                // Continue with soft delete even if physical deletion fails
              }
            }
          }
          
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
          
          // Get primary organization database (non-deleted)
          const { data: db } = await adminDb.databases
            .where({ organizationId: organizationId, isPrimary: true })
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

