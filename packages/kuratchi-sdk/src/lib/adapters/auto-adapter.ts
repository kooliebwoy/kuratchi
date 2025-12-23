/**
 * Auto-detect Adapter
 * Automatically detects binding type and creates the appropriate adapter
 */

import type { ExecutionAdapter } from './types.js';
import { createD1Adapter } from './d1-adapter.js';
import { createD1HttpAdapter } from './d1-http-adapter.js';
import { createDoDirectAdapter } from './do-adapter.js';

/**
 * Auto-detect and create the appropriate adapter
 * Checks the binding type and returns the correct adapter
 * 
 * @param binding - Any database binding (D1, DO, HTTP client)
 */
export function createAutoAdapter(binding: any): ExecutionAdapter {
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
