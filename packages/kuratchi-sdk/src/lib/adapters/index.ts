/**
 * Kuratchi Adapters
 * 
 * Unified adapter system for database access across different backends:
 * - RPC (service bindings to Workers)
 * - D1 (Cloudflare D1 direct binding)
 * - HTTP (REST API access)
 * - DO (Durable Objects direct)
 * 
 * The DatabaseContext abstraction provides a clean interface for plugins
 * to access databases without knowing the underlying adapter.
 */

// Types
export type {
  DatabaseAdapterType,
  QueryResult,
  ExecutionAdapter,
  RpcConfig,
  OrmClient,
  SchemaType,
  AdapterConfig,
  RpcAdapterConfig,
  D1AdapterConfig,
  DoAdapterConfig,
  HttpAdapterConfig,
  PluginAdapterConfig
} from './types.js';

// DatabaseContext interface and factory
export {
  createDatabaseContext,
  type DatabaseContext,
  type IDatabaseContext,
  type DatabaseContextConfig,
  type OrgDatabaseInfo,
  type CreateOrgDatabaseOptions,
  type CreateOrgDatabaseResult,
  type GetOrgDatabaseOptions
} from './database-context.js';

// D1 Direct adapter (includes d1Adapter factory + D1DatabaseContext + full client)
export { createD1Adapter, createD1Client, d1Adapter, D1DatabaseContext } from './d1-adapter.js';

// D1 HTTP adapter (includes httpAdapter factory + HttpDatabaseContext)
export {
  createD1HttpAdapter,
  createDoHttpAdapter,
  httpAdapter,
  HttpDatabaseContext
} from './d1-http-adapter.js';

// DO Direct adapter (includes doAdapter factory)
export { createDoDirectAdapter, doAdapter } from './do-adapter.js';

// Auto-detect adapter
export { createAutoAdapter } from './auto-adapter.js';

// RPC adapter (includes rpcAdapter factory + config + RpcDatabaseContext + full client)
export {
  createRpcAdapter,
  createRpcClient,
  rpcAdapter,
  isRpcServiceBinding,
  setRpcConfig,
  getRpcConfig,
  isRpcEnabled,
  getRpcBindingName,
  getAdapterPreference,
  RpcDatabaseContext
} from './rpc-adapter.js';
