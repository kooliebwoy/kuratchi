import type { D1Client } from './core/types.js';
import type { DatabaseSchema, Column, Table, Index } from './migrations/schema.js';
import type { SchemaDsl } from '../utils/types.js';
import { ensureNormalizedSchema } from './migrations/migration-utils.js';
import { renderCreateTableSql, renderCreateIndexSql, renderColumnDef } from './migrations/generator.js';

export interface SchemaSyncLogger {
  info?: (...args: any[]) => void;
  warn?: (...args: any[]) => void;
  error?: (...args: any[]) => void;
}

export interface SchemaSyncOptions {
  client: D1Client;
  schema: DatabaseSchema | SchemaDsl;
  databaseName?: string;
  logger?: SchemaSyncLogger;
}

export interface SchemaSyncResult {
  changed: boolean;
  appliedStatements: string[];
  warnings: string[];
  hash: string;
}

const STATE_TABLE = 'kuratchi_schema_state';
const runtimeCache = new Map<string, string>();
const inFlightSyncs = new Map<string, Promise<SchemaSyncResult>>();

const fallbackLogger = {
  info: (...args: any[]) => console.log('[schemaSync]', ...args),
  warn: (...args: any[]) => console.warn('[schemaSync]', ...args),
  error: (...args: any[]) => console.error('[schemaSync]', ...args)
};

function getLogger(logger?: SchemaSyncLogger) {
  return {
    info: logger?.info ?? fallbackLogger.info,
    warn: logger?.warn ?? fallbackLogger.warn,
    error: logger?.error ?? fallbackLogger.error
  };
}

function stableStringify(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

function computeSchemaHash(schema: DatabaseSchema): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(stableStringify(schema));
  let hash = BigInt('1469598103934665603');
  const prime = BigInt('1099511628211');
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    hash ^= BigInt(byte);
    hash *= prime;
  }
  return hash.toString(16);
}

async function runQuery<T = any>(client: D1Client, query: string, params: any[] = []): Promise<T[]> {
  try {
    const result = await client.query<T>(query, params);
    if (!result || result.success === false) {
      const msg = result?.error || 'D1 query failed';
      throw new Error(msg);
    }
    return (result.results ?? (result as any).data ?? []) as T[];
  } catch (error: any) {
    const message = error?.message || String(error);
    throw new Error(`${message} (SQL: ${query.trim()})`);
  }
}

async function runExec(client: D1Client, query: string, params: any[] = []): Promise<void> {
  await runQuery(client, query, params);
}

async function ensureStateTable(client: D1Client) {
  const createTableSql = `CREATE TABLE IF NOT EXISTS ${STATE_TABLE} (schema_name TEXT PRIMARY KEY, schema_hash TEXT NOT NULL, version INTEGER, updated_at INTEGER NOT NULL);`;
  await runExec(client, createTableSql);
}

async function getStoredHash(client: D1Client, schemaName: string) {
  const rows = await runQuery<{ schema_hash: string; version: number | null }>(
    client,
    `SELECT schema_hash, version FROM ${STATE_TABLE} WHERE schema_name = ?`,
    [schemaName]
  );
  if (!rows.length) return null;
  return { hash: rows[0].schema_hash, version: rows[0].version };
}

async function saveHash(client: D1Client, schemaName: string, hash: string, version: number | undefined | null) {
  const now = Date.now();
  await runQuery(
    client,
    `INSERT INTO ${STATE_TABLE} (schema_name, schema_hash, version, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(schema_name) DO UPDATE SET schema_hash = excluded.schema_hash, version = excluded.version, updated_at = excluded.updated_at`,
    [schemaName, hash, typeof version === 'number' ? version : null, now]
  );
}

interface IntrospectedColumn {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
  defaultValue: string | null;
}

interface IntrospectedIndex {
  name: string;
  unique: boolean;
  columns: string[];
}

interface IntrospectedForeignKey {
  from: string;
  table: string;
  to: string;
  onDelete?: string;
}

async function fetchColumns(client: D1Client, table: string): Promise<IntrospectedColumn[]> {
  const rows = await runQuery<any>(client, `PRAGMA table_info(${table});`);
  return rows.map((row: any) => ({
    name: row.name,
    type: (row.type || '').toString(),
    notNull: Boolean(row.notnull),
    primaryKey: Boolean(row.pk),
    defaultValue: row.dflt_value ?? null
  }));
}

async function fetchIndexes(client: D1Client, table: string): Promise<IntrospectedIndex[]> {
  const list = await runQuery<any>(client, `PRAGMA index_list(${table});`);
  const out: IntrospectedIndex[] = [];
  for (const idx of list) {
    const name: string = idx.name;
    if (!name || name.startsWith('sqlite_autoindex')) continue;
    const cols = await runQuery<any>(client, `PRAGMA index_info(${name});`);
    out.push({ name, unique: Boolean(idx.unique), columns: cols.map((c: any) => c.name).filter(Boolean) });
  }
  return out;
}

async function fetchForeignKeys(client: D1Client, table: string): Promise<IntrospectedForeignKey[]> {
  const rows = await runQuery<any>(client, `PRAGMA foreign_key_list(${table});`);
  return rows.map((row: any) => ({
    from: row.from,
    table: row.table,
    to: row.to,
    onDelete: row.on_delete ? row.on_delete.toLowerCase() : undefined
  }));
}

function mapSqliteType(type: string): { type: Column['type']; mode?: Column['mode'] } {
  const normalized = type.trim().toLowerCase();
  if (normalized.includes('int')) {
    if (normalized.includes('timestamp')) return { type: 'integer', mode: 'timestamp_ms' };
    if (normalized.includes('bool')) return { type: 'integer', mode: 'boolean' };
    return { type: 'integer' };
  }
  if (normalized.includes('char') || normalized.includes('text') || normalized.includes('clob')) return { type: 'text' };
  if (normalized.includes('real') || normalized.includes('floa') || normalized.includes('doub')) return { type: 'real' };
  if (normalized.includes('blob')) return { type: 'blob' };
  // JSON is stored as TEXT in SQLite, so don't infer a separate 'json' type during introspection
  return { type: 'text' };
}

function parseDefault(raw: string | null): Column['default'] | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const upper = trimmed.toUpperCase();
  if (upper === 'NULL') return { kind: 'value', value: null };
  if (/^[-+]?\d+$/.test(trimmed) || /^[-+]?\d+\.\d+$/.test(trimmed)) return { kind: 'value', value: Number(trimmed) };
  if (upper === 'TRUE') return { kind: 'value', value: true };
  if (upper === 'FALSE') return { kind: 'value', value: false };
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return { kind: 'value', value: trimmed.slice(1, -1) };
  }
  return { kind: 'raw', sql: trimmed };
}

function buildColumn(info: IntrospectedColumn, fks: IntrospectedForeignKey[]): Column {
  const base = mapSqliteType(info.type);
  const fk = fks.find((entry) => entry.from === info.name);
  return {
    name: info.name,
    type: base.type,
    mode: base.mode,
    notNull: info.notNull,
    primaryKey: info.primaryKey,
    default: parseDefault(info.defaultValue),
    references: fk
      ? { table: fk.table, column: fk.to, onDelete: fk.onDelete as Column['references'] extends { onDelete: infer OD } ? OD : undefined }
      : undefined
  };
}

async function introspectCurrentSchema(client: D1Client, target: DatabaseSchema): Promise<DatabaseSchema> {
  const { name } = target;
  const candidateTables = target.tables.map((t) => t.name);
  const rows = await runQuery<{ name: string }>(client, "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
  const existing = new Set(rows.map((row) => row.name));

  const tables: Table[] = [];
  for (const tableName of candidateTables) {
    if (!existing.has(tableName)) continue;
    const columnsInfo = await fetchColumns(client, tableName);
    const foreignKeys = await fetchForeignKeys(client, tableName);
    const indexesInfo = await fetchIndexes(client, tableName);

    const columns = columnsInfo.map((col) => buildColumn(col, foreignKeys));
    const indexes = indexesInfo.map<Index>((idx) => ({ name: idx.name, columns: idx.columns, unique: idx.unique }));

    tables.push({ name: tableName, columns, indexes: indexes.length ? indexes : undefined });
  }

  return { name, version: target.version, tables };
}

const DEFAULT_NORMALIZATIONS = new Map<string, string>([
  ['(CURRENT_TIMESTAMP)', '(CURRENT_TIMESTAMP)'],
  ['CURRENT_TIMESTAMP', '(CURRENT_TIMESTAMP)'],
  ['datetime("now")', '(CURRENT_TIMESTAMP)'],
  ['datetime("now","localtime")', '(CURRENT_TIMESTAMP)'],
  ['datetime("now","utc")', '(CURRENT_TIMESTAMP)'],
  ['datetime()','(CURRENT_TIMESTAMP)'],
  ['(JSON_OBJECT())', 'JSON_OBJECT()'],
  ['JSON_OBJECT()', 'JSON_OBJECT()'],
  ['(JSON_ARRAY())', 'JSON_ARRAY()'],
  ['JSON_ARRAY()', 'JSON_ARRAY()'],
]);

function normalizeDefaultValue(def: Column['default'] | undefined): string | undefined {
  if (!def) return undefined;
  if (def.kind === 'value') {
    // Normalize JSON literal strings to their function equivalents for backwards compatibility
    // This handles databases that were created before proper table recreation was implemented
    if (def.value === '[]') return 'JSON_ARRAY()';
    if (def.value === '{}') return 'JSON_OBJECT()';
    return JSON.stringify(def.value);
  }
  const raw = def.sql.trim().toUpperCase();
  return DEFAULT_NORMALIZATIONS.get(raw) ?? raw;
}

function describeColumn(col: Column): string {
  const parts: string[] = [col.type];
  if (col.mode) parts.push(`mode=${col.mode}`);
  if (col.notNull) parts.push('NOT NULL');
  if (col.primaryKey) parts.push('PK');
  if (col.unique) parts.push('UNIQUE');
  return parts.join(' ');
}

function assertColumnCompatible(tableName: string, target: Column, actual: Column) {
  const targetType = target.type;
  const actualType = actual.type;

  // Treat JSON and TEXT as storage-compatible: JSON is stored as TEXT in SQLite/D1
  const storageTypesCompatible =
    targetType === actualType ||
    (targetType === 'json' && actualType === 'text') ||
    (targetType === 'text' && actualType === 'json');

  if (!storageTypesCompatible) {
    throw new Error(`Column ${tableName}.${target.name} type mismatch (expected ${describeColumn(target)}, got ${describeColumn(actual)})`);
  }
  const targetMode = target.mode ?? null;
  const actualMode = actual.mode ?? null;
  if (targetMode !== actualMode) {
    // Allow missing mode on existing column when target expects one (e.g., legacy timestamps stored as INTEGER)
    if (!(targetMode && actualMode === null)) {
      throw new Error(`Column ${tableName}.${target.name} mode mismatch (expected ${targetMode ?? 'none'}, got ${actualMode ?? 'none'})`);
    }
  }
  if ((target.notNull ?? false) !== (actual.notNull ?? false)) throw new Error(`Column ${target.name} NOT NULL mismatch`);
  if ((target.primaryKey ?? false) !== (actual.primaryKey ?? false)) throw new Error(`Column ${target.name} primary key mismatch`);
  const targetDefault = normalizeDefaultValue(target.default);
  const actualDefault = normalizeDefaultValue(actual.default);
  if (targetDefault !== actualDefault) {
    // Allow differing when target expects default but existing has none (manual fix required)
    if (!(targetDefault && actualDefault === undefined)) {
      throw new Error(`Column ${tableName}.${target.name} default mismatch (expected ${targetDefault ?? 'none'}, got ${actualDefault ?? 'none'})`);
    }
  }
  const targetRef = target.references ? `${target.references.table}.${target.references.column}` : null;
  const actualRef = actual.references ? `${actual.references.table}.${actual.references.column}` : null;
  if (targetRef !== actualRef) throw new Error(`Column ${tableName}.${target.name} FK mismatch (expected ${targetRef ?? 'none'}, got ${actualRef ?? 'none'})`);
}

interface SyncPlan {
  statements: string[];
  warnings: string[];
}

// Non-constant defaults that require table recreation instead of ALTER TABLE ADD COLUMN
const NON_CONSTANT_DEFAULTS = new Set([
  'JSON_ARRAY()',
  '(JSON_ARRAY())',
  'JSON_OBJECT()',
  '(JSON_OBJECT())',
  'CURRENT_TIMESTAMP',
  '(CURRENT_TIMESTAMP)',
  'DATETIME()',
  '(DATETIME())',
]);

function hasNonConstantDefault(column: Column): boolean {
  if (!column.default || column.default.kind !== 'raw') return false;
  const sql = column.default.sql.toUpperCase().trim();
  return NON_CONSTANT_DEFAULTS.has(sql);
}

function createAddColumnStatement(table: Table, column: Column): string {
  if (column.primaryKey || column.unique || column.references || (column.enum && column.enum.length)) {
    throw new Error(`Cannot auto-add constrained column ${table.name}.${column.name}.`);
  }
  if (column.notNull && !column.default) {
    throw new Error(`Cannot auto-add NOT NULL column ${table.name}.${column.name} without DEFAULT.`);
  }
  const parts: string[] = [`ALTER TABLE ${table.name} ADD COLUMN ${column.name}`];
  parts.push(mapSqliteType(column.type).type.toUpperCase());
  if (column.default) {
    if (column.default.kind === 'raw') {
      parts.push(`DEFAULT ${column.default.sql}`);
    } else {
      const v = column.default.value;
      if (v === null) parts.push('DEFAULT NULL');
      else if (typeof v === 'number') parts.push(`DEFAULT ${v}`);
      else if (typeof v === 'boolean') parts.push(`DEFAULT ${v ? 1 : 0}`);
      else parts.push(`DEFAULT '${String(v).replace(/'/g, "''")}'`);
    }
  }
  if (column.notNull) parts.push('NOT NULL');
  return `${parts.join(' ')};`;
}

/**
 * Generate SQL statements to recreate a table with new columns.
 * This is the proper SQLite way to add columns with non-constant defaults.
 * 
 * Steps:
 * 1. Create new table with target schema (temp name)
 * 2. Copy data from old table (only columns that exist in both)
 * 3. Drop old table
 * 4. Rename new table to original name
 * 5. Recreate indexes
 */
function createTableRecreationStatements(
  existingTable: Table,
  targetTable: Table,
  newColumns: Column[]
): string[] {
  const statements: string[] = [];
  const tempTableName = `${targetTable.name}_new`;
  
  // 1. Create new table with full target schema
  const createSql = renderCreateTableSql(targetTable).replace(
    `"${targetTable.name}"`,
    `"${tempTableName}"`
  );
  statements.push(`${createSql};`);
  
  // 2. Copy data - only columns that exist in both tables
  const existingColNames = new Set(existingTable.columns.map(c => c.name));
  const columnsToPreserve = targetTable.columns
    .filter(c => existingColNames.has(c.name))
    .map(c => `"${c.name}"`);
  
  if (columnsToPreserve.length > 0) {
    const columnList = columnsToPreserve.join(', ');
    statements.push(`INSERT INTO "${tempTableName}" (${columnList}) SELECT ${columnList} FROM "${targetTable.name}";`);
  }
  
  // 3. Drop old table
  statements.push(`DROP TABLE "${targetTable.name}";`);
  
  // 4. Rename new table
  statements.push(`ALTER TABLE "${tempTableName}" RENAME TO "${targetTable.name}";`);
  
  // 5. Recreate indexes
  if (targetTable.indexes) {
    for (const idx of targetTable.indexes) {
      statements.push(renderCreateIndexSql(targetTable, idx) + ';');
    }
  }
  
  return statements;
}

function createDropColumnStatement(tableName: string, columnName: string): string {
  // SQLite 3.35+ (which D1 uses) supports ALTER TABLE DROP COLUMN
  return `ALTER TABLE ${tableName} DROP COLUMN ${columnName};`;
}

function buildSyncPlan(current: DatabaseSchema, target: DatabaseSchema): SyncPlan {
  const statements: string[] = [];
  const warnings: string[] = [];
  const currentTables = new Map(current.tables.map((t) => [t.name, t]));

  for (const targetTable of target.tables) {
    const matching = currentTables.get(targetTable.name);
    if (!matching) {
      statements.push(renderCreateTableSql(targetTable) + ';');
      if (targetTable.indexes) {
        for (const idx of targetTable.indexes) statements.push(renderCreateIndexSql(targetTable, idx) + ';');
      }
      continue;
    }

    const currentCols = new Map(matching.columns.map((c) => [c.name, c]));
    
    // Collect new columns and check if any require table recreation
    const newColumns: Column[] = [];
    const newColumnsRequiringRecreation: Column[] = [];
    
    for (const targetCol of targetTable.columns) {
      const existing = currentCols.get(targetCol.name);
      if (!existing) {
        newColumns.push(targetCol);
        if (hasNonConstantDefault(targetCol)) {
          newColumnsRequiringRecreation.push(targetCol);
        }
      } else {
        assertColumnCompatible(targetTable.name, targetCol, existing);
      }
    }
    
    // Collect columns to drop
    const columnsToDrop: string[] = [];
    for (const existing of matching.columns) {
      if (!targetTable.columns.some((col) => col.name === existing.name)) {
        columnsToDrop.push(existing.name);
      }
    }
    
    // If any new column has a non-constant default, we need to recreate the entire table
    if (newColumnsRequiringRecreation.length > 0) {
      const recreationStatements = createTableRecreationStatements(matching, targetTable, newColumns);
      statements.push(...recreationStatements);
      warnings.push(
        `Table ${targetTable.name} recreated to add column(s) with non-constant defaults: ${newColumnsRequiringRecreation.map(c => c.name).join(', ')}`
      );
      // Skip the rest - table recreation handles everything including indexes
      continue;
    }
    
    // Otherwise, use simple ALTER TABLE statements
    for (const col of newColumns) {
      statements.push(createAddColumnStatement(targetTable, col));
    }
    
    for (const colName of columnsToDrop) {
      statements.push(createDropColumnStatement(matching.name, colName));
      warnings.push(`Column ${matching.name}.${colName} dropped (removed from schema).`);
    }

    const currentIdx = new Map((matching.indexes ?? []).map((idx) => [idx.name, idx]));
    const targetIdx = new Map((targetTable.indexes ?? []).map((idx) => [idx.name, idx]));

    targetIdx.forEach((idx, name) => {
      const existing = currentIdx.get(name);
      const same = existing && existing.unique === idx.unique && JSON.stringify(existing.columns) === JSON.stringify(idx.columns);
      if (!same) {
        statements.push(renderCreateIndexSql(targetTable, idx) + ';');
      }
    });

    currentIdx.forEach((_idx, name) => {
      if (!targetIdx.has(name)) {
        statements.push(`DROP INDEX IF EXISTS ${name};`);
        warnings.push(`Index ${name} on ${matching.name} removed.`);
      }
    });
  }

  return { statements, warnings };
}

async function executeStatements(client: D1Client, statements: string[]) {
  for (const stmt of statements) {
    await runQuery(client, stmt);
  }
}

export async function synchronizeSchema(options: SchemaSyncOptions): Promise<SchemaSyncResult> {
  const logger = getLogger(options.logger);
  const normalized = ensureNormalizedSchema(options.schema);
  const schemaName = normalized.name;
  const cacheKey = options.databaseName || schemaName;
  const hash = computeSchemaHash(normalized);

  if (runtimeCache.get(cacheKey) === hash) {
    return { changed: false, appliedStatements: [], warnings: [], hash };
  }

  if (inFlightSyncs.has(cacheKey)) {
    return inFlightSyncs.get(cacheKey)!;
  }

  const syncPromise = (async (): Promise<SchemaSyncResult> => {
    await ensureStateTable(options.client);
    const stored = await getStoredHash(options.client, schemaName);
    if (stored && stored.hash === hash) {
      runtimeCache.set(cacheKey, hash);
      return { changed: false, appliedStatements: [], warnings: [], hash };
    }

    const current = await introspectCurrentSchema(options.client, normalized);
    const plan = buildSyncPlan(current, normalized);

    if (plan.statements.length === 0) {
      await saveHash(options.client, schemaName, hash, normalized.version);
      runtimeCache.set(cacheKey, hash);
      return { changed: false, appliedStatements: [], warnings: plan.warnings, hash };
    }

    logger.info(`Synchronizing schema "${schemaName}" with ${plan.statements.length} statement(s).`);
    if (plan.warnings.length) plan.warnings.forEach((w) => logger.warn(w));

    await executeStatements(options.client, plan.statements);
    await saveHash(options.client, schemaName, hash, normalized.version);
    runtimeCache.set(cacheKey, hash);

    return {
      changed: true,
      appliedStatements: plan.statements,
      warnings: plan.warnings,
      hash
    };
  })();

  inFlightSyncs.set(cacheKey, syncPromise);

  try {
    const result = await syncPromise;
    return result;
  } finally {
    inFlightSyncs.delete(cacheKey);
  }
}
