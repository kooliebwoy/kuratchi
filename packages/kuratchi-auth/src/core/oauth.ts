/**
 * @kuratchi/auth â€” OAuth API
 *
 * Ready-to-use server functions for OAuth flows.
 * Configure providers once, then startOAuth/handleOAuthCallback just work.
 *
 * @example
 * ```ts
 * import { configureOAuth, startOAuth, handleOAuthCallback, getOAuthData } from '@kuratchi/auth';
 *
 * configureOAuth({
 *   providers: {
 *     github: {
 *       clientId: env.GITHUB_CLIENT_ID,
 *       clientSecret: env.GITHUB_CLIENT_SECRET,
 *     },
 *   },
 * });
 * ```
 */

import { env } from 'cloudflare:workers';
import {
  signState,
  verifyState,
  hashToken,
  buildSessionCookie,
  generateSessionToken,
  encryptValue,
} from '../utils/crypto.js';
import { getAuthDbBinding } from './config.js';

// ============================================================================
// Types
// ============================================================================

export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  scopes?: string[];
}

export interface OAuthConfig {
  providers: Record<string, OAuthProviderConfig>;
  /** Redirect after successful OAuth login (default: '/admin') */
  loginRedirect?: string;
  /** Session duration in ms (default: 30 days) */
  sessionDuration?: number;
}

interface ProviderEndpoints {
  authorizeUrl: string;
  tokenUrl: string;
  profileUrl: string;
  defaultScopes: string[];
  parseProfile: (data: any) => { id: string; email: string; name: string | null; image: string | null };
}

// ============================================================================
// Known providers
// ============================================================================

const PROVIDERS: Record<string, ProviderEndpoints> = {
  github: {
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    profileUrl: 'https://api.github.com/user',
    defaultScopes: ['read:user', 'user:email'],
    parseProfile: (data: any) => ({
      id: String(data.id),
      email: data.email?.toLowerCase() || `${data.login}@github.noemail`,
      name: data.name || data.login || null,
      image: data.avatar_url || null,
    }),
  },
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    profileUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    defaultScopes: ['openid', 'email', 'profile'],
    parseProfile: (data: any) => ({
      id: String(data.id),
      email: data.email?.toLowerCase() || '',
      name: data.name || null,
      image: data.picture || null,
    }),
  },
};

// ============================================================================
// Module state
// ============================================================================

let _config: OAuthConfig | null = null;

/**
 * Configure OAuth providers. Call once at module scope.
 */
export function configureOAuth(config: OAuthConfig): void {
  _config = config;
}

/**
 * Get configured OAuth provider info (for UI rendering).
 */
export function getOAuthProviders(): string[] {
  if (!_config) return [];
  return Object.keys(_config.providers).filter(p => {
    const c = _config!.providers[p];
    return !!c.clientId;
  });
}

// ============================================================================
// Framework context
// ============================================================================

function _getEnv(): Record<string, any> {
  return env as unknown as Record<string, any>;
}

function _getContext() {
  const dezContext = (globalThis as any).__kuratchi_context__;
  return {
    request: dezContext?.request as Request | undefined,
    locals: dezContext?.locals as Record<string, any> ?? {},
  };
}

function _getDb(): any {
  const env = _getEnv();
  const bindingName = getAuthDbBinding();
  if (!env[bindingName]) throw new Error(`[kuratchi/auth] No ${bindingName} binding found.`);
  return env[bindingName];
}

function _getSecret(): string {
  const secret = _getEnv().AUTH_SECRET;
  if (!secret) {
    throw new Error(
      '[kuratchi/auth] AUTH_SECRET is not set. Add it to .dev.vars (local) or Workers secrets (production). '
      + 'Auth operations cannot proceed without a secret.'
    );
  }
  return secret;
}

function _getCookieName(): string {
  const { locals } = _getContext();
  return locals.auth?.cookieName || 'kuratchi_session';
}

function _setRedirect(path: string) {
  const { locals } = _getContext();
  locals.__redirectTo = path;
}

function _pushSetCookie(header: string) {
  const { locals } = _getContext();
  if (!locals.__setCookieHeaders) locals.__setCookieHeaders = [];
  locals.__setCookieHeaders.push(header);
}

function _buildSetCookieHeader(name: string, value: string, opts: {
  expires?: Date; httpOnly?: boolean; secure?: boolean; sameSite?: string; path?: string;
}): string {
  const parts = [`${name}=${value}`];
  parts.push(`Path=${opts.path || '/'}`);
  if (opts.httpOnly !== false) parts.push('HttpOnly');
  if (opts.secure !== false) parts.push('Secure');
  parts.push(`SameSite=${opts.sameSite || 'Lax'}`);
  if (opts.expires) parts.push(`Expires=${opts.expires.toUTCString()}`);
  return parts.join('; ');
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get OAuth data for the OAuth page (which providers are configured).
 */
export async function getOAuthData() {
  const { request } = _getContext();
  const url = new URL(request?.url || 'http://localhost');
  const origin = `${url.protocol}//${url.host}`;

  const providers = getOAuthProviders();

  return {
    providers,
    hasGithub: providers.includes('github'),
    hasGoogle: providers.includes('google'),
    origin,
  };
}

/**
 * Start an OAuth flow for a given provider.
 * Reads provider name from FormData or defaults to 'github'.
 */
export async function startOAuth({ formData }: FormData): Promise<void> {
  const providerName = (formData.get('provider') as string) || 'github';
  if (!_config) throw new Error('[kuratchi/auth] OAuth not configured. Call configureOAuth() first.');

  const providerConfig = _config.providers[providerName];
  if (!providerConfig?.clientId) throw new Error(`OAuth provider '${providerName}' not configured.`);

  const endpoints = PROVIDERS[providerName];
  if (!endpoints) throw new Error(`Unknown OAuth provider: ${providerName}`);

  const { request } = _getContext();
  const url = new URL(request?.url || 'http://localhost');
  const origin = `${url.protocol}//${url.host}`;
  const secret = _getSecret();

  const state = await signState(secret, {
    provider: providerName,
    redirectTo: _config.loginRedirect || '/admin',
    ts: Date.now(),
    n: crypto.randomUUID(),
  });

  const authUrl = new URL(endpoints.authorizeUrl);
  authUrl.searchParams.set('client_id', providerConfig.clientId);
  authUrl.searchParams.set('redirect_uri', `${origin}/auth/oauth/${providerName}/callback`);
  authUrl.searchParams.set('scope', (providerConfig.scopes || endpoints.defaultScopes).join(' '));
  authUrl.searchParams.set('state', state);
  if (providerName === 'google') {
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('access_type', 'offline');
  }

  _setRedirect(authUrl.toString());
}

/**
 * Handle OAuth callback. Exchanges code for token, fetches profile,
 * creates/links user, creates session, sets cookie.
 */
export async function handleOAuthCallback(): Promise<{ success?: boolean; error?: string; redirectTo?: string }> {
  const { request } = _getContext();
  const url = new URL(request?.url || 'http://localhost');
  const origin = `${url.protocol}//${url.host}`;

  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  const secret = _getSecret();

  if (!code || !stateParam) return { error: 'Missing code or state parameter' };
  if (!_config) return { error: 'OAuth not configured' };

  // Verify state
  const payload = await verifyState(secret, stateParam);
  if (!payload) return { error: 'Invalid or expired state' };

  const stateData = payload as Record<string, any>;
  if (stateData.ts && Date.now() - stateData.ts > 600000) return { error: 'State expired' };

  const providerName = stateData.provider || 'github';
  const providerConfig = _config.providers[providerName];
  const endpoints = PROVIDERS[providerName];
  if (!providerConfig || !endpoints) return { error: `Unknown provider: ${providerName}` };

  // Exchange code for token
  const tokenBody: Record<string, string> = {
    code,
    client_id: providerConfig.clientId,
    client_secret: providerConfig.clientSecret,
    redirect_uri: `${origin}/auth/oauth/${providerName}/callback`,
  };
  if (providerName === 'google') tokenBody.grant_type = 'authorization_code';

  const tokenRes = await fetch(endpoints.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: new URLSearchParams(tokenBody),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => '');
    console.error('[kuratchi/auth oauth] Token exchange failed:', tokenRes.status, body);
    return { error: 'OAuth authentication failed' };
  }

  const tokenJson: any = await tokenRes.json();
  const access_token = tokenJson.access_token;
  if (!access_token) return { error: 'No access token received' };

  // Fetch profile
  const profileRes = await fetch(endpoints.profileUrl, {
    headers: { 'Authorization': `Bearer ${access_token}`, 'Accept': 'application/json' },
  });
  if (!profileRes.ok) {
    const body = await profileRes.text().catch(() => '');
    console.error('[kuratchi/auth oauth] Profile fetch failed:', profileRes.status, body);
    return { error: 'OAuth authentication failed' };
  }

  const profileData: any = await profileRes.json();
  const profile = endpoints.parseProfile(profileData);

  const db = _getDb();

  // Check if OAuth account already linked
  const existingOAuth = await db.prepare(
    'SELECT userId FROM oauthAccounts WHERE provider = ? AND providerAccountId = ?'
  ).bind(providerName, profile.id).first();

  let user: any;

  if (existingOAuth?.userId) {
    user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(existingOAuth.userId).first();
  } else {
    // Check by email
    user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(profile.email).first();

    if (!user) {
      // Create new user
      await db.prepare(
        'INSERT INTO users (email, name, passwordHash, role, image, emailVerified) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(profile.email, profile.name, null, 'user', profile.image, Date.now()).run();
      user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(profile.email).first();
    }

    // Link OAuth account — encrypt tokens at rest before storing.
    if (user) {
      const encryptedAccessToken = await encryptValue(secret, access_token);
      const encryptedRefreshToken = tokenJson.refresh_token
        ? await encryptValue(secret, tokenJson.refresh_token)
        : null;
      await db.prepare(
        'INSERT INTO oauthAccounts (userId, provider, providerAccountId, accessToken, refreshToken, idToken) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(user.id, providerName, profile.id, encryptedAccessToken, encryptedRefreshToken, null).run();
    }
  }

  if (!user) return { error: 'Failed to create or find user' };

  // Create session
  const sessionToken = generateSessionToken();
  const sessionTokenHash = await hashToken(sessionToken);
  const now = new Date();
  const duration = _config.sessionDuration ?? 30 * 24 * 60 * 60 * 1000;
  const expires = new Date(now.getTime() + duration);

  await db.prepare(
    'INSERT INTO sessions (sessionToken, userId, expires) VALUES (?, ?, ?)'
  ).bind(sessionTokenHash, user.id, expires.getTime()).run();

  const sessionCookie = await buildSessionCookie(secret, 'default', sessionTokenHash);
  const cookieName = _getCookieName();
  _pushSetCookie(_buildSetCookieHeader(cookieName, sessionCookie, {
    expires, httpOnly: true, secure: true, sameSite: 'lax',
  }));

  const redirectTo = stateData.redirectTo || _config.loginRedirect || '/admin';
  _setRedirect(redirectTo);

  return { success: true, redirectTo };
}



