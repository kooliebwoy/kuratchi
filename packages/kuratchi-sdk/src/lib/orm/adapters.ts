/**
 * Execution adapters for different database engines
 * These adapt platform-specific response formats to the ORM's QueryResult format
 */

import type { QueryResult } from './kuratchi-orm.js';

/**
 * Adapter for D1 direct binding
 * Converts D1Result to QueryResult
 */
export function createD1Adapter(db: any) {
  return async (sql: string, params?: any[]): Promise<QueryResult<any>> => {
    try {
      let stmt = db.prepare(sql);
      if (params && params.length > 0) {
        stmt = stmt.bind(...params);  // ✅ bind() returns a NEW statement
      }
      const result = await stmt.all();
      
      // D1 returns { success, results, error, meta }
      // ORM expects { success, data, error }
      return {
        success: result.success ?? true,
        data: result.results,
        results: result.results,
        error: result.error
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
 * Converts HTTP response to QueryResult
 * Use this when accessing D1 via REST API (BaaS, remote workers)
 */
export function createD1HttpAdapter(httpClient: any) {
  return async (sql: string, params?: any[]): Promise<QueryResult<any>> => {
    try {
      const result = await httpClient.query(sql, params || []);
      
      // HTTP client returns { success, results, error }
      // Already in QueryResult format, but ensure data field
      return {
        success: result.success ?? true,
        data: result.results,
        results: result.results,
        error: result.error
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
 * Converts DO SQL response to QueryResult
 */
export function createDoDirectAdapter(doBinding: any) {
  return async (sql: string, params?: any[]): Promise<QueryResult<any>> => {
    try {
      // When DO is accessed directly in Workers, it has .sql() method
      // This is similar to D1's prepare().all() pattern
      const result = await doBinding.sql(sql, params);
      
      return {
        success: result.success ?? true,
        data: result.results,
        results: result.results,
        error: result.error
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
