/**
 * Migration Runner
 * Apply database migrations with history tracking
 */

import type { DoHttpClient, QueryResult } from '../core/types.js';
import type { DatabaseSchema } from '../../orm/json-schema.js';
import type { SchemaDsl } from '../../utils/types.js';
import { loadMigrations } from '../../orm/loader.js';
import { ensureNormalizedSchema, generateInitialMigration, splitSqlStatements, unwrapModuleExport } from './migration-utils.js';

export interface ApplyMigrationsOptions {
  client: DoHttpClient;
  schemaName: string;
  schema?: DatabaseSchema | SchemaDsl;
}

interface MigrationEntry {
  idx: number;
  tag: string;
}

interface MigrationJournal {
  entries: MigrationEntry[];
}

/**
 * Ensure migrations_history table exists
 */
async function ensureMigrationsTable(client: DoHttpClient): Promise<void> {
  const result = await client.exec(
    'CREATE TABLE IF NOT EXISTS migrations_history (id INTEGER PRIMARY KEY AUTOINCREMENT, tag TEXT NOT NULL UNIQUE, created_at INTEGER);'
  );
  
  if (!result || result.success === false) {
    throw new Error(`Failed to ensure migrations_history table: ${result?.error || 'unknown error'}`);
  }
}

/**
 * Get applied migrations from history
 */
async function getAppliedMigrations(client: DoHttpClient): Promise<Set<string>> {
  const result = await client.query<{ tag: string }>('SELECT tag FROM migrations_history');
  
  if (!result || result.success === false) {
    throw new Error(`Failed to read migrations history: ${result?.error || 'unknown error'}`);
  }
  
  const tags = (result.results as any[] | undefined)?.map((row: any) => row.tag) || [];
  return new Set(tags);
}

/**
 * Load migrations from Vite-bundled directory or generate fallback
 */
async function loadOrGenerateMigrations(
  schemaName: string,
  schema?: DatabaseSchema | SchemaDsl
): Promise<{
  journal: MigrationJournal;
  migrations: Record<string, () => Promise<string>>;
  usedFallback: boolean;
}> {
  try {
    // Try to load Vite-bundled migrations
    const loaded = await loadMigrations(schemaName);
    return {
      journal: loaded.journal,
      migrations: loaded.migrations,
      usedFallback: false
    };
  } catch (error: any) {
    // Fallback: generate initial migration from schema if available
    if (!schema) {
      throw new Error(`No migrations found for ${schemaName} and no schema provided for fallback generation`);
    }
    
    const bundle = generateInitialMigration(schema);
    return {
      journal: bundle.journal,
      migrations: bundle.migrations as any,
      usedFallback: true
    };
  }
}

/**
 * Apply a single migration
 */
async function applyMigration(
  client: DoHttpClient,
  migrationKey: string,
  tag: string,
  getSql: () => Promise<string>
): Promise<void> {
  // Get migration SQL
  let sql = await getSql();
  sql = unwrapModuleExport(sql);
  
  // Split into statements
  const statements = splitSqlStatements(sql);
  
  // Build batch with migration statements + history insert
  const batch = statements.map((query) => ({ query, params: [] as any[] }));
  batch.push({
    query: 'INSERT INTO migrations_history (tag, created_at) VALUES (?, ?);',
    params: [tag, Date.now()]
  });
  
  // Execute batch
  const result = await client.batch(batch);
  
  if (!result || result.success === false) {
    throw new Error(`Migration ${migrationKey}/${tag} failed: ${result?.error || 'unknown error'}`);
  }
}

/**
 * Apply all pending migrations
 */
export async function applyMigrations(options: ApplyMigrationsOptions): Promise<void> {
  const { client, schemaName, schema } = options;
  
  // Ensure migrations table exists
  await ensureMigrationsTable(client);
  
  // Get applied migrations
  const appliedTags = await getAppliedMigrations(client);
  
  // Load or generate migrations
  const { journal, migrations, usedFallback } = await loadOrGenerateMigrations(schemaName, schema);
  
  // Apply pending migrations
  for (const entry of journal.entries) {
    const migrationKey = `m${String(entry.idx).padStart(4, '0')}`;
    const tag = entry.tag as string;
    
    // Skip if already applied
    if (appliedTags.has(tag)) {
      continue;
    }
    
    // Get migration SQL loader
    const getSql = (migrations as any)[migrationKey];
    if (!getSql) {
      throw new Error(`Missing migration loader for ${migrationKey} (${tag})`);
    }
    
    // If using fallback (generated initial), only allow m0001 when no history exists
    if (usedFallback && entry.idx !== 1 && appliedTags.size > 0) {
      throw new Error(
        'Only the initial migration can be auto-generated at runtime. ' +
        'Please include a Vite-bundled migrations directory for subsequent migrations.'
      );
    }
    
    // Apply migration
    await applyMigration(client, migrationKey, tag, getSql);
  }
}

/**
 * Check if migrations are pending
 */
export async function hasPendingMigrations(options: ApplyMigrationsOptions): Promise<boolean> {
  const { client, schemaName, schema } = options;
  
  try {
    await ensureMigrationsTable(client);
    const appliedTags = await getAppliedMigrations(client);
    const { journal } = await loadOrGenerateMigrations(schemaName, schema);
    
    for (const entry of journal.entries) {
      if (!appliedTags.has(entry.tag)) {
        return true;
      }
    }
    
    return false;
  } catch {
    return false;
  }
}
