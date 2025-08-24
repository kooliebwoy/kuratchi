export type QueryResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
  results?: any;
};

export interface KuratchiDoConfig {
  databaseName: string; // logical DB name => Durable Object idFromName
  workersSubdomain: string;
  dbToken?: string; // per-database token
  gatewayKey?: string; // master API key for gateway Worker
  scriptName?: string; // default: 'kuratchi-do-internal'
}

/** INTERNAL: Low-level HTTP client for Durable Objects SQLite proxy. */
export class KuratchiDoHttpClient {
  private endpoint: string;
  private dbToken?: string;
  private gatewayKey?: string;
  private dbName: string;

  constructor(config: KuratchiDoConfig) {
    const script = config.scriptName || 'kuratchi-do-internal';
    this.endpoint = `https://${script}.${config.workersSubdomain}`;
    this.dbToken = config.dbToken;
    this.gatewayKey = config.gatewayKey;
    this.dbName = config.databaseName;
    try {
      Object.defineProperty(this, 'dbToken', { enumerable: false, configurable: false, writable: true });
      Object.defineProperty(this, 'gatewayKey', { enumerable: false, configurable: false, writable: true });
    } catch {}
  }

  private async makeRequest(path: string, body: any): Promise<QueryResult<any>> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-db-name': this.dbName };
      if (this.gatewayKey) headers['Authorization'] = `Bearer ${this.gatewayKey}`;
      if (this.dbToken) headers['x-db-token'] = this.dbToken;
      const res = await fetch(`${this.endpoint}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const json = await res.json();
          return { success: false, error: JSON.stringify(json) };
        }
        const text = await res.text();
        return { success: false, error: `API ${res.status}: ${text.slice(0, 200)}...` };
      }
      return res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async query<T>(query: string, params: any[] = []): Promise<QueryResult<T>> {
    return this.makeRequest('/api/run', { query, params });
  }
  async exec(query: string): Promise<QueryResult<any>> {
    return this.makeRequest('/api/exec', { query });
  }
  async batch(queries: { query: string; params?: any[] }[]): Promise<QueryResult<any>> {
    return this.makeRequest('/api/batch', { batch: queries });
  }
  async raw(query: string, params?: any[], columnNames: boolean = false): Promise<QueryResult<any>> {
    return this.makeRequest('/api/raw', { query, params, columnNames });
  }
  async first<T>(query: string, params?: any[], columnName?: string): Promise<QueryResult<T>> {
    return this.makeRequest('/api/first', { query, params, columnName });
  }
}
