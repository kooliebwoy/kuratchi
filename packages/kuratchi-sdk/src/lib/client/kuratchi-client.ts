/**
 * Kuratchi Client - Batteries-included database client
 * 
 * Simple, friction-free access to your Kuratchi database with just an API key and database ID.
 * Provides ORM, raw SQL, and Drizzle proxy support out of the box.
 */

import { createBaasClient } from '../database/clients/baas-client.js';
import { createD1HttpAdapter } from '../orm/adapters.js';
import { createClientFromJsonSchema } from '../orm/kuratchi-orm.js';
import type { DatabaseSchema } from '../database/migrations/schema.js';
import type { D1Client, QueryResult } from '../database/core/types.js';

/**
 * Configuration for Kuratchi Client
 */
export interface KuratchiClientConfig {
  /** Your platform API key (from dashboard) */
  apiKey: string;
  /** Your database ID (from dashboard) */
  databaseId: string;
  /** Database schema for ORM (optional) */
  schema?: DatabaseSchema;
  /** API endpoint (default: production) */
  baseUrl?: string;
}

/**
 * Kuratchi Client - Your all-in-one database client
 * 
 * @example
 * ```typescript
 * // With schema (ORM enabled)
 * const client = new KuratchiClient({
 *   apiKey: process.env.KURATCHI_API_KEY,
 *   databaseId: process.env.DATABASE_ID,
 *   schema: {
 *     users: {
 *       id: { type: 'integer', primaryKey: true },
 *       name: { type: 'text', notNull: true }
 *     }
 *   }
 * });
 * 
 * // Destructure what you need
 * const { orm, query, exec, batch } = client;
 * 
 * // Use ORM
 * await orm.users.insert({ name: 'Alice' });
 * const users = await orm.users.where({ name: 'Alice' }).many();
 * 
 * // Or use raw SQL
 * await query('INSERT INTO users (name) VALUES (?)', ['Bob']);
 * const result = await query('SELECT * FROM users');
 * 
 * // Or use Drizzle
 * import { drizzle } from 'drizzle-orm/sqlite-proxy';
 * const db = drizzle(client.getDrizzleProxy());
 * ```
 * 
 * @example
 * ```typescript
 * // Without schema (raw SQL only)
 * const client = new KuratchiClient({
 *   apiKey: process.env.KURATCHI_API_KEY,
 *   databaseId: process.env.DATABASE_ID
 * });
 * 
 * await client.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
 * await client.query('INSERT INTO users (name) VALUES (?)', ['Alice']);
 * ```
 */
export class KuratchiClient {
  private httpClient: D1Client & {
    getBookmark: () => string | null;
    setBookmark: (bookmark: string | null) => void;
    clearBookmark: () => void;
  };
  
  /** ORM client (if schema provided) */
  public readonly orm?: Record<string, any>;
  
  /**
   * Create a new Kuratchi client
   */
  constructor(config: KuratchiClientConfig) {
    // Create HTTP client with automatic bookmark management
    this.httpClient = createBaasClient({
      apiKey: config.apiKey,
      databaseId: config.databaseId,
      baseUrl: config.baseUrl
    });
    
    // Create ORM if schema provided
    if (config.schema) {
      const adapter = createD1HttpAdapter(this.httpClient);
      this.orm = createClientFromJsonSchema(adapter, config.schema);
    }
  }
  
  // ==================== Raw SQL Methods ====================
  
  /**
   * Execute a parameterized query and get results
   * 
   * @example
   * ```typescript
   * const users = await client.query('SELECT * FROM users WHERE id = ?', [1]);
   * ```
   */
  async query<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
    return this.httpClient.query<T>(sql, params);
  }
  
  /**
   * Execute raw SQL (DDL, multiple statements)
   * 
   * @example
   * ```typescript
   * await client.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
   * ```
   */
  async exec(sql: string): Promise<QueryResult<any>> {
    return this.httpClient.exec(sql);
  }
  
  /**
   * Execute multiple queries in a batch (transaction)
   * 
   * @example
   * ```typescript
   * await client.batch([
   *   { query: 'INSERT INTO users (name) VALUES (?)', params: ['Alice'] },
   *   { query: 'INSERT INTO users (name) VALUES (?)', params: ['Bob'] }
   * ]);
   * ```
   */
  async batch(items: { query: string; params?: any[] }[]): Promise<QueryResult<any>> {
    return this.httpClient.batch(items);
  }
  
  /**
   * Get raw results as arrays instead of objects
   * 
   * @example
   * ```typescript
   * const rows = await client.raw('SELECT id, name FROM users');
   * // Returns: [[1, 'Alice'], [2, 'Bob']]
   * ```
   */
  async raw(sql: string, params: any[] = [], columnNames: boolean = false): Promise<QueryResult<any>> {
    return this.httpClient.raw(sql, params, columnNames);
  }
  
  /**
   * Get a single value from the first row
   * 
   * @example
   * ```typescript
   * const count = await client.first('SELECT COUNT(*) as count FROM users', [], 'count');
   * ```
   */
  async first<T = any>(sql: string, params: any[] = [], columnName?: string): Promise<QueryResult<T>> {
    return this.httpClient.first<T>(sql, params, columnName);
  }
  
  // ==================== Drizzle Support ====================
  
  /**
   * Get a Drizzle ORM compatible proxy function for use with the sqlite-proxy adapter
   * Following the documentation at https://orm.drizzle.team/docs/connect-drizzle-proxy
   * 
   * @example
   * ```typescript
   * import { drizzle } from 'drizzle-orm/sqlite-proxy';
   * import * as schema from './schema';
   * 
   * const client = new KuratchiClient({ apiKey, databaseId });
   * const db = drizzle(client.getDrizzleProxy(), { schema });
   * 
   * // Use Drizzle ORM
   * const users = await db.select().from(schema.users);
   * ```
   */
  getDrizzleProxy() {
    return async (sql: string, params: any[], method: string) => {
      try {
        // Use raw to execute the query with parameters
        const result: any = await this.raw(sql, params);
        
        if (method === 'get') {
          // For .get() queries, return first row
          return { rows: result.results?.[0] || result.data?.[0] };
        }
        
        // For other methods, return all rows
        return { rows: result.results || result.data || [] };
      } catch (e: any) {
        console.error('[KuratchiClient] Error in Drizzle proxy:', e);
        return { rows: [] };
      }
    };
  }
  
  // ==================== Bookmark Management ====================
  
  /**
   * Get the current D1 session bookmark
   * Useful for advanced session management
   */
  getBookmark(): string | null {
    return this.httpClient.getBookmark();
  }
  
  /**
   * Set the D1 session bookmark
   * Useful for restoring sessions from external storage
   */
  setBookmark(bookmark: string | null): void {
    this.httpClient.setBookmark(bookmark);
  }
  
  /**
   * Clear the current bookmark (start fresh session)
   */
  clearBookmark(): void {
    this.httpClient.clearBookmark();
  }
}

/**
 * Create a Kuratchi client (functional alternative to new KuratchiClient)
 * 
 * @example
 * ```typescript
 * const client = createKuratchiClient({
 *   apiKey: process.env.KURATCHI_API_KEY,
 *   databaseId: process.env.DATABASE_ID,
 *   schema
 * });
 * ```
 */
export function createKuratchiClient(config: KuratchiClientConfig): KuratchiClient {
  return new KuratchiClient(config);
}
