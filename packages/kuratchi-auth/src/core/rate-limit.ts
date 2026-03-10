/**
 * @kuratchi/auth â€” Rate Limiting API
 *
 * Config-driven request throttling. Runs in the worker entry before route handlers.
 *
 * @example
 * ```ts
 * // In kuratchi.config.ts:
 * auth: {
 *   rateLimit: {
 *     routes: [
 *       { path: '/auth/login', methods: ['POST'], maxRequests: 10, windowMs: 60000 },
 *       { path: '/auth/signup', methods: ['POST'], maxRequests: 5, windowMs: 60000 },
 *     ]
 *   }
 * }
 * ```
 */

import { env } from 'cloudflare:workers';

// ============================================================================
// Types
// ============================================================================

export interface RateLimitRouteConfig {
  /** Unique identifier for the route (used in storage key) */
  id?: string;
  /** Path matcher â€” literal path or glob with * */
  path: string;
  /** HTTP methods to match (defaults to all) */
  methods?: string[];
  /** Maximum requests within the window */
  maxRequests?: number;
  /** Window duration in milliseconds */
  windowMs?: number;
  /** Custom error message */
  message?: string;
}

export interface RateLimitConfig {
  /** Default window in ms (default: 60000) */
  defaultWindowMs?: number;
  /** Default max requests (default: 10) */
  defaultMaxRequests?: number;
  /** KV binding name for cross-instance rate limiting (optional) */
  kvBinding?: string;
  /** Key prefix (default: 'ratelimit') */
  keyPrefix?: string;
  /** Route-specific rate limit configs */
  routes?: RateLimitRouteConfig[];
}

interface RateLimitRecord {
  count: number;
  expiresAt: number;
}

// ============================================================================
// Module state
// ============================================================================

let _config: RateLimitConfig | null = null;

// In-memory store (per-isolate, resets on cold start)
const _store = new Map<string, RateLimitRecord>();

/**
 * Configure rate limiting. Called automatically by the compiler from kuratchi.config.ts.
 */
export function configureRateLimit(config: RateLimitConfig): void {
  _config = config;
}

// ============================================================================
// Framework context
// ============================================================================

function _getContext() {
  const dezContext = (globalThis as any).__kuratchi_context__;
  return {
    request: dezContext?.request as Request | undefined,
    locals: dezContext?.locals as Record<string, any> ?? {},
    env: env as unknown as Record<string, any>,
  };
}

// ============================================================================
// Pattern matching
// ============================================================================

function _matchPath(pathname: string, pattern: string): boolean {
  const trimmed = pattern !== '/' && pattern.endsWith('/') ? pattern.slice(0, -1) : pattern;
  const escaped = trimmed
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\*/g, '.*');
  return new RegExp(`^${escaped}/?$`, 'i').test(pathname);
}

// ============================================================================
// Store operations
// ============================================================================

async function _increment(key: string, windowMs: number, kvBinding?: any): Promise<RateLimitRecord> {
  const now = Date.now();

  // Try KV if available
  if (kvBinding) {
    try {
      const prefix = _config?.keyPrefix || 'ratelimit';
      const storageKey = `${prefix}:${key}`;
      const existing = await kvBinding.get(storageKey, 'json') as RateLimitRecord | null;

      if (!existing || existing.expiresAt <= now) {
        const record = { count: 1, expiresAt: now + windowMs };
        await kvBinding.put(storageKey, JSON.stringify(record), {
          expirationTtl: Math.max(1, Math.ceil(windowMs / 1000)),
        });
        return record;
      }

      const updated = { count: existing.count + 1, expiresAt: existing.expiresAt };
      const ttl = Math.max(1, Math.ceil((updated.expiresAt - now) / 1000));
      await kvBinding.put(storageKey, JSON.stringify(updated), { expirationTtl: ttl });
      return updated;
    } catch {
      // Fall through to memory store
    }
  }

  // Memory store fallback
  const existing = _store.get(key);
  if (!existing || existing.expiresAt <= now) {
    const record = { count: 1, expiresAt: now + windowMs };
    _store.set(key, record);
    return record;
  }

  const updated = { count: existing.count + 1, expiresAt: existing.expiresAt };
  _store.set(key, updated);
  return updated;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Check rate limits for the current request.
 * Called by the compiler-generated worker entry before route handlers.
 * Returns a 429 Response if rate limited, or null to proceed.
 */
export function checkRateLimit(): Promise<Response | null> {
  return _checkRateLimitAsync();
}

async function _checkRateLimitAsync(): Promise<Response | null> {
  if (!_config?.routes?.length) return null;

  const { request, env } = _getContext();
  if (!request) return null;

  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const pathname = url.pathname;

  // Find matching route config
  const matched = _config.routes.find(route => {
    if (!_matchPath(pathname, route.path)) return false;
    if (route.methods?.length) {
      return route.methods.map(m => m.toUpperCase()).includes(method);
    }
    return true;
  });

  if (!matched) return null;

  // Use cf-connecting-ip only — set by Cloudflare and cannot be spoofed by clients.
  // x-forwarded-for is deliberately excluded: it is client-controlled and would allow
  // an attacker to rotate IPs and bypass per-IP rate limits.
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';

  const routeId = matched.id || matched.path;
  const windowMs = matched.windowMs ?? _config.defaultWindowMs ?? 60_000;
  const maxRequests = matched.maxRequests ?? _config.defaultMaxRequests ?? 10;

  // Get KV binding if configured
  const kvBinding = _config.kvBinding ? env[_config.kvBinding] : null;

  const record = await _increment(`${routeId}:${ip}`, windowMs, kvBinding);

  if (record.count > maxRequests) {
    const retryAfter = Math.max(1, Math.ceil((record.expiresAt - Date.now()) / 1000));
    return new Response(JSON.stringify({
      error: 'too_many_requests',
      message: matched.message || 'Too many requests. Please try again later.',
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': String(maxRequests),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': Math.ceil(record.expiresAt / 1000).toString(),
      },
    });
  }

  return null;
}

/**
 * Get rate limit info for a specific route (for use in server functions).
 */
export function getRateLimitInfo(routeId: string): { limit: number; remaining: number; reset: number } | null {
  if (!_config?.routes) return null;
  const route = _config.routes.find(r => (r.id || r.path) === routeId);
  if (!route) return null;

  const maxRequests = route.maxRequests ?? _config.defaultMaxRequests ?? 10;
  const key = `${routeId}:unknown`;
  const record = _store.get(key);

  if (!record || record.expiresAt <= Date.now()) {
    return { limit: maxRequests, remaining: maxRequests, reset: 0 };
  }

  return {
    limit: maxRequests,
    remaining: Math.max(0, maxRequests - record.count),
    reset: Math.ceil(record.expiresAt / 1000),
  };
}



