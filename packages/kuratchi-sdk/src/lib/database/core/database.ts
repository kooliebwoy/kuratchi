/**
 * Core Database Class
 * Main orchestration class using D1 databases with individual workers
 */

import type {
  DatabaseInstanceConfig,
  CreateDatabaseOptions,
  ClientOptions,
  HttpClientOptions,
  D1Client,
  OrmClient
} from './types.js';
import { CloudflareClient } from '../../utils/cloudflare.js';
import { createSignedDbToken } from '../../utils/token.js';
import { createHttpClient } from '../clients/http-client.js';
import { createOrmClient } from '../clients/orm-client.js';
import { splitSqlStatements } from '../migrations/migration-utils.js';
import { deployWorker } from '../deployment/worker-deployment.js';

/**
 * KuratchiDatabase - D1 backed SQLite with individual workers per database
 * Each database gets its own D1 instance and dedicated worker for isolation and performance
 */
export class KuratchiDatabase {
  private cloudflareClient: CloudflareClient;
  private workersSubdomain: string;
  private scriptNamePrefix: string;

  constructor(config: DatabaseInstanceConfig) {
    this.cloudflareClient = new CloudflareClient({
      apiToken: config.apiToken,
      accountId: config.accountId,
      endpointBase: config.endpointBase
    });
    this.workersSubdomain = config.workersSubdomain;
    this.scriptNamePrefix = config.scriptName || 'kuratchi-d1';
    
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
   * Create a new D1 database with dedicated worker
   * Always uses HTTP mode - databases are accessed via deployed workers
   * For direct D1 bindings (e.g., admin DB in SvelteKit), pass the binding directly to the plugin
   */
  async createDatabase(options: CreateDatabaseOptions): Promise<{ databaseName: string; token: string; databaseId?: string; workerName?: string }> {
    const { databaseName, gatewayKey, migrate, schema, schemaName } = options;
    
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
    
    // Deploy a new D1 database with dedicated worker (always HTTP mode)
    console.log(`[Kuratchi] Deploying D1 worker for ${databaseName}`);
    
    // Generate worker name from database name (sanitize for worker naming)
    const workerName = `${this.scriptNamePrefix}-${databaseName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
    
    // Deploy D1 database and worker
    const { databaseId, workerName: deployedWorkerName } = await deployWorker({
      scriptName: workerName,
      databaseName,
      gatewayKey,
      cloudflareClient: this.cloudflareClient
    });
    
    console.log(`[Kuratchi] D1 worker deployed: ${deployedWorkerName} (DB ID: ${databaseId})`);
    
    // Create HTTP client for this database
    const httpClient = this.httpClient({ 
      databaseName, 
      dbToken: token, 
      gatewayKey,
      scriptName: deployedWorkerName
    });
    
    // Wait for worker to be ready before applying migrations
    console.log(`[Kuratchi] Waiting for worker ${deployedWorkerName} to be ready...`);
    const { waitForWorker } = await import('../deployment/worker-wait.js');
    const isReady = await waitForWorker({ client: httpClient, timeoutMs: 30000, intervalMs: 2000 });
    
    if (!isReady) {
      throw new Error(`Worker ${deployedWorkerName} did not become ready within 30 seconds`);
    }
    
    console.log(`[Kuratchi] Worker ${deployedWorkerName} is ready`);
    
    // Apply migrations if requested (via HTTP)
    if (migrate && schemaName) {
      await this.applyInitialMigration(httpClient, schema, schemaName);
    }
    
    return { databaseName, token, databaseId, workerName: deployedWorkerName };
  }

  /**
   * Delete a database and its dedicated worker
   * Cleans up both the D1 database and the Durable Object worker
   */
  async deleteDatabase(options: { databaseName: string; databaseId?: string }): Promise<{ success: boolean }> {
    const { databaseName, databaseId } = options;
    
    if (!databaseName) {
      throw new Error('databaseName is required');
    }
    
    console.log(`[Kuratchi] Deleting database and worker for ${databaseName}`);
    
    // Generate worker name from database name
    const workerName = `${this.scriptNamePrefix}-${databaseName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
    
    try {
      // Delete the worker script
      console.log(`[Kuratchi] Deleting worker: ${workerName}`);
      await this.cloudflareClient.deleteWorkerScript(workerName);
      console.log(`[Kuratchi] ✓ Worker deleted: ${workerName}`);
    } catch (error: any) {
      // If worker doesn't exist, that's fine
      if (error.message?.includes('10007') || error.message?.includes('not found')) {
        console.log(`[Kuratchi] Worker ${workerName} not found (already deleted)`);
      } else {
        console.warn(`[Kuratchi] Failed to delete worker ${workerName}:`, error.message);
      }
    }
    
    // Delete the D1 database if we have the ID
    if (databaseId) {
      try {
        console.log(`[Kuratchi] Deleting D1 database: ${databaseId}`);
        await this.cloudflareClient.deleteDatabase(databaseId);
        console.log(`[Kuratchi] ✓ D1 database deleted: ${databaseId}`);
      } catch (error: any) {
        // If database doesn't exist, that's fine
        if (error.message?.includes('not found')) {
          console.log(`[Kuratchi] D1 database ${databaseId} not found (already deleted)`);
        } else {
          console.warn(`[Kuratchi] Failed to delete D1 database ${databaseId}:`, error.message);
        }
      }
    }
    
    return { success: true };
  }

  /**
   * Get HTTP client for raw SQL access
   */
  httpClient(options: HttpClientOptions): D1Client {
    // Generate script name if not provided
    const scriptName = options.scriptName || 
      `${this.scriptNamePrefix}-${options.databaseName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
    
    return createHttpClient({
      databaseName: options.databaseName,
      dbToken: options.dbToken,
      gatewayKey: options.gatewayKey,
      workersSubdomain: this.workersSubdomain,
      scriptName
    });
  }

  /**
   * Get ORM client with auto-migrations
   */
  async ormClient(options: ClientOptions): Promise<OrmClient> {
    const { databaseName, dbToken, gatewayKey, schema, scriptName } = options;
    
    if (!databaseName || !dbToken || !gatewayKey) {
      throw new Error('databaseName, dbToken, and gatewayKey are required');
    }
    if (!schema) {
      throw new Error('schema is required');
    }
    
    const httpClient = this.httpClient({ databaseName, dbToken, gatewayKey, scriptName });
    
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
    instance: KuratchiDatabase;
    orm: OrmClient;
    query: D1Client['query'];
    exec: D1Client['exec'];
    batch: D1Client['batch'];
    raw: D1Client['raw'];
    first: D1Client['first'];
  }> {
    const { databaseName, dbToken, gatewayKey } = options;
    const httpClient = this.httpClient({ databaseName, dbToken, gatewayKey });
    const orm = await this.ormClient(options);
    
    return {
      instance: this,
      orm,
      query: httpClient.query,
      exec: httpClient.exec,
      batch: httpClient.batch,
      raw: httpClient.raw,
      first: httpClient.first
    };
  }

  /**
   * Apply migrations during database creation (via HTTP)
   * Uses the same migration runner as runtime, loading from generated migrations folder
   */
  private async applyInitialMigration(client: D1Client, schema: any, schemaName: string): Promise<void> {
    const { applyMigrations } = await import('../migrations/migration-runner.js');
    
    console.log('[Kuratchi] Applying migrations via HTTP...');
    
    // Use the existing migration runner - it will:
    // 1. Create migrations_history table
    // 2. Load migrations from /migrations-{schemaName} folder
    // 3. Apply all pending migrations
    // 4. Skip already-applied migrations
    await applyMigrations({
      client,
      schemaName,
      schema  // Fallback if no migrations folder exists
    });
    
    console.log('[Kuratchi] ✓ Migrations applied');
  }

  /**
   * Hide internals in logs
   */
  toJSON() {
    return { type: 'KuratchiDatabase', scriptNamePrefix: this.scriptNamePrefix };
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.toJSON();
  }
}
