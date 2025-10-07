export * from './kuratchi-orm.js';
export * from './adapters.js';

// Re-export migration-related types and functions from their new consolidated location
export type { DatabaseSchema, Column, Table, Index } from '../database/migrations/schema.js';
export { buildInitialSql, schemaToSqlStatements } from '../database/migrations/generator.js';
export { generateInitialMigrationBundle } from '../database/migrations/migration-utils.js';
export { diffSchemas, buildDiffSql } from '../database/migrations/generator.js';
export { loadMigrations, createFsMigrationLoader } from '../database/migrations/loader.js';
export { normalizeSchema } from '../database/migrations/schema.js';
