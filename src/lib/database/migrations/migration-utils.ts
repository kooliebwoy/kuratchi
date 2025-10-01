/**
 * Migration Utilities
 * Schema normalization and migration generation helpers
 */

import type { DatabaseSchema } from '../../orm/json-schema.js';
import type { SchemaDsl } from '../../utils/types.js';
import { normalizeSchema } from '../../orm/normalize.js';
import { generateInitialMigrationBundle } from '../../orm/migrator.js';

/**
 * Ensure schema is normalized to DatabaseSchema format
 * Accepts both DatabaseSchema (already normalized) and SchemaDsl (needs normalization)
 */
export function ensureNormalizedSchema(schema: DatabaseSchema | SchemaDsl): DatabaseSchema {
  // Heuristic: DatabaseSchema has tables as Array; SchemaDsl has tables as object
  const tables: any = (schema as any)?.tables;
  
  if (Array.isArray(tables)) {
    return schema as DatabaseSchema;
  }
  
  return normalizeSchema(schema as SchemaDsl);
}

/**
 * Generate initial migration from schema
 */
export function generateInitialMigration(schema: DatabaseSchema | SchemaDsl): {
  journal: any;
  migrations: Record<string, () => Promise<string>>;
} {
  const normalized = ensureNormalizedSchema(schema);
  return generateInitialMigrationBundle(normalized);
}

/**
 * Split SQL into individual statements
 */
export function splitSqlStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
    .map((statement) => statement.endsWith(';') ? statement : statement + ';');
}

/**
 * Unwrap module default export if needed
 */
export function unwrapModuleExport(sqlOrModule: any): string {
  if (typeof sqlOrModule === 'string') {
    return sqlOrModule;
  }
  
  if (typeof sqlOrModule === 'object' && sqlOrModule?.default) {
    return String(sqlOrModule.default);
  }
  
  return String(sqlOrModule);
}
