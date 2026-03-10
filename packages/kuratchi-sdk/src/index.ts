/**
 * Kuratchi SDK
 *
 * Unified client for Kuratchi's managed infrastructure:
 * - D1 Databases (SQL)
 * - KV Namespaces (key-value)
 * - R2 Buckets (object storage)
 * - Platform management (create/list/delete resources)
 *
 * @example Quick start
 * ```typescript
 * import { createClient } from '@kuratchi/sdk';
 *
 * const kuratchi = createClient({
 *   apiKey: process.env.KURATCHI_API_KEY,
 *   baseUrl: 'https://your-kuratchi-instance.com',
 * });
 *
 * // Database operations
 * const db = kuratchi.database('my-db');
 * await db.query('SELECT * FROM users');
 * await db.batch([
 *   { sql: 'INSERT INTO users (name) VALUES (?)', params: ['Alice'] },
 *   { sql: 'INSERT INTO users (name) VALUES (?)', params: ['Bob'] },
 * ]);
 *
 * // KV operations
 * const kv = kuratchi.kv('my-cache');
 * await kv.put('session:abc', JSON.stringify({ userId: 1 }), { expirationTtl: 3600 });
 * const value = await kv.get('session:abc');
 *
 * // R2 operations
 * const r2 = kuratchi.r2('my-bucket');
 * await r2.put('uploads/photo.jpg', fileBuffer, { contentType: 'image/jpeg' });
 * const file = await r2.get('uploads/photo.jpg');
 *
 * // Platform management
 * const databases = await kuratchi.platform.databases.list();
 * await kuratchi.platform.databases.create({ name: 'new-db', locationHint: 'enam' });
 * ```
 */

export { KuratchiClient, createClient, type KuratchiConfig } from './client.js';
export { DatabaseClient, type DatabaseQueryResult } from './database.js';
export { KVClient } from './kv.js';
export { R2Client, type R2Object, type R2ListResult } from './r2.js';
export {
  PlatformClient,
  type ApiResponse,
  type DatabaseInfo,
  type KVNamespaceInfo,
  type R2BucketInfo,
  type CreateDatabaseRequest,
  type CreateKVRequest,
  type CreateR2Request,
} from './platform.js';
export type { KuratchiSDK } from './client.js';

