/**
 * D1 Direct Adapter
 * For accessing Cloudflare D1 databases via direct binding
 * 
 * This adapter is the single source of truth for all D1 direct functionality:
 * - Adapter factory for explicit configuration
 * - Execution adapter creation
 * - DatabaseContext implementation for high-level database operations
 */

import type { QueryResult, ExecutionAdapter, D1AdapterConfig, DatabaseAdapterType, OrmClient, SchemaType } from './types.js';
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
 * Create a D1 adapter configuration
 * Use this to explicitly configure D1 direct binding mode for plugins
 * 
 * @example
 * ```ts
 * adminPlugin({
 *   adminSchema,
 *   adapter: d1Adapter({ binding: 'ADMIN_DB' })
 * })
 * ```
 */
export function d1Adapter(options: { binding: string }): D1AdapterConfig {
  return {
    type: 'd1',
    binding: options.binding
  };
}

// ============================================================================
// D1 Execution Adapter
// ============================================================================

/**
 * Create an adapter for D1 direct binding
 * Use when you have a D1 database binding in your worker
 * 
 * Native D1 APIs: https://developers.cloudflare.com/d1/worker-api/prepared-statements/
 * - prepare(sql).bind(...params).all() - returns all rows
 * - prepare(sql).bind(...params).first(column?) - returns first row or column value
 * - prepare(sql).bind(...params).raw() - returns raw array results
 * - prepare(sql).bind(...params).run() - returns metadata only (for INSERT/UPDATE/DELETE)
 * - exec(sql) - execute raw SQL (for DDL, migrations)
 * - batch([stmt1, stmt2, ...]) - execute multiple statements in a transaction
 * 
 * @param db - D1 database binding (e.g., env.MY_DB)
 */
export function createD1Adapter(db: any): ExecutionAdapter {
  return async (sql: string, params?: any[]): Promise<QueryResult<any>> => {
    try {
      let stmt = db.prepare(sql);
      if (params && params.length > 0) {
        stmt = stmt.bind(...params);
      }
      const result = await stmt.all();
      
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
 * Create a full D1 client with all native D1 APIs
 * Used by migration client and other components that need exec, batch, etc.
 * 
 * @param db - D1 database binding (e.g., env.MY_DB)
 */
export function createD1Client(db: any) {
  if (!db) {
    throw new Error('D1 database binding is required');
  }
  
  return {
    // all - get all rows (standard query)
    all: async (sql: string, params?: any[]): Promise<QueryResult<any>> => {
      try {
        let stmt = db.prepare(sql);
        if (params && params.length > 0) {
          stmt = stmt.bind(...params);
        }
        const result = await stmt.all();
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
    
    // run - execute INSERT/UPDATE/DELETE (returns metadata, not rows)
    run: async (sql: string, params?: any[]): Promise<QueryResult<any>> => {
      try {
        let stmt = db.prepare(sql);
        if (params && params.length > 0) {
          stmt = stmt.bind(...params);
        }
        const result = await stmt.run();
        return {
          success: result.success ?? true,
          meta: result.meta,
          error: result.error
        };
      } catch (error: any) {
        return { success: false, error: error?.message || String(error) };
      }
    },
    
    // exec - raw SQL execution (for DDL, migrations)
    exec: async (sql: string): Promise<QueryResult<any>> => {
      try {
        const result = await db.exec(sql);
        return { success: true, meta: result };
      } catch (error: any) {
        return { success: false, error: error?.message || String(error) };
      }
    },
    
    // batch - multiple statements in a transaction
    batch: async (queries: Array<{ query: string; params?: any[] }>): Promise<QueryResult<any>> => {
      try {
        const stmts = queries.map(q => {
          let stmt = db.prepare(q.query);
          if (q.params && q.params.length > 0) {
            stmt = stmt.bind(...q.params);
          }
          return stmt;
        });
        const results = await db.batch(stmts);
        return {
          success: true,
          results: results.map((r: any) => r.results || [])
        };
      } catch (error: any) {
        return { success: false, error: error?.message || String(error) };
      }
    },
    
    // first - get first row or column value
    first: async (sql: string, params?: any[], column?: string): Promise<QueryResult<any>> => {
      try {
        let stmt = db.prepare(sql);
        if (params && params.length > 0) {
          stmt = stmt.bind(...params);
        }
        const result = column ? await stmt.first(column) : await stmt.first();
        return {
          success: true,
          data: result,
          results: result ? [result] : []
        };
      } catch (error: any) {
        return { success: false, error: error?.message || String(error) };
      }
    },
    
    // raw - raw array results [[col1, col2], [col1, col2], ...]
    raw: async (sql: string, params?: any[]): Promise<QueryResult<any>> => {
      try {
        let stmt = db.prepare(sql);
        if (params && params.length > 0) {
          stmt = stmt.bind(...params);
        }
        const result = await stmt.raw();
        return {
          success: true,
          data: result,
          results: result
        };
      } catch (error: any) {
        return { success: false, error: error?.message || String(error) };
      }
    },
    
    // query - alias for all (D1Client compatibility)
    query: async (sql: string, params?: any[]): Promise<QueryResult<any>> => {
      try {
        let stmt = db.prepare(sql);
        if (params && params.length > 0) {
          stmt = stmt.bind(...params);
        }
        const result = await stmt.all();
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

// ============================================================================
// D1 DatabaseContext Implementation
// ============================================================================

/**
 * D1 DatabaseContext - high-level database operations via D1 direct binding
 * 
 * This class implements the DatabaseContext interface for D1 direct mode.
 * All D1-specific database access logic lives here.
 */
export class D1DatabaseContext implements DatabaseContext {
  readonly adapter: DatabaseAdapterType = 'd1';
  readonly isRpc = false;
  
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
    
    // For D1 direct, we need the binding name from config
    const bindingName = this.config.bindingName || this.config.rpcBinding;
    if (!bindingName) {
      throw new Error('[D1Adapter] bindingName is required for D1 adapter');
    }
    
    const d1Binding = this.config.env?.[bindingName];
    if (!d1Binding) {
      throw new Error(`[D1Adapter] D1 binding '${bindingName}' not found in env`);
    }
    
    // Use createOrmClient with explicit d1 adapter - it will use the binding directly
    const client = await createOrmClient({
      schema: options.schema,
      databaseName: bindingName,
      bindingName: bindingName,
      skipMigrations: options.skipMigrations ?? false,
      adapter: 'd1'  // Explicit D1 adapter - no httpClient wrapper needed
    });
    
    this.ormClientCache.set(cacheKey, client);
    return client;
  }
  
  async getOrgDatabase(options: GetOrgDatabaseOptions): Promise<OrmClient | null> {
    // D1 direct doesn't support dynamic org databases - use RPC or HTTP for that
    console.warn('[D1Adapter] D1 direct mode does not support dynamic org databases. Use RPC or HTTP adapter.');
    return null;
  }
  
  async createOrgDatabase(options: CreateOrgDatabaseOptions): Promise<CreateOrgDatabaseResult> {
    throw new Error('[D1Adapter] D1 direct mode does not support creating org databases. Use RPC or HTTP adapter.');
  }
  
  async getOrgDatabaseInfo(organizationId: string): Promise<OrgDatabaseInfo | null> {
    return null;
  }
  
  async resolveDatabaseName(organizationId: string): Promise<string | null> {
    return null;
  }
}
