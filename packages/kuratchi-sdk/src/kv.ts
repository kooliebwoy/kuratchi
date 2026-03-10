/**
 * KV Client
 *
 * Key-value operations against a specific KV namespace.
 * Routes to POST /api/v1/kv/:kvName
 *
 * @example
 * ```typescript
 * const kv = kuratchi.kv('my-cache');
 *
 * await kv.put('user:1', JSON.stringify({ name: 'Alice' }));
 * const value = await kv.get('user:1');
 * const keys = await kv.list({ prefix: 'user:' });
 * await kv.delete('user:1');
 *
 * // With TTL and metadata
 * await kv.put('session:abc', data, {
 *   expirationTtl: 3600,
 *   metadata: { userId: '1' },
 * });
 * const { value, metadata } = await kv.getWithMetadata('session:abc');
 * ```
 */

export interface KVListResult {
  keys: { name: string; expiration?: number; metadata?: any }[];
  list_complete: boolean;
  cursor?: string;
}

export class KVClient {
  private baseUrl: string;
  private apiKey: string;
  private kvName: string;

  constructor(baseUrl: string, apiKey: string, kvName: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.kvName = kvName;
  }

  private async request<T = any>(body: any): Promise<T> {
    const res = await fetch(`${this.baseUrl}/api/v1/kv/${this.kvName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error((err as any).error || `KV request failed: ${res.status}`);
    }

    return await res.json() as T;
  }

  /** Get a value by key */
  async get(key: string, type: 'text' | 'json' | 'arrayBuffer' = 'text'): Promise<any> {
    const result = await this.request<{ success: boolean; value: any }>({ op: 'get', key, type });
    return result.value;
  }

  /** Get a value with its metadata */
  async getWithMetadata(key: string, type: 'text' | 'json' = 'text'): Promise<{ value: any; metadata: any }> {
    const result = await this.request<{ success: boolean; value: any; metadata: any }>({
      op: 'getWithMetadata', key, type,
    });
    return { value: result.value, metadata: result.metadata };
  }

  /** Put a value */
  async put(
    key: string,
    value: string,
    options?: { expirationTtl?: number; expiration?: number; metadata?: any }
  ): Promise<void> {
    await this.request({ op: 'put', key, value, ...options });
  }

  /** Delete a key */
  async delete(key: string): Promise<void> {
    await this.request({ op: 'delete', key });
  }

  /** List keys */
  async list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<KVListResult> {
    return this.request<KVListResult>({ op: 'list', ...options });
  }
}
