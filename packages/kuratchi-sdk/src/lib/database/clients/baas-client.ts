/**
 * BaaS HTTP Client for Kuratchi Platform
 * Simplified client that only requires API key and database ID
 * Handles bookmark tracking automatically for read-after-write consistency
 */

import type { D1Client, QueryResult } from '../core/types.js';

/**
 * Session state for D1 bookmarks
 * Each client instance maintains its own bookmark for consistency
 */
class SessionState {
  private bookmark: string | null = null;

  getBookmark(): string | null {
    return this.bookmark;
  }

  setBookmark(bookmark: string | null): void {
    this.bookmark = bookmark;
  }

  clearBookmark(): void {
    this.bookmark = null;
  }
}

/**
 * Configuration for BaaS client
 */
export interface BaasClientConfig {
  /** Your platform API key (from dashboard) */
  apiKey: string;
  /** Your database ID (from dashboard) */
  databaseId: string;
  /** BaaS endpoint (default: production) */
  baseUrl?: string;
}

/**
 * Make an HTTP request to the Kuratchi BaaS API with session support
 */
async function makeRequest(
  baseUrl: string,
  apiKey: string,
  databaseId: string,
  endpoint: string,
  body: any,
  sessionState: SessionState
): Promise<QueryResult<any>> {
  try {
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'x-database-id': databaseId,
      'x-endpoint': endpoint
    };

    // Add session bookmark if available (for read-after-write consistency)
    const bookmark = sessionState.getBookmark();
    if (bookmark) {
      requestHeaders['x-d1-bookmark'] = bookmark;
    }
    
    const response = await fetch(`${baseUrl}/api/v1/databases`, {
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
        return { 
          success: false, 
          error: json.error || JSON.stringify(json) 
        };
      }
      const text = await response.text();
      return { 
        success: false, 
        error: `API ${response.status}: ${text.slice(0, 200)}...` 
      };
    }
    
    return response.json();
  } catch (error: any) {
    return { 
      success: false, 
      error: error.message || String(error) 
    };
  }
}

/**
 * Create BaaS HTTP client with automatic bookmark management
 * 
 * @example
 * ```typescript
 * import { createBaasClient } from 'kuratchi-sdk';
 * 
 * const client = createBaasClient({
 *   apiKey: process.env.KURATCHI_API_KEY,
 *   databaseId: process.env.DATABASE_ID
 * });
 * 
 * // Bookmarks are handled automatically!
 * await client.query('INSERT INTO users (name) VALUES (?)', ['Alice']);
 * const users = await client.query('SELECT * FROM users'); // Sees Alice immediately
 * ```
 */
export function createBaasClient(config: BaasClientConfig): D1Client & { 
  getBookmark: () => string | null;
  setBookmark: (bookmark: string | null) => void;
  clearBookmark: () => void;
} {
  const baseUrl = config.baseUrl || 'https://kuratchi.dev/api/v1';
  const { apiKey, databaseId } = config;
  
  // Validate required config
  if (!apiKey) {
    throw new Error('apiKey is required');
  }
  if (!databaseId) {
    throw new Error('databaseId is required');
  }
  
  // Create session state for bookmark tracking
  // Each client instance has its own bookmark
  const sessionState = new SessionState();
  
  // Create request helper with session support
  const request = (endpoint: string, body: any) => 
    makeRequest(baseUrl, apiKey, databaseId, endpoint, body, sessionState);
  
  return {
    // Standard D1 client methods
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
    
    // Advanced: Manual bookmark control (optional)
    getBookmark: () => sessionState.getBookmark(),
    setBookmark: (bookmark: string | null) => sessionState.setBookmark(bookmark),
    clearBookmark: () => sessionState.clearBookmark()
  };
}
