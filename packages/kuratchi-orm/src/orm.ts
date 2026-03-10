/**
 * Core ORM â€” query builder + table API + factory
 *
 * Zero dependencies. Worker-safe. No Node APIs.
 */

import type {
  Primitive, Where, OrderBy, SqlExecutor, SqlCondition,
  FullDbClient, IncludeSpec, QueryResult, TableApi, TableQuery,
  OrmAdapterConfig,
} from './types.js';
import { ensureNormalizedSchema } from './schema.js';
import { buildInitialSql } from './migrations/generator.js';
import type { Column, DatabaseSchema } from './schema.js';

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function isObject(v: any): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function compileWhere(where?: Where): { sql: string; params: any[] } {
  if (!where || Object.keys(where).length === 0) return { sql: '', params: [] };
  const clauses: string[] = [];
  const params: any[] = [];

  for (const [col, val] of Object.entries(where)) {
    if (!isObject(val)) {
      if (typeof val === 'string' && val.includes('%')) {
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
      ops.push(`${col} IS ${val.is === null ? 'NULL' : 'NOT NULL'}`);
    }
    if (Object.prototype.hasOwnProperty.call(val, 'isNull')) {
      ops.push(`${col} IS ${val.isNull ? 'NULL' : 'NOT NULL'}`);
    }
    if (Object.prototype.hasOwnProperty.call(val, 'isNullish')) {
      ops.push(`${col} IS ${val.isNullish ? 'NULL' : 'NOT NULL'}`);
    }
    if (ops.length === 0) {
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

// â”€â”€ Query Builder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class QueryBuilder<Row = any> {
  private whereGroups: Where[] = [];
  private rawWhereGroups: { sql: string; params: any[] }[][] = [];
  private order?: OrderBy;
  private limitN?: number;
  private offsetN?: number;
  private includeSpec?: IncludeSpec;
  private selectCols?: string[];
  private pendingUpdateValues?: Record<string, any>;
  private _includeDeleted = false;

  constructor(
    private readonly tableName: string,
    private readonly execute: SqlExecutor,
    private readonly fullClient?: FullDbClient,
    private readonly _hasSoftDelete = false
  ) {}

  withDeleted(): this {
    this._includeDeleted = true;
    return this;
  }

  private applySoftDeleteFilter(): void {
    if (!this._hasSoftDelete || this._includeDeleted) return;
    for (const group of this.whereGroups) {
      if ('deleted_at' in group) return;
    }
    this.where({ deleted_at: { isNullish: true } });
  }

  where(filter: Where): this {
    if (this.whereGroups.length === 0) {
      this.whereGroups.push({});
      this.rawWhereGroups.push([]);
    }
    Object.assign(this.whereGroups[this.whereGroups.length - 1], filter || {});
    return this;
  }

  whereIn(column: string, values: any[]): this {
    if (!Array.isArray(values) || values.length === 0) return this;
    const placeholders = values.map(() => '?').join(', ');
    return this.sql({ query: `${column} IN (${placeholders})`, params: values });
  }

  orWhere(filter: Where): this {
    this.whereGroups.push({ ...filter });
    this.rawWhereGroups.push([]);
    return this;
  }

  whereAny(conditions: Where[]): this {
    if (!conditions || conditions.length === 0) return this;
    const orParts: string[] = [];
    const allParams: any[] = [];
    for (const condition of conditions) {
      const compiled = compileWhere(condition);
      if (compiled.sql) {
        const sqlPart = compiled.sql.replace(/^WHERE\s+/i, '');
        orParts.push(sqlPart);
        allParams.push(...compiled.params);
      }
    }
    if (orParts.length > 0) {
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

    if (query.includes('${') || /\$\{.*\}/.test(query)) {
      throw new Error('Potential SQL injection detected. Use ? placeholders and params array.');
    }
    if (/["'`]\s*\+|concat\s*\(/i.test(query)) {
      throw new Error('String concatenation detected in SQL. Use ? placeholders instead.');
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

  limit(n: number): this { this.limitN = n; return this; }
  offset(n: number): this { this.offsetN = n; return this; }
  include(spec: IncludeSpec): this { this.includeSpec = spec; return this; }
  select(cols: string[]): this { this.selectCols = cols; return this; }

  async distinct(column: string): Promise<QueryResult<any[]>> {
    this.applySoftDeleteFilter();
    const w = compileWhereGroupsWithRaw(this.whereGroups, this.rawWhereGroups);
    const sql = `SELECT DISTINCT ${column} FROM ${this.tableName} ${w.sql}`.trim();
    const ret = await this.execute(sql, w.params);
    if (!ret || ret.success === false) return ret as any;
    const rows = ((ret as any).data ?? (ret as any).results ?? []) as any[];
    return { success: true, data: rows.map(r => r[column]) };
  }

  async count(): Promise<QueryResult<number>> {
    this.applySoftDeleteFilter();
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
    const updateValues = values || this.pendingUpdateValues;
    if (!updateValues || Object.keys(updateValues).length === 0) {
      return { success: false, error: 'No update values provided' } as any;
    }
    const w = compileWhereGroupsWithRaw(this.whereGroups, this.rawWhereGroups);
    if (w.sql) {
      return this.updateMany(updateValues);
    }
    return { success: false, error: 'update() requires a where clause' } as any;
  }

  setPendingUpdate(values: Record<string, any>): this {
    this.pendingUpdateValues = values;
    return this;
  }

  async delete(): Promise<QueryResult<any>> {
    const w = compileWhereGroupsWithRaw(this.whereGroups, this.rawWhereGroups);
    if (!w.sql) {
      return { success: false, error: 'Delete requires a where clause for safety' } as any;
    }
    const sql = `DELETE FROM ${this.tableName} ${w.sql}`;
    return this.execute(sql, w.params);
  }

  async exists(): Promise<boolean> {
    this.applySoftDeleteFilter();
    const w = compileWhereGroupsWithRaw(this.whereGroups, this.rawWhereGroups);
    const sql = `SELECT EXISTS(SELECT 1 FROM ${this.tableName} ${w.sql} LIMIT 1) as e`;
    const ret = await this.execute(sql, w.params);
    if (!ret || ret.success === false) return false;
    const rows = (ret as any).data ?? (ret as any).results ?? [];
    return Array.isArray(rows) && rows.length > 0 && (rows[0]?.e === 1 || rows[0]?.e === true);
  }

  async many(): Promise<QueryResult<Row[]>> {
    this.applySoftDeleteFilter();
    const sel = compileSelect(this.selectCols);
    const w = compileWhereGroupsWithRaw(this.whereGroups, this.rawWhereGroups);
    const order = compileOrderBy(this.order);
    const limit = typeof this.limitN === 'number' ? `LIMIT ${this.limitN}` : '';
    const offset = typeof this.offsetN === 'number' ? `OFFSET ${this.offsetN}` : '';
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
    this.applySoftDeleteFilter();
    if (this.fullClient?.first && typeof this.limitN !== 'number') {
      const sel = compileSelect(this.selectCols);
      const w = compileWhereGroupsWithRaw(this.whereGroups, this.rawWhereGroups);
      const order = compileOrderBy(this.order);
      const sql = [`SELECT ${sel} FROM ${this.tableName}`, w.sql, order, 'LIMIT 1'].filter(Boolean).join(' ');
      const res = await this.fullClient.first(sql, w.params);
      if (!res || res.success === false) return res as any;
      const row = (res as any).data != null ? (res as any).data : undefined;
      return { success: true, data: row };
    }
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
    this.limitN = 2;
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

      const candidateFkCols = [
        `${this.singularize(includeTable)}Id`,
        `${includeTable}Id`,
      ];
      const sample = out[0] || {};
      const parentFkCol = candidateFkCols.find((c) => c in sample);

      if (parentFkCol) {
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

// â”€â”€ createRuntimeOrm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function createRuntimeOrm(
  execute: SqlExecutor,
  schema?: Pick<DatabaseSchema, 'tables'>,
  fullClient?: FullDbClient
) {
  const schemaColumnsByTable = new Map<string, Set<string>>();
  if (schema?.tables) {
    for (const table of schema.tables) {
      const columns = new Set(table.columns.map(col => col.name));
      schemaColumnsByTable.set(table.name, columns);
    }
  }

  function table<Row = any>(tableName: string): TableApi<Row> {
    const hasSoftDelete = schemaColumnsByTable.get(tableName)?.has('deleted_at') ?? false;
    const builderFactory = () => new QueryBuilder<Row>(tableName, execute, fullClient, hasSoftDelete);
    return {
      async many() { return builderFactory().many(); },
      async first() { return builderFactory().first(); },
      async one() { return builderFactory().one(); },
      async exists() { return builderFactory().exists(); },
      withDeleted() { return builderFactory().withDeleted(); },
      async insert(values: Partial<Row> | Partial<Row>[]) {
        const rows = Array.isArray(values) ? values : [values];
        if (rows.length === 0) return { success: true };

        const validColumns = schemaColumnsByTable.get(tableName);
        let validatedRows: Partial<Row>[] = rows;

        if (validColumns) {
          const skippedFields = new Set<string>();
          validatedRows = rows.map(row => {
            const validatedRow: Partial<Row> = {};
            for (const [key, value] of Object.entries(row as any)) {
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
              `[kuratchi-orm] Skipping fields not in schema for table '${tableName}': ${Array.from(skippedFields).join(', ')}`
            );
          }
        }

        const cols = Object.keys(validatedRows[0] as any);
        if (cols.length === 0) {
          return { success: false, error: 'No valid columns to insert' };
        }

        const placeholders = `(${cols.map(() => '?').join(', ')})`;
        const allPlaceholders = validatedRows.map(() => placeholders).join(', ');
        const params = validatedRows.flatMap((r) => cols.map((c) => (r as any)[c]));
        const baseSql = `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES ${allPlaceholders}`;
        return execute(baseSql, params) as any;
      },
      async delete(where?: Where) {
        if (where) {
          const w = compileWhere(where);
          const sql = `DELETE FROM ${tableName} ${w.sql}`;
          return execute(sql, w.params);
        }
        return { success: false, error: 'Delete requires a where clause.' } as any;
      },
      update(values: Record<string, any>) {
        return builderFactory().setPendingUpdate(values);
      },
      async count(where?: Where) {
        const w = compileWhere(where);
        const sql = `SELECT COUNT(*) as count FROM ${tableName} ${w.sql}`;
        const ret = await execute(sql, w.params);
        if (!ret || ret.success === false) return ret as any;
        const rows = (ret as any).data ?? (ret as any).results ?? [];
        const count = rows[0]?.count ?? 0;
        return { success: true, data: count } as any;
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
    } as TableApi<Row> & { withDeleted(): QueryBuilder<Row> } as any;
  }

  return { table, raw: execute };
}

// â”€â”€ Schema-aware client (JSON column auto-serialize) â”€â”€â”€â”€â”€â”€â”€â”€

export function createSchemaClient(
  execute: SqlExecutor,
  schema: Pick<DatabaseSchema, 'tables'>,
  opts?: { client?: FullDbClient }
): Record<string, TableApi> {
  const fullClient = opts?.client;
  const jsonColsByTable = new Map<string, Set<string>>();
  for (const t of schema.tables) {
    const s = new Set<string>();
    for (const col of t.columns) {
      if ((col as any).type === 'json') s.add(col.name);
    }
    if (s.size > 0) jsonColsByTable.set(t.name, s);
  }

  const base = createRuntimeOrm(execute, schema, fullClient);

  const serializeForTable = (table: string, values: Record<string, any>): Record<string, any> => {
    const jsonCols = jsonColsByTable.get(table) || new Set<string>();
    if (!values || !jsonCols.size) return values;
    const out: Record<string, any> = { ...values };
    for (const col of jsonCols) {
      if (!(col in out)) continue;
      const v = out[col];
      if (v === undefined || v === null) continue;
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
          try { copy[col] = JSON.parse(v); } catch { /* leave as string */ }
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
          const v2 = values ? serializeForTable(tableName, values) : undefined;
          return q.update(v2);
        },
        async many() {
          const res = await q.many();
          if (!res || res.success === false) return res as any;
          const data = ((res as any).data ?? (res as any).results ?? []) as Row[];
          return { success: true, data: deserializeRowsForTable<Row>(tableName, data) } as any;
        },
        async first() {
          const res = await q.first();
          if (!res || res.success === false) return res as any;
          const row = (res as any).data as Row | undefined;
          const parsed = row ? deserializeRowsForTable<Row>(tableName, [row])[0] : undefined;
          return { success: true, data: parsed } as any;
        },
        async one() {
          const res = await q.one();
          if (!res || res.success === false) return res as any;
          const row = (res as any).data as Row;
          return { success: true, data: deserializeRowsForTable<Row>(tableName, [row])[0] } as any;
        },
        async exists() { return q.exists(); },
        async count() { return q.count(); },
        async distinct(column: string) { return q.distinct(column); },
        async updateMany(values: Record<string, any>) {
          return q.updateMany(serializeForTable(tableName, values || {}));
        },
        async delete() { return q.delete(); }
      } as TableQuery<Row>;
    };

    return {
      async many() {
        const res = await raw.many();
        if (!res || res.success === false) return res as any;
        const data = ((res as any).data ?? (res as any).results ?? []) as Row[];
        return { success: true, data: deserializeRowsForTable<Row>(tableName, data) } as any;
      },
      async first() {
        const res = await raw.first();
        if (!res || res.success === false) return res as any;
        const row = (res as any).data as Row | undefined;
        const parsed = row ? deserializeRowsForTable<Row>(tableName, [row])[0] : undefined;
        return { success: true, data: parsed } as any;
      },
      async one() {
        const res = await raw.one();
        if (!res || res.success === false) return res as any;
        const row = (res as any).data as Row;
        return { success: true, data: deserializeRowsForTable<Row>(tableName, [row])[0] } as any;
      },
      async exists() { return raw.exists(); },
      async insert(values: Partial<Row> | Partial<Row>[]) {
        const arr = Array.isArray(values) ? values : [values];
        const transformed = arr.map((v) => serializeForTable(tableName, v as any));
        const payload = Array.isArray(values) ? transformed : transformed[0];
        return raw.insert(payload as any);
      },
      update(values: Record<string, any>) {
        return wrapQuery(raw.update(serializeForTable(tableName, values || {})));
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

  const out: Record<string, TableApi> = {};
  for (const t of schema.tables) {
    out[t.name] = wrapTable(t.name);
  }
  return out;
}

// â”€â”€ D1 helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function d1Executor(database: any): { execute: SqlExecutor; fullClient: FullDbClient } {
  const execute: SqlExecutor = async (sql, params) => {
    try {
      let stmt = database.prepare(sql);
      if (params?.length) stmt = stmt.bind(...params);
      const result = await stmt.all();
      return {
        success: result.success ?? true,
        data: result.results,
        results: result.results,
        error: result.error,
        meta: result.meta
      };
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) };
    }
  };

  const fullClient: FullDbClient = {
    first: async (sql, params, column) => {
      try {
        let stmt = database.prepare(sql);
        if (params?.length) stmt = stmt.bind(...params);
        const result = column ? await stmt.first(column) : await stmt.first();
        return { success: true, data: result, results: result ? [result] : [] };
      } catch (error: any) {
        return { success: false, error: error?.message || String(error) };
      }
    },
    batch: async (queries) => {
      try {
        const stmts = queries.map(q => {
          let stmt = database.prepare(q.query);
          if (q.params?.length) stmt = stmt.bind(...q.params);
          return stmt;
        });
        const results = await database.batch(stmts);
        return { success: true, results: results.map((r: any) => r.results || []) };
      } catch (error: any) {
        return { success: false, error: error?.message || String(error) };
      }
    },
    run: async (sql, params) => {
      try {
        let stmt = database.prepare(sql);
        if (params?.length) stmt = stmt.bind(...params);
        const result = await stmt.run();
        return { success: result.success ?? true, meta: result.meta, error: result.error };
      } catch (error: any) {
        return { success: false, error: error?.message || String(error) };
      }
    },
    raw: async (sql, params) => {
      try {
        let stmt = database.prepare(sql);
        if (params?.length) stmt = stmt.bind(...params);
        const result = await stmt.raw();
        return { success: true, data: result, results: result };
      } catch (error: any) {
        return { success: false, error: error?.message || String(error) };
      }
    }
  };

  return { execute, fullClient };
}

// â”€â”€ Unified Factory: kuratchiORM() â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Create an ORM client.
 *
 * - Pass a D1 binding directly for immediate use
 * - Pass a getter function for deferred binding (module-level singletons)
 * - Pass a config object for Durable Objects / custom executors
 *
 * @example D1 binding (inline)
 * ```ts
 * const db = kuratchiORM(env.DB);
 * await db.todos.many();
 * ```
 *
 * @example D1 getter (module-level â€” binding resolved at query time)
 * ```ts
 * const db = kuratchiORM(() => getEnv<Env>().DB);
 * await db.todos.orderBy({ created_at: 'desc' }).many();
 * ```
 *
 * @example Durable Object (inside DO class â€” direct SqlStorage)
 * ```ts
 * const db = kuratchiORM(this.sql);
 * await db.stats.where({ key: 'total_added' }).first();
 * ```
 */

/**
 * Initialize a Durable Object with ORM + schema migration.
 *
 * Call this in your DO constructor â€” it runs the migration SQL synchronously
 * via SqlStorage.exec(), then returns a kuratchiORM instance ready to use.
 *
 * @param sql - The DO's SqlStorage (ctx.storage.sql)
 * @param schema - SchemaDsl or DatabaseSchema defining the tables
 * @returns ORM instance (same API as kuratchiORM)
 *
 * @example
 * ```ts
 * export class MyDO extends DurableObject<Env> {
 *   db: Record<string, any>;
 *   constructor(ctx: DurableObjectState, env: Env) {
 *     super(ctx, env);
 *     this.db = initDO(ctx.storage.sql, mySchema);
 *   }
 * }
 * ```
 */
export function initDO(sql: any, schema: any): Record<string, TableApi> {
  const normalized = ensureNormalizedSchema(schema);

  // Snapshot which tables exist BEFORE running initial SQL.
  // Tables not in this set were just created — no additive migration needed.
  const existingTables = new Set<string>();
  try {
    const rows = sql.exec("SELECT name FROM sqlite_master WHERE type='table'").toArray?.() ?? [];
    for (const r of rows) existingTables.add(String(r?.name ?? ''));
  } catch {}

  // Run CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS statements
  const migrationSql = buildInitialSql(normalized);
  const statements = migrationSql.split(';').map((s: string) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    sql.exec(stmt);
  }

  // Only check for missing columns on tables that pre-existed.
  // Fresh tables (just created above) are already complete.
  applyDoAdditiveMigrations(sql, normalized, existingTables);

  return kuratchiORM(sql);
}

function quoteIdent(name: string): string {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function columnSqlType(col: Column): string {
  switch (col.type) {
    case 'text': return 'TEXT';
    case 'integer': return 'INTEGER';
    case 'real': return 'REAL';
    case 'blob': return 'BLOB';
    case 'json': return 'TEXT';
    default: return 'TEXT';
  }
}

function columnDefaultSql(col: Column): string | null {
  if (!col.default) return null;
  if (col.default.kind === 'raw') return `DEFAULT ${col.default.sql}`;
  const v = col.default.value;
  if (v === null) return 'DEFAULT NULL';
  if (typeof v === 'number') return `DEFAULT ${v}`;
  if (typeof v === 'boolean') return `DEFAULT ${v ? 1 : 0}`;
  const escaped = String(v).replace(/'/g, "''");
  return `DEFAULT '${escaped}'`;
}

function buildAddColumnSql(tableName: string, col: Column): string {
  const parts: string[] = [
    `ALTER TABLE ${quoteIdent(tableName)} ADD COLUMN ${quoteIdent(col.name)} ${columnSqlType(col)}`
  ];
  const dsql = columnDefaultSql(col);
  if (dsql) parts.push(dsql);
  if (col.notNull && dsql) parts.push('NOT NULL');
  return parts.join(' ');
}

function applyDoAdditiveMigrations(sql: any, schema: DatabaseSchema, existingTables: Set<string>): void {
  for (const table of schema.tables) {
    // Table was created fresh this instantiation — skip entirely.
    if (!existingTables.has(table.name)) continue;

    let existingCols = new Set<string>();
    try {
      const pragmaRows = sql.exec(`PRAGMA table_info(${quoteIdent(table.name)})`)?.toArray?.() ?? [];
      existingCols = new Set(pragmaRows.map((r: any) => String(r?.name ?? '')));
    } catch (err: any) {
      console.warn(`[kuratchi-orm] DO migration: unable to inspect table ${table.name}: ${err?.message || String(err)}`);
      continue;
    }

    for (const col of table.columns) {
      if (existingCols.has(col.name)) continue;
      const addSql = buildAddColumnSql(table.name, col);
      try {
        sql.exec(addSql);
        console.log(`[kuratchi-orm] DO migration: added column ${table.name}.${col.name}`);
      } catch (err: any) {
        console.warn(`[kuratchi-orm] DO migration: failed adding column ${table.name}.${col.name}: ${err?.message || String(err)}`);
      }
    }
    // Index creation is handled by buildInitialSql (CREATE INDEX IF NOT EXISTS).
    // No duplicate work needed here.
  }
}

/**
 * Create a SqlExecutor from DO SqlStorage (synchronous .exec() API).
 * SqlStorage.exec(query) returns a Cursor with .toArray().
 */
function sqlStorageExecutor(storage: any): { execute: SqlExecutor } {
  const execute: SqlExecutor = async (sql: string, params?: any[]) => {
    try {
      let cursor;
      if (params?.length) {
        cursor = storage.exec(sql, ...params);
      } else {
        cursor = storage.exec(sql);
      }
      // .exec() returns a Cursor â€” .toArray() gives us rows
      const rows = cursor?.toArray?.() ?? [];
      return { success: true, data: rows, results: rows };
    } catch (error: any) {
      return { success: false, error: error?.message || String(error) };
    }
  };
  return { execute };
}

/**
 * Detect whether an object is SqlStorage (DO) vs D1 binding.
 * SqlStorage has .exec() but no .prepare().
 * D1 has .prepare().
 */
function isSqlStorage(obj: any): boolean {
  return typeof obj?.exec === 'function' && typeof obj?.prepare !== 'function';
}

function resolveExecutor(binding: any): { execute: SqlExecutor; fullClient?: FullDbClient } {
  if (isSqlStorage(binding)) {
    return sqlStorageExecutor(binding);
  }
  return d1Executor(binding);
}

export function kuratchiORM(d1OrConfig: any | (() => any) | OrmAdapterConfig): Record<string, TableApi> {
  // Getter function — resolve binding lazily, cache per binding reference
  if (typeof d1OrConfig === 'function') {
    let cachedBinding: any;
    let cachedBase: ReturnType<typeof createRuntimeOrm> | undefined;
    return new Proxy({} as Record<string, TableApi>, {
      get(_, prop: PropertyKey) {
        if (typeof prop !== 'string') return undefined;
        const binding = d1OrConfig();
        if (binding !== cachedBinding || !cachedBase) {
          cachedBinding = binding;
          const { execute, fullClient } = resolveExecutor(binding);
          cachedBase = createRuntimeOrm(execute, undefined, fullClient);
        }
        return cachedBase.table(prop);
      }
    });
  }

  let execute: SqlExecutor;
  let fullClient: FullDbClient | undefined;

  // D1 binding (has .prepare()) or SqlStorage (has .exec())
  if (typeof d1OrConfig?.prepare === 'function' || isSqlStorage(d1OrConfig)) {
    const resolved = resolveExecutor(d1OrConfig);
    execute = resolved.execute;
    fullClient = resolved.fullClient;
  } else {
    // Adapter config (executor only â€” for custom use cases)
    const config = d1OrConfig as OrmAdapterConfig;
    if (config.adapter === 'executor') {
      execute = config.execute;
      fullClient = config.client;
    } else {
      throw new Error(`Unknown adapter: ${(config as any).adapter}`);
    }
  }

  const base = createRuntimeOrm(execute, undefined, fullClient);

  return new Proxy({} as Record<string, TableApi>, {
    get(_, prop: PropertyKey) {
      if (typeof prop !== 'string') return undefined;
      return base.table(prop);
    }
  });
}


