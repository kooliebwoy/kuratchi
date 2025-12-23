/**
 * D1 HTTP Adapter
 * For accessing Cloudflare D1 databases via REST API
 * 
 * This adapter is the single source of truth for all HTTP functionality:
 * - Execution adapter creation
 * - DatabaseContext implementation for high-level database operations
 */

import type { QueryResult, ExecutionAdapter, DatabaseAdapterType, OrmClient, SchemaType, HttpAdapterConfig } from './types.js';
import type {
  DatabaseContext,
  DatabaseContextConfig,
  OrgDatabaseInfo,
  CreateOrgDatabaseOptions,
  CreateOrgDatabaseResult,
  GetOrgDatabaseOptions
} from './database-context.js';
import { KuratchiDatabase } from '../database/core/database.js';
import { getCache } from '../cache/index.js';

// ============================================================================
// Explicit Adapter Factory
// ============================================================================

/**
 * Create an HTTP adapter configuration
 * Use this to explicitly configure HTTP REST API mode for plugins
 * 
 * @example
 * ```ts
 * organizationPlugin({
 *   organizationSchema,
 *   adapter: httpAdapter({
 *     accountId: env.CF_ACCOUNT_ID,
 *     apiToken: env.CF_API_TOKEN,
 *     workersSubdomain: env.CF_WORKERS_SUBDOMAIN,
 *     gatewayKey: env.GATEWAY_KEY
 *   })
 * })
 * ```
 */
export function httpAdapter(options: {
  accountId: string;
  apiToken: string;
  workersSubdomain: string;
  gatewayKey?: string;
}): HttpAdapterConfig {
  return {
    type: 'http',
    accountId: options.accountId,
    apiToken: options.apiToken,
    workersSubdomain: options.workersSubdomain,
    gatewayKey: options.gatewayKey
  };
}

// ============================================================================
// HTTP Execution Adapter
// ============================================================================

/**
 * Create an adapter for D1 HTTP client
 * Use when accessing D1 via REST API (BaaS, remote workers)
 * 
 * @param httpClient - HTTP client with query method
 */
export function createD1HttpAdapter(httpClient: any): ExecutionAdapter {
  return async (sql: string, params?: any[]): Promise<QueryResult<any>> => {
    try {
      const result = await httpClient.query(sql, params || []);
      
      return {
        success: result.success ?? true,
        data: result.results,
        results: result.results,
        error: result.error,
        meta: result.meta
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || String(error)
      };
    }
  };
}

/**
 * @deprecated Use createD1HttpAdapter instead
 */
export const createDoHttpAdapter = createD1HttpAdapter;

// ============================================================================
// HTTP DatabaseContext Implementation
// ============================================================================

/**
 * HTTP DatabaseContext - high-level database operations via REST API
 * 
 * This class implements the DatabaseContext interface for HTTP mode.
 * All HTTP-specific database access logic lives here.
 */
export class HttpDatabaseContext implements DatabaseContext {
  readonly adapter: DatabaseAdapterType = 'http';
  readonly isRpc = false;
  
  private config: DatabaseContextConfig;
  private dbService: KuratchiDatabase | null = null;
  private ormClientCache = new Map<string, OrmClient>();
  private adminDbGetter?: () => Promise<OrmClient | null>;
  
  constructor(config: DatabaseContextConfig) {
    this.config = config;
    this.adminDbGetter = config.getAdminDb;
    this.initDbService();
  }
  
  setAdminDbGetter(getter: () => Promise<OrmClient | null>): void {
    this.adminDbGetter = getter;
  }
  
  private initDbService(): void {
    const { cloudflare } = this.config;
    if (cloudflare?.apiToken && cloudflare?.accountId && cloudflare?.workersSubdomain) {
      this.dbService = new KuratchiDatabase({
        apiToken: cloudflare.apiToken,
        accountId: cloudflare.accountId,
        workersSubdomain: cloudflare.workersSubdomain
      });
    }
  }
  
  async getAdminDatabase(options: {
    schema: SchemaType;
    skipMigrations?: boolean;
  }): Promise<OrmClient> {
    throw new Error('[HttpAdapter] HTTP mode requires token - use legacy getAdminDb helper');
  }
  
  async getOrgDatabase(options: GetOrgDatabaseOptions): Promise<OrmClient | null> {
    const { organizationId, schema, skipMigrations } = options;
    const cacheKey = `org:${organizationId}`;
    
    if (this.ormClientCache.has(cacheKey)) {
      return this.ormClientCache.get(cacheKey)!;
    }
    
    if (!this.dbService) {
      console.warn('[HttpAdapter] HTTP mode requires Cloudflare credentials');
      return null;
    }
    
    // Get database metadata from cache
    const cache = getCache();
    const meta = cache ? await cache.getOrgDatabaseMeta(organizationId) : null;
    
    if (!meta || !meta.token) {
      console.warn(`[HttpAdapter] No token found for org: ${organizationId}`);
      return null;
    }
    
    const client = await this.dbService.ormClient({
      databaseName: meta.databaseName,
      dbToken: meta.token,
      gatewayKey: this.config.cloudflare?.gatewayKey || '',
      schema,
      scriptName: meta.workerName ?? undefined,
      skipMigrations
    });
    
    this.ormClientCache.set(cacheKey, client);
    return client;
  }
  
  async createOrgDatabase(options: CreateOrgDatabaseOptions): Promise<CreateOrgDatabaseResult> {
    const { organizationId, organizationName, schema, migrate } = options;
    
    if (!this.dbService) {
      throw new Error('[HttpAdapter] HTTP mode requires Cloudflare credentials');
    }
    
    const gatewayKey = this.config.cloudflare?.gatewayKey;
    if (!gatewayKey) {
      throw new Error('[HttpAdapter] HTTP mode requires gateway key');
    }
    
    // Generate database name
    const sanitizedName = organizationName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 32);
    const databaseName = `org-${sanitizedName}-${crypto.randomUUID().substring(0, 8)}`;
    
    // Deploy D1 database with worker
    const result = await this.dbService.createDatabase({
      databaseName,
      gatewayKey,
      migrate: migrate !== false,
      schema,
      schemaName: 'organization'
    });
    
    // Cache the metadata
    const cache = getCache();
    if (cache) {
      await cache.setOrgDatabaseMeta(organizationId, {
        databaseName,
        workerName: result.workerName ?? null,
        token: result.token ?? null,
        adapter: 'http'
      });
    }
    
    return { databaseName, organizationId };
  }
  
  async getOrgDatabaseInfo(organizationId: string): Promise<OrgDatabaseInfo | null> {
    const cache = getCache();
    const meta = cache ? await cache.getOrgDatabaseMeta(organizationId) : null;
    
    if (!meta) return null;
    return { databaseName: meta.databaseName, organizationId };
  }
  
  async resolveDatabaseName(organizationId: string): Promise<string | null> {
    const info = await this.getOrgDatabaseInfo(organizationId);
    return info?.databaseName ?? null;
  }
}
