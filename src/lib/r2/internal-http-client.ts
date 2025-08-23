export type R2GetResult<T = unknown> = {
  success: boolean;
  error?: string;
  value?: T | string | null;
  size?: number;
  etag?: string;
  httpMetadata?: any;
  customMetadata?: Record<string, string> | null;
};

export type R2ListResult = {
  success: boolean;
  error?: string;
  objects?: Array<{
    key: string;
    size: number;
    etag?: string;
    uploaded?: string;
    httpMetadata?: any;
    customMetadata?: Record<string, string> | null;
  }>;
  delimitedPrefixes?: string[];
  truncated?: boolean;
  cursor?: string;
};

export interface KuratchiR2Config {
  bucketName: string;
  workersSubdomain: string;
  apiToken?: string;
}

/**
 * INTERNAL: Low-level HTTP client for R2 Worker. Not exported publicly.
 * @internal
 */
export class KuratchiR2HttpClient {
  private endpoint: string;
  private token?: string;

  constructor(config: KuratchiR2Config) {
    this.endpoint = `https://${config.bucketName}.${config.workersSubdomain}`;
    this.token = config.apiToken;
    try {
      Object.defineProperty(this, 'token', { enumerable: false, configurable: false, writable: true });
    } catch {}
  }

  private async makeRequest(path: string, body: any): Promise<any> {
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

  async get<T = unknown>(key: string, options?: { json?: boolean }): Promise<R2GetResult<T>> {
    return this.makeRequest('/api/get', { key, json: options?.json ?? false });
  }

  async put(
    key: string,
    value: string | object,
    options?: { httpMetadata?: any; customMetadata?: Record<string, string> | null; md5?: string }
  ): Promise<{ success: boolean; error?: string }>
  {
    const v = typeof value === 'string' ? value : JSON.stringify(value);
    const isJson = typeof value !== 'string';
    const httpMetadata = options?.httpMetadata ?? (isJson ? { contentType: 'application/json' } : undefined);
    return this.makeRequest('/api/put', { key, value: v, options: { ...options, httpMetadata } });
  }

  async delete(key: string): Promise<{ success: boolean; error?: string }>
  {
    return this.makeRequest('/api/delete', { key });
  }

  async list(options?: { prefix?: string; limit?: number; cursor?: string; delimiter?: string }): Promise<R2ListResult>
  {
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
