/**
 * HTTP Client for Durable Object communication
 * Handles all HTTP requests to the DO worker
 */

import type { DatabaseConfig, DoHttpClient, QueryResult } from '../core/types.js';
import { createKvClient } from './kv-client.js';

/**
 * Make an HTTP request to the DO worker
 */
async function makeRequest(
  endpoint: string,
  dbName: string,
  path: string,
  body: any,
  headers: Record<string, string>
): Promise<QueryResult<any>> {
  try {
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-db-name': dbName,
      ...headers
    };
    
    const response = await fetch(`${endpoint}${path}`, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await response.json();
        return { success: false, error: JSON.stringify(json) };
      }
      const text = await response.text();
      return { success: false, error: `API ${response.status}: ${text.slice(0, 200)}...` };
    }
    
    return response.json();
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Create HTTP client for DO communication
 */
export function createHttpClient(config: DatabaseConfig): DoHttpClient {
  const scriptName = config.scriptName || 'kuratchi-do-internal';
  const endpoint = `https://${scriptName}.${config.workersSubdomain}`;
  const dbName = config.databaseName;
  
  // Build headers
  const headers: Record<string, string> = {};
  if (config.gatewayKey) {
    headers['Authorization'] = `Bearer ${config.gatewayKey}`;
  }
  if (config.dbToken) {
    headers['x-db-token'] = config.dbToken;
  }
  
  // Create request helper
  const request = (path: string, body: any) => makeRequest(endpoint, dbName, path, body, headers);
  
  // Create KV client
  const kvClient = createKvClient(request);
  
  return {
    query: <T = any>(query: string, params: any[] = []) => 
      request('/api/run', { query, params }) as Promise<QueryResult<T>>,
    
    exec: (query: string) => 
      request('/api/exec', { query }),
    
    batch: (items: { query: string; params?: any[] }[]) => 
      request('/api/batch', { batch: items }),
    
    raw: (query: string, params: any[] = [], columnNames: boolean = false) => 
      request('/api/raw', { query, params, columnNames }),
    
    first: <T = any>(query: string, params: any[] = [], columnName?: string) => 
      request('/api/first', { query, params, columnName }) as Promise<QueryResult<T>>,
    
    kv: kvClient
  };
}

/**
 * Create HTTP client with validation
 */
export function createValidatedHttpClient(config: DatabaseConfig): DoHttpClient {
  if (!config.databaseName) {
    throw new Error('databaseName is required');
  }
  if (!config.workersSubdomain) {
    throw new Error('workersSubdomain is required');
  }
  
  return createHttpClient(config);
}
