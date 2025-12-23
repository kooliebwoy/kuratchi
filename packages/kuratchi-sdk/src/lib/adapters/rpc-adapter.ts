/**
 * RPC Service Binding Adapter
 * For Worker-to-Worker direct calls via service bindings
 * 
 * This adapter is the single source of truth for all RPC functionality:
 * - Configuration state (binding name, adapter preference)
 * - Execution adapter creation
 * - DatabaseContext implementation for high-level database operations
 * - RPC availability checks
 */

import type { QueryResult, ExecutionAdapter, DatabaseAdapterType, RpcConfig, OrmClient, SchemaType, RpcAdapterConfig } from './types.js';
import type {
  DatabaseContext,
  DatabaseContextConfig,
  OrgDatabaseInfo,
  CreateOrgDatabaseOptions,
  CreateOrgDatabaseResult,
  GetOrgDatabaseOptions
} from './database-context.js';
import { createOrmClient } from '../database/clients/orm-client.js';
import { getCache } from '../cache/index.js';

// ============================================================================
// Explicit Adapter Factory
// ============================================================================

/**
 * Create an RPC adapter configuration
 * Use this to explicitly configure RPC mode for plugins
 * 
 * @example
 * ```ts
 * organizationPlugin({
 *   organizationSchema,
 *   adapter: rpcAdapter({ binding: 'KURATCHI_DATABASE' })
 * })
 * ```
 */
export function rpcAdapter(options: { binding: string }): RpcAdapterConfig {
  return {
    type: 'rpc',
    binding: options.binding
  };
}

// ============================================================================
// RPC Configuration State (legacy - for backward compatibility)
// ============================================================================

// Module-level singleton for RPC config
let rpcConfig: RpcConfig = {
  adapter: 'auto',
  enabled: false
};

/**
 * Set the RPC configuration
 * Called by kuratchi() when database.rpcBinding is provided
 */
export function setRpcConfig(config: Partial<RpcConfig>): void {
  const nextBindingName = config.bindingName ?? rpcConfig.bindingName;
  const nextAdapter =
    config.adapter ??
    (config.bindingName ? 'rpc' : rpcConfig.adapter ?? 'auto');

  rpcConfig = {
    bindingName: nextBindingName,
    adapter: nextAdapter,
    enabled: nextAdapter === 'rpc' && !!nextBindingName
  };
}

/**
 * Get the current RPC configuration
 */
export function getRpcConfig(): RpcConfig {
  return rpcConfig;
}

/**
 * Check if RPC is enabled
 */
export function isRpcEnabled(): boolean {
  return rpcConfig.adapter === 'rpc' && !!rpcConfig.bindingName;
}

/**
 * Get the RPC binding name
 */
export function getRpcBindingName(): string | undefined {
  return rpcConfig.bindingName;
}

/**
 * Get the preferred adapter type
 */
export function getAdapterPreference(): DatabaseAdapterType {
  return rpcConfig.adapter ?? 'auto';
}

// ============================================================================
// RPC Execution Adapter
// ============================================================================

/**
 * Create an adapter for RPC service binding
 * Use when accessing a database via a service binding to another worker
 * 
 * The service binding exposes full API: run, exec, batch, first, raw
 * The dbName is passed to identify which DO instance to use.
 * 
 * @param serviceBinding - The service binding (e.g., env.BACKEND)
 * @param dbName - Database name to identify the DO instance
 */
export function createRpcAdapter(serviceBinding: any, dbName: string): ExecutionAdapter {
  if (!serviceBinding) {
    throw new Error('Service binding is required for RPC adapter');
  }
  if (!dbName) {
    throw new Error('Database name is required for RPC adapter');
  }
  
  // The execution adapter uses run for standard queries
  return async (sql: string, params?: any[]): Promise<QueryResult<any>> => {
    try {
      const payload = {
        dbName,
        query: sql,
        params: params || []
      };
      
      // Use run for standard queries (SELECT, INSERT, UPDATE, DELETE)
      const result = await serviceBinding.run(payload);
      
      return {
        success: result.success ?? true,
        data: result.results,
        results: result.results,
        error: result.error,
        meta: result.meta
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || String(error)
      };
    }
  };
}

/**
 * Create a full RPC client with all database methods
 * Used by migration client and other components that need exec, batch, etc.
 */
export function createRpcClient(serviceBinding: any, dbName: string) {
  if (!serviceBinding) {
    throw new Error('Service binding is required for RPC client');
  }
  if (!dbName) {
    throw new Error('Database name is required for RPC client');
  }
  
  return {
    // run - standard parameterized queries
    run: async (sql: string, params?: any[]): Promise<QueryResult<any>> => {
      try {
        const result = await serviceBinding.run({ dbName, query: sql, params: params || [] });
        return {
          success: result.success ?? true,
          data: result.results,
          results: result.results,
          error: result.error,
          meta: result.meta
        };
      } catch (error: any) {
        return { success: false, error: error?.message || String(error) };
      }
    },
    
    // exec - raw SQL execution (for migrations, DDL statements)
    exec: async (sql: string): Promise<QueryResult<any>> => {
      try {
        const result = await serviceBinding.exec({ dbName, query: sql });
        return { success: result.success ?? true, error: result.error };
      } catch (error: any) {
        return { success: false, error: error?.message || String(error) };
      }
    },
    
    // batch - multiple queries in a transaction
    batch: async (queries: Array<{ query: string; params?: any[] }>): Promise<QueryResult<any>> => {
      try {
        const result = await serviceBinding.batch({ dbName, queries });
        return { success: result.success ?? true, error: result.error };
      } catch (error: any) {
        return { success: false, error: error?.message || String(error) };
      }
    },
    
    // first - get first row
    first: async (sql: string, params?: any[]): Promise<QueryResult<any>> => {
      try {
        const result = await serviceBinding.first({ dbName, query: sql, params: params || [] });
        return {
          success: result.success ?? true,
          data: result.data || result.results?.[0],
          results: result.results,
          error: result.error
        };
      } catch (error: any) {
        return { success: false, error: error?.message || String(error) };
      }
    },
    
    // raw - raw results without transformation
    raw: async (sql: string, params?: any[]): Promise<QueryResult<any>> => {
      try {
        const result = await serviceBinding.raw({ dbName, query: sql, params: params || [] });
        return {
          success: result.success ?? true,
          data: result.results,
          results: result.results,
          error: result.error
        };
      } catch (error: any) {
        return { success: false, error: error?.message || String(error) };
      }
    },
    
    // query - alias for run (D1Client compatibility)
    query: async (sql: string, params?: any[]): Promise<QueryResult<any>> => {
      try {
        const result = await serviceBinding.run({ dbName, query: sql, params: params || [] });
        return {
          success: result.success ?? true,
          data: result.results,
          results: result.results,
          error: result.error,
          meta: result.meta
        };
      } catch (error: any) {
        return { success: false, error: error?.message || String(error) };
      }
    }
  };
}

/**
 * Check if RPC binding exists
 * Simple existence check - trust the config, Cloudflare will error if binding is invalid
 */
export function isRpcServiceBinding(binding: any): boolean {
  const exists = binding != null;
  if (exists) {
    console.log('[Kuratchi] RPC binding available');
  }
  return exists;
}

// ============================================================================
// RPC DatabaseContext Implementation
// ============================================================================

/**
 * RPC DatabaseContext - high-level database operations via RPC
 * 
 * This class implements the DatabaseContext interface for RPC mode.
 * All RPC-specific database access logic lives here.
 */
export class RpcDatabaseContext implements DatabaseContext {
  readonly adapter: DatabaseAdapterType = 'rpc';
  readonly isRpc = true;
  
  private config: DatabaseContextConfig;
  private ormClientCache = new Map<string, OrmClient>();
  private adminDbGetter?: () => Promise<OrmClient | null>;
  
  constructor(config: DatabaseContextConfig) {
    this.config = config;
    this.adminDbGetter = config.getAdminDb;
  }
  
  setAdminDbGetter(getter: () => Promise<OrmClient | null>): void {
    this.adminDbGetter = getter;
  }
  
  async getAdminDatabase(options: {
    schema: SchemaType;
    skipMigrations?: boolean;
  }): Promise<OrmClient> {
    const cacheKey = 'admin';
    
    if (this.ormClientCache.has(cacheKey)) {
      return this.ormClientCache.get(cacheKey)!;
    }
    
    const bindingName = this.config.bindingName || this.config.rpcBinding;
    if (!bindingName) {
      throw new Error('[RpcAdapter] bindingName is required for RPC adapter');
    }
    
    const client = await createOrmClient({
      schema: options.schema,
      databaseName: 'admin',
      skipMigrations: options.skipMigrations ?? false,
      bindingName,
      adapter: 'rpc'  // Explicit RPC adapter - uses service binding directly
    });
    
    this.ormClientCache.set(cacheKey, client);
    return client;
  }
  
  async getOrgDatabase(options: GetOrgDatabaseOptions): Promise<OrmClient | null> {
    const { organizationId, schema, skipMigrations } = options;
    const cacheKey = `org:${organizationId}`;
    
    if (this.ormClientCache.has(cacheKey)) {
      return this.ormClientCache.get(cacheKey)!;
    }
    
    const bindingName = this.config.bindingName || this.config.rpcBinding;
    if (!bindingName) {
      throw new Error('[RpcAdapter] bindingName is required for RPC adapter');
    }
    
    const databaseName = await this.resolveDatabaseName(organizationId);
    if (!databaseName) {
      return null;
    }
    
    const client = await createOrmClient({
      schema,
      databaseName,
      skipMigrations: skipMigrations ?? false,
      bindingName,
      adapter: 'rpc'  // Explicit RPC adapter
    });
    
    this.ormClientCache.set(cacheKey, client);
    return client;
  }
  
  async createOrgDatabase(options: CreateOrgDatabaseOptions): Promise<CreateOrgDatabaseResult> {
    const { organizationId, organizationName, schema, migrate } = options;
    
    const bindingName = this.config.bindingName || this.config.rpcBinding;
    if (!bindingName) {
      throw new Error('[RpcAdapter] bindingName is required for RPC adapter');
    }
    
    // Generate database name
    const sanitizedName = organizationName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 32);
    const databaseName = `org-${sanitizedName}-${crypto.randomUUID().substring(0, 8)}`;
    
    // Run migrations if requested
    if (migrate !== false) {
      await createOrmClient({
        schema,
        databaseName,
        skipMigrations: false,
        bindingName,
        adapter: 'rpc'  // Explicit RPC adapter
      });
    }
    
    // Cache the mapping
    const cache = getCache();
    if (cache) {
      await cache.setOrgDatabaseMeta(organizationId, {
        databaseName,
        workerName: null,
        token: null,
        adapter: 'rpc'
      });
    }
    
    return { databaseName, organizationId };
  }
  
  async getOrgDatabaseInfo(organizationId: string): Promise<OrgDatabaseInfo | null> {
    const databaseName = await this.resolveDatabaseName(organizationId);
    if (!databaseName) return null;
    return { databaseName, organizationId };
  }
  
  async resolveDatabaseName(organizationId: string): Promise<string | null> {
    // Check cache first
    const cache = getCache();
    if (cache) {
      const cached = await cache.getOrgDatabaseMeta(organizationId);
      if (cached) {
        return cached.databaseName;
      }
    }
    
    // Cache miss - lookup from admin DB
    if (this.adminDbGetter) {
      try {
        const adminDb = await this.adminDbGetter();
        if (adminDb) {
          const { data: dbRecord } = await (adminDb as any).databases
            .where({ organizationId })
            .first();
          
          if (dbRecord?.name) {
            // Cache for future requests
            if (cache) {
              await cache.setOrgDatabaseMeta(organizationId, {
                databaseName: dbRecord.name,
                workerName: null,
                token: null,
                adapter: 'rpc'
              });
            }
            return dbRecord.name;
          }
        }
      } catch (e) {
        console.warn('[RpcAdapter] Failed to lookup database from admin DB:', e);
      }
    }
    
    console.warn(`[RpcAdapter] No database found for org: ${organizationId}`);
    return null;
  }
}
