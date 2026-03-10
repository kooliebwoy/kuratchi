/**
 * @kuratchi/auth â€” Config-driven auth for KuratchiJS
 *
 * All auth features are configured in kuratchi.config.ts and auto-initialized
 * by the compiler. Import callable functions directly:
 *
 * @example
 * ```ts
 * import { signUp, signIn, getCurrentUser, logActivity } from '@kuratchi/auth';
 *
 * const user = await getCurrentUser();
 * await logActivity('user.login', { detail: 'Logged in' });
 * ```
 */

// Core â€” low-level auth context (cookie/session access)
export { getAuth } from './core/auth.js';
export type { AuthContext, AuthSession, CookieOptions, GetAuthOptions } from './core/auth.js';

// Credentials â€” signup, signin, signout, session lookup, password reset
export { signUp, signIn, signOut, getCurrentUser, configureCredentials, requestPasswordReset, resetPassword } from './core/credentials.js';
export type { CredentialsConfig } from './core/credentials.js';

// Activity â€” structured audit logging
export { logActivity, getActivity, defineActivities, getActivityDefinitions } from './core/activity.js';
export type { LogActivityOptions, GetActivityOptions, ActivityConfig } from './core/activity.js';

// Roles â€” RBAC with permission wildcards
export { defineRoles, hasRole, hasPermission, getPermissionsForRole, assignRole, getRolesData, getRoleDefinitions, getAllRoles, getDefaultRole } from './core/roles.js';

// OAuth â€” provider-based authentication
export { configureOAuth, getOAuthData, startOAuth, handleOAuthCallback, getOAuthProviders } from './core/oauth.js';
export type { OAuthConfig } from './core/oauth.js';

// Guards â€” route protection (compiler interceptor)
export { configureGuards, checkGuard, requireAuth as requireAuthGuard } from './core/guards.js';
export type { GuardsConfig } from './core/guards.js';

// Rate Limiting â€” per-route throttling (compiler interceptor)
export { configureRateLimit, checkRateLimit, getRateLimitInfo } from './core/rate-limit.js';
export type { RateLimitConfig, RateLimitRouteConfig as RateLimitRoute } from './core/rate-limit.js';

// Turnstile â€” Cloudflare bot protection (compiler interceptor)
export { configureTurnstile, checkTurnstile, verifyTurnstile } from './core/turnstile.js';
export type { TurnstileConfig, TurnstileRouteConfig as TurnstileRoute } from './core/turnstile.js';

// Organization â€” multi-tenant DO orchestration
export { configureOrganization, getOrgClient, getOrgStubByName, createOrgDatabase, getOrgDatabaseInfo, resolveOrgDatabaseName, isOrgAvailable } from './core/organization.js';
export type { OrganizationConfig } from './core/organization.js';
export { authAdminTables, authOrgTables } from './schema.js';

// Activity action constants
export { ActivityAction, getActivityActions, isValidAction } from './utils/activity-actions.js';

// Crypto utilities
export {
  generateSessionToken,
  hashPassword,
  comparePassword,
  hashToken,
  buildSessionCookie,
  parseSessionCookie,
  signState,
  verifyState,
  toBase64Url,
  fromBase64Url,
  encryptValue,
  decryptValue,
} from './utils/crypto.js';



