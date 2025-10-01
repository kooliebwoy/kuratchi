import { getCurrentPlatform } from '../utils/platform-context.js';
import { createClientFromJsonSchema, type TableApi } from '../orm/kuratchi-orm.js';
import { loadMigrations } from '../orm/loader.js';
import { generateInitialMigrationBundle } from '../orm/migrator.js';
import type { DatabaseSchema } from '../orm/json-schema.js';
import type { SchemaDsl } from '../utils/types.js';
import { normalizeSchema } from '../orm/normalize.js';
import { createD1Adapter } from '../orm/adapters.js';

/**
 * Global D1 database access that reads from platform.env
 * Automatically works in both dev (via wrangler proxy) and production
 */

type D1Database = {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
};

type D1PreparedStatement = {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
};

type D1Result<T = unknown> = {
  success: boolean;
  results?: T[];
  error?: string;
  meta: {
    duration: number;
    size_after: number;
    rows_read: number;
    rows_written: number;
  };
};

type D1ExecResult = {
  count: number;
  duration: number;
};

class D1NotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'D1NotAvailableError';
  }
}

function getD1Database(name: string): D1Database {
  const platform = getCurrentPlatform();
  
  if (!platform || typeof platform !== 'object') {
    throw new D1NotAvailableError('[Kuratchi D1] No platform available. Are you calling this from a server context with the auth handle configured?');
  }

  const env = (platform as any).env;
  if (!env || typeof env !== 'object') {
    throw new D1NotAvailableError('[Kuratchi D1] No platform.env available. Ensure wrangler dev is running or you are deployed to Cloudflare Workers.');
  }

  const database = env[name];
  if (!database) {
    throw new D1NotAvailableError(`[Kuratchi D1] Database "${name}" not found in platform.env. Check your wrangler.toml bindings.`);
  }

  return database as D1Database;
}

/**
 * Execute a query on a D1 database
 * @param dbName - D1 database binding name (from wrangler.toml)
 * @param query - SQL query string
 * @param params - Optional query parameters
 */
export async function query<T = unknown>(
  dbName: string,
  query: string,
  params?: any[]
): Promise<D1Result<T> | null> {
  try {
    const db = getD1Database(dbName);
    const stmt = db.prepare(query);
    if (params && params.length > 0) {
      stmt.bind(...params);
    }
    return await stmt.all<T>();
  } catch (error) {
    if (error instanceof D1NotAvailableError) {
      console.warn(error.message);
      return null;
    }
    throw error;
  }
}

/**
 * Execute a query and return the first result
 * @param dbName - D1 database binding name (from wrangler.toml)
 * @param query - SQL query string
 * @param params - Optional query parameters
 */
export async function first<T = unknown>(
  dbName: string,
  query: string,
  params?: any[]
): Promise<T | null> {
  try {
    const db = getD1Database(dbName);
    const stmt = db.prepare(query);
    if (params && params.length > 0) {
      stmt.bind(...params);
    }
    return await stmt.first<T>();
  } catch (error) {
    if (error instanceof D1NotAvailableError) {
      console.warn(error.message);
      return null;
    }
    throw error;
  }
}

/**
 * Execute a write operation (INSERT, UPDATE, DELETE)
 * @param dbName - D1 database binding name (from wrangler.toml)
 * @param query - SQL query string
 * @param params - Optional query parameters
 */
export async function run<T = unknown>(
  dbName: string,
  query: string,
  params?: any[]
): Promise<D1Result<T> | null> {
  try {
    const db = getD1Database(dbName);
    const stmt = db.prepare(query);
    if (params && params.length > 0) {
      stmt.bind(...params);
    }
    return await stmt.run<T>();
  } catch (error) {
    if (error instanceof D1NotAvailableError) {
      console.warn(error.message);
      return null;
    }
    throw error;
  }
}

/**
 * Execute a batch of statements
 * @param dbName - D1 database binding name (from wrangler.toml)
 * @param statements - Array of prepared statements
 */
export async function batch<T = unknown>(
  dbName: string,
  statements: Array<{ query: string; params?: any[] }>
): Promise<D1Result<T>[] | null> {
  try {
    const db = getD1Database(dbName);
    const stmts = statements.map(({ query, params }) => {
      const stmt = db.prepare(query);
      if (params && params.length > 0) {
        stmt.bind(...params);
      }
      return stmt;
    });
    return await db.batch<T>(stmts);
  } catch (error) {
    if (error instanceof D1NotAvailableError) {
      console.warn(error.message);
      return null;
    }
    throw error;
  }
}

/**
 * Execute raw SQL (no prepared statements)
 * @param dbName - D1 database binding name (from wrangler.toml)
 * @param sql - Raw SQL string
 */
export async function exec(
  dbName: string,
  sql: string
): Promise<D1ExecResult | null> {
  try {
    const db = getD1Database(dbName);
    return await db.exec(sql);
  } catch (error) {
    if (error instanceof D1NotAvailableError) {
      console.warn(error.message);
      return null;
    }
    throw error;
  }
}

/**
 * Get a D1 database client for direct access
 * @param name - D1 database binding name (from wrangler.toml)
 */
export function database(name: string): D1Database | null {
  try {
    return getD1Database(name);
  } catch (error) {
    if (error instanceof D1NotAvailableError) {
      console.warn(error.message);
      return null;
    }
    throw error;
  }
}

/**
 * Helper function to ensure schema is normalized
 */
function ensureDbSchema(schema: DatabaseSchema | SchemaDsl): DatabaseSchema {
  // Heuristic: DatabaseSchema has tables: Array; SchemaDsl has tables: object
  const t: any = (schema as any)?.tables;
  if (Array.isArray(t)) return schema as DatabaseSchema;
  return normalizeSchema(schema as SchemaDsl);
}

/**
 * Create an ORM client for D1 with automatic migration support
 * @param dbName - D1 database binding name (from wrangler.toml)
 * @param schema - Database schema (DatabaseSchema or SchemaDsl)
 * @returns ORM client with table APIs
 */
export async function client(
  dbName: string,
  schema: DatabaseSchema | SchemaDsl
): Promise<Record<string, TableApi> | null> {
  try {
    const db = getD1Database(dbName);
    if (!schema) throw new Error('D1 client requires a schema (DatabaseSchema or SchemaDsl)');

    const normalized = ensureDbSchema(schema);

    // Use D1 adapter to convert D1 results to ORM QueryResult format
    const exec = createD1Adapter(db);

    // Apply migrations
    await applyD1Migrations(db, normalized.name, normalized);

    return createClientFromJsonSchema(exec, normalized);
  } catch (error) {
    if (error instanceof D1NotAvailableError) {
      console.warn(error.message);
      return null;
    }
    throw error;
  }
}

/**
 * Internal: apply migrations using Vite-bundled loader and track in migrations_history
 */
async function applyD1Migrations(db: D1Database, dirName: string, schema?: DatabaseSchema): Promise<void> {
  let journal: any;
  let migrations: Record<string, () => Promise<string>> | undefined;
  let usedFallback = false;

  try {
    const loaded = await loadMigrations(dirName);
    journal = loaded.journal;
    migrations = loaded.migrations;
  } catch (err: any) {
    // Fallback: if we have a schema, synthesize an initial migration bundle on the fly
    if (!schema) throw err;
    usedFallback = true;
    const bundle = generateInitialMigrationBundle(schema);
    journal = bundle.journal;
    migrations = bundle.migrations as any;
  }

  // Create migrations history table
  await db.exec(
    'CREATE TABLE IF NOT EXISTS migrations_history (id INTEGER PRIMARY KEY AUTOINCREMENT, tag TEXT NOT NULL UNIQUE, created_at INTEGER);'
  );

  // Get applied migrations
  const appliedStmt = db.prepare('SELECT tag FROM migrations_history');
  const appliedRes = await appliedStmt.all<{ tag: string }>();
  const applied = new Set<string>(appliedRes.results?.map((r: any) => r.tag) || []);

  // Apply pending migrations
  for (const entry of journal.entries) {
    const key = `m${String(entry.idx).padStart(4, '0')}`;
    const tag = entry.tag as string;
    if (applied.has(tag)) continue;

    const getSql = (migrations as any)[key];
    if (!getSql) throw new Error(`Missing migration loader for ${key} (${tag})`);
    let sql = await getSql();
    if (typeof sql === 'object' && (sql as any)?.default) sql = (sql as any).default;

    // Split into statements
    const statements = String(sql)
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length)
      .map((s) => (s.endsWith(';') ? s : s + ';'));

    // Build batch with migration statements + history insert
    const stmts: D1PreparedStatement[] = [];
    for (const q of statements) {
      stmts.push(db.prepare(q));
    }
    stmts.push(db.prepare('INSERT INTO migrations_history (tag, created_at) VALUES (?, ?)').bind(tag, Date.now()));

    // If using fallback (generated initial), only allow applying m0001 when no history exists
    if (usedFallback && entry.idx !== 1 && applied.size > 0) {
      throw new Error('Only the initial migration can be auto-generated at runtime. Please include a Vite-bundled migrations directory for subsequent migrations.');
    }

    // Execute batch (atomic)
    await db.batch(stmts);
  }
}

/**
 * Convenience namespace export
 */
export const d1 = {
  query,
  first,
  run,
  batch,
  exec,
  database,
  client
};

// Re-export types
export type {
  D1Database,
  D1PreparedStatement,
  D1Result,
  D1ExecResult
};
