/**
 * Kuratchi Auth Handle v2 - Plugin-based architecture
 * Lightweight orchestrator for modular authentication middleware
 */

import { dev } from '$app/environment';
import type { Handle, RequestEvent } from '@sveltejs/kit';
import { ensurePlatformEnv, runWithPlatform } from '../utils/platform-context.js';
import { PluginRegistry, type AuthPlugin } from './core/plugin.js';
import type { CreateAuthHandleOptions, AuthHandleEnv } from './types.js';
import { sessionPlugin } from './plugins/session.js';
import { storagePlugin } from './plugins/storage.js';
import { adminPlugin } from './plugins/admin.js';
import { organizationPlugin } from './plugins/organization.js';
import { guardsPlugin } from './plugins/guards.js';

/**
 * Default environment resolver
 * Reads from $env/dynamic/private with fallbacks to platform.env
 */
async function defaultGetEnv(event: RequestEvent): Promise<AuthHandleEnv> {
  let dynamicEnv: any = undefined;
  try {
    const mod: any = await import('$env/dynamic/private');
    dynamicEnv = mod?.env;
  } catch {}
  
  const platformEnv = (event as any)?.platform?.env;
  
  const pick = (key: string) => {
    const fromDynamic = dynamicEnv?.[key];
    if (fromDynamic !== undefined && fromDynamic !== null && String(fromDynamic).length > 0) {
      return String(fromDynamic);
    }
    const fromPlatform = platformEnv?.[key];
    if (fromPlatform !== undefined && fromPlatform !== null && String(fromPlatform).length > 0) {
      return String(fromPlatform);
    }
    return undefined;
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
  } as AuthHandleEnv;
}

/**
 * Initialize locals object
 */
function initializeLocals(locals: any): void {
  if (!locals.kuratchi) locals.kuratchi = {};
  if (typeof locals.kuratchi.user === 'undefined') locals.kuratchi.user = null;
  if (typeof locals.kuratchi.session === 'undefined') locals.kuratchi.session = null;
  if (typeof locals.user === 'undefined') locals.user = null;
  if (typeof locals.session === 'undefined') locals.session = null;
}

/**
 * Create auth handle with plugin support
 */
export function createAuthHandle(options: CreateAuthHandleOptions & { plugins?: AuthPlugin[] } = {}): Handle {
  const registry = new PluginRegistry();
  
  // Register user-provided plugins
  if (options.plugins && options.plugins.length > 0) {
    registry.registerMany(options.plugins);
  } else {
    // Auto-register default plugins if no custom plugins provided
    
    // Session plugin (always needed)
    registry.register(sessionPlugin({
      cookieName: options.cookieName
    }));
    
    // Storage plugin (if configured)
    if (options.kvNamespaces || options.r2Buckets || options.d1Databases) {
      registry.register(storagePlugin({
        kv: options.kvNamespaces,
        r2: options.r2Buckets,
        d1: options.d1Databases
      }));
    }
    
    // Admin plugin (if configured)
    if (options.getAdminDb || options.getAdminSchema) {
      registry.register(adminPlugin({
        getAdminDb: options.getAdminDb,
        adminSchema: options.getAdminSchema
      }));
    }
    
    // Organization plugin (if configured)
    if (options.getOrganizationSchema) {
      registry.register(organizationPlugin({
        getOrganizationSchema: options.getOrganizationSchema
      }));
    }
    
    // Guards plugin (if configured)
    if (options.guards && options.guards.length > 0) {
      registry.register(guardsPlugin({
        guards: options.guards
      }));
    }
  }
  
  const getEnv = options.getEnv || defaultGetEnv;
  
  return async ({ event, resolve }) => {
    if (!event || typeof event !== 'object') {
      return resolve(event);
    }
    
    // Ensure platform environment is available
    await ensurePlatformEnv(event as RequestEvent, { dev });
    
    // Initialize locals
    initializeLocals(event.locals);
    
    // Get environment
    const env = await getEnv(event as RequestEvent);
    
    // Create plugin context
    const context = {
      event: event as RequestEvent,
      locals: event.locals,
      env
    };
    
    // Execute onRequest hooks
    const requestResult = await registry.executeOnRequest(context);
    if (requestResult instanceof Response) {
      return requestResult;
    }
    
    // Create session context
    const sessionContext = {
      ...context,
      session: context.locals.kuratchi.session,
      user: context.locals.kuratchi.user
    };
    
    // Execute onSession hooks
    await registry.executeOnSession(sessionContext);
    
    // Check if any guard returned a response
    const guardResponse = (sessionContext as any).__guardResponse__;
    if (guardResponse instanceof Response) {
      return guardResponse;
    }
    
    // Resolve the request with platform context
    let response = await runWithPlatform(event.platform, () => resolve(event));
    
    // Execute onResponse hooks
    const responseContext = {
      ...sessionContext,
      response
    };
    
    response = await registry.executeOnResponse(responseContext);
    
    return response;
  };
}

/**
 * Export for backward compatibility
 */
export { KURATCHI_SESSION_COOKIE } from './types.js';
