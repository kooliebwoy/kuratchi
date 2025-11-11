/**
 * Kuratchi Auth - Plugin-based architecture
 * Main exports for auth module
 */

// Core
export { createAuthHandle, KURATCHI_SESSION_COOKIE } from './core/handle.js';
export { PluginRegistry, createPlugin } from './core/plugin.js';

// Plugins (direct exports - no namespace needed)
export { 
  sessionPlugin,
  storagePlugin,
  adminPlugin,
  requireSuperadmin,
  createSuperadmin,
  organizationPlugin,
  guardsPlugin,
  requireAuth,
  emailAuthPlugin,
  oauthPlugin,
  credentialsPlugin,
  rateLimitPlugin,
  turnstilePlugin,
  rolesPlugin,
  activityPlugin
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
  RateLimitPluginOptions,
  RateLimitRouteConfig,
  TurnstilePluginOptions,
  TurnstileRouteConfig,
  TurnstileVerificationResult,
  RolesPluginOptions,
  ActivityLogOptions
} from './plugins/index.js';

export type {
  CreateAuthHandleOptions,
  AuthHandleEnv,
  SessionMutator,
  SessionMutatorContext,
  RouteGuard,
  RouteGuardContext,
  AuthConfig
} from './utils/types.js';
