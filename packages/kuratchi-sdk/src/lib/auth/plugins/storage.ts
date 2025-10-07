/**
 * Storage plugin - Attach Cloudflare storage bindings
 * Provides KV, R2, and D1 access via locals.kuratchi.*
 */

import type { AuthPlugin, PluginContext } from '../core/plugin.js';

export interface StoragePluginOptions {
  /** 
   * KV namespace bindings
   * Maps friendly names to wrangler.toml binding names
   * Example: { default: 'MY_KV', cache: 'CACHE_KV' }
   */
  kv?: Record<string, string>;
  
  /**
   * R2 bucket bindings
   * Maps friendly names to wrangler.toml binding names
   * Example: { default: 'MY_BUCKET', uploads: 'UPLOADS' }
   */
  r2?: Record<string, string>;
  
  /**
   * D1 database bindings
   * Maps friendly names to wrangler.toml binding names
   * Example: { default: 'MY_DB', analytics: 'ANALYTICS_DB' }
   */
  d1?: Record<string, string>;
}

export function storagePlugin(options: StoragePluginOptions = {}): AuthPlugin {
  return {
    name: 'storage',
    priority: 40, // After session, before auth flows
    
    async onRequest(ctx: PluginContext) {
      if (!ctx.locals.kuratchi) ctx.locals.kuratchi = {};
      
      const platform = ctx.event.platform as any;
      const platformEnv = platform?.env;
      
      if (!platformEnv) {
        // No platform environment available (SSR without wrangler, etc.)
        if (options.kv) ctx.locals.kuratchi.kv = {};
        if (options.r2) ctx.locals.kuratchi.r2 = {};
        if (options.d1) ctx.locals.kuratchi.d1 = {};
        return;
      }
      
      // Attach KV namespaces
      if (options.kv && typeof options.kv === 'object') {
        ctx.locals.kuratchi.kv = {};
        for (const [friendlyName, bindingName] of Object.entries(options.kv)) {
          const binding = platformEnv[bindingName];
          ctx.locals.kuratchi.kv[friendlyName] = binding || null;
          
          if (!binding && import.meta.env?.DEV) {
            console.warn(
              `[Kuratchi Storage] KV namespace "${bindingName}" not found in platform.env. ` +
              `Check your wrangler.toml bindings.`
            );
          }
        }
      }
      
      // Attach R2 buckets
      if (options.r2 && typeof options.r2 === 'object') {
        ctx.locals.kuratchi.r2 = {};
        for (const [friendlyName, bindingName] of Object.entries(options.r2)) {
          const binding = platformEnv[bindingName];
          ctx.locals.kuratchi.r2[friendlyName] = binding || null;
          
          if (!binding && import.meta.env?.DEV) {
            console.warn(
              `[Kuratchi Storage] R2 bucket "${bindingName}" not found in platform.env. ` +
              `Check your wrangler.toml bindings.`
            );
          }
        }
      }
      
      // Attach D1 databases
      if (options.d1 && typeof options.d1 === 'object') {
        ctx.locals.kuratchi.d1 = {};
        for (const [friendlyName, bindingName] of Object.entries(options.d1)) {
          const binding = platformEnv[bindingName];
          ctx.locals.kuratchi.d1[friendlyName] = binding || null;
          
          if (!binding && import.meta.env?.DEV) {
            console.warn(
              `[Kuratchi Storage] D1 database "${bindingName}" not found in platform.env. ` +
              `Check your wrangler.toml bindings.`
            );
          }
        }
      }
    }
  };
}
