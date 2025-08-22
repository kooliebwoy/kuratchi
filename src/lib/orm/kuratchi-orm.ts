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
      if (typeof val === 'string' && (val.includes('%') || val.includes('_'))) {
        clauses.push(`${col} LIKE ?`);
        params.push(val);
      } else {
        clauses.push(`${col} = ?`);
        params.push(val);
      }
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

// Internal: compile an array of OR groups (each group ANDs its keys)
function compileWhereGroups(groups: Where[]): { sql: string; params: any[] } {
  if (!groups || groups.length === 0) return { sql: '', params: [] };
  const parts: string[] = [];
  const params: any[] = [];
  for (const g of groups) {
    const c = compileWhere(g);
    if (!c.sql) continue;
    parts.push(`(${c.sql.replace(/^WHERE\s+/i, '')})`);
    params.push(...c.params);
  }
  if (!parts.length) return { sql: '', params: [] };
  return { sql: `WHERE ${parts.join(' OR ')}`, params };
}

type IncludeSpec = Record<string, boolean | { as?: string; single?: boolean; localKey?: string; foreignKey?: string; table?: string }>;

class QueryBuilder<Row = any> {
  private whereGroups: Where[] = [];
  private order?: OrderBy;
  private limitN?: number;
  private offsetN?: number;
  private includeSpec?: IncludeSpec;

  constructor(private readonly tableName: string, private readonly execute: SqlExecutor) {}

  private currentGroup(): Where {
    if (this.whereGroups.length === 0) this.whereGroups.push({});
    return this.whereGroups[this.whereGroups.length - 1];
  }

  where(filter: Where): this {
    if (this.whereGroups.length === 0) this.whereGroups.push({});
    Object.assign(this.whereGroups[this.whereGroups.length - 1], filter || {});
    return this;
  }

  orWhere(filter: Where): this {
    this.whereGroups.push({ ...filter });
    return this;
  }

  orderBy(order: OrderBy | string): this {
    this.order = typeof order === 'string' ? order : order;
    return this;
    }

  limit(n: number): this {
    this.limitN = n;
    return this;
  }

  offset(n: number): this {
    this.offsetN = n;
    return this;
  }

  include(spec: IncludeSpec): this {
    this.includeSpec = spec;
    return this;
  }

  async findMany(): Promise<QueryResult<Row[]>> {
    const sel = '*';
    const w = compileWhereGroups(this.whereGroups);
    const order = compileOrderBy(this.order);
    const limit = typeof this.limitN === 'number' ? `LIMIT ${this.limitN}` : '';
    const computedOffset = typeof this.offsetN === 'number'
      ? (typeof this.limitN === 'number' ? Math.max(0, (this.offsetN - 1) * this.limitN) : this.offsetN)
      : undefined;
    const offset = typeof computedOffset === 'number' ? `OFFSET ${computedOffset}` : '';
    const head = `SELECT ${sel} FROM ${this.tableName}`;
    const sql = [head, w.sql, order, limit, offset].filter(Boolean).join(' ');
    const ret = await this.execute(sql, w.params);
    if (!ret || ret.success === false) return ret as any;
    let rows = ((ret as any).data ?? (ret as any).results ?? []) as Row[];

    if (this.includeSpec && rows.length) {
      rows = await this.applyIncludes(rows, this.includeSpec);
    }

    return { success: true, data: rows } as QueryResult<Row[]>;
  }

  async findFirst(): Promise<QueryResult<Row | undefined>> {
    this.limitN = 1;
    const res = await this.findMany();
    if (!res.success) return res as any;
    const rows = (res as any).data ?? (res as any).results;
    const first = Array.isArray(rows) ? rows[0] : undefined;
    return { success: true, data: first };
  }

  private singularize(name: string): string {
    return name.endsWith('s') ? name.slice(0, -1) : name;
  }

  private async applyIncludes(rows: any[], spec: IncludeSpec): Promise<any[]> {
    const out = [...rows];
    for (const [key, rawCfg] of Object.entries(spec)) {
      const cfg = typeof rawCfg === 'boolean' ? {} : (rawCfg || {});
      const includeTable = cfg.table ?? key;
      const as = cfg.as ?? key;

      // Detect parent include via <key>Id on the main row
      const candidateFkCols = [
        `${this.singularize(includeTable)}Id`,
        `${includeTable}Id`,
      ];
      const sample = out[0] || {};
      const parentFkCol = candidateFkCols.find((c) => c in sample);

      if (parentFkCol) {
        // Parent (many-to-one): SELECT * FROM includeTable WHERE id IN (...)
        const ids = Array.from(new Set(out.map((r) => r[parentFkCol]).filter(Boolean)));
        if (ids.length) {
          const placeholders = ids.map(() => '?').join(', ');
          const sql = `SELECT * FROM ${includeTable} WHERE id IN (${placeholders})`;
          const ret = await this.execute(sql, ids);
          if (ret && ret.success !== false) {
            const rows2 = ((ret as any).data ?? (ret as any).results ?? []) as any[];
            const map = new Map(rows2.map((r) => [r.id, r]));
            for (const r of out) (r as any)[as] = map.get(r[parentFkCol]);
          }
        }
        continue;
      }

      // Child (one-to-many): assume foreign table has <singular(main)>Id
      const localKey = cfg.localKey ?? 'id';
      const foreignKey = cfg.foreignKey ?? `${this.singularize(this.tableName)}Id`;
      const ids = Array.from(new Set(out.map((r) => r[localKey]).filter(Boolean)));
      if (!ids.length) continue;
      const placeholders = ids.map(() => '?').join(', ');
      const sql = `SELECT * FROM ${includeTable} WHERE ${foreignKey} IN (${placeholders})`;
      const ret = await this.execute(sql, ids);
      if (ret && ret.success !== false) {
        const rows2 = ((ret as any).data ?? (ret as any).results ?? []) as any[];
        const groups = new Map<any, any[]>();
        for (const r of rows2) {
          const k = (r as any)[foreignKey];
          if (!groups.has(k)) groups.set(k, []);
          groups.get(k)!.push(r);
        }
        for (const r of out) (r as any)[as] = groups.get((r as any)[localKey]) ?? [];
      }
    }
    return out;
  }
}

export function createRuntimeOrm(execute: SqlExecutor) {
  function table<Row = any>(tableName: string): TableApi<Row> {
    const builderFactory = () => new QueryBuilder<Row>(tableName, execute);
    return {
      // New simple API: findMany/findFirst accept simple filters too
      async findMany(optsOrFilter: any = {}): Promise<QueryResult<Row[]>> {
        // Detect simple filter (no select/order/limit keys)
        const isSimple = !('where' in (optsOrFilter || {})) && !('select' in (optsOrFilter || {})) && !('orderBy' in (optsOrFilter || {})) && !('limit' in (optsOrFilter || {})) && !('offset' in (optsOrFilter || {}));
        if (isSimple) {
          return builderFactory().where(optsOrFilter as Where).findMany();
        }
        const opts = optsOrFilter as FindManyOptions;
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
      async findFirst(optsOrFilter: any = {}): Promise<QueryResult<Row | undefined>> {
        const isSimple = !('where' in (optsOrFilter || {})) && !('select' in (optsOrFilter || {})) && !('orderBy' in (optsOrFilter || {})) && !('limit' in (optsOrFilter || {})) && !('offset' in (optsOrFilter || {}));
        if (isSimple) {
          return builderFactory().where(optsOrFilter as Where).findFirst();
        }
        const res = await (this as any).findMany({ ...(optsOrFilter as FindManyOptions), limit: 1 });
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
      where(filter: Where) { return builderFactory().where(filter); },
      orWhere(filter: Where) { return builderFactory().orWhere(filter); },
      orderBy(order: OrderBy | string) { return builderFactory().orderBy(order); },
      limit(n: number) { return builderFactory().limit(n); },
      offset(n: number) { return builderFactory().offset(n); },
      include(spec: IncludeSpec) { return builderFactory().include(spec); },
    } as TableApi<Row> as any;
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
  // New chainable builder
  where(filter: Where): TableQuery<Row>;
  orWhere(filter: Where): TableQuery<Row>;
  orderBy(order: OrderBy | string): TableQuery<Row>;
  limit(n: number): TableQuery<Row>;
  offset(n: number): TableQuery<Row>;
  include(spec: IncludeSpec): TableQuery<Row>;
}

export interface TableQuery<Row = any> {
  where(filter: Where): TableQuery<Row>;
  orWhere(filter: Where): TableQuery<Row>;
  orderBy(order: OrderBy | string): TableQuery<Row>;
  limit(n: number): TableQuery<Row>;
  offset(n: number): TableQuery<Row>;
  include(spec: IncludeSpec): TableQuery<Row>;
  findMany(): Promise<QueryResult<Row[]>>;
  findFirst(): Promise<QueryResult<Row | undefined>>;
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

/**
 * @deprecated Dynamic clients are discouraged and no longer exposed by `KuratchiD1`.
 * Prefer explicit schema clients via `KuratchiD1.client(cfg, { schema })` or `KuratchiD1.database(cfg).client({ schema })`.
 * This helper remains for internal/testing scenarios only.
 */
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
