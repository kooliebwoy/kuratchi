/**
 * Database Core Types
 * All type definitions for the database module
 */

import type { TableApi } from '../../orm/kuratchi-orm.js';
import type { DatabaseSchema } from '../../orm/json-schema.js';
import type { SchemaDsl } from '../../utils/types.js';

// Query result types
export type QueryResult<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  results?: any;
};

// KV types
export type KvEncoding = 'json' | 'text' | 'base64';

export interface KvGetOptions {
  key: string;
  type?: 'json' | 'text' | 'arrayBuffer';
  allowConcurrency?: boolean;
  noCache?: boolean;
  withMetadata?: boolean;
}

export interface KvGetResult {
  success: boolean;
  value?: any;
  metadata?: any;
  encoding?: KvEncoding;
  error?: string;
}

export interface KvPutOptions {
  key: string;
  value: any;
  encoding?: 'json' | 'text' | 'base64';
  metadata?: any;
  allowConcurrency?: boolean;
  allowUnconfirmed?: boolean;
  expiration?: number;
  expirationTtl?: number;
}

export interface KvPutResult {
  success: boolean;
  error?: string;
}

export interface KvDeleteOptions {
  key: string;
  allowConcurrency?: boolean;
}

export interface KvDeleteResult {
  success: boolean;
  deleted?: boolean;
  error?: string;
}

export interface KvListOptions {
  prefix?: string;
  start?: string;
  startAfter?: string;
  end?: string;
  limit?: number;
  cursor?: string;
  allowConcurrency?: boolean;
  reverse?: boolean;
}

export interface KvListKey {
  name: string;
  expiration?: number | null;
  metadata?: any;
}

export interface KvListResult {
  success: boolean;
  keys: KvListKey[];
  list_complete: boolean;
  cursor: string | null;
  cacheStatus?: string | null;
  error?: string;
}

// KV Client interface
export interface DoKvClient {
  get(opts: KvGetOptions): Promise<KvGetResult>;
  put(opts: KvPutOptions): Promise<KvPutResult>;
  delete(opts: KvDeleteOptions): Promise<KvDeleteResult>;
  list(opts?: KvListOptions): Promise<KvListResult>;
}

// HTTP Client interface
export interface DoHttpClient {
  query<T = any>(query: string, params?: any[]): Promise<QueryResult<T>>;
  exec(query: string): Promise<QueryResult<any>>;
  batch(items: { query: string; params?: any[] }[]): Promise<QueryResult<any>>;
  raw(query: string, params?: any[], columnNames?: boolean): Promise<QueryResult<any>>;
  first<T = any>(query: string, params?: any[], columnName?: string): Promise<QueryResult<T>>;
  kv: DoKvClient;
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
}

// ORM Client type
export type OrmClient = Record<string, TableApi> & { kv?: DoKvClient };

// Schema union type
export type SchemaType = DatabaseSchema | SchemaDsl;
