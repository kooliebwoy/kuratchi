// Public API surface
export { Kuratchi, type KuratchiOptions, type PrimaryLocationHint } from './kuratchi.js';

// Schemas and validators (stable public API)
export { validateAdminSchema, validateOrganizationSchema } from './auth/validators.js';

// Typed schema DSL and normalizer
export type { SchemaDsl, TableDsl, MixinsDsl } from './schema/types.js';
export { normalizeSchema } from './schema/normalize.js';
export { adminSchemaDsl } from './schema/admin.js';
export { organizationSchemaDsl } from './schema/organization.js';

// Normalized schemas (for consumers that expect DatabaseSchema shape)
import { normalizeSchema as __normalize } from './schema/normalize.js';
import { adminSchemaDsl as __adminDsl } from './schema/admin.js';
import { organizationSchemaDsl as __orgDsl } from './schema/organization.js';
export const adminSchema = __normalize(__adminDsl);
export const organizationSchema = __normalize(__orgDsl);