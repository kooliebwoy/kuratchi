/**
 * Kuratchi Managed Client
 * 
 * Routes all operations through Kuratchi's managed infrastructure.
 * Uses your Kuratchi API key - no need for Cloudflare, Resend, or other service keys.
 * 
 * This is a thin wrapper around the existing database client that:
 * 1. Routes database operations to Kuratchi's BaaS API
 * 2. Adds platform management capabilities (databases, analytics, etc.)
 * 3. Handles authentication with your Kuratchi API key
 */

import { ManagedDatabase } from './database.js';
import { PlatformClient } from './platform.js';
import { createD1HttpAdapter } from '../orm/adapters.js';
import { createClientFromJsonSchema } from '../orm/kuratchi-orm.js';
import type { DatabaseSchema } from '../database/migrations/schema.js';
import type { QueryResult } from '../database/core/types.js';

/**
 * Configuration for Kuratchi Managed Client
 */
export interface ManagedClientConfig {
  /** Your Kuratchi platform API key (from dashboard) */
  apiKey: string;
  /** Your database ID (from dashboard) */
  databaseId: string;
  /** Database schema for ORM (optional) */
  schema?: DatabaseSchema;
  /** API endpoint (default: production) */
  baseUrl?: string;
}

/**
 * Kuratchi Managed Client
 * 
 * All-in-one client for Kuratchi's managed infrastructure.
 * Handles database operations AND platform management with a single API key.
 * 
 * @example
 * ```typescript
 * import { managed } from 'kuratchi-sdk';
 * 
 * const client = new managed.Client({
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
 * // Database operations (routed through Kuratchi)
 * await client.orm.users.insert({ name: 'Alice' });
 * await client.query('SELECT * FROM users');
 * 
 * // Platform management
 * const databases = await client.platform.databases.list();
 * const analytics = await client.platform.databases.analytics('db-id');
 * ```
 */
export class ManagedClient {
  private db: ManagedDatabase;
  private platformClient: PlatformClient;
  
  /** ORM client (if schema provided) - routed through Kuratchi */
  public readonly orm?: Record<string, any>;
  
  constructor(config: ManagedClientConfig) {
    // Create managed database client (thin HTTP wrapper)
    this.db = new ManagedDatabase({
      apiKey: config.apiKey,
      databaseId: config.databaseId,
      baseUrl: config.baseUrl
    });
    
    // Create platform management client
    this.platformClient = new PlatformClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl
    });
    
    // Create ORM if schema provided
    if (config.schema) {
      const adapter = createD1HttpAdapter(this.db);
      this.orm = createClientFromJsonSchema(adapter, config.schema);
    }
  }
  
  // ==================== Database Operations ====================
  // All methods delegate to db (thin HTTP wrapper to /api/v1/databases)
  
  /**
   * Execute a parameterized query
   * Routed through Kuratchi's managed infrastructure
   */
  async query<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
    return this.db.query<T>(sql, params);
  }
  
  /**
   * Execute raw SQL (DDL, multiple statements)
   * Routed through Kuratchi's managed infrastructure
   */
  async exec(sql: string): Promise<QueryResult<any>> {
    return this.db.exec(sql);
  }
  
  /**
   * Execute multiple queries in a batch (transaction)
   * Routed through Kuratchi's managed infrastructure
   */
  async batch(items: { query: string; params?: any[] }[]): Promise<QueryResult<any>> {
    return this.db.batch(items);
  }
  
  /**
   * Get raw results as arrays instead of objects
   * Routed through Kuratchi's managed infrastructure
   */
  async raw(sql: string, params: any[] = [], columnNames: boolean = false): Promise<QueryResult<any>> {
    return this.db.raw(sql, params, columnNames);
  }
  
  /**
   * Get a single value from the first row
   * Routed through Kuratchi's managed infrastructure
   */
  async first<T = any>(sql: string, params: any[] = [], columnName?: string): Promise<QueryResult<T>> {
    return this.db.first<T>(sql, params, columnName);
  }
  
  // ==================== Drizzle Support ====================
  
  /**
   * Get a Drizzle ORM compatible proxy function
   * Routed through Kuratchi's managed infrastructure
   * 
   * @example
   * ```typescript
   * import { drizzle } from 'drizzle-orm/sqlite-proxy';
   * import * as schema from './schema';
   * 
   * const db = drizzle(client.getDrizzleProxy(), { schema });
   * const users = await db.select().from(schema.users);
   * ```
   */
  getDrizzleProxy() {
    return async (sql: string, params: any[], method: string) => {
      try {
        const result: any = await this.raw(sql, params);
        
        if (method === 'get') {
          return { rows: result.results?.[0] || result.data?.[0] };
        }
        
        return { rows: result.results || result.data || [] };
      } catch (e: any) {
        console.error('[ManagedClient] Error in Drizzle proxy:', e);
        return { rows: [] };
      }
    };
  }
  
  // ==================== Bookmark Management ====================
  
  /**
   * Get the current D1 session bookmark
   * For read-after-write consistency
   */
  getBookmark(): string | null {
    return this.db.getBookmark();
  }
  
  /**
   * Set the D1 session bookmark
   * For restoring sessions
   */
  setBookmark(bookmark: string | null): void {
    this.db.setBookmark(bookmark);
  }
  
  /**
   * Clear the current bookmark
   */
  clearBookmark(): void {
    this.db.clearBookmark();
  }
  
  // ==================== Platform Management ====================
  
  /**
   * Platform management API
   * Manage databases, get analytics, and more
   * 
   * @example
   * ```typescript
   * // List databases
   * const { data } = await client.platform.databases.list();
   * 
   * // Create database
   * await client.platform.databases.create({
   *   name: 'my-db',
   *   description: 'Production'
   * });
   * 
   * // Get analytics
   * const analytics = await client.platform.databases.analytics('db-id', { days: 14 });
   * ```
   */
  get platform() {
    return this.platformClient;
  }
}

/**
 * Create a managed client (functional alternative)
 * 
 * @example
 * ```typescript
 * import { managed } from 'kuratchi-sdk';
 * 
 * const client = managed.createClient({
 *   apiKey: process.env.KURATCHI_API_KEY,
 *   databaseId: process.env.DATABASE_ID,
 *   schema
 * });
 * ```
 */
export function createClient(config: ManagedClientConfig): ManagedClient {
  return new ManagedClient(config);
}
