/**
 * ORM Client
 * Create ORM client with schema and migrations
 */

import type { DoHttpClient, OrmClient, ClientOptions } from '../core/types.js';
import type { DatabaseSchema } from '../../orm/json-schema.js';
import type { SchemaDsl } from '../../utils/types.js';
import { createClientFromJsonSchema } from '../../orm/kuratchi-orm.js';
import { createDoHttpAdapter, createDoDirectAdapter } from '../../orm/adapters.js';
import { getCurrentPlatform } from '../../utils/platform-context.js';
import { ensureNormalizedSchema } from '../migrations/migration-utils.js';
import { applyMigrations } from '../migrations/migration-runner.js';

export interface CreateOrmClientOptions {
  httpClient: DoHttpClient;
  schema: DatabaseSchema | SchemaDsl;
  databaseName: string;
}

/**
 * Detect if we should use direct DO binding or HTTP client
 */
function shouldUseDirectBinding(databaseName: string): boolean {
  const isDev = import.meta.env?.DEV ?? false;
  if (isDev) return false;
  
  const platform = getCurrentPlatform() as any;
  const doBinding = platform?.env?.[databaseName];
  
  return doBinding && typeof doBinding.sql === 'function';
}

/**
 * Get direct DO binding if available
 */
function getDirectBinding(databaseName: string): any {
  const platform = getCurrentPlatform() as any;
  return platform?.env?.[databaseName];
}

/**
 * Create ORM client (auto-detects HTTP vs Direct binding)
 */
export async function createOrmClient(options: CreateOrmClientOptions): Promise<OrmClient> {
  const { httpClient, schema, databaseName } = options;
  
  // Normalize schema
  const normalizedSchema = ensureNormalizedSchema(schema);
  
  // Apply migrations first
  await applyMigrations({
    client: httpClient,
    schemaName: normalizedSchema.name,
    schema: normalizedSchema
  });
  
  // Determine adapter type
  let exec: any;
  let kvClient: any = null;
  
  if (shouldUseDirectBinding(databaseName)) {
    // Production: Use direct DO binding (fastest)
    const doBinding = getDirectBinding(databaseName);
    console.log(`[Kuratchi] Using direct DO binding for ${databaseName}`);
    exec = createDoDirectAdapter(doBinding);
    // TODO: Add direct KV access from DO binding
  } else {
    // Dev or remote: Use HTTP client
    exec = createDoHttpAdapter(httpClient);
    kvClient = httpClient.kv;
  }
  
  // Create ORM client
  return createClientFromJsonSchema(exec, normalizedSchema, { kv: kvClient });
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
