/**
 * Kuratchi Cloud
 * 
 * Premium managed infrastructure - all operations routed through Kuratchi Cloud.
 * Single API key for everything - no need for Cloudflare, Resend, or other service keys.
 * 
 * @example
 * ```typescript
 * import { cloud } from 'kuratchi-sdk';
 * 
 * const client = new cloud.Client({
 *   apiKey: process.env.KURATCHI_API_KEY,
 *   databaseId: process.env.DATABASE_ID,
 *   schema
 * });
 * 
 * // Database operations
 * await client.orm.users.insert({ name: 'Alice' });
 * 
 * // Platform management
 * const databases = await client.platform.databases.list();
 * ```
 */

export { 
  ManagedClient as Client,
  createClient,
  type ManagedClientConfig as ClientConfig
} from './client.js';

export {
  PlatformClient,
  type PlatformClientConfig,
  type Database,
  type DatabaseAnalytics,
  type CreateDatabaseRequest,
  type UpdateDatabaseRequest,
  type ApiResponse
} from './platform.js';
