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
export interface D1Client {
  query<T = any>(query: string, params?: any[]): Promise<QueryResult<T>>;
  exec(query: string): Promise<QueryResult<any>>;
  batch(items: { query: string; params?: any[] }[]): Promise<QueryResult<any>>;
  raw(query: string, params?: any[], columnNames?: boolean): Promise<QueryResult<any>>;
  first<T = any>(query: string, params?: any[], columnName?: string): Promise<QueryResult<T>>;
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

export interface CreateDatabaseOptions {
  databaseName: string;
  gatewayKey: string;
  migrate?: boolean;
  schema?: DatabaseSchema | SchemaDsl;
  schemaName?: string;  // Name of migrations folder (e.g., 'organization', 'admin', 'foo')
}

export interface ClientOptions {
  databaseName: string;
  dbToken: string;
  gatewayKey: string;
  schema: DatabaseSchema | SchemaDsl;
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
