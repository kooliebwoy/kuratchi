/**
 * Kuratchi BaaS - Simplified database access
 * 
 * This module provides a batteries-included way to use Kuratchi databases
 * with just an API key and database ID. Bookmarks are handled automatically.
 */

import { createBaasClient, type BaasClientConfig } from './clients/baas-client.js';
import { createD1HttpAdapter } from '../orm/adapters.js';
import { createClientFromJsonSchema } from '../orm/kuratchi-orm.js';
import type { DatabaseSchema } from './migrations/schema.js';

/**
 * Configuration for BaaS database connection
 */
export interface BaasDatabaseConfig {
  /** Your platform API key (from dashboard) */
  apiKey: string;
  /** Your database ID (from dashboard) */
  databaseId: string;
  /** Database schema for ORM (optional) */
  schema?: DatabaseSchema;
  /** BaaS endpoint (default: production) */
  baseUrl?: string;
}

/**
 * Create a Kuratchi BaaS database connection with ORM
 * 
 * This is the simplest way to use Kuratchi databases. Just provide your
 * API key and database ID, and you get a fully-featured ORM with automatic
 * bookmark management for read-after-write consistency.
 * 
 * @example
 * ```typescript
 * import { createBaasDatabase } from 'kuratchi-sdk';
 * 
 * // 1. Define your schema
 * const schema = {
 *   users: {
 *     id: { type: 'integer', primaryKey: true },
 *     name: { type: 'text', notNull: true },
 *     email: { type: 'text', unique: true }
 *   }
 * };
 * 
 * // 2. Create database connection
 * const db = createBaasDatabase({
 *   apiKey: process.env.KURATCHI_API_KEY,
 *   databaseId: process.env.DATABASE_ID,
 *   schema
 * });
 * 
 * // 3. Use the ORM - bookmarks handled automatically!
 * await db.users.insert({
 *   name: 'Alice',
 *   email: 'alice@example.com'
 * });
 * 
 * // This query will see the insert immediately (bookmark ensures consistency)
 * const users = await db.users.where({ name: 'Alice' }).many();
 * 
 * // You can also use raw queries
 * const result = await db.client.query('SELECT COUNT(*) as count FROM users');
 * ```
 * 
 * @example
 * ```typescript
 * // Without schema (raw SQL only)
 * const db = createBaasDatabase({
 *   apiKey: process.env.KURATCHI_API_KEY,
 *   databaseId: process.env.DATABASE_ID
 * });
 * 
 * // Use raw client
 * await db.client.query('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
 * await db.client.query('INSERT INTO users (name) VALUES (?)', ['Alice']);
 * const users = await db.client.query('SELECT * FROM users');
 * ```
 */
export function createBaasDatabase(config: BaasDatabaseConfig) {
  // Create the HTTP client with bookmark management
  const client = createBaasClient({
    apiKey: config.apiKey,
    databaseId: config.databaseId,
    baseUrl: config.baseUrl
  });

  // If schema provided, create ORM
  if (config.schema) {
    const adapter = createD1HttpAdapter(client);
    const orm = createClientFromJsonSchema(adapter, config.schema);
    
    return {
      ...orm,
      client, // Expose raw client for advanced usage
      // Expose bookmark methods for advanced control
      getBookmark: () => client.getBookmark(),
      setBookmark: (bookmark: string | null) => client.setBookmark(bookmark),
      clearBookmark: () => client.clearBookmark()
    };
  }

  // No schema - return just the client
  return {
    client,
    getBookmark: () => client.getBookmark(),
    setBookmark: (bookmark: string | null) => client.setBookmark(bookmark),
    clearBookmark: () => client.clearBookmark()
  };
}

/**
 * Type helper for BaaS database with schema
 */
export type BaasDatabase<T extends DatabaseSchema> = ReturnType<typeof createClientFromJsonSchema> & {
  client: ReturnType<typeof createBaasClient>;
  getBookmark: () => string | null;
  setBookmark: (bookmark: string | null) => void;
  clearBookmark: () => void;
};

/**
 * Type helper for BaaS database without schema (raw client only)
 */
export type BaasRawDatabase = {
  client: ReturnType<typeof createBaasClient>;
  getBookmark: () => string | null;
  setBookmark: (bookmark: string | null) => void;
  clearBookmark: () => void;
};
