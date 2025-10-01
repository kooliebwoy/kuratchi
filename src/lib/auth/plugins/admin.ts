/**
 * Admin plugin - Kuratchi admin database management
 * Optional plugin for multi-tenant organization management
 */

import type { AuthPlugin, PluginContext } from '../core/plugin.js';
import { KuratchiDatabase } from '../../database/kuratchi-database.js';
import { adminSchemaDsl } from '../../schema/admin.js';
import type { RequestEvent } from '@sveltejs/kit';

export interface AdminPluginOptions {
  /**
   * Custom function to get admin DB client
   * If not provided, will auto-create from env variables
   */
  getAdminDb?: (event: RequestEvent) => Promise<any> | any;
  
  /**
   * Custom admin schema
   * If not provided, uses default adminSchemaDsl
   */
  adminSchema?: any;
}

export function adminPlugin(options: AdminPluginOptions = {}): AuthPlugin {
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
        
        if (!adminDbToken || !workersSubdomain) {
          console.warn(
            '[Kuratchi Admin] Admin DB not configured. ' +
            'Set KURATCHI_ADMIN_DB_TOKEN and CLOUDFLARE_WORKERS_SUBDOMAIN'
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
        
        // Get HTTP client for admin DB
        if (dbService) {
          const httpClient = dbService.httpClient({
            databaseName: adminDbName,
            dbToken: adminDbToken,
            gatewayKey: gatewayKey || ''
          });
          
          // Create ORM client with admin schema
          const schema = options.adminSchema || adminSchemaDsl;
          adminDbClient = await dbService.client({
            databaseName: adminDbName,
            dbToken: adminDbToken,
            gatewayKey: gatewayKey || '',
            schema
          });
          
          return adminDbClient;
        }
        
        return null;
      };
    }
  };
}
