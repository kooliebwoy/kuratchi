/**
 * KV Client for Durable Object Key-Value operations
 * Handles KV get, put, delete, and list operations
 */

import type {
  DoKvClient,
  KvGetOptions,
  KvGetResult,
  KvPutOptions,
  KvPutResult,
  KvDeleteOptions,
  KvDeleteResult,
  KvListOptions,
  KvListResult,
  KvListKey,
  KvEncoding,
  QueryResult
} from '../core/types.js';

/**
 * Decode base64 string to Uint8Array
 */
function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Create KV client that communicates via HTTP request function
 */
export function createKvClient(
  request: (path: string, body: any) => Promise<QueryResult<any>>
): DoKvClient {
  return {
    async get(opts: KvGetOptions): Promise<KvGetResult> {
      const result = await request('/api/kv/get', opts);
      
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      const encoding = (result as any).encoding as KvEncoding | undefined;
      let value = (result as any).value;
      
      // Decode base64 if needed
      if (encoding === 'base64' && typeof value === 'string') {
        value = decodeBase64(value);
      }
      
      return {
        success: true,
        value,
        metadata: (result as any).metadata,
        encoding: encoding ?? 'json'
      };
    },

    async put(opts: KvPutOptions): Promise<KvPutResult> {
      const result = await request('/api/kv/put', opts);
      return {
        success: !!result.success,
        error: result.success ? undefined : result.error
      };
    },

    async delete(opts: KvDeleteOptions): Promise<KvDeleteResult> {
      const result = await request('/api/kv/delete', opts);
      return {
        success: !!result.success,
        deleted: (result as any).deleted,
        error: result.success ? undefined : result.error
      };
    },

    async list(opts: KvListOptions = {}): Promise<KvListResult> {
      const result = await request('/api/kv/list', opts);
      
      if (!result.success) {
        return {
          success: false,
          keys: [],
          list_complete: true,
          cursor: null,
          error: result.error
        };
      }
      
      const rawKeys = Array.isArray((result as any).keys) ? (result as any).keys : [];
      const keys: KvListKey[] = rawKeys.map((k: any) => ({
        name: k.name,
        expiration: k.expiration ?? null,
        metadata: k.metadata
      }));
      
      return {
        success: true,
        keys,
        list_complete: (result as any).list_complete ?? true,
        cursor: (result as any).cursor ?? null,
        cacheStatus: (result as any).cacheStatus ?? null
      };
    }
  };
}
