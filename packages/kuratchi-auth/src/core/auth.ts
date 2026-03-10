/**
 * @kuratchi/auth â€” Backend Auth Utility
 *
 * The primary API for server-side auth in KuratchiJS.
 * Call getAuth() from load(), actions, or rpc functions to get
 * explicit, on-demand auth context â€” no middleware required.
 *
 * The framework's compiler injects thin session cookie parsing
 * into the Worker entry (via kuratchi.config.ts auth config), which
 * populates locals.auth with the raw cookie. getAuth() then
 * builds the full auth context lazily on first call.
 *
 * @example
 * ```ts
 * // src/server/routes/dashboard.ts
 * import { getAuth } from '@kuratchi/auth';
 *
 * export async function load() {
 *   const auth = getAuth();
 *   const session = await auth.getSession();
 *   if (!session) return auth.redirect('/login');
 *
 *   return {
 *     user: session.user,
 *     permissions: auth.getPermissions(),
 *   };
 * }
 * ```
 */

import { env } from 'cloudflare:workers';
import type { AuthEnv } from './plugin.js';
import { parseSessionCookie } from '../utils/crypto.js';

// ============================================================================
// Types
// ============================================================================

export interface AuthContext {
  /** Get the current session (decrypts cookie, validates, returns session or null) */
  getSession: () => Promise<AuthSession | null>;

  /** Get the current user (shorthand for getSession().user) */
  getUser: () => Promise<any | null>;

  /** Check if the current request is authenticated */
  isAuthenticated: () => Promise<boolean>;

  /** Check a permission against the session's roles */
  hasPermission: (permission: string) => Promise<boolean>;

  /** Check if user has a specific role */
  hasRole: (role: string) => Promise<boolean>;

  /** Get all permissions for the current user (serializable for client) */
  getPermissions: () => Promise<string[]>;

  /** Get the raw session cookie value (before decryption) */
  getSessionCookie: () => string | null;

  /** Get parsed cookies from the request */
  getCookies: () => Record<string, string>;

  /** Build a Set-Cookie header string */
  buildSetCookie: (name: string, value: string, opts?: CookieOptions) => string;

  /** Build a clear-cookie header string */
  buildClearCookie: (name: string) => string;

  /** Create a redirect Response */
  redirect: (url: string, status?: number) => Response;

  /** Create a 401/403 error Response */
  forbidden: (message?: string) => Response;

  /** Create a JSON Response */
  json: (data: any, status?: number) => Response;

  /** Get auth env values (AUTH_SECRET, etc.) */
  getAuthEnv: () => AuthEnv;

  /** Get the request-scoped locals */
  getLocals: () => Record<string, any>;

  /** Get the raw request */
  getRequest: () => Request;

  /** Get the Worker env bindings */
  getEnv: () => Record<string, any>;
}

export interface AuthSession {
  userId: string;
  email?: string;
  organizationId?: string;
  user?: any;
  roles?: string[];
  permissions?: string[];
  expiresAt?: string;
  [key: string]: any;
}

export interface CookieOptions {
  expires?: Date;
  maxAge?: number;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

export interface GetAuthOptions {
  /**
   * Custom env resolver â€” override automatic env resolution.
   * If not provided, reads AUTH_SECRET and other keys directly from env.
   */
  getEnv?: (env: Record<string, any>) => AuthEnv;

  /**
   * Map env binding names to auth env keys.
   * Example: { AUTH_SECRET: 'MY_AUTH_SECRET' }
   */
  envMap?: Record<string, string>;

  /**
   * Custom session decoder â€” override the default AES-GCM cookie decryption.
   * Useful for JWT tokens or external session stores.
   */
  decodeSession?: (cookie: string, secret: string) => Promise<AuthSession | null>;

  /**
   * Custom session loader â€” called after cookie decryption to load full session from DB.
   * Receives the decoded session payload and should return the enriched session.
   */
  loadSession?: (decoded: AuthSession, env: Record<string, any>) => Promise<AuthSession | null>;

  /**
   * Static role â†’ permissions map for hasPermission/hasRole checks.
   * Example: { admin: ['*'], editor: ['posts.*', 'comments.*'] }
   */
  permissions?: Record<string, string[]>;

  /**
   * Framework context â€” provide env, request, and locals directly.
   * If not provided, getAuth() reads from KuratchiJS's module-scoped context
   * (getEnv/getRequest/getLocals from KuratchiJS/runtime/context.js).
   */
  context?: {
    env: Record<string, any>;
    request: Request;
    locals: Record<string, any>;
  };
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Resolve auth env values from Worker env bindings.
 */
function resolveAuthEnv(env: Record<string, any>, envMap?: Record<string, string>): AuthEnv {
  const pick = (key: string): string | undefined => {
    if (envMap?.[key]) {
      const val = env[envMap[key]];
      if (val !== undefined && val !== null && String(val).length > 0) return String(val);
    }
    const val = env[key];
    if (val !== undefined && val !== null && String(val).length > 0) return String(val);
    return undefined;
  };

  return {
    AUTH_SECRET: pick('AUTH_SECRET') || pick('kuratchi_AUTH_SECRET') || '',
    ORIGIN: pick('ORIGIN') || pick('APP_ORIGIN'),
    RESEND_API_KEY: pick('RESEND_API_KEY'),
    EMAIL_FROM: pick('EMAIL_FROM'),
    GOOGLE_CLIENT_ID: pick('GOOGLE_CLIENT_ID'),
    GOOGLE_CLIENT_SECRET: pick('GOOGLE_CLIENT_SECRET'),
    GITHUB_CLIENT_ID: pick('GITHUB_CLIENT_ID'),
    GITHUB_CLIENT_SECRET: pick('GITHUB_CLIENT_SECRET'),
    TURNSTILE_SECRET: pick('TURNSTILE_SECRET') || pick('CLOUDFLARE_TURNSTILE_SECRET'),
    TURNSTILE_SITE_KEY: pick('TURNSTILE_SITE_KEY') || pick('CLOUDFLARE_TURNSTILE_SITE_KEY'),
  };
}

/**
 * Check if a permission matches a pattern (supports wildcards).
 * 'posts.*' matches 'posts.create', 'posts.delete', etc.
 * '*' matches everything.
 */
function matchPermission(pattern: string, permission: string): boolean {
  if (pattern === '*') return true;
  if (pattern === permission) return true;
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2);
    return permission.startsWith(prefix + '.') || permission === prefix;
  }
  return false;
}

/**
 * Get auth context for the current request.
 *
 * This is the primary API for backend auth. It reads from the
 * framework's request-scoped context (set by the compiler-injected
 * session init) and provides lazy, cached auth operations.
 *
 * @param options - Optional configuration for env resolution, session decoding, etc.
 */
export function getAuth(options: GetAuthOptions = {}): AuthContext {
  // Resolve framework context: either from explicit options or from KuratchiJS globals
  let _env: Record<string, any>;
  let _request: Request;
  let _locals: Record<string, any>;

  if (options.context) {
    // Explicit context provided (e.g., from load/action/rpc args)
    _env = options.context.env;
    _request = options.context.request;
    _locals = options.context.locals;
  } else {
    // Read from KuratchiJS globals set by the compiler-generated Worker entry:
    //   __kuratchi_context__  â†’ request, locals  (per-request)
    //   env â†’ env bindings   (via `import { env } from ‘cloudflare:workers’`)
    try {
      const dezContext = (globalThis as any).__kuratchi_context__;
      _env = env as unknown as Record<string, any>;
      _request = dezContext?.request ?? new Request('http://localhost');
      _locals = dezContext?.locals ?? {};
    } catch {
      _env = {};
      _request = new Request('http://localhost');
      _locals = {};
    }
  }

  // Resolve auth env
  const authEnv = options.getEnv
    ? options.getEnv(_env)
    : resolveAuthEnv(_env, options.envMap);

  // Cached session (resolved once per getAuth() call)
  let _session: AuthSession | null | undefined = undefined;
  let _sessionPromise: Promise<AuthSession | null> | null = null;

  const getSessionCookie = (): string | null => {
    return _locals.auth?.sessionCookie || null;
  };

  const getCookies = (): Record<string, string> => {
    return _locals.auth?.cookies || {};
  };

  const resolveSession = async (): Promise<AuthSession | null> => {
    if (_session !== undefined) return _session;

    const cookie = getSessionCookie();
    if (!cookie) {
      _session = null;
      return null;
    }

    if (!authEnv.AUTH_SECRET) {
      console.error('[kuratchi/auth] AUTH_SECRET not set â€” cannot decrypt session cookie. Add it to .dev.vars or Workers secrets.');
      _session = null;
      return null;
    }

    try {
      // Custom decoder
      let decoded: AuthSession | null = null;
      if (options.decodeSession) {
        decoded = await options.decodeSession(cookie, authEnv.AUTH_SECRET);
      } else {
        // Default: AES-GCM decryption via parseSessionCookie
        const parsed = await parseSessionCookie(authEnv.AUTH_SECRET, cookie);
        if (parsed) {
          // The cookie contains { orgId, tokenHash } â€” build session from it
          decoded = {
            userId: '', // Will be enriched by loadSession
            organizationId: parsed.orgId,
            tokenHash: parsed.tokenHash,
          };
        }
      }

      if (!decoded) {
        _session = null;
        return null;
      }

      // Check expiry
      if (decoded.expiresAt && new Date(decoded.expiresAt) < new Date()) {
        _session = null;
        return null;
      }

      // Custom session loader (e.g., enrich from DB)
      if (options.loadSession) {
        decoded = await options.loadSession(decoded, _env);
      }

      _session = decoded;

      // Also set on locals for downstream access
      _locals.session = decoded;
      _locals.user = decoded?.user || null;

      return decoded;
    } catch (e) {
      console.warn('[kuratchi/auth] Failed to decrypt session cookie:', e);
      _session = null;
      return null;
    }
  };

  return {
    getSession: async () => {
      if (_sessionPromise) return _sessionPromise;
      _sessionPromise = resolveSession();
      return _sessionPromise;
    },

    getUser: async () => {
      const session = await resolveSession();
      return session?.user || null;
    },

    isAuthenticated: async () => {
      const session = await resolveSession();
      return session !== null;
    },

    hasPermission: async (permission: string) => {
      const session = await resolveSession();
      if (!session) return false;

      // Check session-level permissions first
      if (session.permissions?.some((p: string) => matchPermission(p, permission))) {
        return true;
      }

      // Check role-based permissions from options
      if (options.permissions && session.roles) {
        for (const role of session.roles) {
          const rolePerms = options.permissions[role];
          if (rolePerms?.some(p => matchPermission(p, permission))) {
            return true;
          }
        }
      }

      return false;
    },

    hasRole: async (role: string) => {
      const session = await resolveSession();
      return session?.roles?.includes(role) ?? false;
    },

    getPermissions: async () => {
      const session = await resolveSession();
      if (!session) return [];

      const perms = new Set<string>(session.permissions || []);

      // Expand role-based permissions
      if (options.permissions && session.roles) {
        for (const role of session.roles) {
          const rolePerms = options.permissions[role];
          if (rolePerms) {
            for (const p of rolePerms) perms.add(p);
          }
        }
      }

      return Array.from(perms);
    },

    getSessionCookie,
    getCookies,

    buildSetCookie: (name: string, value: string, opts?: CookieOptions) => {
      const parts = [`${name}=${value}`];
      parts.push(`Path=${opts?.path || '/'}`);
      if (opts?.httpOnly !== false) parts.push('HttpOnly');
      if (opts?.secure !== false) parts.push('Secure');
      parts.push(`SameSite=${opts?.sameSite || 'Lax'}`);
      if (opts?.expires) parts.push(`Expires=${opts.expires.toUTCString()}`);
      if (opts?.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
      return parts.join('; ');
    },

    buildClearCookie: (name: string) => {
      return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
    },

    redirect: (url: string, status = 302) => {
      // Prevent open redirect attacks. Relative paths (starting with /) are always
      // allowed. Absolute URLs must match the request's own origin; any external
      // origin or non-http scheme (e.g. javascript:) is rejected and replaced with '/'.
      let safe = url;
      const isRelativePath = url.startsWith('/') && !url.startsWith('//');
      if (!isRelativePath) {
        try {
          const target = new URL(url);
          const reqOrigin = new URL(_request.url).origin;
          if (target.origin !== reqOrigin) {
            console.warn(`[kuratchi/auth] Blocked open redirect to external origin: ${url}`);
            safe = '/';
          }
        } catch {
          // URL parsing failed (e.g. javascript:alert(1)) — reject.
          safe = '/';
        }
      }
      return new Response(null, { status, headers: { Location: safe } });
    },

    forbidden: (message = 'Forbidden') => {
      return new Response(JSON.stringify({ error: message }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      });
    },

    json: (data: any, status = 200) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    },

    getAuthEnv: () => authEnv,
    getLocals: () => _locals,
    getRequest: () => _request,
    getEnv: () => _env,
  };
}



