/**
 * @kuratchi/auth â€” Turnstile API
 *
 * Config-driven Cloudflare Turnstile bot protection.
 * Runs in the worker entry before route handlers.
 *
 * @example
 * ```ts
 * // In kuratchi.config.ts:
 * auth: {
 *   turnstile: {
 *     secretEnv: 'TURNSTILE_SECRET',
 *     routes: [
 *       { path: '/auth/login', methods: ['POST'] },
 *       { path: '/auth/signup', methods: ['POST'] },
 *     ]
 *   }
 * }
 * ```
 */

import { env } from 'cloudflare:workers';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const DEFAULT_FIELD_NAMES = ['cf-turnstile-response', 'turnstileToken', 'turnstile_token'];
const DEFAULT_HEADER_NAMES = ['cf-turnstile-token', 'x-turnstile-token'];

// ============================================================================
// Types
// ============================================================================

export interface TurnstileRouteConfig {
  /** Unique identifier (defaults to path) */
  id?: string;
  /** Path matcher â€” literal path or glob with * */
  path: string;
  /** HTTP methods to match (defaults to ['POST']) */
  methods?: string[];
  /** Custom field name to read the token from */
  tokenField?: string;
  /** Custom header name to read the token from */
  tokenHeader?: string;
  /** Override failure message */
  message?: string;
  /** Expected Turnstile action value(s) */
  expectedAction?: string;
}

export interface TurnstileConfig {
  /** Env var name for Turnstile secret (default: 'TURNSTILE_SECRET') */
  secretEnv?: string;
  /** Env var name for Turnstile site key (default: 'TURNSTILE_SITE_KEY') â€” exposed to client */
  siteKeyEnv?: string;
  /** Skip Turnstile verification in dev mode (default: true) */
  skipInDev?: boolean;
  /** Routes that require Turnstile verification */
  routes?: TurnstileRouteConfig[];
}

// ============================================================================
// Module state
// ============================================================================

let _config: TurnstileConfig | null = null;

/**
 * Configure Turnstile. Called automatically by the compiler from kuratchi.config.ts.
 */
export function configureTurnstile(config: TurnstileConfig): void {
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
// Token extraction
// ============================================================================

async function _extractToken(request: Request, route: TurnstileRouteConfig): Promise<string | null> {
  // Check headers first
  const headerNames = route.tokenHeader ? [route.tokenHeader] : DEFAULT_HEADER_NAMES;
  for (const name of headerNames) {
    const val = request.headers.get(name);
    if (val) return val;
  }

  // Check body
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      const cloned = request.clone();
      const json = await cloned.json() as Record<string, any>;
      const fieldNames = route.tokenField ? [route.tokenField] : DEFAULT_FIELD_NAMES;
      for (const name of fieldNames) {
        if (json[name]) return String(json[name]);
      }
    } catch { /* ignore */ }
  }

  if (contentType.includes('form')) {
    try {
      const cloned = request.clone();
      const formData = await cloned.formData();
      const fieldNames = route.tokenField ? [route.tokenField] : DEFAULT_FIELD_NAMES;
      for (const name of fieldNames) {
        const val = formData.get(name);
        if (val) return String(val);
      }
    } catch { /* ignore */ }
  }

  return null;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Check Turnstile verification for the current request.
 * Called by the compiler-generated worker entry before route handlers.
 * Returns a 403 Response if verification fails, or null to proceed.
 */
export function checkTurnstile(): Promise<Response | null> {
  return _checkTurnstileAsync();
}

async function _checkTurnstileAsync(): Promise<Response | null> {
  if (!_config?.routes?.length) return null;

  // Skip in dev mode (default: true)
  if (_config.skipInDev !== false) {
    if ((globalThis as any).__kuratchi_DEV__) return null;
  }

  const { request, env } = _getContext();
  if (!request) return null;

  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const pathname = url.pathname;

  // Find matching route
  const matched = _config.routes.find(route => {
    if (!_matchPath(pathname, route.path)) return false;
    const methods = route.methods || ['POST'];
    return methods.map(m => m.toUpperCase()).includes(method);
  });

  if (!matched) return null;

  // Resolve secret from env
  const secretKey = _config.secretEnv || 'TURNSTILE_SECRET';
  const secret = env[secretKey];
  if (!secret) return null; // No secret configured â€” skip

  // Extract token
  const token = await _extractToken(request, matched);
  if (!token) {
    return new Response(JSON.stringify({
      error: 'turnstile_token_missing',
      message: matched.message || 'Turnstile verification required.',
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify with Cloudflare
  // Use cf-connecting-ip only — cannot be spoofed by clients on CF Workers.
  // x-forwarded-for is excluded as it is client-controlled.
  const ip = request.headers.get('cf-connecting-ip') || undefined;

  const verifyBody: Record<string, string> = { secret, response: token };
  if (ip) verifyBody.remoteip = ip;

  const verifyRes = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(verifyBody),
  });

  const result: any = await verifyRes.json();

  if (!result.success) {
    return new Response(JSON.stringify({
      error: 'turnstile_verification_failed',
      message: matched.message || 'Bot verification failed.',
      details: result['error-codes'],
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check expected action
  if (matched.expectedAction && result.action && result.action !== matched.expectedAction) {
    return new Response(JSON.stringify({
      error: 'turnstile_action_mismatch',
      message: 'Turnstile action mismatch.',
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return null;
}

/**
 * Verify a Turnstile token manually (for use in server functions).
 */
export async function verifyTurnstile(token: string, options?: {
  expectedAction?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { env } = _getContext();
  const secretKey = _config?.secretEnv || 'TURNSTILE_SECRET';
  const secret = env[secretKey];

  if (!secret) return { success: false, error: 'TURNSTILE_SECRET not configured' };

  const { request } = _getContext();
  const ip = request?.headers.get('cf-connecting-ip') || undefined;

  const verifyBody: Record<string, string> = { secret, response: token };
  if (ip) verifyBody.remoteip = ip;

  const res = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(verifyBody),
  });

  const result: any = await res.json();

  if (!result.success) {
    return { success: false, error: result['error-codes']?.join(', ') || 'Verification failed' };
  }

  if (options?.expectedAction && result.action !== options.expectedAction) {
    return { success: false, error: 'Action mismatch' };
  }

  return { success: true };
}



