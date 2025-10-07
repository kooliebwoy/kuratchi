import { getCurrentPlatform } from '../utils/platform-context.js';

/**
 * Global KV namespace that reads from platform.env
 * Automatically works in both dev (via wrangler proxy) and production
 */

type KVNamespace = {
  get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream'; cacheTtl?: number }): Promise<any>;
  put(key: string, value: string | ArrayBuffer | ReadableStream, options?: { expiration?: number; expirationTtl?: number; metadata?: any }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{ keys: Array<{ name: string; expiration?: number; metadata?: any }>; list_complete: boolean; cursor?: string }>;
};

class KVNotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KVNotAvailableError';
  }
}

function getKVNamespace(name: string): KVNamespace {
  const platform = getCurrentPlatform();
  
  if (!platform || typeof platform !== 'object') {
    throw new KVNotAvailableError('[Kuratchi KV] No platform available. Are you calling this from a server context with the auth handle configured?');
  }

  const env = (platform as any).env;
  if (!env || typeof env !== 'object') {
    throw new KVNotAvailableError('[Kuratchi KV] No platform.env available. Ensure wrangler dev is running or you are deployed to Cloudflare Workers.');
  }

  const kvNamespace = env[name];
  if (!kvNamespace) {
    throw new KVNotAvailableError(`[Kuratchi KV] KV namespace "${name}" not found in platform.env. Check your wrangler.toml bindings.`);
  }

  return kvNamespace as KVNamespace;
}

/**
 * Get a value from KV
 * @param namespace - KV namespace binding name (from wrangler.toml)
 * @param key - Key to retrieve
 * @param options - Optional get options
 */
export async function get<T = any>(
  namespace: string,
  key: string,
  options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream'; cacheTtl?: number }
): Promise<T | null> {
  try {
    const kv = getKVNamespace(namespace);
    return await kv.get(key, options);
  } catch (error) {
    if (error instanceof KVNotAvailableError) {
      console.warn(error.message);
      return null;
    }
    throw error;
  }
}

/**
 * Put a value into KV
 * @param namespace - KV namespace binding name (from wrangler.toml)
 * @param key - Key to store
 * @param value - Value to store
 * @param options - Optional put options
 */
export async function put(
  namespace: string,
  key: string,
  value: string | ArrayBuffer | ReadableStream,
  options?: { expiration?: number; expirationTtl?: number; metadata?: any }
): Promise<boolean> {
  try {
    const kv = getKVNamespace(namespace);
    await kv.put(key, value, options);
    return true;
  } catch (error) {
    if (error instanceof KVNotAvailableError) {
      console.warn(error.message);
      return false;
    }
    throw error;
  }
}

/**
 * Delete a key from KV
 * @param namespace - KV namespace binding name (from wrangler.toml)
 * @param key - Key to delete
 */
export async function del(
  namespace: string,
  key: string
): Promise<boolean> {
  try {
    const kv = getKVNamespace(namespace);
    await kv.delete(key);
    return true;
  } catch (error) {
    if (error instanceof KVNotAvailableError) {
      console.warn(error.message);
      return false;
    }
    throw error;
  }
}

/**
 * List keys in KV
 * @param namespace - KV namespace binding name (from wrangler.toml)
 * @param options - Optional list options
 */
export async function list(
  namespace: string,
  options?: { prefix?: string; limit?: number; cursor?: string }
): Promise<{ keys: Array<{ name: string; expiration?: number; metadata?: any }>; list_complete: boolean; cursor?: string } | null> {
  try {
    const kv = getKVNamespace(namespace);
    return await kv.list(options);
  } catch (error) {
    if (error instanceof KVNotAvailableError) {
      console.warn(error.message);
      return null;
    }
    throw error;
  }
}

/**
 * Get a KV namespace client for direct access
 * @param name - KV namespace binding name (from wrangler.toml)
 */
export function namespace(name: string): KVNamespace | null {
  try {
    return getKVNamespace(name);
  } catch (error) {
    if (error instanceof KVNotAvailableError) {
      console.warn(error.message);
      return null;
    }
    throw error;
  }
}

/**
 * Convenience namespace export
 */
export const kv = {
  get,
  put,
  delete: del,
  list,
  namespace
};
