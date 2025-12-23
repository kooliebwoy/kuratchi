// Minimal runtime ORM (experimental)
// Goal: remove Drizzle usage by providing a tiny query builder on top of db.query
// Safe for Workers/Vite runtimes; no Node APIs.
import type { DatabaseSchema } from '../database/migrations/schema.js';

export type Primitive = string | number | boolean | null;
export type WhereValue =
  | Primitive
  | { eq?: Primitive; ne?: Primitive; gt?: Primitive; gte?: Primitive; lt?: Primitive; lte?: Primitive; like?: string; in?: Primitive[]; notIn?: Primitive[]; is?: null; isNull?: boolean; isNullish?: boolean };
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
  results?: T;
  error?: string;
  meta?: {
    rowsRead?: number;
    rowsWritten?: number;
    duration?: number;
  };
};

export type SqlExecutor = (sql: string, params?: any[]) => Promise<QueryResult<any>>;

/**
 * Full database client interface for optimized operations
 * When provided, the ORM can use native APIs like first(), batch(), etc.
 */
export interface FullDbClient {
  /** Standard query - returns all rows */
  query?: (sql: string, params?: any[]) => Promise<QueryResult<any>>;
  /** Get first row only - more efficient than query + limit 1 */
  first?: (sql: string, params?: any[], column?: string) => Promise<QueryResult<any>>;
  /** Execute DDL/migrations - no results returned */
  exec?: (sql: string) => Promise<QueryResult<any>>;
  /** Batch multiple queries in a transaction */
  batch?: (queries: Array<{ query: string; params?: any[] }>) => Promise<QueryResult<any>>;
  /** Raw array results */
  raw?: (sql: string, params?: any[]) => Promise<QueryResult<any>>;
  /** Run INSERT/UPDATE/DELETE - returns metadata only */
  run?: (sql: string, params?: any[]) => Promise<QueryResult<any>>;
}

export type SqlCondition = { query: string; params?: any[] };

export interface OrmKvClient {
  get(opts: any): Promise<any>;
  put(opts: any): Promise<any>;
  delete(opts: any): Promise<any>;
  list(opts?: any): Promise<any>;
}

function isObject(v: any): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function isTemplateStringsArray(x: any): x is TemplateStringsArray {
  return Array.isArray(x) && x !== null && typeof (x as any).raw !== 'undefined';
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
    if (Object.prototype.hasOwnProperty.call(val, 'isNull')) {
      // isNull: true/false for NULL checking
      ops.push(`${col} IS ${val.isNull ? 'NULL' : 'NOT NULL'}`);
    }
    if (Object.prototype.hasOwnProperty.call(val, 'isNullish')) {
      // isNullish: true/false handles both NULL and undefined (undefined becomes NULL in SQLite)
      ops.push(`${col} IS ${val.isNullish ? 'NULL' : 'NOT NULL'}`);
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
  // If only one group, return its compiled WHERE directly (avoids extra wrapping parens)
  if (groups.length === 1) return compileWhere(groups[0]);
  const parts: string[] = [];
  const params: any[] = [];
  for (const g of groups) {
    const c = compileWhere(g);
    if (!c.sql) continue;
    // Wrap each group in parentheses when OR-ing multiple groups
    const inner = c.sql.replace(/^WHERE\s+/i, '');
    parts.push(`(${inner})`);
    params.push(...c.params);
  }
  if (!parts.length) return { sql: '', params: [] };
  return { sql: `WHERE ${parts.join(' OR ')}`, params };
}

// Compile groups with additional raw fragments per group. Each group is OR'ed together; within a group, parts are AND'ed.
function compileWhereGroupsWithRaw(
  groups: Where[],
  rawGroups: { sql: string; params: any[] }[][]
): { sql: string; params: any[] } {
  const G = groups || [];
  const RG = rawGroups || [];
  const groupCount = Math.max(G.length, RG.length);
  if (groupCount === 0) return { sql: '', params: [] };

  const groupSqls: string[] = [];
  const allParams: any[] = [];

  for (let i = 0; i < groupCount; i++) {
    const base = compileWhere(G[i] || {});
    const raws = (RG[i] || []).filter((r) => r && r.sql && r.sql.trim().length);

    const parts: string[] = [];
    const params: any[] = [];

    if (base.sql) {
      const inner = base.sql.replace(/^WHERE\s+/i, '');
      parts.push(inner);
      params.push(...base.params);
    }
    for (const r of raws) {
      parts.push(r.sql);
      if (r.params && r.params.length) params.push(...r.params);
    }

    if (parts.length === 0) continue;
    const combined = parts.length > 1 ? `(${parts.join(' AND ')})` : parts[0];
    groupSqls.push(combined);
    allParams.push(...params);
  }

  if (groupSqls.length === 0) return { sql: '', params: [] };
  if (groupSqls.length === 1) return { sql: `WHERE ${groupSqls[0]}`, params: allParams };
  return { sql: `WHERE ${groupSqls.map((s) => `(${s})`).join(' OR ')}`, params: allParams };
}

type IncludeSpec = Record<string, boolean | { as?: string; single?: boolean; localKey?: string; foreignKey?: string; table?: string }>;

class QueryBuilder<Row = any> {
  private whereGroups: Where[] = [];
  private rawWhereGroups: { sql: string; params: any[] }[][] = [];
  private order?: OrderBy;
  private limitN?: number;
  private offsetN?: number;
  private includeSpec?: IncludeSpec;
  private selectCols?: string[];
  private pendingUpdateValues?: Record<string, any>;

  constructor(
    private readonly tableName: string, 
    private readonly execute: SqlExecutor,
    private readonly fullClient?: FullDbClient
  ) {}

  private currentGroup(): Where {
    if (this.whereGroups.length === 0) {
      this.whereGroups.push({});
      this.rawWhereGroups.push([]);
    }
    return this.whereGroups[this.whereGroups.length - 1];
  }

  where(filter: Where): this {
    if (this.whereGroups.length === 0) {
      this.whereGroups.push({});
      this.rawWhereGroups.push([]);
    }
    Object.assign(this.whereGroups[this.whereGroups.length - 1], filter || {});
    return this;
  }

  // Adds an IN (...) clause for a specific column on the current where group
  whereIn(column: string, values: any[]): this {
    if (!Array.isArray(values) || values.length === 0) return this; // no-op
    const placeholders = values.map(() => '?').join(', ');
    return this.sql({ query: `${column} IN (${placeholders})`, params: values });
  }

  orWhere(filter: Where): this {
    this.whereGroups.push({ ...filter });
    this.rawWhereGroups.push([]);
    return this;
  }

  /**
   * Add a parenthetical OR group to the current WHERE clause.
   * All conditions in the array are OR'd together and wrapped in parentheses.
   * Example: .where({ status: 'active' }).whereAny([{ role: 'admin' }, { role: 'owner' }])
   * Generates: WHERE status = 'active' AND (role = 'admin' OR role = 'owner')
   */
  whereAny(conditions: Where[]): this {
    if (!conditions || conditions.length === 0) return this;
    
    // Compile each condition to SQL
    const orParts: string[] = [];
    const allParams: any[] = [];
    
    for (const condition of conditions) {
      const compiled = compileWhere(condition);
      if (compiled.sql) {
        // Remove the 'WHERE ' prefix from each part
        const sqlPart = compiled.sql.replace(/^WHERE\s+/i, '');
        orParts.push(sqlPart);
        allParams.push(...compiled.params);
      }
    }
    
    if (orParts.length > 0) {
      // Join with OR and wrap in parentheses
      const orClause = orParts.length > 1 
        ? `(${orParts.join(' OR ')})` 
        : orParts[0];
      
      return this.sql({ query: orClause, params: allParams });
    }
    
    return this;
  }

  sql(condition: SqlCondition): this {
    if (this.whereGroups.length === 0) {
      this.whereGroups.push({});
      this.rawWhereGroups.push([]);
    }
    const idx = this.whereGroups.length - 1;
    const query = String(condition?.query ?? '').trim();
    const params = Array.isArray(condition?.params) ? condition!.params! : [];

    // Guards
    if (query.includes('${') || /\$\{.*\}/.test(query)) {
      throw new Error('Potential SQL injection detected. Use ? placeholders and params array.');
    }
    if (/["'`]\s*\+|concat\s*\(/i.test(query)) {
      throw new Error('String concatenation detected in SQL. Use ? placeholders instead.');
    }
    if (params.length === 0) {
      if (/\b\d{10,}\b/.test(query)) {
        console.warn('⚠️  Hardcoded numeric values detected. Consider using ? and params.');
      }
      if ((/['"][^'\"]*['\"]/).test(query) && !(/^[^'\"]*['\"][a-zA-Z_][a-zA-Z0-9_]*['\"][^'\"]*$/.test(query))) {
        console.warn('⚠️  Hardcoded string values detected. Consider using ? and params.');
      }
    }
    if (/;\s*(drop|delete|insert|update|create)\s+/i.test(query)) {
      throw new Error('Potentially dangerous SQL detected. Multiple statements not allowed.');
    }

    if (!query) return this;
    this.rawWhereGroups[idx].push({ sql: query, params });
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

  select(cols: string[]): this {
    this.selectCols = cols;
    return this;
  }

  /**
   * Get distinct values for a column
   */
  async distinct(column: string): Promise<QueryResult<any[]>> {
    const w = compileWhereGroupsWithRaw(this.whereGroups, this.rawWhereGroups);
    const sql = `SELECT DISTINCT ${column} FROM ${this.tableName} ${w.sql}`.trim();
    const ret = await this.execute(sql, w.params);
    if (!ret || ret.success === false) return ret as any;
    const rows = ((ret as any).data ?? (ret as any).results ?? []) as any[];
    return { success: true, data: rows.map(r => r[column]) };
  }

  /**
   * Count matching rows (chainable version)
   */
  async count(): Promise<QueryResult<number>> {
    const w = compileWhereGroupsWithRaw(this.whereGroups, this.rawWhereGroups);
    const sql = `SELECT COUNT(*) as count FROM ${this.tableName} ${w.sql}`.trim();
    const ret = await this.execute(sql, w.params);
    if (!ret || ret.success === false) return ret as any;
    const rows = ((ret as any).data ?? (ret as any).results ?? []) as any[];
    const count = rows[0]?.count ?? 0;
    return { success: true, data: count };
  }

  async updateMany(values: Record<string, any>): Promise<QueryResult<any>> {
    const setCols = Object.keys(values || {});
    if (!setCols.length) return { success: true };
    const setSql = setCols.map((c) => `${c} = ?`).join(', ');
    const setParams = setCols.map((c) => values[c]);
    const w = compileWhereGroupsWithRaw(this.whereGroups, this.rawWhereGroups);
    const sql = `UPDATE ${this.tableName} SET ${setSql} ${w.sql}`.trim();
    return this.execute(sql, [...setParams, ...w.params]);
  }

  async update(values?: Record<string, any>): Promise<QueryResult<any>> {
    // If values provided, execute update immediately
    // If no values, use pending values from .update(values).where() chain
    const updateValues = values || this.pendingUpdateValues;
    if (!updateValues || Object.keys(updateValues).length === 0) {
      return { success: false, error: 'No update values provided' } as any;
    }
    
    // Single-row update: resolve first row, then update by id when present; otherwise fallback to current filter
    const one = await this.first();
    if (!one || (one as any).success === false) return one as any;
    const row = (one as any).data as any | undefined;
    if (!row) return { success: false, error: 'Not found' } as any;
    const id = (row as any)?.id;
    if (typeof id === 'undefined') {
      return this.updateMany(updateValues);
    }
    const setCols = Object.keys(updateValues);
    if (!setCols.length) return { success: true } as any;
    const setSql = setCols.map((c) => `${c} = ?`).join(', ');
    const setParams = setCols.map((c) => (updateValues as any)[c]);
    const sql = `UPDATE ${this.tableName} SET ${setSql} WHERE id = ?`;
    return this.execute(sql, [...setParams, id]);
  }

  /**
   * Set pending update values for deferred execution.
   * Allows chaining: .update(values).where({...}) or .where({...}).update(values)
   */
  setPendingUpdate(values: Record<string, any>): this {
    this.pendingUpdateValues = values;
    return this;
  }

  /**
   * Delete rows matching the accumulated where clauses.
   * Allows chaining: .where({...}).delete() or .delete().where({...})
   */
  async delete(): Promise<QueryResult<any>> {
    const w = compileWhereGroupsWithRaw(this.whereGroups, this.rawWhereGroups);
    if (!w.sql) {
      return { success: false, error: 'Delete requires a where clause for safety' } as any;
    }
    const sql = `DELETE FROM ${this.tableName} ${w.sql}`;
    return this.execute(sql, w.params);
  }

  async exists(): Promise<boolean> {
    const w = compileWhereGroupsWithRaw(this.whereGroups, this.rawWhereGroups);
    // Use EXISTS subquery for better performance on large tables
    const sql = `SELECT EXISTS(SELECT 1 FROM ${this.tableName} ${w.sql} LIMIT 1) as e`;
    const ret = await this.execute(sql, w.params);
    if (!ret || ret.success === false) return false;
    const rows = (ret as any).data ?? (ret as any).results ?? [];
    return Array.isArray(rows) && rows.length > 0 && (rows[0]?.e === 1 || rows[0]?.e === true);
  }

  async many(): Promise<QueryResult<Row[]>> {
    const sel = compileSelect(this.selectCols);
    const w = compileWhereGroupsWithRaw(this.whereGroups, this.rawWhereGroups);
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

  async first(): Promise<QueryResult<Row | undefined>> {
    // Use native first() if available and no custom limit set
    if (this.fullClient?.first && typeof this.limitN !== 'number') {
      const sel = compileSelect(this.selectCols);
      const w = compileWhereGroupsWithRaw(this.whereGroups, this.rawWhereGroups);
      const order = compileOrderBy(this.order);
      const sql = [`SELECT ${sel} FROM ${this.tableName}`, w.sql, order, 'LIMIT 1'].filter(Boolean).join(' ');
      
      const res = await this.fullClient.first(sql, w.params);
      if (!res || res.success === false) return res as any;
      // Native first() returns single row in results (not array), or in data
      const row = (res as any).data ?? (res as any).results;
      return { success: true, data: row };
    }
    
    // Fallback: use many() with limit 1
    if (typeof this.limitN !== 'number') {
      this.limitN = 1;
    }
    const res = await this.many();
    if (!res.success) return res as any;
    const rows = (res as any).data ?? (res as any).results;
    const first = Array.isArray(rows) ? rows[0] : undefined;
    return { success: true, data: first };
  }

  async one(): Promise<QueryResult<Row>> {
    this.limitN = 2; // fetch up to 2 to detect non-uniqueness cheaply
    const res = await this.many();
    if (!res.success) return res as any;
    const rows = ((res as any).data ?? (res as any).results ?? []) as Row[];
    if (rows.length !== 1) {
      return { success: false, error: rows.length === 0 ? 'Not found' : 'Expected exactly one row' } as any;
    }
    return { success: true, data: rows[0] } as any;
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

export function createRuntimeOrm(
  execute: SqlExecutor, 
  schema?: Pick<DatabaseSchema, 'tables'>,
  fullClient?: FullDbClient
) {
  // Build column map for schema validation
  const schemaColumnsByTable = new Map<string, Set<string>>();
  if (schema?.tables) {
    for (const table of schema.tables) {
      const columns = new Set(table.columns.map(col => col.name));
      schemaColumnsByTable.set(table.name, columns);
    }
  }

  function table<Row = any>(tableName: string): TableApi<Row> {
    const builderFactory = () => new QueryBuilder<Row>(tableName, execute, fullClient);
    return {
      async many(): Promise<QueryResult<Row[]>> {
        return builderFactory().many();
      },
      async first(): Promise<QueryResult<Row | undefined>> {
        return builderFactory().first();
      },
      async one(): Promise<QueryResult<Row>> {
        return builderFactory().one();
      },
      async exists(): Promise<boolean> {
        return builderFactory().exists();
      },
      async insert(values: Partial<Row> | Partial<Row>[]): Promise<QueryResult<Row | Row[]>> {
        const rows = Array.isArray(values) ? values : [values];
        if (rows.length === 0) return { success: true };
        
        // Schema validation: filter out invalid columns
        const validColumns = schemaColumnsByTable.get(tableName);
        let validatedRows: Partial<Row>[] = rows;
        
        if (validColumns) {
          const skippedFields = new Set<string>();
          validatedRows = rows.map(row => {
            const validatedRow: Partial<Row> = {};
            for (const [key, value] of Object.entries(row)) {
              if (validColumns.has(key)) {
                (validatedRow as any)[key] = value;
              } else {
                skippedFields.add(key);
              }
            }
            return validatedRow;
          });
          
          if (skippedFields.size > 0) {
            console.warn(
              `[Kuratchi ORM] Skipping fields not in schema for table '${tableName}': ${Array.from(skippedFields).join(', ')}`
            );
          }
        }
        
        const cols = Object.keys(validatedRows[0]);
        if (cols.length === 0) {
          return { success: false, error: 'No valid columns to insert' };
        }
        
        const placeholders = `(${cols.map(() => '?').join(', ')})`;
        const allPlaceholders = validatedRows.map(() => placeholders).join(', ');
        const params = validatedRows.flatMap((r) => cols.map((c) => (r as any)[c]));
        const baseSql = `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES ${allPlaceholders}`;
        
        const ret = await execute(baseSql, params);
        return ret as QueryResult<Row | Row[]>;
      },
      /**
       * Delete with where object (original API)
       */
      async delete(where?: Where): Promise<QueryResult<any>> {
        if (where) {
          const w = compileWhere(where);
          const sql = `DELETE FROM ${tableName} ${w.sql}`;
          return execute(sql, w.params);
        }
        // No where = return builder for chaining
        return { success: false, error: 'Delete requires a where clause. Use .where({...}).delete() or .delete({...})' } as any;
      },
      /**
       * Start an update chain: .update(values).where({...})
       * Returns a builder that will execute when .where() is followed by terminal or when update() is called
       */
      update(values: Record<string, any>) {
        return builderFactory().setPendingUpdate(values);
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
      whereIn(column: string, values: any[]) { return builderFactory().whereIn(column, values); },
      orWhere(filter: Where) { return builderFactory().orWhere(filter); },
      whereAny(conditions: Where[]) { return builderFactory().whereAny(conditions); },
      orderBy(order: OrderBy | string) { return builderFactory().orderBy(order); },
      limit(n: number) { return builderFactory().limit(n); },
      offset(n: number) { return builderFactory().offset(n); },
      include(spec: IncludeSpec) { return builderFactory().include(spec); },
      select(cols: string[]) { return builderFactory().select(cols); },
      sql(condition: SqlCondition) { return builderFactory().sql(condition); },
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
  many(): Promise<QueryResult<Row[]>>;
  first(): Promise<QueryResult<Row | undefined>>;
  one(): Promise<QueryResult<Row>>;
  exists(): Promise<boolean>;
  insert(values: Partial<Row> | Partial<Row>[]): Promise<QueryResult<Row | Row[]>>;
  delete(where?: Where): Promise<QueryResult<any>>;
  count(where?: Where): Promise<QueryResult<{ count: number }[]>>;
  // Chainable update: .update(values).where({...})
  update(values: Record<string, any>): TableQuery<Row>;
  // Chainable builder methods
  where(filter: Where): TableQuery<Row>;
  whereIn(column: string, values: any[]): TableQuery<Row>;
  orWhere(filter: Where): TableQuery<Row>;
  whereAny(conditions: Where[]): TableQuery<Row>;
  orderBy(order: OrderBy | string): TableQuery<Row>;
  limit(n: number): TableQuery<Row>;
  offset(n: number): TableQuery<Row>;
  include(spec: IncludeSpec): TableQuery<Row>;
  select(cols: string[]): TableQuery<Row>;
  sql(condition: SqlCondition): TableQuery<Row>;
}

export interface TableQuery<Row = any> {
  where(filter: Where): TableQuery<Row>;
  whereIn(column: string, values: any[]): TableQuery<Row>;
  whereAny(conditions: Where[]): TableQuery<Row>;
  orWhere(filter: Where): TableQuery<Row>;
  orderBy(order: OrderBy | string): TableQuery<Row>;
  limit(n: number): TableQuery<Row>;
  offset(n: number): TableQuery<Row>;
  include(spec: IncludeSpec): TableQuery<Row>;
  select(cols: string[]): TableQuery<Row>;
  sql(condition: SqlCondition): TableQuery<Row>;
  many(): Promise<QueryResult<Row[]>>;
  first(): Promise<QueryResult<Row | undefined>>;
  one(): Promise<QueryResult<Row>>;
  exists(): Promise<boolean>;
  count(): Promise<QueryResult<number>>;
  distinct(column: string): Promise<QueryResult<any[]>>;
  updateMany(values: Record<string, any>): Promise<QueryResult<any>>;
  // Single-row update: updates the first matched row by primary key 'id';
  // if no 'id' present, falls back to updateMany (may affect multiple rows)
  // Can be called with values or use pending values from .update(values).where() chain
  update(values?: Record<string, any>): Promise<QueryResult<any>>;
  // Chainable delete: .where({...}).delete() executes delete with accumulated where clauses
  delete(): Promise<QueryResult<any>>;
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

export function createClientFromJsonSchema(
  execute: SqlExecutor,
  schema: Pick<DatabaseSchema, 'tables'>,
  opts?: { kv?: OrmKvClient; client?: FullDbClient }
): Record<string, TableApi> & { kv?: OrmKvClient } {
  // Full client for optimized native API calls
  const fullClient = opts?.client;
  // Build per-table JSON column sets
  const jsonColsByTable = new Map<string, Set<string>>();
  for (const t of schema.tables) {
    const s = new Set<string>();
    for (const col of t.columns) {
      if ((col as any).type === 'json') {
        s.add(col.name);
      }
    }
    if (s.size > 0) {
      jsonColsByTable.set(t.name, s);
    }
  }

  // Pass fullClient to createRuntimeOrm for native API optimizations
  const base = createRuntimeOrm(execute, schema, fullClient);

  const serializeForTable = (table: string, values: Record<string, any>): Record<string, any> => {
    const jsonCols = jsonColsByTable.get(table) || new Set<string>();
    if (!values || !jsonCols.size) return values;
    const out: Record<string, any> = { ...values };
    for (const col of jsonCols) {
      if (!(col in out)) continue;
      const v = out[col];
      if (v === undefined || v === null) continue;
      // If already a string, assume caller serialized. Otherwise JSON.stringify.
      out[col] = typeof v === 'string' ? v : JSON.stringify(v);
    }
    return out;
  };

  const deserializeRowsForTable = <R = any>(table: string, rows: R[]): R[] => {
    const jsonCols = jsonColsByTable.get(table) || new Set<string>();
    if (!Array.isArray(rows) || !rows.length || !jsonCols.size) return rows;
    return rows.map((row: any) => {
      const copy: any = { ...row };
      for (const col of jsonCols) {
        const v = copy[col];
        if (v === undefined || v === null) continue;
        if (typeof v === 'string') {
          try { 
            copy[col] = JSON.parse(v);
          } catch { 
            /* leave as string if not valid JSON */
          }
        }
      }
      return copy as R;
    });
  };

  const wrapTable = <Row = any>(tableName: string): TableApi<Row> => {
    const raw = base.table<Row>(tableName);

    const wrapQuery = (q: TableQuery<Row>): TableQuery<Row> => {
      return {
        where: (f) => wrapQuery(q.where(f)),
        whereIn: (c, v) => wrapQuery(q.whereIn(c, v)),
        whereAny: (conditions) => wrapQuery(q.whereAny(conditions)),
        orWhere: (f) => wrapQuery(q.orWhere(f)),
        orderBy: (o) => wrapQuery(q.orderBy(o)),
        limit: (n) => wrapQuery(q.limit(n)),
        offset: (n) => wrapQuery(q.offset(n)),
        include: (s) => wrapQuery(q.include(s)),
        select: (cols) => wrapQuery(q.select(cols)),
        sql: (cond) => wrapQuery(q.sql(cond)),
        async update(values?: Record<string, any>) {
          // If values provided, serialize and execute
          // If no values, delegate to underlying query (uses pending values)
          if (values) {
            const one = await q.first();
            if (!one || one.success === false) return one as any;
            const row = (one as any).data as any | undefined;
            if (!row) return { success: false, error: 'Not found' } as any;
            const id = row?.id;
            const v2 = serializeForTable(tableName, values);
            if (typeof id === 'undefined') {
              return q.updateMany(v2);
            }
            // Perform targeted update by id using an ad-hoc statement
            const setCols = Object.keys(v2);
            if (!setCols.length) return { success: true } as any;
            const setSql = setCols.map((c) => `${c} = ?`).join(', ');
            const setParams = setCols.map((c) => (v2 as any)[c]);
            const sql = `UPDATE ${tableName} SET ${setSql} WHERE id = ?`;
            return execute(sql, [...setParams, id]);
          }
          // No values - use pending values from .update(values).where() chain
          return q.update();
        },
        async many() {
          const res = await q.many();
          if (!res || res.success === false) return res as any;
          const data = ((res as any).data ?? (res as any).results ?? []) as Row[];
          const parsed = deserializeRowsForTable<Row>(tableName, data);
          return { success: true, data: parsed } as QueryResult<Row[]>;
        },
        async first() {
          const res = await q.first();
          if (!res || res.success === false) return res as any;
          const row = (res as any).data as Row | undefined;
          const parsed = row ? deserializeRowsForTable<Row>(tableName, [row])[0] : undefined;
          return { success: true, data: parsed } as QueryResult<Row | undefined>;
        },
        async one() {
          const res = await q.one();
          if (!res || res.success === false) return res as any;
          const row = (res as any).data as Row;
          const parsed = deserializeRowsForTable<Row>(tableName, [row])[0];
          return { success: true, data: parsed } as QueryResult<Row>;
        },
        async exists() {
          return q.exists();
        },
        async count() {
          return q.count();
        },
        async distinct(column: string) {
          return q.distinct(column);
        },
        async updateMany(values: Record<string, any>) {
          const v2 = serializeForTable(tableName, values || {});
          return q.updateMany(v2);
        },
        async delete() {
          return q.delete();
        }
      } as TableQuery<Row>;
    };

    return {
      async many() {
        const res = await raw.many();
        if (!res || res.success === false) return res as any;
        const data = ((res as any).data ?? (res as any).results ?? []) as Row[];
        const parsed = deserializeRowsForTable<Row>(tableName, data);
        return { success: true, data: parsed } as QueryResult<Row[]>;
      },
      async first() {
        const res = await raw.first();
        if (!res || res.success === false) return res as any;
        const row = (res as any).data as Row | undefined;
        const parsed = row ? deserializeRowsForTable<Row>(tableName, [row])[0] : undefined;
        return { success: true, data: parsed } as QueryResult<Row | undefined>;
      },
      async one() {
        const res = await raw.one();
        if (!res || res.success === false) return res as any;
        const row = (res as any).data as Row;
        const parsed = deserializeRowsForTable<Row>(tableName, [row])[0];
        return { success: true, data: parsed } as QueryResult<Row>;
      },
      async exists() { return raw.exists(); },
      async insert(values: Partial<Row> | Partial<Row>[]) {
        const arr = Array.isArray(values) ? values : [values];
        const transformed = arr.map((v) => serializeForTable(tableName, v as any));
        const payload = Array.isArray(values) ? transformed : transformed[0];
        return raw.insert(payload as any);
      },
      // Chainable update: .update(values).where({...})
      update(values: Record<string, any>) {
        const v2 = serializeForTable(tableName, values || {});
        return wrapQuery(raw.update(v2));
      },
      async delete(where?: Where) { return raw.delete(where); },
      async count(where?: Where) { return raw.count(where); },
      where(filter: Where) { return wrapQuery(raw.where(filter)); },
      whereIn(column: string, values: any[]) { return wrapQuery(raw.whereIn(column, values)); },
      orWhere(filter: Where) { return wrapQuery(raw.orWhere(filter)); },
      whereAny(conditions: Where[]) { return wrapQuery(raw.whereAny(conditions)); },
      orderBy(order: OrderBy | string) { return wrapQuery(raw.orderBy(order)); },
      limit(n: number) { return wrapQuery(raw.limit(n)); },
      offset(n: number) { return wrapQuery(raw.offset(n)); },
      include(spec: IncludeSpec) { return wrapQuery(raw.include(spec)); },
      select(cols: string[]) { return wrapQuery(raw.select(cols)); },
      sql(condition: SqlCondition) { return wrapQuery(raw.sql(condition)); },
    } as TableApi<Row> as any;
  };

  const out: Record<string, TableApi> & { kv?: OrmKvClient } = {} as any;
  for (const t of schema.tables) {
    out[t.name] = wrapTable(t.name);
  }
  if (opts?.kv) {
    Object.defineProperty(out, 'kv', {
      value: opts.kv,
      enumerable: false,
      configurable: false,
      writable: false,
    });
  }
  return out;
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
