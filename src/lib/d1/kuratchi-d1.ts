import { CloudflareClient, type PrimaryLocationHint } from '../cloudflare.js';
import { DEFAULT_D1V2_WORKER_SCRIPT } from './worker-template.js';
import { KuratchiD1v2HttpClient } from './internal-http-client.js';
import { createSignedDbToken } from '../do/token.js';
import type { DatabaseSchema } from '../orm/json-schema.js';
import type { SchemaDsl } from '../schema/types.js';
import { normalizeSchema } from '../schema/normalize.js';
import { generateInitialMigrationBundle } from '../orm/migrator.js';
import { createClientFromJsonSchema, type TableApi } from '../orm/kuratchi-orm.js';

function ensureDbSchema(schema: DatabaseSchema | SchemaDsl): DatabaseSchema {
  const t: any = (schema as any)?.tables;
  if (Array.isArray(t)) return schema as DatabaseSchema;
  return normalizeSchema(schema as SchemaDsl);
}

export interface D1Options {
  apiToken: string;
  accountId: string;
  endpointBase?: string;
  workersSubdomain: string;
  scriptName?: string; // default: 'kuratchi-d1-internal'
}

export class KuratchiD1 {
  private cf: CloudflareClient;
  private workersSubdomain: string;
  private scriptName: string;

  constructor(config: D1Options) {
    this.cf = new CloudflareClient({ apiToken: config.apiToken, accountId: config.accountId, endpointBase: config.endpointBase });
    this.workersSubdomain = config.workersSubdomain;
    this.scriptName = config.scriptName || 'kuratchi-d1-internal';
    try { Object.defineProperty(this, 'cf', { enumerable: false, configurable: false, writable: true }); } catch {}
  }

  /** Rebuild and deploy router with provided D1 bindings in one shot (no merge). */
  async deployRouterWithBindings(apiKey: string, databases: Array<{ name: string; uuid: string }>) {
    if (!apiKey) throw new Error('deployRouterWithBindings(apiKey, databases) requires apiKey');
    const d1Bindings = databases.map((d) => ({ type: 'd1', name: `DB_${d.name}`, id: d.uuid }));
    const bindings = [
      { type: 'secret_text', name: 'API_KEY', text: apiKey },
      ...d1Bindings,
    ];
    await this.cf.uploadWorkerModule(this.scriptName, DEFAULT_D1V2_WORKER_SCRIPT, bindings);
    await this.cf.enableWorkerSubdomain(this.scriptName);
  }

  /**
   * Creates a D1 database and patches the single router worker with a new binding DB_<databaseName>.
   * Returns a per-database signed token that should be persisted by the caller (e.g., Admin DB).
   */
  async createDatabase(opts: { databaseName: string; gatewayKey: string; location?: PrimaryLocationHint; migrate?: boolean; schema?: DatabaseSchema | SchemaDsl; deferBinding?: boolean })
  : Promise<{ database: any; token: string }> {
    const { databaseName, gatewayKey, location } = opts;
    if (!databaseName) throw new Error('createDatabase requires databaseName');
    if (!gatewayKey) throw new Error('createDatabase requires gatewayKey');

    // Ensure router worker exists with gateway key
    await this.ensureWorker(gatewayKey);

    // Create the D1 database
    const databaseResp = await this.cf.createDatabase(databaseName, location);
    const database = (databaseResp as any)?.result ?? databaseResp;
    if (!database || !database.uuid) throw new Error('Failed to create D1 database');

    // Enable read replication to support bookmarks
    try { await this.cf.enableReadReplication(database.uuid); } catch {}

    // Issue signed per-db token
    const token = await createSignedDbToken(databaseName, gatewayKey);

    // Either patch immediately or let caller rebuild bindings in bulk later
    if (!opts.deferBinding) {
      await this.patchBindings(gatewayKey, [
        { type: 'd1', name: `DB_${databaseName}`, id: database.uuid },
      ]);
    }

    // Best-effort: if bound now, wait for router endpoint to respond for this DB
    try { if (!opts.deferBinding) await this.waitForWorkerEndpoint(databaseName, token, gatewayKey); } catch {}

    // Optional initial migration
    if (opts.migrate) {
      if (!opts.schema) throw new Error('KuratchiD1.createDatabase: migrate:true requires a schema');
      const normalized = ensureDbSchema(opts.schema);
      const { migrations } = generateInitialMigrationBundle(normalized);
      const initialSql = await migrations.m0001();
      const client = this.getClient({ databaseName, dbToken: token, gatewayKey });
      const statements = initialSql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length)
        .map((s) => (s.endsWith(';') ? s : s + ';'));
      if (statements.length === 1) {
        const res = await client.query(statements[0]);
        if (!res || res.success === false) throw new Error(`Migration failed: ${res?.error || 'unknown error'}`);
      } else if (statements.length > 1) {
        const res = await client.batch(statements.map((q) => ({ query: q })));
        if (!res || res.success === false) throw new Error(`Migration batch failed: ${res?.error || 'unknown error'}`);
      }
    }

    return { database, token };
  }

  /** Ensure router worker is deployed with API_KEY and current bindings (no-op if already exists). */
  private async ensureWorker(apiKey: string) {
    if (!apiKey) throw new Error('ensureWorker(apiKey) requires a key');
    const existingBindings = await this.getExistingBindingsSafe();
    // Remove any previous API_KEY secret and then prepend the current one
    const preserved = existingBindings.filter((b: any) => !(b?.type === 'secret_text' && b?.name === 'API_KEY'));
    const bindings = [
      { type: 'secret_text', name: 'API_KEY', text: apiKey },
      ...preserved,
    ];
    try {
      await this.cf.uploadWorkerModule(this.scriptName, DEFAULT_D1V2_WORKER_SCRIPT, bindings);
    } catch (e) {
      // If upload fails, rethrow (no DO migrations here)
      throw e;
    }
    await this.cf.enableWorkerSubdomain(this.scriptName);
  }

  /** Patch router bindings by merging new entries with existing and re-uploading. */
  private async patchBindings(apiKey: string, newBindings: any[]) {
    const existing = await this.getExistingBindingsSafe();
    // Build a map for D1 bindings to merge by name, but preserve all non-D1 bindings verbatim
    const nonD1 = existing.filter((b: any) => b?.type !== 'd1' && !(b?.type === 'secret_text' && b?.name === 'API_KEY'));
    const d1Map = new Map<string, any>();
    for (const b of existing) if (b?.type === 'd1' && b?.name) d1Map.set(b.name, b);
    for (const b of newBindings) if (b?.type === 'd1' && b?.name) d1Map.set(b.name, b);
    const mergedD1 = Array.from(d1Map.values());

    const bindings = [
      { type: 'secret_text', name: 'API_KEY', text: apiKey },
      ...nonD1,
      ...mergedD1,
    ];
    await this.cf.uploadWorkerModule(this.scriptName, DEFAULT_D1V2_WORKER_SCRIPT, bindings);
    await this.cf.enableWorkerSubdomain(this.scriptName);
  }

  private async getExistingBindingsSafe(): Promise<any[]> {
    try {
      const meta = await this.cf.getWorkerScript(this.scriptName);
      // Some responses may include result.bindings; otherwise, best-effort empty
      const b = (meta as any)?.result?.bindings || (meta as any)?.bindings || [];
      return Array.isArray(b) ? b : [];
    } catch {
      return [];
    }
  }

  getClient(cfg: { databaseName: string; dbToken: string; gatewayKey: string }) {
    return new KuratchiD1v2HttpClient({
      databaseName: cfg.databaseName,
      dbToken: cfg.dbToken,
      gatewayKey: cfg.gatewayKey,
      workersSubdomain: this.workersSubdomain,
      scriptName: this.scriptName,
    });
  }

  client(
    cfg: { databaseName: string; dbToken: string; gatewayKey: string },
    options: { schema: DatabaseSchema | SchemaDsl }
  ): Record<string, TableApi> {
    const http = this.getClient(cfg);
    const exec = (sql: string, params?: any[]) => http.query(sql, params);
    if (!options?.schema) throw new Error('KuratchiD1.client requires a schema (DatabaseSchema or SchemaDsl)');
    const normalized = ensureDbSchema(options.schema);
    return createClientFromJsonSchema(exec, normalized);
  }

  database(cfg: { databaseName: string; dbToken: string; gatewayKey: string }) {
    // IMPORTANT: reuse a single HTTP client instance to preserve the D1 session bookmark
    const http = this.getClient(cfg);
    return {
      query: <T>(sql: string, params: any[] = []) => http.query<T>(sql, params),
      getClient: () => http,
      client: (options: { schema: DatabaseSchema | SchemaDsl }): Record<string, TableApi> => {
        const exec = (sql: string, params?: any[]) => http.query(sql, params);
        if (!options?.schema) throw new Error('KuratchiD1.database().client requires a schema (DatabaseSchema or SchemaDsl)');
        const normalized = ensureDbSchema(options.schema);
        return createClientFromJsonSchema(exec, normalized);
      },
    };
  }

  /** Delete a D1 database by id */
  async deleteDatabase(databaseId: string) {
    return this.cf.deleteDatabase(databaseId);
  }

  private async waitForWorkerEndpoint(databaseName: string, dbToken: string, gatewayKey: string): Promise<boolean> {
    const client = this.getClient({ databaseName, dbToken, gatewayKey });
    const deadline = Date.now() + 30_000;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    while (true) {
      try {
        const res: any = await client.query('SELECT 1');
        if (res && res.success === true) return true;
        if (Date.now() > deadline) break;
        await sleep(1000);
      } catch {
        if (Date.now() > deadline) break;
        await sleep(1000);
      }
    }
    return false;
  }

  toJSON() { return { ensureWorker: '[api]', database: '[api]' } as any; }
  [Symbol.for('nodejs.util.inspect.custom')]() { return this.toJSON(); }
}

export type { PrimaryLocationHint } from '../cloudflare.js';
