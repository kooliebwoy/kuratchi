/**
 * Kuratchi SDK - Public API
 * 
 * Unified SDK for Cloudflare Workers with auth, database, storage, and ORM
 */

// === UNIFIED API ===
// Single entry point for all configuration
export { kuratchi } from './kuratchi.js';
export type { KuratchiConfig, KuratchiSDK } from './kuratchi.js';

// === CLIENT (BATTERIES-INCLUDED) ===
// Simple, friction-free database client - just API key + database ID
export { KuratchiClient, createKuratchiClient, type KuratchiClientConfig } from './client/index.js';

// === MODULAR API ===
// Individual module exports for granular control
export { database } from './database/index.js';
export { kv } from './kv/index.js';
export { r2 } from './r2/index.js';
export { domains } from './domains/index.js';
export { stripe } from './stripe/index.js';

// === ACTIVITY ===
// Activity action constants (auto-populated from DB)
export { ActivityAction, getActivityActions, isValidAction } from './auth/utils/activity-actions.js';

// === TYPES ===
// Re-export commonly used types
export type {
  SessionMutatorContext,
  SessionMutator,
  RouteGuardContext,
  RouteGuard,
  AuthHandleEnv,
  CreateAuthHandleOptions,
  AuthConfig
} from './auth/utils/types.js';

// Domains types
export type {
  Zone,
  DnsRecord,
  ListZonesOptions,
  ListDnsRecordsOptions,
  CreateDnsRecordOptions
} from './domains/index.js';

// Stripe types
export type {
  StripePluginOptions,
  CreateCustomerOptions,
  CreateCheckoutOptions,
  CreateSubscriptionOptions,
  UpdateSubscriptionOptions,
  CreatePortalSessionOptions,
  StripeCustomerRecord,
  StripeSubscriptionRecord,
  StripeEventRecord,
  StripeInvoiceRecord
} from './stripe/index.js';
