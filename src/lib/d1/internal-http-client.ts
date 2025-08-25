export type QueryResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
  results?: any;
};

export interface KuratchiD1v2Config {
  databaseName: string; // logical DB name used as x-db-name
  workersSubdomain: string;
  dbToken: string; // per-database token
  gatewayKey: string; // master API key for router Worker
  scriptName?: string; // default: 'kuratchi-d1-internal'
  debug?: boolean; // optional debug logging
}

// Back-compat alias to avoid touching many imports immediately
export { KuratchiD1v2HttpClient as KuratchiHttpClient };

/** INTERNAL: Low-level HTTP client for D1 router Worker (multi-DB). */
export class KuratchiD1v2HttpClient {
  private endpoint: string;
  private dbToken: string;
  private gatewayKey: string;
  private dbName: string;
  private bookmark?: string;
  private debug: boolean;

  constructor(config: KuratchiD1v2Config) {
    const script = config.scriptName || 'kuratchi-d1-internal';
    this.endpoint = `https://${script}.${config.workersSubdomain}`;
    this.dbToken = config.dbToken;
    this.gatewayKey = config.gatewayKey;
    this.dbName = config.databaseName;
    this.debug = !!config.debug;
    try {
      Object.defineProperty(this, 'dbToken', { enumerable: false, configurable: false, writable: true });
      Object.defineProperty(this, 'gatewayKey', { enumerable: false, configurable: false, writable: true });
    } catch {}
  }

  private async makeRequest(path: string, body: any): Promise<QueryResult<any>> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-db-name': this.dbName,
        'x-db-token': this.dbToken,
        Authorization: `Bearer ${this.gatewayKey}`,
      };
      if (this.bookmark) headers['x-d1-bookmark'] = this.bookmark;
      if (this.debug) { try { console.log('[KuratchiD1v2HttpClient.makeRequest] ->', path, { hasBookmark: !!this.bookmark }); } catch {} }
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
      const bm = res.headers.get('x-d1-bookmark');
      if (bm) this.bookmark = bm;
      const json = await res.json();
      if (this.debug) { try { console.log('[KuratchiD1v2HttpClient.makeRequest] <-', path, { keys: json && typeof json === 'object' ? Object.keys(json) : typeof json, bookmark: this.bookmark ? this.bookmark.slice(0, 24)+'...' : null }); } catch {} }
      return json;
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async query<T>(query: string, params: any[] = []): Promise<QueryResult<T>> {
    const head = String(query || '').trim().slice(0, 10).toUpperCase();
    const isSelect = head.startsWith('SELECT');
    if (isSelect) {
      const res = await this.makeRequest('/api/raw', { query, params, columnNames: true });
      // Normalize into array of objects if returned as [columns, ...rows]
      if (res && typeof res === 'object' && 'success' in res && (res as any).success === false) {
        return res as any;
      }
      let rows: any[] = [];
      if (this.debug) { try { console.log('[KuratchiD1v2HttpClient.query][SELECT] raw response type:', Array.isArray(res) ? 'array' : typeof res); } catch {} }
      if (Array.isArray(res)) {
        const arr: any[] = res as any[];
        if (arr.length && Array.isArray(arr[0]) && arr[0].every((x: any) => typeof x === 'string')) {
          const cols = arr[0] as string[];
          rows = arr.slice(1).map((vals) => {
            const obj: Record<string, any> = {};
            for (let i = 0; i < cols.length; i++) obj[cols[i]] = (vals as any[])[i];
            return obj;
          });
        } else {
          rows = arr as any[];
        }
      } else if (res && typeof res === 'object') {
        // Support object shapes:
        // - { columns: string[], results: any[][] }
        // - { columnNames: string[], rows: any[][] }
        // - { results: any[][], meta: { columns: string[] } }
        const obj = res as any;
        const columns: string[] | undefined = Array.isArray(obj.columns) ? obj.columns
          : Array.isArray(obj.columnNames) ? obj.columnNames
          : Array.isArray(obj.meta?.columns) ? obj.meta.columns
          : undefined;
        const resultRows: any[] | undefined = Array.isArray(obj.results) ? obj.results
          : Array.isArray(obj.rows) ? obj.rows
          : undefined;
        if (columns && Array.isArray(resultRows)) {
          rows = (resultRows as any[]).map((vals: any[]) => {
            const o: Record<string, any> = {};
            for (let i = 0; i < columns.length; i++) o[columns[i]] = vals[i];
            return o;
          });
        } else {
          rows = obj.results ?? obj.data ?? [];
        }
      } else {
        rows = [];
      }
      if (this.debug) { try { console.log('[KuratchiD1v2HttpClient.query][SELECT] mapped rows:', Array.isArray(rows) ? rows.slice(0, 2) : rows); } catch {} }
      return { success: true, data: rows } as any;
    } else {
      // Use run for DDL/DML with bound params
      const res = await this.makeRequest('/api/run', { query, params });
      if (this.debug) { try { console.log('[KuratchiD1v2HttpClient.query][RUN] response keys:', res && typeof res === 'object' ? Object.keys(res as any) : typeof res); } catch {} }
      return res as any;
    }
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
