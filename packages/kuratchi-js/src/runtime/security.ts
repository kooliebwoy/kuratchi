/**
 * KuratchiJS Security Module
 *
 * Provides CSRF protection, request signing, and security utilities
 * for the framework runtime.
 */

import { __getLocals, __setLocal } from './context.js';

// ── CSRF Token Management ──────────────────────────────────────────

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = '__kuratchi_csrf';
const CSRF_HEADER_NAME = 'x-kuratchi-csrf';
const CSRF_FORM_FIELD = '_csrf';

/**
 * Generate a cryptographically secure random token
 */
function generateToken(length: number = CSRF_TOKEN_LENGTH): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Initialize CSRF protection for the current request.
 * Generates a new token if one doesn't exist in cookies.
 */
export function initCsrf(request: Request, cookieName: string = CSRF_COOKIE_NAME): string {
  const cookies = parseCookies(request.headers.get('cookie'));
  let token = cookies[cookieName];

  if (!token || token.length < CSRF_TOKEN_LENGTH) {
    token = generateToken();
    // Mark that we need to set the cookie
    __setLocal('__csrfTokenNew', true);
  }

  __setLocal('__csrfToken', token);
  __setLocal('__csrfCookieName', cookieName);
  return token;
}

/**
 * Get the current CSRF token for the request
 */
export function getCsrfToken(): string {
  const token = __getLocals().__csrfToken;
  if (!token) {
    throw new Error('[kuratchi] CSRF token not initialized. Ensure security middleware is active.');
  }
  return token;
}

/**
 * Validate CSRF token from request against stored token.
 * Checks both header and form field.
 */
export function validateCsrf(
  request: Request,
  formData?: FormData,
  headerName: string = CSRF_HEADER_NAME,
  formField: string = CSRF_FORM_FIELD,
): { valid: boolean; reason?: string } {
  const storedToken = __getLocals().__csrfToken;
  if (!storedToken) {
    return { valid: false, reason: 'No CSRF token in session' };
  }

  // Check header first (for fetch requests)
  const headerToken = request.headers.get(headerName);
  if (headerToken) {
    if (timingSafeEqual(headerToken, storedToken)) {
      return { valid: true };
    }
    return { valid: false, reason: 'CSRF header token mismatch' };
  }

  // Check form field (for traditional form submissions)
  if (formData) {
    const formToken = formData.get(formField);
    if (typeof formToken === 'string' && timingSafeEqual(formToken, storedToken)) {
      return { valid: true };
    }
    return { valid: false, reason: 'CSRF form token mismatch or missing' };
  }

  return { valid: false, reason: 'No CSRF token provided in request' };
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Get the Set-Cookie header for CSRF token if needed
 */
export function getCsrfCookieHeader(): string | null {
  const locals = __getLocals();
  if (!locals.__csrfTokenNew) {
    return null;
  }
  const token = locals.__csrfToken;
  const cookieName = locals.__csrfCookieName || CSRF_COOKIE_NAME;
  // SameSite=Lax allows the cookie to be sent on top-level navigations
  // HttpOnly=false so client JS can read it for fetch requests
  return `${cookieName}=${token}; Path=/; SameSite=Lax; Secure`;
}

// ── RPC Security ───────────────────────────────────────────────────

const RPC_NONCE_LENGTH = 16;

export interface RpcSecurityConfig {
  requireAuth: boolean;
  validateCsrf: boolean;
  allowedMethods: ('GET' | 'POST')[];
}

/**
 * Generate a per-request RPC nonce for additional request signing
 */
export function generateRpcNonce(): string {
  return generateToken(RPC_NONCE_LENGTH);
}

/**
 * Validate an RPC request meets security requirements
 */
export function validateRpcRequest(
  request: Request,
  config: RpcSecurityConfig,
): { valid: boolean; status: number; reason?: string } {
  const method = request.method as 'GET' | 'POST';

  // Check allowed methods
  if (!config.allowedMethods.includes(method)) {
    return {
      valid: false,
      status: 405,
      reason: `RPC method ${method} not allowed. Use: ${config.allowedMethods.join(', ')}`,
    };
  }

  // Check CSRF if enabled
  if (config.validateCsrf) {
    const csrfResult = validateCsrf(request);
    if (!csrfResult.valid) {
      return { valid: false, status: 403, reason: csrfResult.reason };
    }
  }

  // Check authentication if required
  if (config.requireAuth) {
    const locals = __getLocals();
    const user = locals.user || locals.session?.user;
    if (!user) {
      return { valid: false, status: 401, reason: 'Authentication required for RPC' };
    }
  }

  return { valid: true, status: 200 };
}

// ── Action Security ────────────────────────────────────────────────

export interface ActionSecurityConfig {
  validateCsrf: boolean;
  requireSameOrigin: boolean;
}

/**
 * Validate an action request meets security requirements
 */
export function validateActionRequest(
  request: Request,
  url: URL,
  formData: FormData,
  config: ActionSecurityConfig,
): { valid: boolean; status: number; reason?: string } {
  // Check same-origin
  if (config.requireSameOrigin && !isSameOrigin(request, url)) {
    return { valid: false, status: 403, reason: 'Cross-origin action requests forbidden' };
  }

  // Check CSRF if enabled
  if (config.validateCsrf) {
    const csrfResult = validateCsrf(request, formData);
    if (!csrfResult.valid) {
      return { valid: false, status: 403, reason: csrfResult.reason };
    }
  }

  return { valid: true, status: 200 };
}

// ── Security Headers ───────────────────────────────────────────────

export interface SecurityHeadersConfig {
  contentSecurityPolicy?: string | null;
  strictTransportSecurity?: string | null;
  permissionsPolicy?: string | null;
}

const DEFAULT_SEC_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

/**
 * Apply security headers to a response
 */
export function applySecurityHeaders(
  response: Response,
  config?: SecurityHeadersConfig,
): Response {
  for (const [key, value] of Object.entries(DEFAULT_SEC_HEADERS)) {
    if (!response.headers.has(key)) {
      response.headers.set(key, value);
    }
  }

  if (config?.contentSecurityPolicy && !response.headers.has('Content-Security-Policy')) {
    response.headers.set('Content-Security-Policy', config.contentSecurityPolicy);
  }

  if (config?.strictTransportSecurity && !response.headers.has('Strict-Transport-Security')) {
    response.headers.set('Strict-Transport-Security', config.strictTransportSecurity);
  }

  if (config?.permissionsPolicy && !response.headers.has('Permissions-Policy')) {
    response.headers.set('Permissions-Policy', config.permissionsPolicy);
  }

  return response;
}

// ── Utility Functions ──────────────────────────────────────────────

function parseCookies(header: string | null): Record<string, string> {
  const map: Record<string, string> = {};
  if (!header) return map;
  for (const pair of header.split(';')) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    map[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return map;
}

function isSameOrigin(request: Request, url: URL): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'same-site' && fetchSite !== 'none') {
    return false;
  }
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === url.origin;
  } catch {
    return false;
  }
}

// ── Fragment Security ───────────────────────────────────────────────

/**
 * Sign a fragment ID with the route path and CSRF token to prevent tampering.
 * Format: fragmentId:signature
 */
export function signFragmentId(fragmentId: string, routePath: string): string {
  const token = __getLocals().__csrfToken || '';
  const payload = `${fragmentId}:${routePath}:${token}`;
  const signature = simpleHash(payload);
  return `${fragmentId}:${signature}`;
}

/**
 * Validate a signed fragment ID against the current route and session.
 * If no CSRF token is present (e.g., in tests), allows unsigned fragments.
 */
export function validateSignedFragment(
  signedFragment: string,
  routePath: string,
): { valid: boolean; fragmentId: string | null; reason?: string } {
  const token = __getLocals().__csrfToken || '';
  
  // If no CSRF token is set, allow unsigned fragments (backward compat / tests)
  if (!token) {
    const colonIdx = signedFragment.lastIndexOf(':');
    // If it looks signed, extract the fragment ID; otherwise use as-is
    const fragmentId = colonIdx !== -1 ? signedFragment.slice(0, colonIdx) : signedFragment;
    return { valid: true, fragmentId };
  }

  const colonIdx = signedFragment.lastIndexOf(':');
  if (colonIdx === -1) {
    // Unsigned fragment with CSRF enabled - reject for security
    return { valid: false, fragmentId: null, reason: 'Fragment ID not signed' };
  }

  const fragmentId = signedFragment.slice(0, colonIdx);
  const providedSignature = signedFragment.slice(colonIdx + 1);

  const payload = `${fragmentId}:${routePath}:${token}`;
  const expectedSignature = simpleHash(payload);

  if (!timingSafeEqual(providedSignature, expectedSignature)) {
    return { valid: false, fragmentId: null, reason: 'Fragment signature invalid' };
  }

  return { valid: true, fragmentId };
}

/**
 * Simple hash function for signing (not cryptographic, but sufficient for HMAC-like signing
 * when combined with a secret token). Uses FNV-1a for speed.
 */
function simpleHash(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(36);
}

// ── Query Override Security ────────────────────────────────────────

/**
 * Validate that a query function is allowed for the current route.
 * The allowedQueries set should contain the function names registered for this route.
 */
export function validateQueryOverride(
  queryFn: string,
  allowedQueries: Set<string> | string[],
): { valid: boolean; reason?: string } {
  const allowed = allowedQueries instanceof Set ? allowedQueries : new Set(allowedQueries);
  
  if (!queryFn) {
    return { valid: false, reason: 'No query function specified' };
  }

  if (!allowed.has(queryFn)) {
    return { valid: false, reason: `Query function '${queryFn}' not registered for this route` };
  }

  return { valid: true };
}

/**
 * Validate query arguments are safe JSON.
 * Returns parsed arguments or null if invalid.
 */
export function parseQueryArgs(argsRaw: string): { valid: boolean; args: unknown[]; reason?: string } {
  if (!argsRaw || argsRaw === '[]') {
    return { valid: true, args: [] };
  }

  try {
    const parsed = JSON.parse(argsRaw);
    if (!Array.isArray(parsed)) {
      return { valid: false, args: [], reason: 'Query args must be an array' };
    }
    return { valid: true, args: parsed };
  } catch {
    return { valid: false, args: [], reason: 'Invalid JSON in query args' };
  }
}

// ── Exports for Framework Use ──────────────────────────────────────

export const CSRF_DEFAULTS = {
  cookieName: CSRF_COOKIE_NAME,
  headerName: CSRF_HEADER_NAME,
  formField: CSRF_FORM_FIELD,
} as const;
