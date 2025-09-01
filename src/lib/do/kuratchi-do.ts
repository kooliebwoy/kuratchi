import { CloudflareClient } from '../utils/cloudflare.js';
import { DEFAULT_DO_WORKER_SCRIPT } from './worker-template.js';
import { createSignedDbToken } from '../utils/token.js';
import type { DatabaseSchema } from '../orm/json-schema.js';
import type { SchemaDsl } from '../utils/types.js';
import { normalizeSchema } from '../orm/normalize.js';
import { generateInitialMigrationBundle } from '../orm/migrator.js';
import { loadMigrations } from '../orm/loader.js';
import { createClientFromJsonSchema, type TableApi } from '../orm/kuratchi-orm.js';

export type QueryResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
  results?: any;
};

interface KuratchiDoConfig {
  databaseName: string;
  workersSubdomain: string;
  dbToken?: string;
  gatewayKey?: string;
  scriptName?: string;
}

class KuratchiDoHttpClient {
  private endpoint: string;
  private dbToken?: string;
  private gatewayKey?: string;
  private dbName: string;

  constructor(config: KuratchiDoConfig) {
    const script = config.scriptName || 'kuratchi-do-internal';
    this.endpoint = `https://${script}.${config.workersSubdomain}`;
    this.dbToken = config.dbToken;
    this.gatewayKey = config.gatewayKey;
    this.dbName = config.databaseName;
    try {
      Object.defineProperty(this, 'dbToken', { enumerable: false, configurable: false, writable: true });
      Object.defineProperty(this, 'gatewayKey', { enumerable: false, configurable: false, writable: true });
    } catch {}
  }

  private async makeRequest(path: string, body: any): Promise<QueryResult<any>> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-db-name': this.dbName };
      if (this.gatewayKey) headers['Authorization'] = `Bearer ${this.gatewayKey}`;
      if (this.dbToken) headers['x-db-token'] = this.dbToken;
      const res = await fetch(`${this.endpoint}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const json = await res.json();
          return { success: false, error: JSON.stringify(json) };
        }
        const text = await res.text();
        return { success: false, error: `API ${res.status}: ${text.slice(0, 200)}...` };
      }
      return res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async query<T>(query: string, params: any[] = []): Promise<QueryResult<T>> {
    return this.makeRequest('/api/run', { query, params });
  }

  async exec(query: string): Promise<QueryResult<any>> {
    return this.makeRequest('/api/exec', { query });
  }

  async batch(queries: { query: string; params?: any[] }[]): Promise<QueryResult<any>> {
    return this.makeRequest('/api/batch', { batch: queries });
  }

  async raw(query: string, params?: any[], columnNames: boolean = false): Promise<QueryResult<any>> {
    return this.makeRequest('/api/raw', { query, params, columnNames });
  }

  async first<T>(query: string, params?: any[], columnName?: string): Promise<QueryResult<T>> {
    return this.makeRequest('/api/first', { query, params, columnName });
  }
}

// Note: DO client accepts DatabaseSchema or SchemaDsl (normalized internally). String aliases are not supported.

function ensureDbSchema(schema: DatabaseSchema | SchemaDsl): DatabaseSchema {
  // Heuristic: DatabaseSchema has tables: Array; SchemaDsl has tables: object
  const t: any = (schema as any)?.tables;
  if (Array.isArray(t)) return schema as DatabaseSchema;
  return normalizeSchema(schema as SchemaDsl);
}

export interface DOOptions {
  apiToken: string;
  accountId: string;
  endpointBase?: string;
  workersSubdomain: string;
  scriptName?: string; // default: 'kuratchi-do-internal'
}

// token creation now imported from ./token

/** KuratchiDO — Durable Objects backed SQLite with instant logical DBs (per-DO idFromName). */
export class KuratchiDO {
  private cf: CloudflareClient;
  private workersSubdomain: string;
  private scriptName: string;

  constructor(config: DOOptions) {
    this.cf = new CloudflareClient({ apiToken: config.apiToken, accountId: config.accountId, endpointBase: config.endpointBase });
    this.workersSubdomain = config.workersSubdomain;
    this.scriptName = config.scriptName || 'kuratchi-do-internal';
    try {
      Object.defineProperty(this, 'cf', { enumerable: false, configurable: false, writable: true });
    } catch {}
  }

  /**
   * Provision a logical DO-backed database and issue a per-database token.
   * Persistence of this token should be handled by your admin flow (e.g., store in Admin DB).
   */
  async createDatabase(opts: { databaseName: string; gatewayKey: string; migrate?: boolean; schema?: DatabaseSchema | SchemaDsl }): Promise<{ databaseName: string; token: string }> {
    const { databaseName, gatewayKey } = opts;
    if (!databaseName) throw new Error('createDatabase requires databaseName');
    if (!gatewayKey) throw new Error('createDatabase requires gatewayKey');

    // Ensure the DO worker is deployed with master gateway key
    await this.ensureWorker(gatewayKey);

    // Issue a signed per-database API token (store in Admin DB)
    const token = await createSignedDbToken(databaseName, gatewayKey);
    
    // Best-effort: wait for the worker endpoint to become responsive
    try {
      await this.waitForWorkerEndpoint(databaseName, token, gatewayKey);
    } catch {
      // Non-fatal; queries may still succeed shortly after
    }
    
    // Optional: apply initial schema migration (single-bundle) when requested
    if (opts.migrate) {
      // DO runtime requires a concrete schema; accept DSL and normalize it
      if (!opts.schema) {
        throw new Error('KuratchiDO.createDatabase: migrate:true requires a schema (DatabaseSchema or SchemaDsl).');
      }
      const normalized = ensureDbSchema(opts.schema);
      const { migrations } = generateInitialMigrationBundle(normalized);
      const initialSql = await migrations.m0001();
      const client = this.workerClient({ databaseName, dbToken: token, gatewayKey });
      // Split into statements for atomic batch execution
      const statements = initialSql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length)
        .map((s) => (s.endsWith(';') ? s : s + ';'));
      if (statements.length === 1) {
        const res = await client.query(statements[0]);
        if (!res || res.success === false) {
          throw new Error(`Migration failed: ${res?.error || 'unknown error'}`);
        }
      } else if (statements.length > 1) {
        const res = await client.batch(statements.map((q) => ({ query: q })));
        if (!res || res.success === false) {
          throw new Error(`Migration batch failed: ${res?.error || 'unknown error'}`);
        }
      }
    }
    
    // NOTE: Persist (databaseName, token) in your Admin DB in your provisioning flow.
    return { databaseName, token };
  }

  // Deploy or update the internal DO worker that hosts the KuratchiDoInternal durable object.
  private async ensureWorker(apiKey: string) {
    if (!apiKey) throw new Error('ensureWorker(apiKey) requires an API key');
    
    const bindings: any[] = [
      // Secret binding for gateway key
      { type: 'secret_text', name: 'API_KEY', text: apiKey },
      // Durable Object namespace binding exposed to the script as env.DO
      { type: 'durable_object_namespace', name: 'DO', class_name: 'KuratchiDoInternal' },
    ];

    // Try to update existing worker first, then create if it doesn't exist
    try {
      await this.cf.uploadWorkerModule(this.scriptName, DEFAULT_DO_WORKER_SCRIPT, bindings);
    } catch (error: any) {
      // If it's a DO class migration error, try without migrations
      if (error.message?.includes('new-class migration') || error.message?.includes('already depended on')) {
        await this.cf.uploadWorkerModule(this.scriptName, DEFAULT_DO_WORKER_SCRIPT, bindings, { skipDoMigrations: true });
      } else {
        throw error;
      }
    }
    
    await this.cf.enableWorkerSubdomain(this.scriptName);
  }

  // Internal: centralized Worker HTTP client factory
  private workerClient(cfg: { databaseName: string; dbToken: string; gatewayKey: string }): KuratchiDoHttpClient {
    return new KuratchiDoHttpClient({
      databaseName: cfg.databaseName,
      workersSubdomain: this.workersSubdomain,
      dbToken: cfg.dbToken,
      gatewayKey: cfg.gatewayKey,
      scriptName: this.scriptName,
    });
  }

  // Public API: returns ORM client and ensures migrations are applied on connect
  async database(args: { databaseName: string; dbToken: string; gatewayKey: string; schema: DatabaseSchema | SchemaDsl }): Promise<Record<string, TableApi>> {
    const { databaseName, dbToken, gatewayKey, schema } = args;
    if (!databaseName || !dbToken || !gatewayKey) throw new Error('KuratchiDO.database requires databaseName, dbToken, and gatewayKey');
    if (!schema) throw new Error('KuratchiDO.database requires a schema (DatabaseSchema or SchemaDsl)');

    const http = this.workerClient({ databaseName, dbToken, gatewayKey });

    const exec = (sql: string, params?: any[]) => http.query(sql, params);
    const normalized = ensureDbSchema(schema);

    // Apply migrations from bundle for this schema (expects /migrations-<name>)
    await this.applyMigrations(http, normalized.name);

    return createClientFromJsonSchema(exec, normalized);
  }

  // Internal: apply migrations using Vite-bundled loader and track in migrations_history
  private async applyMigrations(http: KuratchiDoHttpClient, dirName: string): Promise<void> {
    const { journal, migrations } = await loadMigrations(dirName);

    const createTable = await http.exec(
      'CREATE TABLE IF NOT EXISTS migrations_history (id INTEGER PRIMARY KEY AUTOINCREMENT, tag TEXT NOT NULL UNIQUE, created_at INTEGER);'
    );
    if (!createTable || createTable.success === false) {
      throw new Error(`Failed to ensure migrations_history table: ${createTable?.error || 'unknown error'}`);
    }

    const appliedRes = await http.query<{ tag: string }>('SELECT tag FROM migrations_history');
    if (!appliedRes || appliedRes.success === false) {
      throw new Error(`Failed to read migrations history: ${appliedRes?.error || 'unknown error'}`);
    }
    const applied = new Set<string>((appliedRes.results as any[] | undefined)?.map((r: any) => r.tag) || []);

    for (const entry of journal.entries) {
      const key = `m${String(entry.idx).padStart(4, '0')}`;
      const tag = entry.tag as string;
      if (applied.has(tag)) continue;
      const getSql = migrations[key];
      if (!getSql) throw new Error(`Missing migration loader for ${key} (${tag})`);
      let sql = await getSql();
      if (typeof sql === 'object' && (sql as any)?.default) sql = (sql as any).default;

      // Our migrator emits semicolon-terminated statements
      const statements = String(sql)
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length)
        .map((s) => (s.endsWith(';') ? s : s + ';'));

      const batch = statements.map((q) => ({ query: q, params: [] as any[] }));
      batch.push({ query: 'INSERT INTO migrations_history (tag, created_at) VALUES (?, ?);', params: [tag, Date.now()] });

      const res = await http.batch(batch);
      if (!res || res.success === false) {
        throw new Error(`Migration ${key}/${tag} failed: ${res?.error || 'unknown error'}`);
      }
    }
  }

  // Ensure Worker endpoint is reachable before returning from createDatabase
  private async waitForWorkerEndpoint(databaseName: string, dbToken: string, gatewayKey: string): Promise<boolean> {
    const client = this.workerClient({ databaseName, dbToken, gatewayKey });
    const deadline = Date.now() + 30_000; // up to 30s
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    
    while (true) {
      try {
        const res: any = await client.query('SELECT 1 as test');
        // Check if query succeeded
        if (res && res.success === true) {
          return true;
        }
        if (Date.now() > deadline) break;
        await sleep(2000); // Wait 2s between attempts
      } catch {
        if (Date.now() > deadline) break;
        await sleep(2000);
      }
    }
    return false;
  }

  // Redact internals on logs
  toJSON() {
    return { ensureWorker: '[api]', database: '[api]' } as any;
  }
  [Symbol.for('nodejs.util.inspect.custom')]() { return this.toJSON(); }
}

