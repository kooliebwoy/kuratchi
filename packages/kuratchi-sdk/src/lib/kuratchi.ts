/**
 * Unified Kuratchi SDK Configuration
 * Single entry point for all SDK features: auth, database, storage (KV, R2, D1), and ORM
 */

import type { Handle } from '@sveltejs/kit';
import type { CreateAuthHandleOptions } from './auth/types.js';
import type { AuthPlugin } from './auth/core/plugin.js';
import { createAuthHandle } from './auth/handle-v2.js';
import { KuratchiDatabase } from './database/index.js';
import { database as databaseNamespace } from './database/index.js';
import { auth as authNamespace } from './auth/kuratchi-auth.js';
import { kv as kvNamespace } from './kv/index.js';
import { r2 as r2Namespace } from './r2/index.js';
import { d1 as d1Namespace } from './d1/index.js';
import { domains as domainsNamespace } from './domains/index.js';

/**
 * Unified Kuratchi configuration object
 */
export interface KuratchiConfig {
  /**
   * Authentication configuration
   */
  auth?: {
    /** Session cookie name (default: 'kuratchi_session') */
    cookieName?: string;
    /** Auth plugins (session, admin, organization, oauth, email, credentials, etc.) */
    plugins?: AuthPlugin[];
    /** Additional auth options */
    options?: Partial<CreateAuthHandleOptions>;
  };

  /**
   * Database (Durable Objects) configuration
   */
  database?: {
    /** Cloudflare Workers subdomain */
    workersSubdomain?: string;
    /** Cloudflare account ID */
    accountId?: string;
    /** Cloudflare API token */
    apiToken?: string;
    /** DO script name (default: 'kuratchi-do-internal') */
    scriptName?: string;
    /** Gateway key for database access */
    gatewayKey?: string;
  };

  /**
   * Storage bindings configuration (maps friendly names to wrangler.toml bindings)
   */
  storage?: {
    /** KV namespace mappings: { friendlyName: 'WRANGLER_BINDING' } */
    kv?: Record<string, string>;
    /** R2 bucket mappings: { friendlyName: 'WRANGLER_BINDING' } */
    r2?: Record<string, string>;
    /** D1 database mappings: { friendlyName: 'WRANGLER_BINDING' } */
    d1?: Record<string, string>;
  };
}

/**
 * Kuratchi SDK instance with configured services
 */
export interface KuratchiSDK {
  /** SvelteKit handle for hooks.server.ts */
  handle: Handle;
  /** Database (DO) service */
  database: typeof databaseNamespace;
  /** Auth service */
  auth: typeof authNamespace;
  /** KV service */
  kv: typeof kvNamespace;
  /** R2 service */
  r2: typeof r2Namespace;
  /** D1 service */
  d1: typeof d1Namespace;
  /** Domains (Cloudflare DNS) service */
  domains: typeof domainsNamespace;
}

/**
 * Create a unified Kuratchi SDK instance with all services configured
 * 
 * @example
 * ```typescript
 * import { kuratchi } from 'kuratchi-sdk';
 * import { sessionPlugin, adminPlugin } from 'kuratchi-sdk/auth';
 * 
 * const app = kuratchi({
 *   auth: {
 *     plugins: [sessionPlugin(), adminPlugin()]
 *   },
 *   database: {
 *     workersSubdomain: 'my-subdomain'
 *   },
 *   storage: {
 *     kv: { default: 'MY_KV', cache: 'CACHE_KV' },
 *     r2: { uploads: 'USER_UPLOADS' },
 *     d1: { analytics: 'ANALYTICS_DB' }
 *   }
 * });
 * 
 * export const handle = app.handle;
 * ```
 */
export function kuratchi(config: KuratchiConfig = {}): KuratchiSDK {
  // Create auth handle with all configuration
  const authConfig: CreateAuthHandleOptions & { plugins?: AuthPlugin[] } = {
    ...config.auth?.options,
    cookieName: config.auth?.cookieName,
    kvNamespaces: config.storage?.kv,
    r2Buckets: config.storage?.r2,
    d1Databases: config.storage?.d1,
  };

  // Create auth handle (v2 supports both plugin and non-plugin modes)
  const handle = createAuthHandle({
    ...authConfig,
    plugins: config.auth?.plugins || []
  });

  // Create database instance if config provided (only if all required fields present)
  const databaseInstance = config.database?.workersSubdomain && config.database?.accountId && config.database?.apiToken
    ? new KuratchiDatabase({
        workersSubdomain: config.database.workersSubdomain,
        accountId: config.database.accountId,
        apiToken: config.database.apiToken,
        scriptName: config.database.scriptName || 'kuratchi-do-internal',
      })
    : undefined;

  // Return configured SDK
  return {
    handle,
    // Use configured database instance or default namespace
    database: databaseInstance ? {
      ...databaseNamespace,
      instance: () => databaseInstance
    } : databaseNamespace,
    auth: authNamespace,
    kv: kvNamespace,
    r2: r2Namespace,
    d1: d1Namespace,
    domains: domainsNamespace,
  };
}
