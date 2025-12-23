/**
 * ORM Client
 * Create ORM client with schema and migrations
 */

import type { D1Client, OrmClient, ClientOptions } from '../core/types.js';
import type { DatabaseSchema } from '../migrations/schema.js';
import type { SchemaDsl } from '../../utils/types.js';
import { createClientFromJsonSchema } from '../../orm/kuratchi-orm.js';
import { createD1HttpAdapter, createD1Adapter, createDoDirectAdapter, createRpcAdapter } from '../../orm/adapters.js';
import { getCurrentPlatform } from '../../utils/platform-context.js';
import { ensureNormalizedSchema } from '../migrations/migration-utils.js';
import { synchronizeSchema } from '../schema-sync.js';
import { getAdapterPreference, getRpcBindingName } from '../rpc-config.js';
import type { DatabaseAdapterType } from '../rpc-config.js';

export interface CreateOrmClientOptions {
  httpClient?: D1Client;
  schema: DatabaseSchema | SchemaDsl;
  databaseName: string;
  skipMigrations?: boolean;
  bindingName?: string; // Optional: binding name to look up in platform.env (overrides databaseName for detection)
  adapter?: DatabaseAdapterType;
}

/**
 * Detect binding type and return adapter
 * Checks for D1 direct binding or falls back to HTTP (D1 workers)
 */
function detectAdapter(
  databaseName: string,
  httpClient: D1Client | undefined,
  bindingName: string | undefined,
  adapterPreference: DatabaseAdapterType
): { exec: any; type: string } {
  const platform = getCurrentPlatform() as any;
  const lookupKey = bindingName || databaseName;
  const binding = platform?.env?.[lookupKey];

  const resolveRpc = () => {
    if (!binding) {
      throw new Error(`[Kuratchi] RPC adapter requires binding '${lookupKey}' but none was found`);
    }
    if (typeof binding.run !== 'function') {
      throw new Error(`[Kuratchi] Binding '${lookupKey}' does not expose a run() method for RPC adapter`);
    }
    console.log(`[Kuratchi] Using RPC service binding for ${lookupKey}`);
    return { exec: createRpcAdapter(binding, databaseName), type: 'rpc' as const };
  };

  const resolveDo = () => {
    if (!binding) {
      throw new Error(`[Kuratchi] DO adapter requires binding '${lookupKey}' but none was found`);
    }
    if (typeof binding.sql !== 'function') {
      throw new Error(`[Kuratchi] Binding '${lookupKey}' does not expose a sql() method for DO adapter`);
    }
    console.log(`[Kuratchi] Using DO direct binding for ${lookupKey}`);
    return { exec: createDoDirectAdapter(binding), type: 'do' as const };
  };

  const resolveD1 = () => {
    if (!binding) {
      throw new Error(`[Kuratchi] D1 adapter requires binding '${lookupKey}' but none was found`);
    }
    if (typeof binding.prepare !== 'function') {
      throw new Error(`[Kuratchi] Binding '${lookupKey}' does not expose a prepare() method for D1 adapter`);
    }
    console.log(`[Kuratchi] Using D1 direct binding for ${lookupKey}`);
    return { exec: createD1Adapter(binding), type: 'd1' as const };
  };

  const resolveHttp = () => {
    if (!httpClient) {
      throw new Error(
        `[Kuratchi] HTTP adapter requires httpClient for ${databaseName}, but none was provided`
      );
    }
    console.log(`[Kuratchi] Using HTTP client for ${databaseName}`);
    return { exec: createD1HttpAdapter(httpClient), type: 'http' as const };
  };

  // Respect explicit adapter selection
  if (adapterPreference && adapterPreference !== 'auto') {
    switch (adapterPreference) {
      case 'rpc':
        return resolveRpc();
      case 'do':
        return resolveDo();
      case 'd1':
        return resolveD1();
      case 'http':
        return resolveHttp();
      default:
        throw new Error(`[Kuratchi] Unknown adapter preference: ${adapterPreference}`);
    }
  }

  // Auto-detection mode
  if (binding) {
    if (typeof binding.run === 'function') {
      return resolveRpc();
    }
    if (typeof binding.sql === 'function') {
      return resolveDo();
    }
    if (typeof binding.prepare === 'function') {
      return resolveD1();
    }
  }

  return resolveHttp();
}

/**
 * Create ORM client (auto-detects D1 direct binding or HTTP client)
 */
export async function createOrmClient(options: CreateOrmClientOptions): Promise<OrmClient> {
  const { httpClient, schema, databaseName, skipMigrations, bindingName, adapter } = options;

  // Normalize schema
  const normalizedSchema = ensureNormalizedSchema(schema);

  // Determine adapter preference (explicit option overrides global config)
  const globalBinding = getRpcBindingName();
  const globalPreference = bindingName && bindingName === globalBinding ? getAdapterPreference() : 'auto';
  const adapterPreference = adapter ?? globalPreference ?? 'auto';

  // Auto-detect best adapter (respecting preference when provided)
  const { exec, type } = detectAdapter(databaseName, httpClient, bindingName, adapterPreference);

  // Apply migrations using the detected adapter
  // For D1 direct, we need to wrap exec to match D1Client interface
  const migrationClient = type === 'http'
    ? (() => {
        if (!httpClient) {
          throw new Error(`[Kuratchi] httpClient is required for HTTP adapter (${databaseName})`);
        }
        return httpClient;
      })()
    : createMigrationClientFromExec(exec);
  
  if (!skipMigrations) {
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
        if (syncResult.appliedStatements.length > 0) {
          console.log(`[Kuratchi] Applied statements:`, syncResult.appliedStatements.slice(0, 5).join('\n').substring(0, 500));
        }
      } else {
        console.log(`[Kuratchi] ✓ Schema already up-to-date for ${normalizedSchema.name} v${schemaVersion} (hash: ${syncResult.hash.substring(0, 8)})`);
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
  
  // Create ORM client from schema (no KV support in D1 mode)
  const ormClient = createClientFromJsonSchema(exec, normalizedSchema);
  
  return ormClient;
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
