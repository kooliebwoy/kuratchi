/**
 * Execution adapters for different database engines
 * These adapt platform-specific response formats to the ORM's QueryResult format
 */

import type { QueryResult } from './kuratchi-orm.js';

/**
 * Adapter for D1 direct binding
 * Passes through D1Result format directly
 */
export function createD1Adapter(db: any) {
  return async (sql: string, params?: any[]): Promise<QueryResult<any>> => {
    try {
      let stmt = db.prepare(sql);
      if (params && params.length > 0) {
        stmt = stmt.bind(...params);
      }
      const result = await stmt.all();
      
      // Pass through D1Result format directly
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
 * Adapter for D1 HTTP client
 * Passes through D1Result format directly
 * Use this when accessing D1 via REST API (BaaS, remote workers)
 */
export function createD1HttpAdapter(httpClient: any) {
  return async (sql: string, params?: any[]): Promise<QueryResult<any>> => {
    try {
      const result = await httpClient.query(sql, params || []);
      
      // Pass through D1Result format directly
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
 * @deprecated Use createD1HttpAdapter instead
 * Kept for backward compatibility
 */
export function createDoHttpAdapter(httpClient: any) {
  return createD1HttpAdapter(httpClient);
}

/**
 * Adapter for DO direct binding (when running inside Workers)
 * Passes through D1-compatible format directly
 */
export function createDoDirectAdapter(doBinding: any) {
  return async (sql: string, params?: any[]): Promise<QueryResult<any>> => {
    try {
      // When DO is accessed directly in Workers, it has .sql() method
      const result = await doBinding.sql(sql, params);
      
      // Pass through D1-compatible format directly
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
 * Adapter for RPC service binding (Worker-to-Worker direct calls)
 * Use this when accessing a database via a service binding to another worker
 * 
 * The service binding should expose RPC methods: run(request), exec(request), etc.
 * The dbName is passed via x-db-name header to identify which DO instance to use.
 * 
 * @param serviceBinding - The service binding (e.g., env.BACKEND)
 * @param dbName - Database name to pass in x-db-name header
 */
export function createRpcAdapter(serviceBinding: any, dbName: string) {
  if (!serviceBinding) {
    throw new Error('Service binding is required for RPC adapter');
  }
  if (!dbName) {
    throw new Error('Database name is required for RPC adapter');
  }
  
  return async (sql: string, params?: any[]): Promise<QueryResult<any>> => {
    try {
      const payload = {
        dbName,
        query: sql,
        params: params || []
      };
      
      // Call the service binding's run method directly via RPC
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
 * Auto-detect and create the appropriate adapter
 * Checks the binding type and returns the correct adapter
 */
export function createAutoAdapter(binding: any) {
  // Check if it's a D1 database (has prepare method)
  if (binding && typeof binding.prepare === 'function') {
    return createD1Adapter(binding);
  }
  
  // Check if it's a DO direct binding (has sql method)
  if (binding && typeof binding.sql === 'function') {
    return createDoDirectAdapter(binding);
  }
  
  // Check if it's an HTTP client (has query method)
  if (binding && typeof binding.query === 'function') {
    return createD1HttpAdapter(binding);
  }
  
  throw new Error('Unknown binding type. Expected D1Database, DO binding, or HTTP client');
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
