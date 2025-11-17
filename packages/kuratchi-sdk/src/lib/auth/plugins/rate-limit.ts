/**
 * Rate limit plugin - Basic request throttling for auth routes
 * Applies default protections to sign-in/sign-up flows and exposes
 * a configurable interface for additional routes.
 */

import type { AuthPlugin, PluginContext } from '../core/plugin.js';

type IdentifierResolver = (ctx: PluginContext) => Promise<string | null> | string | null;

export interface RateLimitRouteConfig {
  /** Unique identifier for the route (used in storage key / headers) */
  id?: string;
  /** Path matcher. Accepts literal paths or wildcard globs ("/auth/*") or RegExp */
  path: string | RegExp;
  /** HTTP methods to match (defaults to all methods) */
  methods?: string[];
  /** Maximum number of requests allowed within the window */
  maxRequests?: number;
  /** Window duration in milliseconds */
  windowMs?: number;
  /** Custom error message when limit is exceeded */
  message?: string;
  /** Optional identifier resolver. Defaults to client IP address */
  identifier?: IdentifierResolver;
}

export interface RateLimitPluginOptions {
  /** Default window duration in ms (applies when route config does not specify) */
  defaultWindowMs?: number;
  /** Default max requests (applies when route config does not specify) */
  defaultMaxRequests?: number;
  /**
   * KV namespace binding name (wrangler.toml). When provided and available,
   * counts will be stored in KV for cross-instance consistency.
   */
  kvBinding?: string;
  /**
   * Friendly KV namespace configured via storage plugin (defaults to
   * `rateLimit` then `default` when available).
   */
  kvNamespace?: string;
  /** Prefix for rate limit keys (defaults to 'ratelimit') */
  keyPrefix?: string;
  /** Custom routes. Merged with defaults when `includeDefaultRoutes` is true */
  routes?: RateLimitRouteConfig[];
  /** Include default sign-in / sign-up routes */
  includeDefaultRoutes?: boolean;
  /** Override plugin priority (lower runs earlier) */
  priority?: number;
}

interface RateLimitRecord {
  count: number;
  expiresAt: number;
}

interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<RateLimitRecord>;
}

interface NormalizedRateLimitRoute extends RateLimitRouteConfig {
  id: string;
  regex: RegExp;
  identifierResolver: IdentifierResolver;
}

class MemoryRateLimitStore implements RateLimitStore {
  private readonly cache = new Map<string, RateLimitRecord>();

  async increment(key: string, windowMs: number): Promise<RateLimitRecord> {
    const now = Date.now();
    const existing = this.cache.get(key);

    if (!existing || existing.expiresAt <= now) {
      const record = { count: 1, expiresAt: now + windowMs };
      this.cache.set(key, record);
      return record;
    }

    const updated = { count: existing.count + 1, expiresAt: existing.expiresAt };
    this.cache.set(key, updated);
    return updated;
  }
}

type RateLimitKVNamespace = {
  get(
    key: string,
    type?:
      | 'text'
      | 'json'
      | 'arrayBuffer'
      | 'stream'
      | { type?: 'text' | 'json' | 'arrayBuffer' | 'stream'; cacheTtl?: number }
  ): Promise<any>;
  put(key: string, value: string, options?: { expiration?: number; expirationTtl?: number; metadata?: any }): Promise<void>;
};

class KvRateLimitStore implements RateLimitStore {
  constructor(private readonly kv: RateLimitKVNamespace, private readonly prefix: string) {}

  async increment(key: string, windowMs: number): Promise<RateLimitRecord> {
    const storageKey = `${this.prefix}:${key}`;
    const now = Date.now();

    try {
      const existing = await this.kv.get(storageKey, 'json') as RateLimitRecord | null;
      if (!existing || !existing.expiresAt || existing.expiresAt <= now) {
        const record = { count: 1, expiresAt: now + windowMs };
        await this.kv.put(storageKey, JSON.stringify(record), {
          expirationTtl: Math.max(1, Math.ceil(windowMs / 1000))
        });
        return record;
      }

      const updated: RateLimitRecord = {
        count: existing.count + 1,
        expiresAt: existing.expiresAt
      };

      const ttlSeconds = Math.max(1, Math.ceil((updated.expiresAt - now) / 1000));
      await this.kv.put(storageKey, JSON.stringify(updated), { expirationTtl: ttlSeconds });
      return updated;
    } catch (error) {
      console.warn('[Kuratchi Auth] Failed to use KV for rate limiting:', error);
      // Fallback to in-memory store if KV operation fails
      return memoryStore.increment(storageKey, windowMs);
    }
  }
}

const globalStoreSymbol = Symbol.for('kuratchi.rateLimit.memoryStore');
const memoryStore: MemoryRateLimitStore = (() => {
  const globalObject = globalThis as any;
  if (!globalObject[globalStoreSymbol]) {
    globalObject[globalStoreSymbol] = new MemoryRateLimitStore();
  }
  return globalObject[globalStoreSymbol] as MemoryRateLimitStore;
})();

const DEFAULT_ROUTES: RateLimitRouteConfig[] = [
  {
    id: 'auth.signin.page',
    path: '/auth/signin',
    methods: ['POST'],
    maxRequests: 10,
    windowMs: 60_000,
    message: 'Too many sign in attempts. Please wait before trying again.'
  },
  {
    id: 'auth.credentials.login',
    path: '/auth/credentials/login',
    methods: ['POST'],
    maxRequests: 10,
    windowMs: 60_000,
    message: 'Too many login attempts. Please try again later.'
  },
  {
    id: 'auth.signup.page',
    path: '/auth/signup',
    methods: ['POST'],
    maxRequests: 5,
    windowMs: 60_000,
    message: 'Too many sign up attempts. Please wait before trying again.'
  }
];

function normalizePathMatcher(path: string | RegExp): RegExp {
  if (path instanceof RegExp) return path;

  const hasWildcard = path.includes('*');
  const trimmed = path !== '/' && path.endsWith('/') ? path.slice(0, -1) : path;

  const escaped = trimmed
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\*/g, '.*');

  const optionalTrailingSlash = !hasWildcard && trimmed !== '/' ? '/?' : '';
  return new RegExp(`^${escaped}${optionalTrailingSlash}$`, 'i');
}

function toIdentifierResolver(config?: IdentifierResolver): IdentifierResolver {
  if (typeof config === 'function') {
    return config;
  }

  return (ctx: PluginContext) => {
    const ip =
      ctx.event.request.headers.get('cf-connecting-ip') ||
      ctx.event.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      (ctx.event as any).getClientAddress?.() ||
      ctx.event.request.headers.get('x-real-ip');

    return ip || 'unknown';
  };
}

function resolveKvNamespace(ctx: PluginContext, options: RateLimitPluginOptions): RateLimitKVNamespace | null {
  const platformEnv = (ctx.event as any)?.platform?.env as Record<string, RateLimitKVNamespace | undefined> | undefined;

  if (options.kvBinding && platformEnv?.[options.kvBinding]) {
    return platformEnv[options.kvBinding] ?? null;
  }

  const kvNamespace = options.kvNamespace || 'rateLimit';
  const kvFromLocals = ctx.locals?.kuratchi?.kv?.[kvNamespace] || ctx.locals?.kuratchi?.kv?.default;
  if (kvFromLocals) {
    return kvFromLocals;
  }

  if (platformEnv) {
    const binding = platformEnv[kvNamespace];
    if (binding) return binding;
  }

  return null;
}

function buildStore(ctx: PluginContext, options: RateLimitPluginOptions): RateLimitStore {
  const kv = resolveKvNamespace(ctx, options);
  if (kv) {
    return new KvRateLimitStore(kv, options.keyPrefix || 'ratelimit');
  }
  return memoryStore;
}

export function rateLimitPlugin(options: RateLimitPluginOptions = {}): AuthPlugin {
  const defaultWindowMs = options.defaultWindowMs ?? 60_000;
  const defaultMaxRequests = options.defaultMaxRequests ?? 10;
  const includeDefaults = options.includeDefaultRoutes ?? true;

  const configuredRoutes: NormalizedRateLimitRoute[] = [
    ...(includeDefaults ? DEFAULT_ROUTES : []),
    ...(options.routes || [])
  ].map(route => ({
    ...route,
    id: route.id || (typeof route.path === 'string' ? route.path : route.path.toString()),
    regex: normalizePathMatcher(route.path),
    identifierResolver: toIdentifierResolver(route.identifier)
  })) as NormalizedRateLimitRoute[];

  return {
    name: 'rate-limit',
    priority: options.priority ?? 15,

    async onRequest(ctx) {
      const url = new URL(ctx.event.request.url);
      const method = ctx.event.request.method.toUpperCase();

      const matchedRoute = configuredRoutes.find(route => {
        if (!route.regex.test(url.pathname)) return false;
        if (route.methods && route.methods.length > 0) {
          return route.methods.map(m => m.toUpperCase()).includes(method);
        }
        return true;
      });

      if (!matchedRoute) {
        return;
      }

      const identifier = await matchedRoute.identifierResolver(ctx);
      if (!identifier) {
        return;
      }

      const windowMs = matchedRoute.windowMs ?? defaultWindowMs;
      const maxRequests = matchedRoute.maxRequests ?? defaultMaxRequests;
      const store = buildStore(ctx, options);

      const record = await store.increment(`${matchedRoute.id}:${identifier}`, windowMs);
      const remaining = Math.max(0, maxRequests - record.count);

      ctx.locals.kuratchi = ctx.locals.kuratchi || {};
      ctx.locals.kuratchi.rateLimit = ctx.locals.kuratchi.rateLimit || {};
      ctx.locals.kuratchi.rateLimit[matchedRoute.id!] = {
        limit: maxRequests,
        remaining,
        reset: Math.ceil(record.expiresAt / 1000)
      };

      if (record.count > maxRequests) {
        const retryAfter = Math.max(1, Math.ceil((record.expiresAt - Date.now()) / 1000));
        const body = JSON.stringify({
          error: 'too_many_requests',
          message: matchedRoute.message || 'Too many requests. Please try again later.'
        });

        return new Response(body, {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': String(maxRequests),
            'X-RateLimit-Remaining': String(Math.max(0, maxRequests - (record.count - 1))),
            'X-RateLimit-Reset': Math.ceil(record.expiresAt / 1000).toString()
          }
        });
      }
    }
  };
}

