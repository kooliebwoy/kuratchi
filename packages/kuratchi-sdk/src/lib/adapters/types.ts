/**
 * Adapter Types
 * Shared type definitions for the adapter system
 */

import type { OrmClient, SchemaType } from '../database/core/types.js';

/**
 * Database adapter type
 * - 'auto': Auto-detect based on binding type
 * - 'rpc': RPC service binding (Worker-to-Worker)
 * - 'd1': Cloudflare D1 direct binding
 * - 'do': Durable Objects direct
 * - 'http': HTTP REST API
 */
export type DatabaseAdapterType = 'auto' | 'rpc' | 'do' | 'd1' | 'http';

/**
 * Query result from database operations
 */
export interface QueryResult<T = any> {
  success: boolean;
  data?: T | T[];
  results?: T[];
  error?: string;
  meta?: any;
}

/**
 * Execution adapter function signature
 * All adapters return this function type
 */
export type ExecutionAdapter = (sql: string, params?: any[]) => Promise<QueryResult<any>>;

/**
 * RPC configuration for service bindings
 */
export interface RpcConfig {
  /** Service binding name (e.g., 'BACKEND') */
  bindingName?: string;
  /** Preferred adapter type */
  adapter: DatabaseAdapterType;
  /** Whether RPC is enabled */
  enabled: boolean;
}

// ============================================================================
// Explicit Adapter Configuration
// ============================================================================

/**
 * Base adapter configuration - all adapters extend this
 */
export interface AdapterConfig {
  /** Adapter type identifier */
  readonly type: DatabaseAdapterType;
  /** Binding name in platform.env */
  readonly binding: string;
}

/**
 * RPC adapter configuration
 * For Worker-to-Worker calls via service bindings
 */
export interface RpcAdapterConfig extends AdapterConfig {
  readonly type: 'rpc';
}

/**
 * D1 adapter configuration
 * For direct D1 database bindings
 */
export interface D1AdapterConfig extends AdapterConfig {
  readonly type: 'd1';
}

/**
 * Durable Objects adapter configuration
 * For direct DO bindings
 */
export interface DoAdapterConfig extends AdapterConfig {
  readonly type: 'do';
}

/**
 * HTTP adapter configuration
 * For REST API access (requires credentials)
 */
export interface HttpAdapterConfig {
  readonly type: 'http';
  readonly accountId: string;
  readonly apiToken: string;
  readonly workersSubdomain: string;
  readonly gatewayKey?: string;
}

/**
 * Union type for all adapter configurations
 * Used by plugins to accept any adapter type
 */
export type PluginAdapterConfig = 
  | RpcAdapterConfig 
  | D1AdapterConfig 
  | DoAdapterConfig 
  | HttpAdapterConfig;

// Re-export ORM types for convenience
export type { OrmClient, SchemaType };
