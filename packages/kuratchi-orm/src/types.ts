/**
 * Core ORM types
 */

// ── Primitives ──────────────────────────────────────────────

export type Primitive = string | number | boolean | null;

export type WhereValue =
  | Primitive
  | {
      eq?: Primitive;
      ne?: Primitive;
      gt?: Primitive;
      gte?: Primitive;
      lt?: Primitive;
      lte?: Primitive;
      like?: string;
      in?: Primitive[];
      notIn?: Primitive[];
      is?: null;
      isNull?: boolean;
      isNullish?: boolean;
    };

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

// ── Query Result ────────────────────────────────────────────

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

// ── SQL Executor ────────────────────────────────────────────

export type SqlExecutor = (sql: string, params?: any[]) => Promise<QueryResult<any>>;

export type SqlCondition = { query: string; params?: any[] };

// ── Full DB Client (native D1 APIs) ─────────────────────────

export interface FullDbClient {
  query?: (sql: string, params?: any[]) => Promise<QueryResult<any>>;
  first?: (sql: string, params?: any[], column?: string) => Promise<QueryResult<any>>;
  exec?: (sql: string) => Promise<QueryResult<any>>;
  batch?: (queries: Array<{ query: string; params?: any[] }>) => Promise<QueryResult<any>>;
  raw?: (sql: string, params?: any[]) => Promise<QueryResult<any>>;
  run?: (sql: string, params?: any[]) => Promise<QueryResult<any>>;
}

// ── Include (relations) ─────────────────────────────────────

export type IncludeSpec = Record<
  string,
  boolean | {
    as?: string;
    single?: boolean;
    localKey?: string;
    foreignKey?: string;
    table?: string;
  }
>;

// ── Table API ───────────────────────────────────────────────

export interface TableApi<Row = any> {
  many(): Promise<QueryResult<Row[]>>;
  first(): Promise<QueryResult<Row | undefined>>;
  one(): Promise<QueryResult<Row>>;
  exists(): Promise<boolean>;
  insert(values: Partial<Row> | Partial<Row>[]): Promise<QueryResult<Row | Row[]>>;
  delete(where?: Where): Promise<QueryResult<any>>;
  count(where?: Where): Promise<QueryResult<number>>;
  update(values: Record<string, any>): TableQuery<Row>;
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
  update(values?: Record<string, any>): Promise<QueryResult<any>>;
  delete(): Promise<QueryResult<any>>;
}

// ── Schema DSL ──────────────────────────────────────────────

export type ColumnDefString = string;
export type TableDsl = Record<string, ColumnDefString | true>;
export type MixinsDsl = Record<string, TableDsl>;

export type IndexDsl = {
  columns: string[];
  unique?: boolean;
};

export type TableIndexesDsl = Record<string, IndexDsl>;

export type SchemaDsl = {
  name: string;
  version: number;
  mixins?: MixinsDsl;
  tables: Record<string, TableDsl>;
  indexes?: Record<string, TableIndexesDsl>;
};

// ── Adapter Config (advanced — custom executors only) ────────

export interface ExecutorAdapterConfig {
  adapter: 'executor';
  execute: SqlExecutor;
  client?: FullDbClient;
}

export type OrmAdapterConfig = ExecutorAdapterConfig;
