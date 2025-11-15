/**
 * Database Core Types
 * All type definitions for the database module
 */

import type { TableApi } from '../../orm/kuratchi-orm.js';
import type { DatabaseSchema } from '../migrations/schema.js';
import type { SchemaDsl } from '../../utils/types.js';

// Query result types
export type QueryResult<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  results?: any;
};

// KV types removed - KV operations not supported in D1 mode
// Use Cloudflare KV directly via platform.env if needed

// D1 Client interface (for migrations and raw queries)
export interface StoragePutOptions {
  key: string;
  /** Base64-encoded payload */
  data: string;
  httpMetadata?: Record<string, any>;
  customMetadata?: Record<string, string>;
}

export interface StorageGetResult {
  key: string;
  data?: string;
  size?: number;
  httpMetadata?: Record<string, any>;
  customMetadata?: Record<string, string>;
  etag?: string;
}

export interface StorageListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
  delimiter?: string;
}

export interface StorageListResult {
  objects: Array<{ key: string; size: number; uploaded?: string; etag?: string }>;
  truncated: boolean;
  cursor?: string;
  prefixes?: string[];
}

export interface StorageClient {
  get(key: string): Promise<QueryResult<StorageGetResult>>;
  put(options: StoragePutOptions): Promise<QueryResult<any>>;
  delete(key: string | string[]): Promise<QueryResult<any>>;
  list(options?: StorageListOptions): Promise<QueryResult<StorageListResult>>;
  head(key: string): Promise<QueryResult<StorageGetResult>>;
}

export interface D1Client {
  query<T = any>(query: string, params?: any[]): Promise<QueryResult<T>>;
  exec(query: string): Promise<QueryResult<any>>;
  batch(items: { query: string; params?: any[] }[]): Promise<QueryResult<any>>;
  raw(query: string, params?: any[], columnNames?: boolean): Promise<QueryResult<any>>;
  first<T = any>(query: string, params?: any[], columnName?: string): Promise<QueryResult<T>>;
  /**
   * Optional storage helpers backed by the same worker.
   * Available when the worker has an R2 bucket binding.
   */
  storage?: StorageClient;
}

// Configuration types
export interface DatabaseConfig {
  databaseName: string;
  workersSubdomain: string;
  dbToken?: string;
  gatewayKey?: string;
  scriptName?: string;
}

export interface DatabaseInstanceConfig {
  apiToken: string;
  accountId: string;
  endpointBase?: string;
  workersSubdomain: string;
  scriptName?: string;
}

export interface CreateR2Options {
  /** Explicit bucket name. Defaults to sanitized database name with "-storage" suffix. */
  bucketName?: string;
  /** Worker binding name. Defaults to "STORAGE". */
  bindingName?: string;
}

export interface CreateDatabaseOptions {
  databaseName: string;
  gatewayKey: string;
  migrate?: boolean;
  schema?: DatabaseSchema | SchemaDsl;
  schemaName?: string;  // Name of migrations folder (e.g., 'organization', 'admin', 'foo')
  /** Provision an R2 bucket and bind it to the worker. */
  r2?: boolean | CreateR2Options;
}

export interface ClientOptions {
  databaseName: string;
  dbToken: string;
  gatewayKey: string;
  schema: DatabaseSchema | SchemaDsl;
  scriptName?: string;
  skipMigrations?: boolean;
}

export interface HttpClientOptions {
  databaseName: string;
  dbToken: string;
  gatewayKey: string;
  scriptName?: string;
}

// ORM Client type
export type OrmClient = Record<string, TableApi>;

// Schema union type
export type SchemaType = DatabaseSchema | SchemaDsl;
