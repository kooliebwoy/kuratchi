 // Auth module exports
export { AuthService } from './AuthService.js';

// SvelteKit integration
export { createAuthHandle, KURATCHI_SESSION_COOKIE } from './sveltekit.js';
export { KuratchiAuth } from './kuratchi-auth.js';
export type { CreateAuthHandleOptions } from './sveltekit.js';

// Schema exports - export schemas as namespaced objects to avoid conflicts
export { adminSchema } from './adminSchema.js';
export { organizationSchema } from '../org/organizationSchema.js';

// Type exports
export type { Tenant, User, Session } from './types.js';
export type { SessionData, SessionValidationResult } from './AuthService.js';

// Utility exports
export * from './utils.js';