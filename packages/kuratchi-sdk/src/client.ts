/**
 * Kuratchi Client
 *
 * Unified entry point. Provides access to all resource types
 * and platform management through a single API key.
 *
 * @example
 * ```typescript
 * import { createClient } from '@kuratchi/sdk';
 *
 * const kuratchi = createClient({
 *   apiKey: process.env.KURATCHI_API_KEY,
 *   baseUrl: 'https://your-instance.com',
 * });
 *
 * // Data plane — work with specific resources
 * const db = kuratchi.database('my-db');
 * const kv = kuratchi.kv('my-cache');
 * const r2 = kuratchi.r2('my-bucket');
 *
 * // Control plane — manage resources
 * await kuratchi.platform.databases.create({ name: 'new-db' });
 * ```
 */

import { DatabaseClient } from './database.js';
import { KVClient } from './kv.js';
import { R2Client } from './r2.js';
import { PlatformClient } from './platform.js';

export interface KuratchiConfig {
  /** API key — use a platform token (kdbp_ prefix) for full access, or a resource-scoped token for single-resource access */
  apiKey: string;
  /** Base URL of your Kuratchi instance */
  baseUrl: string;
}

export interface KuratchiSDK {
  /** Get a database client for SQL operations */
  database(name: string): DatabaseClient;
  /** Get a KV client for key-value operations */
  kv(name: string): KVClient;
  /** Get an R2 client for object storage operations */
  r2(name: string): R2Client;
  /** Platform management — create, list, delete resources and tokens */
  platform: PlatformClient;
}

export class KuratchiClient implements KuratchiSDK {
  private baseUrl: string;
  private apiKey: string;
  private _platform: PlatformClient;

  constructor(config: KuratchiConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this._platform = new PlatformClient(this.baseUrl, this.apiKey);
  }

  database(name: string): DatabaseClient {
    return new DatabaseClient(this.baseUrl, this.apiKey, name);
  }

  kv(name: string): KVClient {
    return new KVClient(this.baseUrl, this.apiKey, name);
  }

  r2(name: string): R2Client {
    return new R2Client(this.baseUrl, this.apiKey, name);
  }

  get platform(): PlatformClient {
    return this._platform;
  }
}

export function createClient(config: KuratchiConfig): KuratchiSDK {
  return new KuratchiClient(config);
}

