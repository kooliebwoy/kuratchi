// Public API surface
export { Kuratchi, type KuratchiOptions, type PrimaryLocationHint } from './kuratchi.js';

// Schemas and validators (stable public API)
import adminJsonSchema from './schema-json/admin.json' with { type: 'json' };
import organizationJsonSchema from './schema-json/organization.json' with { type: 'json' };
export const adminSchema = adminJsonSchema as any;
export const organizationSchema = organizationJsonSchema as any;
export { validateAdminSchema, validateOrganizationSchema } from './auth/validators.js';