/**
 * Database Client
 *
 * SQL query execution against a specific D1 database.
 * Routes to POST /api/v1/:dbName
 *
 * @example
 * ```typescript
 * const db = kuratchi.database('my-db');
 *
 * // Simple query
 * const users = await db.query('SELECT * FROM users WHERE active = ?', [true]);
 *
 * // Batch (transaction)
 * await db.batch([
 *   { sql: 'INSERT INTO posts (title) VALUES (?)', params: ['Hello'] },
 *   { sql: 'INSERT INTO posts (title) VALUES (?)', params: ['World'] },
 * ]);
 *
 * // DDL / exec
 * await db.exec('CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY, title TEXT)');
 *
 * // Raw (array-of-arrays)
 * const raw = await db.raw('SELECT id, name FROM users');
 *
 * // Drizzle ORM integration
 * import { drizzle } from 'drizzle-orm/sqlite-proxy';
 * const drizzleDb = drizzle(db.drizzleProxy());
 * ```
 */

export interface DatabaseQueryResult<T = any> {
  success: boolean;
  results?: T[];
  error?: string;
  meta?: { rows_read?: number; rows_written?: number; duration?: number };
}

export class DatabaseClient {
  private baseUrl: string;
  private apiKey: string;
  private dbName: string;
  private bookmark: string | null = null;

  constructor(baseUrl: string, apiKey: string, dbName: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.dbName = dbName;
  }

  private async request<T = any>(body: any): Promise<DatabaseQueryResult<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };

    if (this.bookmark) {
      headers['x-d1-bookmark'] = this.bookmark;
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/${this.dbName}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const newBookmark = res.headers.get('x-d1-bookmark');
      if (newBookmark) this.bookmark = newBookmark;

      return await res.json() as DatabaseQueryResult<T>;
    } catch (error: any) {
      return { success: false, error: error.message || String(error) };
    }
  }

  /** Execute a parameterized query — returns rows as objects */
  async query<T = any>(sql: string, params: any[] = []): Promise<DatabaseQueryResult<T>> {
    return this.request<T>({ sql, params });
  }

  /** Execute DDL or write-only SQL — no results returned */
  async exec(sql: string): Promise<DatabaseQueryResult> {
    return this.request({ sql, exec: true });
  }

  /** Execute multiple statements in a batch (transaction) */
  async batch(items: { sql: string; params?: any[] }[]): Promise<DatabaseQueryResult> {
    return this.request({ batch: items });
  }

  /** Execute a query — returns rows as arrays instead of objects */
  async raw<T = any[]>(sql: string, params: any[] = []): Promise<DatabaseQueryResult<T>> {
    return this.request<T>({ sql, params, raw: true });
  }

  /** Get the current D1 session bookmark (for read-after-write consistency) */
  getBookmark(): string | null {
    return this.bookmark;
  }

  /** Set the D1 session bookmark */
  setBookmark(bookmark: string | null): void {
    this.bookmark = bookmark;
  }

  /**
   * Get a Drizzle ORM compatible proxy function.
   *
   * @example
   * ```typescript
   * import { drizzle } from 'drizzle-orm/sqlite-proxy';
   * import * as schema from './schema';
   *
   * const db = kuratchi.database('my-db');
   * const drizzleDb = drizzle(db.drizzleProxy(), { schema });
   * const users = await drizzleDb.select().from(schema.users);
   * ```
   */
  drizzleProxy() {
    return async (sql: string, params: any[], method: string) => {
      const result = await this.raw(sql, params);
      const rows = result.results ?? [];
      if (method === 'get') {
        return { rows: rows[0] ? [rows[0]] : [] };
      }
      return { rows };
    };
  }
}

