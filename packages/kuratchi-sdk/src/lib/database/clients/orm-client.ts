/**
 * ORM Client
 * Create ORM client with schema and migrations
 * 
 * Adapter-first design: explicit adapter type determines execution path
 * - 'd1': Direct D1 binding (binding.prepare)
 * - 'rpc': RPC service binding (binding.run)
 * - 'do': Durable Objects direct (binding.sql)
 * - 'http': HTTP REST API (requires httpClient)
 * - 'auto': Auto-detect from binding type
 */

import type { D1Client, OrmClient, ClientOptions } from '../core/types.js';
import type { DatabaseSchema } from '../migrations/schema.js';
import type { SchemaDsl } from '../../utils/types.js';
import { createClientFromJsonSchema } from '../../orm/kuratchi-orm.js';
import { createD1HttpAdapter } from '../../adapters/d1-http-adapter.js';
import { createD1Adapter, createD1Client } from '../../adapters/d1-adapter.js';
import { createDoDirectAdapter } from '../../adapters/do-adapter.js';
import { createRpcAdapter, createRpcClient } from '../../adapters/rpc-adapter.js';
import { getCurrentPlatform } from '../../utils/platform-context.js';
import { ensureNormalizedSchema } from '../migrations/migration-utils.js';
import { synchronizeSchema } from '../schema-sync.js';
import type { DatabaseAdapterType } from '../../adapters/index.js';

export interface CreateOrmClientOptions {
  /** Schema definition */
  schema: DatabaseSchema | SchemaDsl;
  /** Database name (used for RPC routing and logging) */
  databaseName: string;
  /** Skip schema migrations (default: false) */
  skipMigrations?: boolean;
  /** Binding name in platform.env (defaults to databaseName) */
  bindingName?: string;
  /** Explicit adapter type (recommended) */
  adapter?: DatabaseAdapterType;
  /** @deprecated Use adapter: 'http' instead. HTTP client for REST API mode */
  httpClient?: D1Client;
}

/**
 * Get binding from platform.env
 */
function getBinding(bindingName: string): any {
  const platform = getCurrentPlatform() as any;
  return platform?.env?.[bindingName];
}

/**
 * Create execution adapter based on explicit type
 * Returns exec function for ORM and optional client for migrations
 */
function createExecutionAdapter(
  adapterType: DatabaseAdapterType,
  bindingName: string,
  databaseName: string,
  httpClient?: D1Client
): { exec: any; type: DatabaseAdapterType; client?: any } {
  const binding = getBinding(bindingName);
  
  switch (adapterType) {
    case 'd1': {
      if (!binding) {
        throw new Error(`[Kuratchi] D1 binding '${bindingName}' not found in platform.env`);
      }
      if (typeof binding.prepare !== 'function') {
        throw new Error(`[Kuratchi] Binding '${bindingName}' is not a D1 database (no prepare method)`);
      }
      console.log(`[Kuratchi] Using D1 direct binding: ${bindingName}`);
      // Return both the exec adapter and the full D1 client for migrations
      const d1Client = createD1Client(binding);
      return { 
        exec: createD1Adapter(binding), 
        type: 'd1',
        client: d1Client  // Full client with exec, batch, first, raw methods
      };
    }
    
    case 'rpc': {
      if (!binding) {
        throw new Error(`[Kuratchi] RPC binding '${bindingName}' not found in platform.env`);
      }
      if (typeof binding.run !== 'function') {
        throw new Error(`[Kuratchi] Binding '${bindingName}' is not an RPC service (no run method)`);
      }
      console.log(`[Kuratchi] Using RPC service binding: ${bindingName} -> ${databaseName}`);
      // Return both the exec adapter and the full RPC client for migrations
      const rpcClient = createRpcClient(binding, databaseName);
      return { 
        exec: createRpcAdapter(binding, databaseName), 
        type: 'rpc',
        client: rpcClient  // Full client with exec, batch, first, raw methods
      };
    }
    
    case 'do': {
      if (!binding) {
        throw new Error(`[Kuratchi] DO binding '${bindingName}' not found in platform.env`);
      }
      if (typeof binding.sql !== 'function') {
        throw new Error(`[Kuratchi] Binding '${bindingName}' is not a Durable Object (no sql method)`);
      }
      console.log(`[Kuratchi] Using DO direct binding: ${bindingName}`);
      return { exec: createDoDirectAdapter(binding), type: 'do' };
    }
    
    case 'http': {
      if (!httpClient) {
        throw new Error(`[Kuratchi] HTTP adapter requires httpClient for ${databaseName}`);
      }
      console.log(`[Kuratchi] Using HTTP client: ${databaseName}`);
      return { exec: createD1HttpAdapter(httpClient), type: 'http', client: httpClient };
    }
    
    case 'auto':
    default: {
      // Auto-detect from binding type
      if (binding) {
        if (typeof binding.run === 'function') {
          console.log(`[Kuratchi] Auto-detected RPC binding: ${bindingName}`);
          const rpcClient = createRpcClient(binding, databaseName);
          return { exec: createRpcAdapter(binding, databaseName), type: 'rpc', client: rpcClient };
        }
        if (typeof binding.sql === 'function') {
          console.log(`[Kuratchi] Auto-detected DO binding: ${bindingName}`);
          return { exec: createDoDirectAdapter(binding), type: 'do' };
        }
        if (typeof binding.prepare === 'function') {
          console.log(`[Kuratchi] Auto-detected D1 binding: ${bindingName}`);
          const d1Client = createD1Client(binding);
          return { exec: createD1Adapter(binding), type: 'd1', client: d1Client };
        }
      }
      // Fall back to HTTP if no binding found
      if (httpClient) {
        console.log(`[Kuratchi] Falling back to HTTP client: ${databaseName}`);
        return { exec: createD1HttpAdapter(httpClient), type: 'http', client: httpClient };
      }
      throw new Error(`[Kuratchi] No binding '${bindingName}' found and no httpClient provided`);
    }
  }
}

/**
 * Create ORM client with explicit adapter type
 * 
 * @example
 * ```ts
 * // D1 direct binding
 * const client = await createOrmClient({
 *   schema: mySchema,
 *   databaseName: 'ADMIN_DB',
 *   bindingName: 'ADMIN_DB',
 *   adapter: 'd1'
 * });
 * 
 * // RPC service binding
 * const client = await createOrmClient({
 *   schema: mySchema,
 *   databaseName: 'org-abc-123',
 *   bindingName: 'KURATCHI_DATABASE',
 *   adapter: 'rpc'
 * });
 * ```
 */
export async function createOrmClient(options: CreateOrmClientOptions): Promise<OrmClient> {
  const { schema, databaseName, skipMigrations, bindingName, adapter, httpClient } = options;

  // Normalize schema
  const normalizedSchema = ensureNormalizedSchema(schema);

  // Resolve binding name (defaults to databaseName)
  const resolvedBindingName = bindingName || databaseName;
  
  // Resolve adapter type (defaults to 'auto')
  const adapterType = adapter || 'auto';

  // Create execution adapter
  const { exec, type, client } = createExecutionAdapter(adapterType, resolvedBindingName, databaseName, httpClient);

  // Run schema migrations if needed
  if (!skipMigrations) {
    // Use full client if available (RPC, HTTP), otherwise wrap exec
    const migrationClient = client || createMigrationClientFromExec(exec);
    try {
      const schemaVersion = (normalizedSchema as any).version ?? 'unknown';
      console.log(`[Kuratchi] Synchronizing schema for ${normalizedSchema.name} v${schemaVersion} (via ${type})...`);
      const syncResult = await synchronizeSchema({
        client: migrationClient,
        schema: normalizedSchema,
        databaseName
      });
      if (syncResult.changed) {
        console.log(`[Kuratchi] ✓ Schema synchronized for ${normalizedSchema.name} - applied ${syncResult.appliedStatements.length} statement(s)`);
      } else {
        console.log(`[Kuratchi] ✓ Schema up-to-date for ${normalizedSchema.name} v${schemaVersion}`);
      }
      if (syncResult.warnings.length > 0) {
        console.warn(`[Kuratchi] Schema warnings:`, syncResult.warnings);
      }
    } catch (error: any) {
      console.error(`[Kuratchi] Schema sync error for ${normalizedSchema.name}:`, error.message);
      throw error;
    }
  } else {
    console.log(`[Kuratchi] Skipping schema sync for ${normalizedSchema.name}`);
  }
  
  // Create ORM client from schema with full client for native API optimizations
  return createClientFromJsonSchema(exec, normalizedSchema, { client });
}

export async function createOrmClientFromExec(options: {
  exec: any;
  schema: DatabaseSchema | SchemaDsl;
  databaseName: string;
  skipMigrations?: boolean;
}): Promise<OrmClient> {
  const { exec, schema, databaseName, skipMigrations } = options;

  const normalizedSchema = ensureNormalizedSchema(schema);
  const migrationClient = createMigrationClientFromExec(exec);

  if (!skipMigrations) {
    const syncResult = await synchronizeSchema({
      client: migrationClient,
      schema: normalizedSchema,
      databaseName
    });
    if (syncResult.warnings.length > 0) {
      console.warn(`[Kuratchi] Schema warnings:`, syncResult.warnings);
    }
  } else {
    console.log(`[Kuratchi] Skipping schema sync for ${normalizedSchema.name}`);
  }

  return createClientFromJsonSchema(exec, normalizedSchema);
}

/**
 * Create a D1Client-compatible wrapper from an exec function
 * Used for running migrations against D1 direct bindings
 */
export function createMigrationClientFromExec(exec: any): D1Client {
  return {
    exec: exec,
    query: async (sql: string, params?: any[]) => {
      const result = await exec(sql, params);
      return {
        success: result.success ?? true,
        results: result.results || [],
        meta: result.meta,
        error: result.error
      };
    },
    batch: async (queries: any[]) => {
      // Execute queries sequentially for D1/DO direct
      for (const q of queries) {
        await exec(q.query, q.params);
      }
      return { success: true };
    },
    raw: async (sql: string, params?: any[]) => {
      return exec(sql, params);
    },
    first: async (sql: string, params?: any[]) => {
      const result = await exec(sql, params);
      return result.results?.[0] || null;
    },
    kv: null as any
  } as D1Client;
}

/**
 * Create ORM client with full validation
 */
export async function createValidatedOrmClient(options: ClientOptions & { httpClient: D1Client }): Promise<OrmClient> {
  const { httpClient, schema, databaseName, skipMigrations } = options;
  
  if (!databaseName) {
    throw new Error('databaseName is required');
  }
  if (!schema) {
    throw new Error('schema is required');
  }
  
  return createOrmClient({ httpClient, schema, databaseName, skipMigrations });
}
