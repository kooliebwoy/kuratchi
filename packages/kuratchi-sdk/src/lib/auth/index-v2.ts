/**
 * Kuratchi Auth - Plugin-based architecture
 * Main exports for v2 API
 */

// Core
export { createAuthHandle, KURATCHI_SESSION_COOKIE } from './handle-v2.js';
export { PluginRegistry, createPlugin } from './core/plugin.js';

// Plugins (direct exports - no namespace needed)
export { 
  sessionPlugin,
  storagePlugin,
  adminPlugin,
  organizationPlugin,
  guardsPlugin,
  requireAuth,
  emailAuthPlugin,
  oauthPlugin,
  credentialsPlugin,
  rolesPlugin,
  requireRole,
  superadminPlugin,
  requireSuperadmin
} from './plugins/index.js';

// Also export as namespace for those who prefer it
export * as plugins from './plugins/index.js';

// Types
export type {
  AuthPlugin,
  PluginContext,
  SessionContext,
  ResponseContext
} from './core/plugin.js';

export type {
  SessionPluginOptions,
  StoragePluginOptions,
  AdminPluginOptions,
  OrganizationPluginOptions,
  GuardsPluginOptions,
  EmailAuthPluginOptions,
  OAuthPluginOptions,
  OAuthProviderConfig,
  CredentialsPluginOptions,
  RolesPluginOptions,
  SuperadminPluginOptions
} from './plugins/index.js';

export type {
  CreateAuthHandleOptions,
  AuthHandleEnv,
  SessionMutator,
  SessionMutatorContext,
  RouteGuard,
  RouteGuardContext,
  AuthConfig
} from './types.js';

// Legacy exports (for backward compatibility)
export { KuratchiAuth } from './kuratchi-auth.js';
