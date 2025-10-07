/**
 * Database Migrations Module
 * Centralized exports for all migration functionality
 */

// Core types and schema (includes normalization)
export type { DatabaseSchema, Column, Table, Index } from './schema.js';
export { normalizeSchema, isDatabaseSchema } from './schema.js';

// SQL generation and schema diffing (consolidated)
export { 
  buildInitialSql, 
  schemaToSqlStatements,
  renderColumnDef,
  renderCreateTableSql,
  renderCreateIndexSql,
  diffSchemas, 
  buildDiffSql,
  type DiffResult 
} from './generator.js';

// Migration generation and utilities (consolidated)
export { 
  generateInitialMigrationBundle,
  generateInitialMigration,
  ensureNormalizedSchema,
  splitSqlStatements,
  unwrapModuleExport,
  type MigrationJournal 
} from './migration-utils.js';

// Migration loading (Vite and filesystem)
export { 
  loadMigrations, 
  createFsMigrationLoader 
} from './loader.js';

// Migration execution
export { 
  applyMigrations, 
  hasPendingMigrations,
  type ApplyMigrationsOptions 
} from './migration-runner.js';

// Utility functions
export { 
  ensureNormalizedSchema,
  generateInitialMigration,
  splitSqlStatements,
  unwrapModuleExport 
} from './migration-utils.js';