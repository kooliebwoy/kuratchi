/**
 * Migration Runner
 * Apply database migrations with history tracking
 */

import type { D1Client, QueryResult } from '../core/types.js';
import type { DatabaseSchema } from './schema.js';
import type { SchemaDsl } from '../../utils/types.js';
import { loadMigrations } from './loader.js';
import { ensureNormalizedSchema, generateInitialMigration, splitSqlStatements, unwrapModuleExport } from './migration-utils.js';

export interface ApplyMigrationsOptions {
  client: D1Client;
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
async function ensureMigrationsTable(client: D1Client): Promise<void> {
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
async function getAppliedMigrations(client: D1Client): Promise<Set<string>> {
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
    console.log(`[Kuratchi Migrations] Loading migrations for ${schemaName}...`);
    const loaded = await loadMigrations(schemaName);
    console.log(`[Kuratchi Migrations] ✓ Loaded ${loaded.journal.entries.length} migration(s) from /migrations-${schemaName}`);
    return {
      journal: loaded.journal,
      migrations: loaded.migrations,
      usedFallback: false
    };
  } catch (error: any) {
    // Fallback: generate initial migration from schema if available
    console.log(`[Kuratchi Migrations] No bundled migrations found for ${schemaName}, using fallback...`);
    if (!schema) {
      throw new Error(`No migrations found for ${schemaName} and no schema provided for fallback generation`);
    }
    
    const bundle = generateInitialMigration(schema);
    console.log(`[Kuratchi Migrations] ✓ Generated initial migration from schema`);
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
  client: D1Client,
  migrationKey: string,
  tag: string,
  getSql: () => Promise<string>
): Promise<void> {
  // Get migration SQL
  let sql = await getSql();
  sql = unwrapModuleExport(sql);
  
  // Split into individual statements and execute them one by one
  // D1's exec() via HTTP has issues, so we use query() for each statement
  const statements = splitSqlStatements(sql);
  console.log(`[Migration] Executing ${statements.length} statements for ${migrationKey}`);
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const result = await client.query(stmt);
    
    if (!result || result.success === false) {
      throw new Error(`Migration ${migrationKey}/${tag} failed at statement ${i + 1}/${statements.length}: ${result?.error || 'unknown error'}`);
    }
  }
  
  console.log(`[Migration] ✓ All ${statements.length} statements executed successfully`);
  
  // Record migration in history
  const timestamp = Date.now();
  console.log(`[Migration] Recording in history: tag=${tag}, timestamp=${timestamp}`);
  
  const historyResult = await client.query(
    'INSERT INTO migrations_history (tag, created_at) VALUES (?, ?)',
    [tag, timestamp]
  );
  
  if (!historyResult || historyResult.success === false) {
    throw new Error(`Failed to record migration ${migrationKey}/${tag} in history: ${historyResult?.error || 'unknown error'}`);
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
  let appliedCount = 0;
  for (const entry of journal.entries) {
    const migrationKey = `m${String(entry.idx).padStart(4, '0')}`;
    const tag = entry.tag as string;
    
    // Skip if already applied
    if (appliedTags.has(tag)) {
      console.log(`[Kuratchi Migrations] ⊘ Skipping ${migrationKey} (${tag}) - already applied`);
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
    console.log(`[Kuratchi Migrations] → Applying ${migrationKey} (${tag})...`);
    await applyMigration(client, migrationKey, tag, getSql);
    console.log(`[Kuratchi Migrations] ✓ Applied ${migrationKey} (${tag})`);
    appliedCount++;
  }
  
  if (appliedCount === 0 && journal.entries.length > 0) {
    console.log(`[Kuratchi Migrations] ✓ All ${journal.entries.length} migration(s) already applied`);
  } else if (appliedCount > 0) {
    console.log(`[Kuratchi Migrations] ✓ Applied ${appliedCount} new migration(s)`);
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
