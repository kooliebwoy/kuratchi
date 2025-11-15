/**
 * HTTP Client for D1 communication with Session support
 * Handles all HTTP requests to the D1 worker with bookmark tracking
 */

import type { DatabaseConfig, D1Client, QueryResult, StorageClient, StoragePutOptions, StorageGetResult, StorageListOptions, StorageListResult } from '../core/types.js';

/**
 * Session state for D1 bookmarks
 */
class SessionState {
  private bookmark: string | null = null;

  getBookmark(): string | null {
    return this.bookmark;
  }

  setBookmark(bookmark: string | null): void {
    this.bookmark = bookmark;
  }
}

/**
 * Make an HTTP request to the D1 worker with session support
 */
async function makeRequest(
  endpoint: string,
  dbName: string,
  path: string,
  body: any,
  headers: Record<string, string>,
  sessionState: SessionState
): Promise<QueryResult<any>> {
  try {
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-db-name': dbName,
      ...headers
    };

    // Add session bookmark if available
    const bookmark = sessionState.getBookmark();
    if (bookmark) {
      requestHeaders['x-d1-bookmark'] = bookmark;
    }
    
    const response = await fetch(`${endpoint}${path}`, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(body)
    });

    // Extract and store new bookmark from response
    const newBookmark = response.headers.get('x-d1-bookmark');
    if (newBookmark) {
      sessionState.setBookmark(newBookmark);
    }
    
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
 * Create HTTP client for D1 communication with session support
 */
export function createHttpClient(config: DatabaseConfig): D1Client {
  const scriptName = config.scriptName || 'kuratchi-d1-internal';
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
  
  // Create session state for bookmark tracking
  const sessionState = new SessionState();
  
  // Create request helper with session support
  const request = (path: string, body: any) => makeRequest(endpoint, dbName, path, body, headers, sessionState);
  
  // Storage client for R2 operations
  const storage: StorageClient = {
    get: (key: string) => 
      request('/api/storage/get', { key }) as Promise<QueryResult<StorageGetResult>>,
    
    put: (options: StoragePutOptions) => 
      request('/api/storage/put', options),
    
    delete: (key: string | string[]) => 
      request('/api/storage/delete', { key }),
    
    list: (options?: StorageListOptions) => 
      request('/api/storage/list', options || {}) as Promise<QueryResult<StorageListResult>>,
    
    head: (key: string) => 
      request('/api/storage/head', { key }) as Promise<QueryResult<StorageGetResult>>
  };
  
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
    
    storage
  };
}

/**
 * Create HTTP client with validation
 */
export function createValidatedHttpClient(config: DatabaseConfig): D1Client {
  if (!config.databaseName) {
    throw new Error('databaseName is required');
  }
  if (!config.workersSubdomain) {
    throw new Error('workersSubdomain is required');
  }
  
  return createHttpClient(config);
}
