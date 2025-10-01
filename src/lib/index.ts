// Public API surface
export { database } from './database/kuratchi-database.js';
export { auth } from './auth/kuratchi-auth.js';
// KV utilities (for standalone usage or fallback)
export { kv } from './kv/index.js';
// R2 utilities (for standalone usage or fallback)
export { r2 } from './r2/index.js';
// D1 utilities (for standalone usage or fallback)
export { d1 } from './d1/index.js';

// Re-export auth types for convenience
export type {
  SessionMutatorContext,
  SessionMutator,
  RouteGuardContext,
  RouteGuard,
  AuthHandleEnv,
  CreateAuthHandleOptions,
  AuthConfig
} from './auth/types.js';