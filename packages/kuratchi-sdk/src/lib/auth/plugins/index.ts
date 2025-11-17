/**
 * Kuratchi Auth Plugins
 * Export all built-in plugins
 */

export { sessionPlugin } from './session.js';
export type { SessionPluginOptions } from './session.js';

export { storagePlugin } from './storage.js';
export type { StoragePluginOptions } from './storage.js';

export { adminPlugin, requireSuperadmin, createSuperadmin } from './admin.js';
export type { AdminPluginOptions } from './admin.js';

export { organizationPlugin } from './organization.js';
export type { OrganizationPluginOptions } from './organization.js';

export { guardsPlugin, requireAuth } from './guards.js';
export type { GuardsPluginOptions } from './guards.js';

export { emailAuthPlugin } from './email-auth.js';
export type { EmailAuthPluginOptions } from './email-auth.js';

export { oauthPlugin } from './oauth.js';
export type { OAuthPluginOptions, OAuthProviderConfig } from './oauth.js';

export { credentialsPlugin } from './credentials.js';
export type { CredentialsPluginOptions } from './credentials.js';

export { rateLimitPlugin } from './rate-limit.js';
export type { RateLimitPluginOptions, RateLimitRouteConfig } from './rate-limit.js';

export { turnstilePlugin } from './turnstile.js';
export type { TurnstilePluginOptions, TurnstileRouteConfig, TurnstileVerificationResult } from './turnstile.js';

// Roles plugin
export { rolesPlugin } from './roles.js';
export type { RolesPluginOptions, PermissionDef, RoleDefinitions } from './roles.js';

// Activity tracking plugin
export { activityPlugin } from './activity.js';
export type { ActivityLogOptions, ActivityTypeDefinition, ActivityPluginOptions } from './activity.js';

// Re-export plugin types
export type { AuthPlugin, PluginContext, SessionContext, ResponseContext } from '../core/plugin.js';
