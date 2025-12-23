/**
 * Durable Objects Direct Adapter
 * For accessing Durable Objects directly within Workers
 */

import type { QueryResult, ExecutionAdapter, DoAdapterConfig } from './types.js';

// ============================================================================
// Explicit Adapter Factory
// ============================================================================

/**
 * Create a DO adapter configuration
 * Use this to explicitly configure Durable Objects mode for plugins
 * 
 * @example
 * ```ts
 * organizationPlugin({
 *   organizationSchema,
 *   adapter: doAdapter({ binding: 'DATABASE_DO' })
 * })
 * ```
 */
export function doAdapter(options: { binding: string }): DoAdapterConfig {
  return {
    type: 'do',
    binding: options.binding
  };
}

// ============================================================================
// DO Execution Adapter
// ============================================================================

/**
 * Create an adapter for DO direct binding
 * Use when running inside Workers with direct DO access
 * 
 * @param doBinding - DO binding with sql method
 */
export function createDoDirectAdapter(doBinding: any): ExecutionAdapter {
  return async (sql: string, params?: any[]): Promise<QueryResult<any>> => {
    try {
      const result = await doBinding.sql(sql, params);
      
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
