/**
 * Kuratchi Cloud
 * 
 * Two-tier architecture for managed infrastructure:
 * 
 * 1. **Platform Client**: Manage databases, roles, organizations (no database context)
 * 2. **Database Client**: Work with a specific database (requires databaseId)
 * 3. **Unified Client**: Convenience wrapper combining both
 * 
 * @example Platform Management (no database needed)
 * ```typescript
 * import { cloud } from 'kuratchi-sdk';
 * 
 * const platform = cloud.createPlatform({
 *   apiKey: process.env.KURATCHI_API_KEY
 * });
 * 
 * // Platform operations
 * const databases = await platform.databases.list();
 * const roles = await platform.roles.list();
 * await platform.roles.create({
 *   name: 'editor',
 *   permissions: ['posts.create', 'posts.edit']
 * });
 * ```
 * 
 * @example Database Operations (requires databaseId)
 * ```typescript
 * import { cloud } from 'kuratchi-sdk';
 * 
 * const db = cloud.createDatabase({
 *   apiKey: process.env.KURATCHI_API_KEY,
 *   databaseId: process.env.DATABASE_ID,
 *   schema
 * });
 * 
 * // Database operations
 * await db.orm.users.insert({ name: 'Alice' });
 * const users = await db.query('SELECT * FROM users');
 * ```
 * 
 * @example Unified Client (for complex scenarios)
 * ```typescript
 * import { cloud } from 'kuratchi-sdk';
 * 
 * const client = cloud.createClient({
 *   apiKey: process.env.KURATCHI_API_KEY
 * });
 * 
 * // Platform operations (always available)
 * await client.platform.databases.list();
 * await client.platform.roles.list();
 * 
 * // Database operations (dynamic)
 * const db = client.useDatabase('db-123', schema);
 * await db.orm.users.insert({ name: 'Alice' });
 * ```
 */

// Platform Client (no database context)
export { 
  PlatformClient,
  createPlatformClient as createPlatform,
  type PlatformClientConfig,
  type Database,
  type DatabaseAnalytics,
  type CreateDatabaseRequest,
  type UpdateDatabaseRequest,
  type ApiResponse
} from './platform.js';

// Roles & Permissions APIs
export {
  RolesAPI,
  PermissionsAPI,
  type Permission,
  type Role,
  type RoleWithPermissions,
  type RoleWithOrganizations,
  type CreatePermissionRequest,
  type UpdatePermissionRequest,
  type CreateRoleRequest,
  type UpdateRoleRequest,
  type ListPermissionsOptions,
  type ListRolesOptions,
  type GetRoleOptions
} from './platform-roles.js';

// Database Client (single database context)
export { 
  ManagedClient as DatabaseClient,
  createClient as createDatabase,
  type ManagedClientConfig as DatabaseClientConfig
} from './client.js';

// Unified Client (combines platform + database)
// TODO: Implement unified client that wraps both
// export {
//   UnifiedClient,
//   createClient,
//   type UnifiedClientConfig
// } from './unified-client.js';

// Legacy exports (backward compatibility)
export { 
  ManagedClient as Client,
  type ManagedClientConfig as ClientConfig
} from './client.js';
