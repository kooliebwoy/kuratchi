/**
 * Core Database Class
 * Main orchestration class using extracted modules
 */

import type {
  DatabaseInstanceConfig,
  CreateDatabaseOptions,
  ClientOptions,
  HttpClientOptions,
  DoHttpClient,
  OrmClient
} from './types.js';
import { CloudflareClient } from '../../utils/cloudflare.js';
import { createSignedDbToken } from '../../utils/token.js';
import { createHttpClient } from '../clients/http-client.js';
import { createOrmClient } from '../clients/orm-client.js';
import { splitSqlStatements } from '../migrations/migration-utils.js';

/**
 * KuratchiDatabase - Durable Objects backed SQLite with instant logical databases
 */
export class KuratchiDatabase {
  private cloudflareClient: CloudflareClient;
  private workersSubdomain: string;
  private scriptName: string;

  constructor(config: DatabaseInstanceConfig) {
    this.cloudflareClient = new CloudflareClient({
      apiToken: config.apiToken,
      accountId: config.accountId,
      endpointBase: config.endpointBase
    });
    this.workersSubdomain = config.workersSubdomain;
    this.scriptName = config.scriptName || 'kuratchi-do-internal';
    
    // Hide CloudflareClient from enumeration
    try {
      Object.defineProperty(this, 'cloudflareClient', {
        enumerable: false,
        configurable: false,
        writable: true
      });
    } catch {}
  }

  /**
   * Create a new logical database
   */
  async createDatabase(options: CreateDatabaseOptions): Promise<{ databaseName: string; token: string }> {
    const { databaseName, gatewayKey, migrate, schema } = options;
    
    if (!databaseName) {
      throw new Error('databaseName is required');
    }
    if (!gatewayKey) {
      throw new Error('gatewayKey is required');
    }
    
    // Create signed database token
    // For admin DB, use 100-year TTL to avoid token expiration deadlock
    // For org DBs, use 1-year TTL (can be refreshed via admin DB)
    const isAdminDb = databaseName === 'kuratchi-admin' || databaseName.includes('admin');
    const ttl = isAdminDb 
      ? 100 * 365 * 24 * 60 * 60 * 1000  // 100 years (essentially permanent)
      : 365 * 24 * 60 * 60 * 1000;       // 1 year (renewable via admin)
    const token = await createSignedDbToken(databaseName, gatewayKey, ttl);
    
    // Check if we have direct DO binding (ONLY in wrangler dev or production Workers)
    // Note: Local SvelteKit dev (npm run dev) doesn't have DO bindings - must use HTTP
    const platform = (globalThis as any).__sveltekit_platform || (globalThis as any).platform;
    
    // Detect local SvelteKit dev using $app/environment dev flag or lack of platform.env
    let isLocalDev = false;
    try {
      // Try to import SvelteKit's dev flag (only available in SvelteKit context)
      const { dev } = await import('$app/environment');
      isLocalDev = dev && !platform?.env;
    } catch {
      // Not in SvelteKit context or import failed - check for platform.env absence
      isLocalDev = !platform?.env;
    }
    
    if (!isLocalDev) {
      const doBinding = platform?.env?.[databaseName] || platform?.env?.KURATCHI_DO;
      
      if (doBinding && typeof doBinding.sql === 'function') {
        console.log(`[Kuratchi] Using direct DO binding for ${databaseName} - skipping deploy/wait`);
        
        // Apply initial schema migration if requested (using direct binding)
        if (migrate && schema) {
          await this.applyInitialMigrationDirect(doBinding, schema);
        }
        
        return { databaseName, token };
      }
    }
    
    // Fallback: HTTP flow
    // Note: Worker should already be deployed via CLI (kuratchi-cli admin create)
    // Each database is just a new DO instance accessed via the same worker
    console.log(`[Kuratchi] No direct binding for ${databaseName} - using HTTP flow`);
    
    // Create HTTP client for this database (new DO instance)
    const httpClient = this.httpClient({ databaseName, dbToken: token, gatewayKey });
    
    // Apply initial schema migration if requested (via HTTP)
    if (migrate && schema) {
      await this.applyInitialMigration(httpClient, schema);
    }
    
    return { databaseName, token };
  }

  /**
   * Get HTTP client for raw SQL access
   */
  httpClient(options: HttpClientOptions): DoHttpClient {
    return createHttpClient({
      databaseName: options.databaseName,
      dbToken: options.dbToken,
      gatewayKey: options.gatewayKey,
      workersSubdomain: this.workersSubdomain,
      scriptName: this.scriptName
    });
  }

  /**
   * Get ORM client with auto-migrations
   */
  async ormClient(options: ClientOptions): Promise<OrmClient> {
    const { databaseName, dbToken, gatewayKey, schema } = options;
    
    if (!databaseName || !dbToken || !gatewayKey) {
      throw new Error('databaseName, dbToken, and gatewayKey are required');
    }
    if (!schema) {
      throw new Error('schema is required');
    }
    
    const httpClient = this.httpClient({ databaseName, dbToken, gatewayKey });
    
    return createOrmClient({
      httpClient,
      schema,
      databaseName
    });
  }

  /**
   * Legacy alias for ormClient (for backward compatibility)
   * @deprecated Use ormClient instead
   */
  async client(options: ClientOptions): Promise<OrmClient> {
    return this.ormClient(options);
  }

  /**
   * Get both ORM client and raw SQL access
   */
  async connect(options: ClientOptions): Promise<{
    orm: OrmClient;
    query: DoHttpClient['query'];
    exec: DoHttpClient['exec'];
    batch: DoHttpClient['batch'];
    raw: DoHttpClient['raw'];
    first: DoHttpClient['first'];
    kv: DoHttpClient['kv'];
  }> {
    const { databaseName, dbToken, gatewayKey } = options;
    const httpClient = this.httpClient({ databaseName, dbToken, gatewayKey });
    const orm = await this.ormClient(options);
    
    return {
      orm,
      query: httpClient.query,
      exec: httpClient.exec,
      batch: httpClient.batch,
      raw: httpClient.raw,
      first: httpClient.first,
      kv: httpClient.kv
    };
  }

  /**
   * Apply initial migration during database creation
   */
  private async applyInitialMigration(client: DoHttpClient, schema: any): Promise<void> {
    const { generateInitialMigration, ensureNormalizedSchema } = await import('../migrations/migration-utils.js');
    
    const normalized = ensureNormalizedSchema(schema);
    const { migrations } = generateInitialMigration(normalized);
    const initialSql = await migrations.m0001();
    
    // Split into statements
    const statements = splitSqlStatements(initialSql);
    
    if (statements.length === 1) {
      const result = await client.query(statements[0]);
      if (!result || result.success === false) {
        throw new Error(`Migration failed: ${result?.error || 'unknown error'}`);
      }
    } else if (statements.length > 1) {
      const result = await client.batch(statements.map((query) => ({ query })));
      if (!result || result.success === false) {
        throw new Error(`Migration batch failed: ${result?.error || 'unknown error'}`);
      }
    }
  }

  /**
   * Apply initial migration using direct DO binding
   */
  private async applyInitialMigrationDirect(doBinding: any, schema: any): Promise<void> {
    const { generateInitialMigration, ensureNormalizedSchema } = await import('../migrations/migration-utils.js');
    
    const normalized = ensureNormalizedSchema(schema);
    const { migrations } = generateInitialMigration(normalized);
    const initialSql = await migrations.m0001();
    
    // Split into statements
    const statements = splitSqlStatements(initialSql);
    
    // Execute directly on DO binding
    for (const sql of statements) {
      await doBinding.sql(sql);
    }
  }

  /**
   * Hide internals in logs
   */
  toJSON() {
    return { type: 'KuratchiDatabase', scriptName: this.scriptName };
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.toJSON();
  }
}
