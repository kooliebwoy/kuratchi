/**
 * ORM Client
 * Create ORM client with schema and migrations
 */

import type { DoHttpClient, OrmClient, ClientOptions } from '../core/types.js';
import type { DatabaseSchema } from '../migrations/schema.js';
import type { SchemaDsl } from '../../utils/types.js';
import { createClientFromJsonSchema } from '../../orm/kuratchi-orm.js';
import { createDoHttpAdapter, createDoDirectAdapter, createD1Adapter } from '../../orm/adapters.js';
import { getCurrentPlatform } from '../../utils/platform-context.js';
import { ensureNormalizedSchema } from '../migrations/migration-utils.js';
import { applyMigrations } from '../migrations/migration-runner.js';

export interface CreateOrmClientOptions {
  httpClient: DoHttpClient;
  schema: DatabaseSchema | SchemaDsl;
  databaseName: string;
}

/**
 * Detect binding type and return adapter
 * Checks for D1, DO direct, or falls back to HTTP
 */
function detectAdapter(databaseName: string, httpClient: DoHttpClient): { exec: any; kvClient: any; type: string } {
  const platform = getCurrentPlatform() as any;
  
  if (platform?.env) {
    const binding = platform.env[databaseName] || platform.env.ADMIN_DB;
    
    // Check for D1 binding
    if (binding && typeof binding.prepare === 'function') {
      console.log(`[Kuratchi] Using D1 direct binding for ${databaseName}`);
      return {
        exec: createD1Adapter(binding),
        kvClient: null,
        type: 'd1'
      };
    }
    
    // Check for DO direct binding
    if (binding && typeof binding.sql === 'function') {
      console.log(`[Kuratchi] Using DO direct binding for ${databaseName}`);
      return {
        exec: createDoDirectAdapter(binding),
        kvClient: null, // TODO: Add direct KV access from DO binding
        type: 'do-direct'
      };
    }
  }
  
  // Fallback to HTTP client
  console.log(`[Kuratchi] Using HTTP client for ${databaseName}`);
  return {
    exec: createDoHttpAdapter(httpClient),
    kvClient: httpClient.kv,
    type: 'http'
  };
}

/**
 * Create ORM client (auto-detects D1, DO direct, or HTTP client)
 */
export async function createOrmClient(options: CreateOrmClientOptions): Promise<OrmClient> {
  const { httpClient, schema, databaseName } = options;
  
  // Normalize schema
  const normalizedSchema = ensureNormalizedSchema(schema);
  
  // Auto-detect best adapter FIRST (D1 > DO direct > HTTP)
  const { exec, kvClient, type } = detectAdapter(databaseName, httpClient);
  
  // Apply migrations using the detected adapter
  // For D1/DO direct, we need to wrap exec to match DoHttpClient interface
  const migrationClient = type === 'http' 
    ? httpClient 
    : createMigrationClientFromExec(exec);
  
  try {
    console.log(`[Kuratchi] Applying migrations for ${normalizedSchema.name} (via ${type})...`);
    await applyMigrations({
      client: migrationClient,
      schemaName: normalizedSchema.name,
      schema: normalizedSchema
    });
    console.log(`[Kuratchi] ✓ Migrations applied for ${normalizedSchema.name}`);
  } catch (error: any) {
    console.error(`[Kuratchi] Migration error for ${normalizedSchema.name}:`, error.message);
    throw error;
  }
  
  // Create ORM client with detected adapter
  return createClientFromJsonSchema(exec, normalizedSchema, { kv: kvClient });
}

/**
 * Create a DoHttpClient-compatible wrapper from an exec function
 * Used for running migrations against D1/DO direct bindings
 */
function createMigrationClientFromExec(exec: any): DoHttpClient {
  return {
    exec: exec,
    query: async (sql: string, params?: any[]) => {
      const result = await exec(sql, params);
      return {
        success: true,
        results: result.results || [],
        meta: result.meta
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
  } as DoHttpClient;
}

/**
 * Create ORM client with full validation
 */
export async function createValidatedOrmClient(options: ClientOptions & { httpClient: DoHttpClient }): Promise<OrmClient> {
  const { httpClient, schema, databaseName } = options;
  
  if (!databaseName) {
    throw new Error('databaseName is required');
  }
  if (!schema) {
    throw new Error('schema is required');
  }
  
  return createOrmClient({ httpClient, schema, databaseName });
}
