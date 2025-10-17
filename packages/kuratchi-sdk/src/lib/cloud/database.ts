/**
 * Managed Database Client
 * 
 * Thin HTTP wrapper for Kuratchi's managed database API.
 * All operations route to /api/v1/databases with your API key.
 */

import type { QueryResult } from '../database/core/types.js';

export interface ManagedDatabaseConfig {
  apiKey: string;
  databaseId: string;
  baseUrl?: string;
}

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

  clearBookmark(): void {
    this.bookmark = null;
  }
}

/**
 * Make HTTP request to Kuratchi's managed database API
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

    // Add session bookmark if available
    const bookmark = sessionState.getBookmark();
    if (bookmark) {
      requestHeaders['x-d1-bookmark'] = bookmark;
    }
    
    const response = await fetch(`${baseUrl}/api/v1/databases`, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(body)
    });

    // Extract and store new bookmark
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
 * Managed Database Client
 * 
 * Thin wrapper around /api/v1/databases endpoint.
 * Handles authentication, bookmarks, and request routing.
 */
export class ManagedDatabase {
  private baseUrl: string;
  private apiKey: string;
  private databaseId: string;
  private sessionState: SessionState;

  constructor(config: ManagedDatabaseConfig) {
    this.baseUrl = config.baseUrl || 'https://kuratchi.dev';
    this.apiKey = config.apiKey;
    this.databaseId = config.databaseId;
    this.sessionState = new SessionState();
  }

  private request(endpoint: string, body: any) {
    return makeRequest(
      this.baseUrl,
      this.apiKey,
      this.databaseId,
      endpoint,
      body,
      this.sessionState
    );
  }

  /**
   * Execute a parameterized query
   */
  async query<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
    return this.request('/api/run', { query: sql, params }) as Promise<QueryResult<T>>;
  }

  /**
   * Execute raw SQL
   */
  async exec(sql: string): Promise<QueryResult<any>> {
    return this.request('/api/exec', { query: sql });
  }

  /**
   * Execute batch queries
   */
  async batch(items: { query: string; params?: any[] }[]): Promise<QueryResult<any>> {
    return this.request('/api/batch', { batch: items });
  }

  /**
   * Get raw results as arrays
   */
  async raw(sql: string, params: any[] = [], columnNames: boolean = false): Promise<QueryResult<any>> {
    return this.request('/api/raw', { query: sql, params, columnNames });
  }

  /**
   * Get first result
   */
  async first<T = any>(sql: string, params: any[] = [], columnName?: string): Promise<QueryResult<T>> {
    return this.request('/api/first', { query: sql, params, columnName }) as Promise<QueryResult<T>>;
  }

  /**
   * Get current bookmark
   */
  getBookmark(): string | null {
    return this.sessionState.getBookmark();
  }

  /**
   * Set bookmark
   */
  setBookmark(bookmark: string | null): void {
    this.sessionState.setBookmark(bookmark);
  }

  /**
   * Clear bookmark
   */
  clearBookmark(): void {
    this.sessionState.clearBookmark();
  }
}
