/**
 * DatabaseContext - High-level database access abstraction
 * 
 * This file defines the shared interface and types.
 * Each adapter (RPC, HTTP) implements this interface in their own file.
 * 
 * Plugins use this interface without knowing which adapter is active.
 */

import type { DatabaseAdapterType, OrmClient, SchemaType } from './types.js';

// ============================================================================
// Types (shared by all adapter implementations)
// ============================================================================

export interface DatabaseContextConfig {
  /** Adapter type: 'rpc', 'http', 'd1', 'do', or 'auto' */
  adapter: DatabaseAdapterType;
  
  /** Binding name in platform.env (for d1, rpc, do adapters) */
  bindingName?: string;
  
  /** @deprecated Use bindingName instead */
  rpcBinding?: string;
  
  /** Platform environment (for accessing bindings) */
  env?: Record<string, any>;
  
  /** Cloudflare credentials (for HTTP mode) */
  cloudflare?: {
    accountId?: string;
    apiToken?: string;
    workersSubdomain?: string;
    gatewayKey?: string;
  };
  
  /** Admin DB getter (for resolving org database names) */
  getAdminDb?: () => Promise<OrmClient | null>;
}

export interface OrgDatabaseInfo {
  databaseName: string;
  organizationId: string;
}

export interface CreateOrgDatabaseOptions {
  organizationId: string;
  organizationName: string;
  schema: SchemaType;
  migrate?: boolean;
}

export interface CreateOrgDatabaseResult {
  databaseName: string;
  organizationId: string;
}

export interface GetOrgDatabaseOptions {
  organizationId: string;
  schema: SchemaType;
  skipMigrations?: boolean;
}

/**
 * DatabaseContext interface - consumed by plugins
 * 
 * Plugins call these methods without knowing the adapter.
 * Each adapter implements this interface with its own logic.
 */
export interface DatabaseContext {
  /** Current adapter type */
  readonly adapter: DatabaseAdapterType;
  
  /** Whether this context uses RPC (no tokens needed) */
  readonly isRpc: boolean;
  
  /** Set the admin DB getter (called by admin plugin after initialization) */
  setAdminDbGetter(getter: () => Promise<OrmClient | null>): void;
  
  /** Get the admin database ORM client */
  getAdminDatabase(options: { schema: SchemaType; skipMigrations?: boolean }): Promise<OrmClient>;
  
  /** Get an organization database ORM client */
  getOrgDatabase(options: GetOrgDatabaseOptions): Promise<OrmClient | null>;
  
  /** Create a new organization database */
  createOrgDatabase(options: CreateOrgDatabaseOptions): Promise<CreateOrgDatabaseResult>;
  
  /** Get organization database info (name only) */
  getOrgDatabaseInfo(organizationId: string): Promise<OrgDatabaseInfo | null>;
  
  /** Resolve database name for an organization */
  resolveDatabaseName(organizationId: string): Promise<string | null>;
}

export type { DatabaseContext as IDatabaseContext };

// ============================================================================
// Factory - imports implementations from adapters
// ============================================================================

import { RpcDatabaseContext } from './rpc-adapter.js';
import { HttpDatabaseContext } from './d1-http-adapter.js';
import { D1DatabaseContext } from './d1-adapter.js';

/**
 * Create a DatabaseContext based on configuration
 * This is the main entry point - plugins should use this
 * 
 * @example
 * ```ts
 * // From plugin adapter config
 * const ctx = createDatabaseContext({
 *   adapter: 'd1',
 *   bindingName: 'ADMIN_DB',
 *   env: platform?.env
 * });
 * 
 * // The context handles everything internally
 * const adminDb = await ctx.getAdminDatabase({ schema, skipMigrations: false });
 * ```
 */
export function createDatabaseContext(config: DatabaseContextConfig): DatabaseContext {
  // Normalize config: use bindingName, fallback to rpcBinding for backward compat
  const bindingName = config.bindingName || config.rpcBinding;
  const normalizedConfig: DatabaseContextConfig = {
    ...config,
    bindingName,
    rpcBinding: bindingName  // Keep both in sync for backward compat
  };
  
  // Determine adapter type
  const adapterType = config.adapter === 'auto' 
    ? (bindingName ? 'rpc' : 'http')
    : config.adapter;
  
  if (adapterType === 'rpc') {
    return new RpcDatabaseContext(normalizedConfig);
  }
  
  if (adapterType === 'd1') {
    return new D1DatabaseContext(normalizedConfig);
  }
  
  if (adapterType === 'do') {
    // DO uses same pattern as D1 for now
    return new D1DatabaseContext(normalizedConfig);
  }
  
  return new HttpDatabaseContext(normalizedConfig);
}

// Re-export implementations for direct use
export { RpcDatabaseContext, HttpDatabaseContext, D1DatabaseContext };
