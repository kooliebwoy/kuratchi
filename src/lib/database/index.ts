/**
 * Kuratchi Database - Public API
 * Clean, modular exports for the database module
 */

// Core class
export { KuratchiDatabase } from './core/database.js';

// Types
export type {
  QueryResult,
  DoKvClient,
  DoHttpClient,
  DatabaseConfig,
  DatabaseInstanceConfig,
  CreateDatabaseOptions,
  ClientOptions,
  HttpClientOptions,
  OrmClient,
  SchemaType,
  KvGetOptions,
  KvGetResult,
  KvPutOptions,
  KvPutResult,
  KvDeleteOptions,
  KvDeleteResult,
  KvListOptions,
  KvListResult,
  KvListKey,
  KvEncoding
} from './core/types.js';

// Legacy type alias
export type { DatabaseInstanceConfig as DOOptions } from './core/types.js';

// Client factories
export { createHttpClient, createValidatedHttpClient } from './clients/http-client.js';
export { createKvClient } from './clients/kv-client.js';
export { createOrmClient, createValidatedOrmClient } from './clients/orm-client.js';

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
import type { SchemaType, DoHttpClient, DoKvClient, OrmClient } from './core/types.js';

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
  }): Promise<OrmClient> {
    const envConfig = getDoEnvironment();
    const instance = args.instance || database.instance();
    const gatewayKey = args.gatewayKey || envConfig.gatewayKey!;
    
    return instance.ormClient({
      databaseName: args.databaseName,
      dbToken: args.dbToken,
      gatewayKey,
      schema: args.schema
    });
  },

  /**
   * Get HTTP client for schema-less SQL access
   */
  forDatabase(args: {
    databaseName: string;
    dbToken: string;
    gatewayKey?: string;
    instance?: KuratchiDatabase;
  }): {
    query: DoHttpClient['query'];
    exec: DoHttpClient['exec'];
    batch: DoHttpClient['batch'];
    raw: DoHttpClient['raw'];
    first: DoHttpClient['first'];
    kv: DoKvClient;
  } {
    const envConfig = getDoEnvironment();
    const gatewayKey = args.gatewayKey || envConfig.gatewayKey;
    
    if (!gatewayKey) {
      throw new Error('KURATCHI_GATEWAY_KEY is required');
    }
    
    const instance = args.instance || database.instance();
    const httpClient = instance.httpClient({
      databaseName: args.databaseName,
      dbToken: args.dbToken,
      gatewayKey
    });
    
    return {
      query: httpClient.query.bind(httpClient),
      exec: httpClient.exec.bind(httpClient),
      batch: httpClient.batch.bind(httpClient),
      raw: httpClient.raw.bind(httpClient),
      first: httpClient.first.bind(httpClient),
      kv: httpClient.kv
    };
  },

  /**
   * Admin database helper (auto-config from env)
   */
  async admin(): Promise<{
    instance: KuratchiDatabase;
    orm: OrmClient;
    query: DoHttpClient['query'];
    exec: DoHttpClient['exec'];
    batch: DoHttpClient['batch'];
    raw: DoHttpClient['raw'];
    first: DoHttpClient['first'];
    kv: DoKvClient;
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
    const { orm, query, exec, batch, raw, first, kv } = await instance.connect({
      databaseName: adminEnv.databaseName,
      dbToken: adminEnv.dbToken,
      gatewayKey: envConfig.gatewayKey,
      schema: adminSchemaDsl as any
    });
    
    return { instance, orm, query, exec, batch, raw, first, kv };
  },

  /**
   * Create a new database
   */
  async create(args: {
    name: string;
    migrate?: boolean;
    schema?: SchemaType;
    instance?: KuratchiDatabase;
  }): Promise<{ databaseName: string; token: string }> {
    const envConfig = getDoEnvironment();
    
    if (!envConfig.gatewayKey) {
      throw new Error('KURATCHI_GATEWAY_KEY is required');
    }
    
    const instance = args.instance || database.instance();
    
    return instance.createDatabase({
      databaseName: args.name,
      gatewayKey: envConfig.gatewayKey,
      migrate: !!args.migrate,
      schema: args.schema
    });
  },

  /**
   * Delete a database (placeholder)
   */
  async delete(_args: { name: string; instance?: KuratchiDatabase }): Promise<void> {
    throw new Error('database.delete is not implemented yet');
  }
};
