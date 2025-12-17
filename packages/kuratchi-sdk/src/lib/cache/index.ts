/**
 * Kuratchi SDK Caching Module
 * 
 * Provides multi-layer caching for database metadata, ORM clients, and query results:
 * - L1: In-memory request-scoped cache (fastest, per-request)
 * - L2: In-memory cross-request cache (fast, with TTL)
 * - L3: KV-backed persistent cache (durable, distributed)
 * 
 * Designed for Cloudflare Workers environment with KV storage.
 */

import type { RequestEvent } from '@sveltejs/kit';

// ============================================================================
// Types
// ============================================================================

export interface CacheConfig {
  /** Enable caching (default: true) */
  enabled?: boolean;
  
  /** KV namespace binding name for persistent cache (e.g., 'CACHE_KV') */
  kvNamespace?: string;
  
  /** Default TTL for cached items in seconds (default: 300 = 5 minutes) */
  defaultTtlSeconds?: number;
  
  /** TTL for database metadata (org records, tokens) in seconds (default: 3600 = 1 hour) */
  metadataTtlSeconds?: number;
  
  /** TTL for schema sync status in seconds (default: 86400 = 24 hours) */
  schemaSyncTtlSeconds?: number;
  
  /** Enable debug logging */
  debug?: boolean;
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  kvHits: number;
  kvMisses: number;
  writes: number;
  evictions: number;
}

// ============================================================================
// In-Memory Cache (L2 - Cross-Request)
// ============================================================================

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize: number;
  private stats: CacheStats = { hits: 0, misses: 0, kvHits: 0, kvMisses: 0, writes: 0, evictions: 0 };
  
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    
    this.stats.hits++;
    return entry.value as T;
  }
  
  set<T>(key: string, value: T, ttlSeconds: number): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.stats.evictions++;
      }
    }
    
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlSeconds * 1000),
      createdAt: Date.now()
    });
    this.stats.writes++;
  }
  
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  getStats(): CacheStats {
    return { ...this.stats };
  }
  
  // Clean up expired entries
  prune(): number {
    const now = Date.now();
    let pruned = 0;
    
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        pruned++;
      }
    }
    
    return pruned;
  }
}

// Global memory cache instance (persists across requests in the same worker)
const memoryCache = new MemoryCache();

// ============================================================================
// KV Cache (L3 - Persistent)
// ============================================================================

type KVNamespace = {
  get(key: string, options?: { type?: 'text' | 'json' }): Promise<any>;
  put(key: string, value: string, options?: { expirationTtl?: number; metadata?: any }): Promise<void>;
  delete(key: string): Promise<void>;
};

async function getFromKV<T>(
  kv: KVNamespace | null,
  key: string,
  debug = false
): Promise<T | null> {
  if (!kv) return null;
  
  try {
    const value = await kv.get(key, { type: 'json' });
    if (debug && value) {
      console.log(`[Kuratchi Cache] KV HIT: ${key}`);
    }
    return value as T;
  } catch (error) {
    if (debug) {
      console.warn(`[Kuratchi Cache] KV GET error for ${key}:`, error);
    }
    return null;
  }
}

async function setInKV(
  kv: KVNamespace | null,
  key: string,
  value: any,
  ttlSeconds: number,
  debug = false
): Promise<boolean> {
  if (!kv) return false;
  
  try {
    await kv.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
    if (debug) {
      console.log(`[Kuratchi Cache] KV SET: ${key} (TTL: ${ttlSeconds}s)`);
    }
    return true;
  } catch (error) {
    if (debug) {
      console.warn(`[Kuratchi Cache] KV SET error for ${key}:`, error);
    }
    return false;
  }
}

async function deleteFromKV(
  kv: KVNamespace | null,
  key: string
): Promise<boolean> {
  if (!kv) return false;
  
  try {
    await kv.delete(key);
    return true;
  } catch (error) {
    return false;
  }
}

// ============================================================================
// Unified Cache Manager
// ============================================================================

export class CacheManager {
  private config: Required<CacheConfig>;
  private kv: KVNamespace | null = null;
  
  constructor(config: CacheConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      kvNamespace: config.kvNamespace ?? '',
      defaultTtlSeconds: config.defaultTtlSeconds ?? 300,
      metadataTtlSeconds: config.metadataTtlSeconds ?? 3600,
      schemaSyncTtlSeconds: config.schemaSyncTtlSeconds ?? 86400,
      debug: config.debug ?? false
    };
  }
  
  /**
   * Initialize KV namespace from platform environment
   */
  initializeKV(platform: any): void {
    if (!this.config.kvNamespace || !platform?.env) return;
    
    const kvNamespace = platform.env[this.config.kvNamespace];
    if (kvNamespace) {
      this.kv = kvNamespace as KVNamespace;
      if (this.config.debug) {
        console.log(`[Kuratchi Cache] KV initialized: ${this.config.kvNamespace}`);
      }
    }
  }
  
  /**
   * Get value from cache (L1 -> L2 -> L3)
   */
  async get<T>(key: string, requestCache?: Map<string, any>): Promise<T | null> {
    if (!this.config.enabled) return null;
    
    const cacheKey = `kuratchi:${key}`;
    
    // L1: Request-scoped cache (if provided)
    if (requestCache?.has(cacheKey)) {
      if (this.config.debug) {
        console.log(`[Kuratchi Cache] L1 HIT: ${key}`);
      }
      return requestCache.get(cacheKey) as T;
    }
    
    // L2: Memory cache
    const memoryValue = memoryCache.get<T>(cacheKey);
    if (memoryValue !== null) {
      if (this.config.debug) {
        console.log(`[Kuratchi Cache] L2 HIT: ${key}`);
      }
      // Promote to L1
      requestCache?.set(cacheKey, memoryValue);
      return memoryValue;
    }
    
    // L3: KV cache
    const kvValue = await getFromKV<T>(this.kv, cacheKey, this.config.debug);
    if (kvValue !== null) {
      // Promote to L2 and L1
      memoryCache.set(cacheKey, kvValue, this.config.defaultTtlSeconds);
      requestCache?.set(cacheKey, kvValue);
      return kvValue;
    }
    
    if (this.config.debug) {
      console.log(`[Kuratchi Cache] MISS: ${key}`);
    }
    
    return null;
  }
  
  /**
   * Set value in cache (L1 + L2 + L3)
   */
  async set<T>(
    key: string,
    value: T,
    ttlSeconds?: number,
    requestCache?: Map<string, any>
  ): Promise<void> {
    if (!this.config.enabled) return;
    
    const cacheKey = `kuratchi:${key}`;
    const ttl = ttlSeconds ?? this.config.defaultTtlSeconds;
    
    // L1: Request cache
    requestCache?.set(cacheKey, value);
    
    // L2: Memory cache
    memoryCache.set(cacheKey, value, ttl);
    
    // L3: KV cache (async, don't await)
    setInKV(this.kv, cacheKey, value, ttl, this.config.debug);
    
    if (this.config.debug) {
      console.log(`[Kuratchi Cache] SET: ${key} (TTL: ${ttl}s)`);
    }
  }
  
  /**
   * Delete value from all cache layers
   */
  async delete(key: string, requestCache?: Map<string, any>): Promise<void> {
    const cacheKey = `kuratchi:${key}`;
    
    requestCache?.delete(cacheKey);
    memoryCache.delete(cacheKey);
    await deleteFromKV(this.kv, cacheKey);
  }
  
  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    memoryCache.clear();
    // Note: KV clear would require listing and deleting all keys - expensive operation
  }
  
  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return memoryCache.getStats();
  }
  
  /**
   * Get configuration
   */
  getConfig(): Required<CacheConfig> {
    return { ...this.config };
  }
  
  // ========================================================================
  // Specialized Cache Methods for Database Operations
  // ========================================================================
  
  /**
   * Cache key generators
   */
  static keys = {
    orgDatabase: (orgId: string) => `org:db:${orgId}`,
    orgToken: (orgId: string) => `org:token:${orgId}`,
    schemaSync: (dbName: string, schemaHash: string) => `schema:sync:${dbName}:${schemaHash}`,
    adminDb: () => `admin:db`,
    user: (userId: string) => `user:${userId}`,
    users: (userIds: string[]) => `users:${userIds.sort().join(',')}`,
  };
  
  /**
   * Get cached organization database metadata
   */
  async getOrgDatabaseMeta(
    orgId: string,
    requestCache?: Map<string, any>
  ): Promise<{ databaseName: string; workerName: string; token: string } | null> {
    return this.get(CacheManager.keys.orgDatabase(orgId), requestCache);
  }
  
  /**
   * Set cached organization database metadata
   */
  async setOrgDatabaseMeta(
    orgId: string,
    meta: { databaseName: string; workerName: string; token: string },
    requestCache?: Map<string, any>
  ): Promise<void> {
    return this.set(
      CacheManager.keys.orgDatabase(orgId),
      meta,
      this.config.metadataTtlSeconds,
      requestCache
    );
  }
  
  /**
   * Check if schema has been synced recently
   */
  async isSchemaSynced(
    dbName: string,
    schemaHash: string,
    requestCache?: Map<string, any>
  ): Promise<boolean> {
    const synced = await this.get<boolean>(
      CacheManager.keys.schemaSync(dbName, schemaHash),
      requestCache
    );
    return synced === true;
  }
  
  /**
   * Mark schema as synced
   */
  async markSchemaSynced(
    dbName: string,
    schemaHash: string,
    requestCache?: Map<string, any>
  ): Promise<void> {
    return this.set(
      CacheManager.keys.schemaSync(dbName, schemaHash),
      true,
      this.config.schemaSyncTtlSeconds,
      requestCache
    );
  }
}

// ============================================================================
// Global Cache Instance
// ============================================================================

let globalCacheManager: CacheManager | null = null;

/**
 * Initialize the global cache manager
 */
export function initCache(config: CacheConfig): CacheManager {
  globalCacheManager = new CacheManager(config);
  return globalCacheManager;
}

/**
 * Get the global cache manager
 */
export function getCache(): CacheManager | null {
  return globalCacheManager;
}

// ============================================================================
// Request-Scoped Cache Helper
// ============================================================================

const REQUEST_CACHE_KEY = Symbol('kuratchi_request_cache');

/**
 * Get or create request-scoped cache from locals
 */
export function getRequestCache(locals: any): Map<string, any> {
  if (!locals[REQUEST_CACHE_KEY]) {
    locals[REQUEST_CACHE_KEY] = new Map<string, any>();
  }
  return locals[REQUEST_CACHE_KEY];
}

// ============================================================================
// Exports
// ============================================================================

export { memoryCache };
