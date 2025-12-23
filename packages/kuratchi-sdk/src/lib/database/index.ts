/**
 * Kuratchi Database - Public API
 * Clean, modular exports for the database module
 */

// Core class
export { KuratchiDatabase } from './core/database.js';

// Types
export type {
  DatabaseConfig,
  D1Client,
  QueryResult,
  OrmClient,
  ClientOptions,
  HttpClientOptions,
  CreateDatabaseOptions,
  DatabaseInstanceConfig
} from './core/types.js';

// Schema types
export type { SchemaDsl, TableDsl } from '../utils/types.js';
export type { DatabaseSchema, Table, Column, Index } from './migrations/schema.js';

// Legacy type alias
export type { DatabaseInstanceConfig as DOOptions } from './core/types.js';

// Client factories
export { createHttpClient, createValidatedHttpClient } from './clients/http-client.js';
export { createOrmClient, createValidatedOrmClient } from './clients/orm-client.js';

// RPC configuration (for direct Worker-to-Worker calls)
export { setRpcConfig, getRpcConfig, isRpcEnabled, getRpcBindingName } from './rpc-config.js';
export type { RpcConfig } from './rpc-config.js';

// Deployment utilities
export { deployWorker, isWorkerDeployed } from './deployment/worker-deployment.js';
export { waitForWorker, isWorkerReady } from './deployment/worker-wait.js';

// Migration utilities
export { applyMigrations, hasPendingMigrations } from './migrations/migration-runner.js';
export {
  ensureNormalizedSchema,
  generateInitialMigration,
  splitSqlStatements,
  unwrapModuleExport
} from './migrations/migration-utils.js';

// Configuration
export {
  getDoEnvironment,
  getAdminEnvironment,
  validateDoEnvironment,
  validateAdminEnvironment
} from './core/config.js';
export type { EnvironmentConfig, AdminEnvironmentConfig } from './core/config.js';

// Convenience namespace API
import { getDoEnvironment, getAdminEnvironment } from './core/config.js';
import { KuratchiDatabase } from './core/database.js';
// Uses example schema as default for database.admin() helper (legacy convenience)
import { adminSchemaDsl } from '../schema/admin.example.js';
import type { SchemaType, D1Client, OrmClient, ClientOptions } from './core/types.js';

/**
 * Convenience namespace for common database operations
 */
export const database = {
  /**
   * Create a database instance (reads env by default)
   */
  instance(config?: {
    workersSubdomain?: string;
    accountId?: string;
    apiToken?: string;
    scriptName?: string;
  }): KuratchiDatabase {
    const envConfig = getDoEnvironment();
    
    return new KuratchiDatabase({
      workersSubdomain: config?.workersSubdomain || envConfig.workersSubdomain!,
      accountId: config?.accountId || envConfig.accountId!,
      apiToken: config?.apiToken || envConfig.apiToken!,
      scriptName: config?.scriptName || envConfig.scriptName
    });
  },

  /**
   * Build an ORM client for a specific database
   */
  async client(args: {
    databaseName: string;
    dbToken: string;
    schema: SchemaType;
    gatewayKey?: string;
    instance?: KuratchiDatabase;
    scriptName?: string;
    skipMigrations?: boolean;
  }): Promise<OrmClient> {
    const envConfig = getDoEnvironment();
    const instance = args.instance || database.instance();
    const gatewayKey = args.gatewayKey || envConfig.gatewayKey!;
    
    return instance.ormClient({
      databaseName: args.databaseName,
      dbToken: args.dbToken,
      gatewayKey,
      schema: args.schema,
      scriptName: args.scriptName,
      skipMigrations: args.skipMigrations
    });
  },

  /**
   * Get HTTP client for schema-less SQL access
   */
  forDatabaseHttpClient(args: {
    databaseName: string;
    dbToken: string;
    gatewayKey?: string;
    instance?: KuratchiDatabase;
  }): {
    query: D1Client['query'];
    exec: D1Client['exec'];
    batch: D1Client['batch'];
    raw: D1Client['raw'];
    first: D1Client['first'];
  } {
    const envConfig = getDoEnvironment();
    const gatewayKey = args.gatewayKey || envConfig.gatewayKey;
    
    if (!gatewayKey) {
      throw new Error('KURATCHI_GATEWAY_KEY is required');
    }
    
    const instance = args.instance || database.instance();
    const httpClient = instance.httpClient({ databaseName: args.databaseName, dbToken: args.dbToken, gatewayKey });
    
    return {
      query: httpClient.query.bind(httpClient),
      exec: httpClient.exec.bind(httpClient),
      batch: httpClient.batch.bind(httpClient),
      raw: httpClient.raw.bind(httpClient),
      first: httpClient.first.bind(httpClient)
    };
  },

  /**
   * Admin database helper (auto-config from env)
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
    const envConfig = getDoEnvironment();
    const adminEnv = getAdminEnvironment();
    
    if (!envConfig.gatewayKey) {
      throw new Error('KURATCHI_GATEWAY_KEY is required');
    }
    if (!adminEnv.dbToken) {
      throw new Error('KURATCHI_ADMIN_DB_TOKEN is required');
    }
    
    const instance = database.instance();
    const { orm, query, exec, batch, raw, first } = await instance.connect({
      databaseName: adminEnv.databaseName,
      dbToken: adminEnv.dbToken,
      gatewayKey: envConfig.gatewayKey,
      schema: adminSchemaDsl as any
    });
    
    return { instance, orm, query, exec, batch, raw, first };
  },

  /**
   * Create a new database (D1 with dedicated worker)
   */
  async create(args: {
    name: string;
    migrate?: boolean;
    schema?: SchemaType;
    schemaName?: string;  // Name of migrations folder (e.g., 'organization', 'admin', 'foo')
    instance?: KuratchiDatabase;
  }): Promise<{ databaseName: string; token: string; databaseId?: string; workerName?: string }> {
    const envConfig = getDoEnvironment();
    
    if (!envConfig.gatewayKey) {
      throw new Error('KURATCHI_GATEWAY_KEY is required');
    }
    
    const instance = args.instance || database.instance();
    
    return instance.createDatabase({
      databaseName: args.name,
      gatewayKey: envConfig.gatewayKey,
      migrate: !!args.migrate,
      schema: args.schema,
      schemaName: args.schemaName
    });
  },

  /**
   * Delete a database (D1 + worker)
   * @param args.databaseId - The D1 database UUID
   * @param args.workerName - Optional worker name to delete (if different from database name)
   */
  async delete(args: { 
    databaseId: string; 
    workerName?: string;
    apiToken?: string;
    accountId?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const envConfig = getDoEnvironment();
    
    const apiToken = args.apiToken || envConfig.apiToken;
    const accountId = args.accountId || envConfig.accountId;
    
    if (!apiToken || !accountId) {
      return { success: false, error: 'API token and account ID are required' };
    }
    
    try {
      // Import CloudflareClient dynamically to avoid circular deps
      const { CloudflareClient } = await import('../utils/cloudflare.js');
      const client = new CloudflareClient({ apiToken, accountId });
      
      // Delete worker first if provided
      if (args.workerName) {
        try {
          await client.deleteWorkerScript(args.workerName);
          console.log(`[database.delete] Deleted worker: ${args.workerName}`);
        } catch (workerErr: any) {
          console.warn(`[database.delete] Failed to delete worker ${args.workerName}:`, workerErr.message);
          // Continue to delete database
        }
      }
      
      // Delete D1 database
      const result = await client.deleteDatabase(args.databaseId);
      
      if (result.success) {
        console.log(`[database.delete] Deleted database: ${args.databaseId}`);
        return { success: true };
      } else {
        return { success: false, error: JSON.stringify(result.errors) };
      }
    } catch (err: any) {
      console.error('[database.delete] Error:', err);
      return { success: false, error: err.message };
    }
  }
};
