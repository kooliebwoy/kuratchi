/**
 * Organization plugin - Multi-tenant organization database access
 * Optional plugin for per-organization data isolation
 */

import type { AuthPlugin, PluginContext, SessionContext } from '../core/plugin.js';
import { KuratchiDatabase } from '../../database/kuratchi-database.js';
import { organizationSchemaDsl } from '../../schema/organization.js';
import type { RequestEvent } from '@sveltejs/kit';

export interface OrganizationPluginOptions {
  /**
   * Custom function to get organization schema
   * If not provided, uses default organizationSchemaDsl
   */
  getOrganizationSchema?: (event: RequestEvent) => Promise<any> | any;
  
  /**
   * Custom organization schema
   * Alternative to getOrganizationSchema function
   */
  organizationSchema?: any;
}

export function organizationPlugin(options: OrganizationPluginOptions = {}): AuthPlugin {
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
        options?: { schema?: any }
      ) => {
        if (typeof window !== 'undefined') {
          throw new Error('[Kuratchi Organization] orgDatabaseClient() is server-only');
        }
        
        const session = ctx.locals.kuratchi.session;
        const organizationId = orgIdOverride || session?.organizationId;
        
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
        
        // Lookup organization database record
        const { data: databases } = await adminDb.databases
          .where({ organization_id: organizationId })
          .first();
        
        if (!databases || !databases.db_token) {
          console.warn(`[Kuratchi Organization] No database found for organization: ${organizationId}`);
          return null;
        }
        
        const databaseName = databases.database_name;
        const dbToken = databases.db_token;
        
        // Get schema
        let schema = options?.schema;
        if (!schema) {
          if (options.getOrganizationSchema) {
            schema = await options.getOrganizationSchema(ctx.event);
          } else {
            schema = options.organizationSchema || organizationSchemaDsl;
          }
        }
        
        // Get organization DB client
        const orgDb = await dbService.client({
          databaseName,
          dbToken,
          gatewayKey: gatewayKey || '',
          schema
        });
        
        return orgDb;
      };
    },
    
    async onSession(ctx: SessionContext) {
      // Could enrich session with organization data here if needed
    }
  };
}
