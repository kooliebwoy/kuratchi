/**
 * Unified Kuratchi SDK Configuration
 * Single entry point for all SDK features: auth, database, storage (KV, R2, D1), and ORM
 */

import type { Handle } from '@sveltejs/kit';
import type { CreateAuthHandleOptions } from './auth/utils/types.js';
import type { AuthPlugin } from './auth/core/plugin.js';
import { createAuthHandle } from './auth/core/handle.js';
import { KuratchiDatabase } from './database/index.js';
import { database as databaseNamespace } from './database/index.js';
import { kv as kvNamespace } from './kv/index.js';
import { r2 as r2Namespace } from './r2/index.js';
import { domains as domainsNamespace } from './domains/index.js';
import { initEmailPlugin } from './email/index.js';
import type { EmailPluginOptions } from './email/index.js';
import { stripe as stripeNamespace, initStripePlugin } from './stripe/index.js';
import type { StripePluginOptions } from './stripe/index.js';
import { handleStripeCallback } from './stripe/callback.js';
import type { NotificationPluginOptions } from './notifications/types.js';
import {
  initInAppNotifications,
  initEmailNotifications,
  initPlatformMonitoring,
  initQueue,
  initTemplates,
  initPreferences,
} from './notifications/index.js';

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

  /**
   * Email service configuration (Resend)
   */
  email?: EmailPluginOptions;

  /**
   * Stripe payment and subscription configuration
   */
  stripe?: StripePluginOptions;

  /**
   * Notifications configuration
   */
  notifications?: NotificationPluginOptions;
}

/**
 * Kuratchi SDK instance with configured services
 */
export interface KuratchiSDK {
  /** SvelteKit handle for hooks.server.ts */
  handle: Handle;
  /** Database (DO) service */
  database: typeof databaseNamespace;
  /** KV service */
  kv: typeof kvNamespace;
  /** R2 service */
  r2: typeof r2Namespace;
  /** Domains (Cloudflare DNS) service */
  domains: typeof domainsNamespace;
  /** Stripe payment and subscription service */
  stripe: typeof stripeNamespace;
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
  // Initialize email plugin if configured
  if (config.email) {
    initEmailPlugin(config.email);
  }

  // Initialize Stripe plugin if configured
  if (config.stripe) {
    initStripePlugin(config.stripe);
  }

  // Initialize notifications plugin if configured
  if (config.notifications) {
    initInAppNotifications(config.notifications);
    initEmailNotifications(config.notifications);
    initPlatformMonitoring(config.notifications);
    initQueue(config.notifications);
    initTemplates(config.notifications);
    initPreferences(config.notifications);
  }

  // Create auth handle with plugin-based configuration
  const hasCustomAuthPlugins = !!config.auth?.plugins && config.auth.plugins.length > 0;

  const authConfig: CreateAuthHandleOptions & { plugins?: AuthPlugin[] } = {
    cookieName: config.auth?.cookieName,
    kvNamespaces: config.storage?.kv,
    r2Buckets: config.storage?.r2,
    d1Databases: config.storage?.d1,
    // If the host app provides explicit auth plugins via kuratchi({ auth: { plugins } }),
    // disable the built-in rateLimit/turnstile auto-plugins to avoid duplication.
    ...(hasCustomAuthPlugins
      ? { rateLimit: false, turnstile: false }
      : {}),
    plugins: config.auth?.plugins || []
  };

  // Create auth handle with plugins and Stripe callback handling
  const baseHandle = createAuthHandle(authConfig);

  // Wrap handle to intercept Stripe callback route
  const handle: Handle = async ({ event, resolve }) => {
    const callbackPath = config.stripe?.callbackPath || '/kuratchi/stripe/callback';

    // Check if this is the Stripe callback route
    if (config.stripe && event.url.pathname === callbackPath) {
      return await handleStripeCallback(event);
    }

    // Otherwise, use the base auth handle
    return baseHandle({ event, resolve });
  };

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
    kv: kvNamespace,
    r2: r2Namespace,
    domains: domainsNamespace,
    stripe: stripeNamespace,
  };
}
