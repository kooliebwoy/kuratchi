import { CloudflareClient } from '../cloudflare.js';
import { DEFAULT_DO_WORKER_SCRIPT } from './worker-template.js';
import { KuratchiDoHttpClient } from './internal-http-client.js';
import { createSignedDbToken } from './token.js';
import type { DatabaseSchema } from '../orm/json-schema.js';
import { generateInitialMigrationBundle } from '../orm/migrator.js';
import { createClientFromJsonSchema, type TableApi } from '../orm/kuratchi-orm.js';
// Convenience re-exports for normalized standard schemas
export { adminSchema, organizationSchema } from '../index.js';

// Note: DO client requires explicit DatabaseSchema. Typed alias clients have been removed.

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
  async createDatabase(opts: { databaseName: string; gatewayKey: string; migrate?: boolean; schema?: DatabaseSchema }): Promise<{ databaseName: string; token: string }> {
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
      // DO runtime requires a concrete DatabaseSchema object (TS), not a string alias
      if (!opts.schema) {
        throw new Error('KuratchiDO.createDatabase: migrate:true requires a TS DatabaseSchema object.');
      }
      const { migrations } = generateInitialMigrationBundle(opts.schema);
      const initialSql = await migrations.m0001();
      const client = this.getClient({ databaseName, dbToken: token, gatewayKey });
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

  getClient(cfg: { databaseName: string; dbToken: string; gatewayKey: string; bookmark?: string }) {
    // bookmark is unused for DO
    return new KuratchiDoHttpClient({
      databaseName: cfg.databaseName,
      workersSubdomain: this.workersSubdomain,
      dbToken: cfg.dbToken,
      gatewayKey: cfg.gatewayKey,
      scriptName: this.scriptName,
    });
  }

  // Top-level sugar: property client with explicit TS DatabaseSchema only
  client(
    cfg: { databaseName: string; dbToken: string; gatewayKey: string },
    options: { schema: DatabaseSchema }
  ): Record<string, TableApi> {
    const exec = (sql: string, params?: any[]) => this.getClient(cfg as any).query(sql, params);
    if (!options?.schema) throw new Error('KuratchiDO.client requires a TS DatabaseSchema');
    return createClientFromJsonSchema(exec, options.schema);
  }

  database(cfg: { databaseName: string; dbToken: string; gatewayKey: string }) {
    return {
      query: <T>(sql: string, params: any[] = []) => this.getClient(cfg as any).query<T>(sql, params),
      getClient: () => this.getClient(cfg as any),
      client: (options: { schema: DatabaseSchema }): Record<string, TableApi> => {
        const exec = (sql: string, params?: any[]) => this.getClient(cfg as any).query(sql, params);
        if (!options?.schema) throw new Error('KuratchiDO.database().client requires a TS DatabaseSchema');
        return createClientFromJsonSchema(exec, options.schema);
      },
    };
  }

  // Ensure Worker endpoint is reachable before returning from createDatabase
  private async waitForWorkerEndpoint(databaseName: string, dbToken: string, gatewayKey: string): Promise<boolean> {
    const client = this.getClient({ databaseName, dbToken, gatewayKey });
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

