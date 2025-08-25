export type QueryResult<T> = {
    success: boolean;
    data?: T;
    error?: string;
    results?: any;
    schema?: any;
};

export interface KuratchiConfig {
    databaseName: string;
    workersSubdomain: string;
    apiToken?: string;
}

/**
 * INTERNAL: Low-level HTTP client used by the legacy D1 SDK.
 * Not exported from the package entrypoint. Subject to change without notice.
 * @internal
 */
export class KuratchiHttpClient {
    private endpoint: string;
    private token?: string;
    private bookmark?: string; // D1 session bookmark

    constructor(config: KuratchiConfig) {
        this.endpoint = `https://${config.databaseName}.${config.workersSubdomain}`;
        this.token = config.apiToken;
        // Prevent accidental exposure in console.log / util.inspect
        try {
            Object.defineProperty(this, 'token', { enumerable: false, configurable: false, writable: true });
            Object.defineProperty(this, 'bookmark', { enumerable: false, configurable: false, writable: true });
        } catch {}
    }

    // ---- Session bookmark helpers ----
    setSessionBookmark(bookmark?: string) {
        this.bookmark = bookmark;
    }

    private async makeRequest(path: string, body: any): Promise<QueryResult<any>> {
        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };

            if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
            if (this.bookmark) headers['x-d1-bookmark'] = this.bookmark;

            const response = await fetch(`${this.endpoint}${path}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });

            // Capture latest bookmark from response for continued sessions
            const latestBookmark = response.headers.get('x-d1-bookmark');
            if (latestBookmark !== null) this.bookmark = latestBookmark || undefined;

            if (!response.ok) {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const errorData = await response.json();
                    console.error('Request failed with JSON error:', errorData);
                    return { success: false, error: JSON.stringify(errorData) };
                } else {
                    const text = await response.text();
                    console.error('Request failed with non-JSON response:',
                        `Status: ${response.status}, URL: ${this.endpoint}${path}, Response: ${text.substring(0, 200)}...`
                    );
                    return {
                        success: false,
                        error: `API request failed with status ${response.status}. Worker may not be deployed or accessible.`
                    };
                }
            }

            const data = await response.json();
            return data;
        } catch (e: any) {
            console.error('Error making request:', e);
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

    async update(table: string, data: Record<string, any>, where: Record<string, any>): Promise<QueryResult<any>> {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const whereColumns = Object.keys(where);
        const whereValues = Object.values(where);

        const setClause = columns.map(col => `${col} = ?`).join(', ');
        const whereClause = whereColumns.map(col => `${col} = ?`).join(' AND ');

        const query = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
        const params = [...values, ...whereValues];

        return this.query(query, params);
    }

    async getTableData(table: string, limit: number = 20): Promise<QueryResult<any>> {
        const schemaQuery = `PRAGMA table_info(${table})`;
        const schemaResult = await this.query(schemaQuery);
        if (!schemaResult.success) return schemaResult;

        const dataQuery = `SELECT * FROM ${table} LIMIT ?`;
        const dataResult = await this.query(dataQuery, [limit]);
        if (!dataResult.success) return dataResult;

        dataResult.schema = schemaResult.results;
        return dataResult;
    }

    /**
     * Drizzle ORM proxy for sqlite-proxy adapter
     */
    getDrizzleProxy() {
        return async (sql: string, params: any[], method: string) => {
            try {
                const result: any = await this.raw(sql, params);
                if (method === 'get') {
                    return { rows: result[0] };
                }
                return { rows: result };
            } catch (e: any) {
                console.error('Error in Drizzle proxy:', e);
                return { rows: [] };
            }
        };
    }

    /**
     * Execute database migrations using provided files
     */
    async migrate(migrations: { journal: { entries: any[] }, migrations: Record<string, string | (() => Promise<string>) | { default: string }> }) {
        try {
            const createTableResult: any = await this.exec(
                'CREATE TABLE IF NOT EXISTS migrations_history (id INTEGER PRIMARY KEY AUTOINCREMENT, tag TEXT NOT NULL UNIQUE, created_at INTEGER);'
            );
            if (!createTableResult && !createTableResult?.count) {
                throw new Error('Failed to create migrations table');
            }

            const appliedMigrationsResult: any = await this.query('SELECT tag FROM migrations_history');
            const appliedTags = new Set(appliedMigrationsResult.results?.map((row: any) => row.tag) || []);

            for (const entry of migrations.journal.entries) {
                const { tag, idx } = entry;
                if (appliedTags.has(tag)) continue;

                const migrationKey = `m${idx.toString().padStart(4, '0')}`;
                const raw = migrations.migrations[migrationKey];
                if (!raw) throw new Error(`Migration SQL not found for ${tag} with key ${migrationKey}`);
                let migrationText: string;
                if (typeof raw === 'function') migrationText = await raw();
                else if (typeof raw === 'object' && (raw as any).default) migrationText = (raw as any).default;
                else migrationText = raw as string;

                const statements = migrationText.split('--> statement-breakpoint');
                const batchQueries = [] as { query: string; params: any[] }[];
                for (const statement of statements) {
                    const trimmed = statement.trim();
                    if (!trimmed) continue;
                    const sqlStatement = trimmed.endsWith(';') ? trimmed : `${trimmed};`;
                    batchQueries.push({ query: sqlStatement, params: [] });
                }
                batchQueries.push({
                    query: 'INSERT INTO migrations_history (tag, created_at) VALUES (?, ?)',
                    params: [tag, Date.now()]
                });

                if (batchQueries.length > 0) {
                    const batchResult = await this.batch(batchQueries);
                    if (!batchResult) {
                        throw new Error(`Failed to apply migration ${tag}: ` + batchResult);
                    }
                }
            }
            return true;
        } catch (error) {
            console.error('Migration failed:', error);
            return false;
        }
    }

  // Redact internals on logs
  toJSON() {
    return {
      endpoint: this.endpoint,
      query: '[function]',
      raw: '[function]'
    } as any;
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.toJSON();
  }
}
