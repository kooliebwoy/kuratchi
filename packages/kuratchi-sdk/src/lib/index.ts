/**
 * Kuratchi SDK - Public API
 * 
 * Unified SDK for Cloudflare Workers with auth, database, storage, and ORM
 */

// === UNIFIED API (NEW) ===
// Single entry point for all configuration
export { kuratchi } from './kuratchi.js';
export type { KuratchiConfig, KuratchiSDK } from './kuratchi.js';

// === MODULAR API (BACKWARD COMPATIBLE) ===
// Individual module exports for granular control
export { database } from './database/kuratchi-database.js';
export { auth } from './auth/kuratchi-auth.js';
export { kv } from './kv/index.js';
export { r2 } from './r2/index.js';
export { d1 } from './d1/index.js';
export { domains } from './domains/index.js';

// === ACTIVITY ===
// Activity action constants (auto-populated from DB)
export { ActivityAction, getActivityActions, isValidAction } from './activity-actions.js';

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
} from './auth/types.js';

// Domains types
export type {
  Zone,
  DnsRecord,
  ListZonesOptions,
  ListDnsRecordsOptions,
  CreateDnsRecordOptions
} from './domains/index.js';
