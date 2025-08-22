// Minimal runtime ORM (experimental)
// Goal: remove Drizzle usage by providing a tiny query builder on top of db.query
// Safe for Workers/Vite runtimes; no Node APIs.
import type { DatabaseSchema } from './json-schema.js';

export type Primitive = string | number | boolean | null;
export type WhereValue =
  | Primitive
  | { eq?: Primitive; ne?: Primitive; gt?: Primitive; gte?: Primitive; lt?: Primitive; lte?: Primitive; like?: string; in?: Primitive[]; notIn?: Primitive[]; is?: null };
export type Where = Record<string, WhereValue>;

export type OrderItem = string | { [column: string]: 'asc' | 'desc' };
export type OrderBy = OrderItem | OrderItem[];

export type FindManyOptions = {
  where?: Where;
  select?: string[];
  orderBy?: OrderBy;
  limit?: number;
  offset?: number;
};

export type QueryResult<T = any> = {
  success: boolean;
  data?: T;
  results?: any;
  error?: string;
};

export type SqlExecutor = (sql: string, params?: any[]) => Promise<QueryResult<any>>;

function isObject(v: any): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function compileWhere(where?: Where): { sql: string; params: any[] } {
  if (!where || Object.keys(where).length === 0) return { sql: '', params: [] };
  const clauses: string[] = [];
  const params: any[] = [];

  for (const [col, val] of Object.entries(where)) {
    if (!isObject(val)) {
      clauses.push(`${col} = ?`);
      params.push(val);
      continue;
    }
    const ops: string[] = [];
    if (val.eq !== undefined) { ops.push(`${col} = ?`); params.push(val.eq); }
    if (val.ne !== undefined) { ops.push(`${col} <> ?`); params.push(val.ne); }
    if (val.gt !== undefined) { ops.push(`${col} > ?`); params.push(val.gt); }
    if (val.gte !== undefined) { ops.push(`${col} >= ?`); params.push(val.gte); }
    if (val.lt !== undefined) { ops.push(`${col} < ?`); params.push(val.lt); }
    if (val.lte !== undefined) { ops.push(`${col} <= ?`); params.push(val.lte); }
    if (val.like !== undefined) { ops.push(`${col} LIKE ?`); params.push(val.like); }
    if (val.in && Array.isArray(val.in) && val.in.length) {
      ops.push(`${col} IN (${val.in.map(() => '?').join(', ')})`);
      params.push(...val.in);
    }
    if (val.notIn && Array.isArray(val.notIn) && val.notIn.length) {
      ops.push(`${col} NOT IN (${val.notIn.map(() => '?').join(', ')})`);
      params.push(...val.notIn);
    }
    if (Object.prototype.hasOwnProperty.call(val, 'is')) {
      // Only supports IS NULL explicitly; use eq for booleans/others
      ops.push(`${col} IS ${val.is === null ? 'NULL' : 'NOT NULL'}`);
    }
    if (ops.length === 0) {
      // fallback eq
      ops.push(`${col} = ?`);
      params.push((val as any) as Primitive);
    }
    const part = ops.join(' AND ');
    clauses.push(part);
  }
  const formatted = clauses.length > 1 ? clauses.map((c) => `(${c})`) : clauses;
  return { sql: `WHERE ${formatted.join(' AND ')}`, params };
}

function compileOrderBy(orderBy?: OrderBy): string {
  if (!orderBy) return '';
  const parts: string[] = [];
  const arr = Array.isArray(orderBy) ? orderBy : [orderBy];
  for (const item of arr) {
    if (typeof item === 'string') parts.push(item);
    else {
      for (const [col, dir] of Object.entries(item)) parts.push(`${col} ${String(dir).toUpperCase()}`);
    }
  }
  return parts.length ? `ORDER BY ${parts.join(', ')}` : '';
}

function compileSelect(select?: string[]): string {
  if (!select || !select.length) return '*';
  return select.join(', ');
}

export function createRuntimeOrm(execute: SqlExecutor) {
  function table<Row = any>(tableName: string): TableApi<Row> {
    return {
      async findMany(opts: FindManyOptions = {}): Promise<QueryResult<Row[]>> {
        const sel = compileSelect(opts.select);
        const w = compileWhere(opts.where);
        const order = compileOrderBy(opts.orderBy);
        const limit = typeof opts.limit === 'number' ? `LIMIT ${opts.limit}` : '';
        const offset = typeof opts.offset === 'number' ? `OFFSET ${opts.offset}` : '';
        const head = `SELECT ${sel} FROM ${tableName}`;
        const sql = [head, w.sql, order, limit, offset].filter(Boolean).join(' ');
        const ret = await execute(sql, w.params);
        if (!ret || ret.success === false) return ret as any;
        const rows = (ret as any).data ?? (ret as any).results ?? [];
        return { success: true, data: rows } as QueryResult<Row[]>;
      },
      async findFirst(opts: Omit<FindManyOptions, 'limit'> = {}): Promise<QueryResult<Row | undefined>> {
        const res = await this.findMany({ ...opts, limit: 1 });
        if (!res.success) return res as any;
        const rows = (res as any).data ?? (res as any).results;
        const first = Array.isArray(rows) ? rows[0] : undefined;
        return { success: true, data: first };
      },
      async insert(values: Partial<Row> | Partial<Row>[]): Promise<QueryResult<Row | Row[]>> {
        const rows = Array.isArray(values) ? values : [values];
        if (rows.length === 0) return { success: true };
        const cols = Object.keys(rows[0]);
        const placeholders = `(${cols.map(() => '?').join(', ')})`;
        const allPlaceholders = rows.map(() => placeholders).join(', ');
        const params = rows.flatMap((r) => cols.map((c) => (r as any)[c]));
        const baseSql = `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES ${allPlaceholders}`;
        // Always perform a single INSERT without RETURNING and without follow-up SELECTs
        const ret = await execute(baseSql, params);
        return ret as QueryResult<Row | Row[]>;
      },
      async update(where: Where, values: Record<string, any>): Promise<QueryResult<any>> {
        const setCols = Object.keys(values);
        if (!setCols.length) return { success: true };
        const setSql = setCols.map((c) => `${c} = ?`).join(', ');
        const setParams = setCols.map((c) => values[c]);
        const w = compileWhere(where);
        const sql = `UPDATE ${tableName} SET ${setSql} ${w.sql}`;
        return execute(sql, [...setParams, ...w.params]);
      },
      async delete(where: Where): Promise<QueryResult<any>> {
        const w = compileWhere(where);
        const sql = `DELETE FROM ${tableName} ${w.sql}`;
        return execute(sql, w.params);
      },
      async count(where?: Where): Promise<QueryResult<{ count: number }[]>> {
        const w = compileWhere(where);
        const sql = `SELECT COUNT(*) as count FROM ${tableName} ${w.sql}`;
        const ret = await execute(sql, w.params);
        if (!ret || ret.success === false) return ret as any;
        const rows = (ret as any).data ?? (ret as any).results ?? [];
        return { success: true, data: rows } as QueryResult<{ count: number }[]>;
      },
    };
  }

  return { table, raw: execute };
}

// Convenience wrapper for KuratchiD1.database({}).
// The db object must expose: query(sql, params?) => Promise<QueryResult<any>>
export function createRuntimeOrmFromKuratchiDb(db: { query: (sql: string, params?: any[]) => Promise<QueryResult<any>> }) {
  return createRuntimeOrm((sql, params) => db.query(sql, params));
}

// ---- Property-based clients ----

export interface TableApi<Row = any> {
  findMany(opts?: FindManyOptions): Promise<QueryResult<Row[]>>;
  findFirst(opts?: Omit<FindManyOptions, 'limit'>): Promise<QueryResult<Row | undefined>>;
  insert(values: Partial<Row> | Partial<Row>[]): Promise<QueryResult<Row | Row[]>>;
  update(where: Where, values: Record<string, any>): Promise<QueryResult<any>>;
  delete(where: Where): Promise<QueryResult<any>>;
  count(where?: Where): Promise<QueryResult<{ count: number }[]>>;
}

export function createClientFromMapping<T extends Record<string, string>>(execute: SqlExecutor, mapping: T): { [K in keyof T]: TableApi } {
  const base = createRuntimeOrm(execute);
  const out: Record<string, TableApi> = {};
  for (const [key, tableName] of Object.entries(mapping)) {
    out[key] = base.table(tableName);
  }
  return out as any;
}

export function createClientFromTableNames(execute: SqlExecutor, tables: string[]): Record<string, TableApi> {
  const mapping: Record<string, string> = {};
  for (const name of tables) mapping[name] = name;
  return createClientFromMapping(execute, mapping);
}

export function createClientFromJsonSchema(execute: SqlExecutor, schema: Pick<DatabaseSchema, 'tables'>): Record<string, TableApi> {
  const mapping: Record<string, string> = {};
  for (const t of schema.tables) mapping[t.name] = t.name;
  return createClientFromMapping(execute, mapping);
}

export function createDynamicClient(execute: SqlExecutor): Record<string, TableApi> {
  const base = createRuntimeOrm(execute);
  const cache = new Map<string, TableApi>();
  return new Proxy({}, {
    get(_target, prop: PropertyKey) {
      if (typeof prop !== 'string') return undefined as any;
      if (cache.has(prop)) return cache.get(prop) as any;
      const t = base.table(prop);
      cache.set(prop, t);
      return t as any;
    },
  }) as any;
}

// ---- Typed variants ----
export type TableApiTyped<Row> = TableApi<Row>;

export function createTypedClientFromMapping<RowMap extends Record<string, any>>(
  execute: SqlExecutor,
  mapping: { [K in keyof RowMap]: string }
): { [K in keyof RowMap]: TableApiTyped<RowMap[K]> } {
  const base = createRuntimeOrm(execute);
  const out: any = {};
  for (const key in mapping) {
    const tableName = (mapping as any)[key] as string;
    out[key] = base.table<any>(tableName);
  }
  return out as { [K in keyof RowMap]: TableApiTyped<RowMap[K]> };
}
