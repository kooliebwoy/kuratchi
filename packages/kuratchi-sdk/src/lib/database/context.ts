/**
 * DatabaseContext - Re-exports from adapters folder
 * @deprecated Import from '../adapters/database-context.js' instead
 */

export {
  createDatabaseContext,
  RpcDatabaseContext,
  HttpDatabaseContext,
  type DatabaseContext,
  type DatabaseContextConfig,
  type OrgDatabaseInfo,
  type CreateOrgDatabaseOptions,
  type CreateOrgDatabaseResult,
  type GetOrgDatabaseOptions,
  type IDatabaseContext
} from '../adapters/database-context.js';
