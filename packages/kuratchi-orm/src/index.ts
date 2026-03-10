/**
 * @kuratchi/orm â€” Lightweight D1/SQLite ORM for Cloudflare Workers
 *
 * Zero dependencies. Worker-safe. No Node APIs.
 */

// Core factory
export { kuratchiORM, initDO, createRuntimeOrm, createSchemaClient } from './orm.js';

// Schema
export { normalizeSchema, ensureNormalizedSchema } from './schema.js';
export type { DatabaseSchema, Column, Table, Index, SqlDefault, Reference } from './schema.js';
export { isDatabaseSchema } from './schema.js';

// Types
export type {
  Primitive, Where, WhereValue, OrderBy, OrderItem, FindManyOptions,
  QueryResult, SqlExecutor, SqlCondition, FullDbClient, IncludeSpec,
  TableApi, TableQuery,
  ColumnDefString, TableDsl, MixinsDsl, IndexDsl, TableIndexesDsl, SchemaDsl,
  OrmAdapterConfig, ExecutorAdapterConfig,
} from './types.js';



