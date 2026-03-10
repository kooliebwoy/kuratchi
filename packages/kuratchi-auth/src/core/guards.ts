/**
 * @kuratchi/auth â€” Guards API
 *
 * Route protection that runs before route handlers.
 * Configure in kuratchi.config.ts, or call requireAuth() in server functions.
 *
 * @example
 * ```ts
 * // In kuratchi.config.ts:
 * auth: {
 *   guards: {
 *     paths: ['/admin/*', '/dashboard/*'],
 *     exclude: ['/admin/login'],
 *     redirectTo: '/auth/login',
 *   }
 * }
 *
 * // Or call directly in a server function:
 * import { requireAuth } from '@kuratchi/auth';
 * const user = await requireAuth(); // throws redirect if not authenticated
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export interface GuardsConfig {
  /** Paths to protect (glob patterns). If empty, protects all paths. */
  paths?: string[];
  /** Paths to exclude from protection (glob patterns) */
  exclude?: string[];
  /** Redirect URL if not authenticated (default: '/auth/login') */
  redirectTo?: string;
}

// ============================================================================
// Module state
// ============================================================================

let _config: GuardsConfig | null = null;

/**
 * Configure route guards. Called automatically by the compiler from kuratchi.config.ts.
 */
export function configureGuards(config: GuardsConfig): void {
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
  };
}

// ============================================================================
// Pattern matching
// ============================================================================

function _matchPattern(pathname: string, pattern: string): boolean {
  // /admin/* should match /admin, /admin/, /admin/roles, etc.
  if (pattern.endsWith('/*')) {
    const base = pattern.slice(0, -2); // '/admin'
    if (pathname === base || pathname.startsWith(base + '/')) return true;
    return false;
  }
  // Escape all regex metacharacters first, then restore * as a glob wildcard.
  // Without this, a pattern like `/auth.login` would match `/authXlogin` etc.
  const regexStr = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // escape all metacharacters (including *)
    .replace(/\\\*/g, '.*');                 // un-escape * → glob wildcard
  return new RegExp(`^${regexStr}$`).test(pathname);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Check if the current request should be guarded.
 * Called by the compiler-generated worker entry before route handlers.
 * Returns a redirect Response if not authenticated, or null to proceed.
 */
export function checkGuard(): Response | null {
  if (!_config) return null;

  const { request, locals } = _getContext();
  if (!request) return null;

  const url = new URL(request.url);
  const pathname = url.pathname;

  // Skip internal asset routes
  if (pathname.startsWith('/_assets/')) return null;

  // Check if path is protected
  const paths = _config.paths || [];
  const exclude = _config.exclude || [];

  if (paths.length > 0) {
    const included = paths.some(p => _matchPattern(pathname, p));
    if (!included) return null;
  }

  if (exclude.length > 0) {
    const excluded = exclude.some(p => _matchPattern(pathname, p));
    if (excluded) return null;
  }

  // SECURITY NOTE: This check is cookie *presence* only — it does NOT decrypt or
  // validate the session. Any request carrying any value for the session cookie
  // (including forged/malformed values) will pass this guard. Route handlers MUST
  // call getCurrentUser() or getAuth().getSession() to perform actual session
  // validation and must not assume the guard implies a verified session.
  const sessionCookie = locals.auth?.sessionCookie;
  if (sessionCookie) return null; // Has session cookie — allow through (presence only)

  // Not authenticated â€” redirect
  const redirectTo = _config.redirectTo || '/auth/login';
  return new Response(null, {
    status: 302,
    headers: { Location: redirectTo },
  });
}

/**
 * Callable guard for use in server functions.
 * Returns the current user or redirects if not authenticated.
 *
 * @example
 * ```ts
 * const user = await requireAuth();
 * // If we get here, user is authenticated
 * ```
 */
export async function requireAuth(options?: {
  redirectTo?: string;
}): Promise<Record<string, any>> {
  const { getCurrentUser } = await import('./credentials.js');
  const user = await getCurrentUser();

  if (!user) {
    const { locals } = _getContext();
    locals.__redirectTo = options?.redirectTo || _config?.redirectTo || '/auth/login';
    throw new Error('Authentication required');
  }

  return user;
}



