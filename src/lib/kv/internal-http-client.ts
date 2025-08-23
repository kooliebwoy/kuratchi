export type KVQueryResult<T = unknown> = {
  success: boolean;
  error?: string;
  value?: T | string | null;
  keys?: Array<{ name: string; expiration?: number; metadata?: any }>;
  list_complete?: boolean;
  cursor?: string;
};

export interface KuratchiKVConfig {
  namespaceName: string;
  workersSubdomain: string;
  apiToken?: string;
}

/**
 * INTERNAL: Low-level HTTP client for KV Worker. Not exported publicly.
 * @internal
 */
export class KuratchiKVHttpClient {
  private endpoint: string;
  private token?: string;

  constructor(config: KuratchiKVConfig) {
    this.endpoint = `https://${config.namespaceName}.${config.workersSubdomain}`;
    this.token = config.apiToken;
    try {
      Object.defineProperty(this, 'token', { enumerable: false, configurable: false, writable: true });
    } catch {}
  }

  private async makeRequest(path: string, body: any): Promise<KVQueryResult<any>> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
      const res = await fetch(`${this.endpoint}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body ?? {})
      });
      if (!res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const j = await res.json();
          return { success: false, error: JSON.stringify(j) };
        }
        const t = await res.text();
        return { success: false, error: `HTTP ${res.status}: ${t.substring(0, 200)}...` };
      }
      const data = await res.json();
      return data;
    } catch (e: any) {
      return { success: false, error: e?.message || String(e) };
    }
  }

  async get<T = unknown>(key: string, options?: { json?: boolean; cacheTtl?: number }): Promise<KVQueryResult<T>> {
    return this.makeRequest('/api/get', { key, json: options?.json ?? false, cacheTtl: options?.cacheTtl });
  }

  async put(key: string, value: string | object, options?: { expiration?: number; expirationTtl?: number; metadata?: any }): Promise<KVQueryResult<null>> {
    const v = typeof value === 'string' ? value : JSON.stringify(value);
    return this.makeRequest('/api/put', { key, value: v, options });
  }

  async delete(key: string): Promise<KVQueryResult<null>> {
    return this.makeRequest('/api/delete', { key });
  }

  async list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<KVQueryResult<any>> {
    return this.makeRequest('/api/list', { ...options });
  }

  // Redact internals on logs
  toJSON() {
    return { endpoint: this.endpoint } as any;
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.toJSON();
  }
}
