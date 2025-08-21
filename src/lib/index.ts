// Public API surface
export { Kuratchi, type KuratchiOptions, type PrimaryLocationHint } from './kuratchi.js';

// Schemas and validators (stable public API)
export { adminSchema, organizationSchema } from './schema/index.js';
export { validateAdminSchema, validateOrganizationSchema } from './schema/index.js';

// Experimental: JSON-schema ORM and migration utilities
// Note: API may change while stabilizing.
export * as orm from './orm/index.js';