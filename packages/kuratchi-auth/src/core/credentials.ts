/**
 * @kuratchi/auth â€” Credentials API
 *
 * Ready-to-use server functions for email/password auth.
 * Uses @kuratchi/orm for all database operations.
 *
 * Supports two modes:
 *
 * 1. **Standard** â€” single-tenant, ORM backed by configured D1 binding
 * 2. **Org-aware** â€” multi-tenant, admin D1 for org/user mapping,
 *    per-org Durable Objects for credentials/sessions (via RPC)
 *
 * The credentials plugin owns: binding (D1), defaultRole, redirects.
 * The organizations plugin owns: DO namespace binding.
 * Credentials checks `isOrgAvailable()` to decide mode.
 *
 * @example
 * ```ts
 * import { signUp, signIn, signOut, getCurrentUser } from '@kuratchi/auth';
 *
 * export async function signUpAction({ formData }: FormData) {
 *   await signUp(formData);
 * }
 * ```
 */

import { env } from 'cloudflare:workers';
import {
  hashPassword,
  comparePassword,
  generateSessionToken,
  hashToken,
  buildSessionCookie,
  parseSessionCookie,
} from '../utils/crypto.js';
import { kuratchiORM } from '@kuratchi/orm';
import { isOrgAvailable, getOrgStubByName } from './organization.js';
import { logActivity } from './activity.js';
import { setAuthDbBinding } from './config.js';

// ============================================================================
// Framework context helpers
// ============================================================================

function _getEnv(): Record<string, any> {
  return env as unknown as Record<string, any>;
}

function _getContext() {
  const ctx = (globalThis as any).__kuratchi_context__;
  return {
    request: ctx?.request as Request | undefined,
    locals: ctx?.locals as Record<string, any> ?? {},
  };
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

function _getSessionCookie(): string | null {
  const { locals } = _getContext();
  return locals.auth?.sessionCookie || null;
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
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  path?: string;
}): string {
  const parts = [`${name}=${value}`];
  parts.push(`Path=${opts.path || '/'}`);
  if (opts.httpOnly !== false) parts.push('HttpOnly');
  if (opts.secure !== false) parts.push('Secure');
  parts.push(`SameSite=${opts.sameSite || 'Lax'}`);
  if (opts.expires) parts.push(`Expires=${opts.expires.toUTCString()}`);
  return parts.join('; ');
}

function _buildClearCookieHeader(name: string): string {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

async function _safeLogActivity(
  action: string,
  options?: { detail?: string | Record<string, any>; userId?: number | string | null },
): Promise<void> {
  try {
    await logActivity(action, { detail: options?.detail, userId: options?.userId });
  } catch {
    // Telemetry should never break auth flows.
  }
}

function _errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return String(err);
}

// ============================================================================
// Database â€” ORM against the configured D1 binding
// ============================================================================

/** Get the D1 database as an ORM instance (uses credentials.binding). */
function _getDb(): Record<string, any> {
  const bindingName = _config.binding || 'DB';
  return kuratchiORM(() => {
    const env = _getEnv();
    if (!env[bindingName]) throw new Error(`[kuratchi/auth] No ${bindingName} binding found in env.`);
    return env[bindingName];
  });
}

/** Generate a unique DO name from an org name. */
function _generateDoName(orgName: string): string {
  const sanitized = orgName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 32);
  return `org-${sanitized}-${crypto.randomUUID().substring(0, 8)}`;
}

function _getOrgNameFromRow(row: Record<string, any> | null | undefined): string | null {
  if (!row) return null;
  return row.orgName ?? null;
}

function _getDoNameFromRow(row: Record<string, any> | null | undefined): string | null {
  if (!row) return null;
  return row.doName ?? null;
}

function _getOrgIdFromMapping(row: Record<string, any> | null | undefined): string | null {
  if (!row) return null;
  return row.orgId ?? null;
}

async function _findMappingByEmail(db: any, email: string): Promise<Record<string, any> | null> {
  const m = await db.userMappings.where({ email }).first();
  return m.data ?? null;
}

// ============================================================================
// Configuration
// ============================================================================

export interface CredentialsConfig {
  /** D1 binding name for auth database (default: 'DB') */
  binding?: string;
  /** Default role for new users (default: 'user') */
  defaultRole?: string;
  /** Session duration in ms (default: 30 days) */
  sessionDuration?: number;
  /** Minimum password length (default: 8) */
  minPasswordLength?: number;
  /** Redirect after signup (default: '/auth/login') */
  signUpRedirect?: string;
  /** Redirect after signin (default: '/admin') */
  signInRedirect?: string;
  /** Redirect after signout (default: '/auth/login') */
  signOutRedirect?: string;
  /** Fields to exclude from the returned user object */
  excludeFields?: string[];
}

let _config: CredentialsConfig = {};

/**
 * Configure credentials behavior. Called by the compiler from kuratchi.config.ts.
 */
export function configureCredentials(config: CredentialsConfig): void {
  _config = { ..._config, ...config };
  setAuthDbBinding(_config.binding);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Sign up a new user with email/password.
 *
 * Standard mode: inserts user via ORM into D1, redirects.
 * Org mode: creates org + mapping in admin D1, creates user
 *           in org DO via RPC, auto-creates session, redirects.
 */
export async function signUp({ formData }: FormData): Promise<void> {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;
  const name = (formData.get('name') as string)?.trim() || null;
  try {

  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  const minLen = _config.minPasswordLength ?? 8;
  if (password.length < minLen) {
    throw new Error(`Password must be at least ${minLen} characters`);
  }

  const secret = _getSecret();
  const passwordHash = await hashPassword(password, undefined, secret);
  const role = _config.defaultRole ?? 'user';

  // â”€â”€ Org-aware mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (isOrgAvailable()) {
    const orgName = (formData.get('orgName') as string)?.trim();
    if (!orgName) {
      throw new Error('Organization name is required');
    }

    const db = _getDb();

    // Check if email is already mapped
    const existing = await _findMappingByEmail(db, email);
    if (existing) {
      throw new Error('An account with this email already exists');
    }

    // Generate DO name and create org record (contract: organizations.orgName/doName)
    const doName = _generateDoName(orgName);
    const orgId = crypto.randomUUID();
    await db.organizations.insert({ id: orgId, orgName, doName, email });
    const org = await db.organizations.where({ id: orgId }).first();
    await db.userMappings.insert({ id: crypto.randomUUID(), orgId, email });

    // Create user in org DO via RPC
    const stub = getOrgStubByName(doName)!;
    const newUser = await stub.createUser({ email, name, passwordHash, role });

    // Auto-login: create session in org DO
    const sessionToken = generateSessionToken();
    const sessionTokenHash = await hashToken(sessionToken);
    const duration = _config.sessionDuration ?? 30 * 24 * 60 * 60 * 1000;
    const expires = new Date(Date.now() + duration);

    await stub.createSession({
      sessionToken: sessionTokenHash,
      userId: newUser.id,
      expires: expires.getTime(),
    });

    const sessionCookie = await buildSessionCookie(secret, doName, sessionTokenHash);
    const { locals } = _getContext();
    if (!locals.auth) locals.auth = {};
    locals.auth.sessionCookie = sessionCookie;
    _pushSetCookie(_buildSetCookieHeader(_getCookieName(), sessionCookie, {
      expires, httpOnly: true, secure: true, sameSite: 'lax',
    }));
    await _safeLogActivity('user.signup', {
      userId: newUser.id,
      detail: { email, orgName: _getOrgNameFromRow(org.data) ?? orgName, role },
    });

    _setRedirect(_config.signUpRedirect ?? '/');
    return;
  }

  // â”€â”€ Standard D1 mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const db = _getDb();

  const existing = await db.users.where({ email }).first();
  if (existing.data) {
    throw new Error('An account with this email already exists');
  }

  await db.users.insert({ email, name, passwordHash, role });
  const created = await db.users.where({ email }).first();
  await _safeLogActivity('user.signup', {
    userId: created.data?.id ?? null,
    detail: { email, role },
  });
  _setRedirect(_config.signUpRedirect ?? '/auth/login');
  } catch (err) {
    await _safeLogActivity('auth.failed', {
      detail: { phase: 'signup', email: email || null, error: _errorMessage(err) },
    });
    throw err as Error;
  }
}

/**
 * Sign in with email/password.
 *
 * Standard mode: verifies credentials + creates session in D1 via ORM.
 * Org mode: resolves emailâ†’org in D1, then verifies + creates session
 *           in the org's DO via RPC.
 */
export async function signIn({ formData }: FormData): Promise<void> {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;
  try {

  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  const secret = _getSecret();

  // â”€â”€ Org-aware mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (isOrgAvailable()) {
    const db = _getDb();

    // Resolve email â†’ org
    const mapping = await _findMappingByEmail(db, email);
    if (!mapping) throw new Error('Invalid email or password');
    const orgId = _getOrgIdFromMapping(mapping);
    if (!orgId) throw new Error('Invalid email or password');
    const orgResult = await db.organizations.where({ id: orgId }).first();
    const org = orgResult.data as Record<string, any> | undefined;
    const doName = _getDoNameFromRow(org);
    if (!doName) throw new Error('Invalid email or password');

    const stub = getOrgStubByName(doName);
    if (!stub) throw new Error('Invalid email or password');

    // Verify credentials in org DO
    const user = await stub.getUserByEmail(email);
    const storedHash = user?.passwordHash ?? null;
    if (!storedHash) throw new Error('Invalid email or password');

    const isValid = await comparePassword(password, String(storedHash), secret);
    if (!isValid) throw new Error('Invalid email or password');
    const userId = user?.id ?? null;
    if (userId == null) throw new Error('Invalid email or password');

    // Create session in org DO
    const sessionToken = generateSessionToken();
    const sessionTokenHash = await hashToken(sessionToken);
    const duration = _config.sessionDuration ?? 30 * 24 * 60 * 60 * 1000;
    const expires = new Date(Date.now() + duration);

    await stub.createSession({
      sessionToken: sessionTokenHash,
      userId,
      expires: expires.getTime(),
    });

    const sessionCookie = await buildSessionCookie(secret, doName, sessionTokenHash);
    const { locals } = _getContext();
    if (!locals.auth) locals.auth = {};
    locals.auth.sessionCookie = sessionCookie;
    _pushSetCookie(_buildSetCookieHeader(_getCookieName(), sessionCookie, {
      expires, httpOnly: true, secure: true, sameSite: 'lax',
    }));
    await _safeLogActivity('user.login', {
      userId,
      detail: { email },
    });

    _setRedirect(_config.signInRedirect ?? '/');
    return;
  }

  // â”€â”€ Standard D1 mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const db = _getDb();

  const userResult = await db.users.where({ email }).first();
  const user = userResult.data;
  if (!user?.passwordHash) throw new Error('Invalid email or password');

  const isValid = await comparePassword(password, user.passwordHash, secret);
  if (!isValid) throw new Error('Invalid email or password');

  const sessionToken = generateSessionToken();
  const sessionTokenHash = await hashToken(sessionToken);
  const duration = _config.sessionDuration ?? 30 * 24 * 60 * 60 * 1000;
  const expires = new Date(Date.now() + duration);

  await db.sessions.insert({
    sessionToken: sessionTokenHash,
    userId: user.id,
    expires: expires.getTime(),
  });

  const sessionCookie = await buildSessionCookie(secret, 'default', sessionTokenHash);
  const { locals } = _getContext();
  if (!locals.auth) locals.auth = {};
  locals.auth.sessionCookie = sessionCookie;
  _pushSetCookie(_buildSetCookieHeader(_getCookieName(), sessionCookie, {
    expires, httpOnly: true, secure: true, sameSite: 'lax',
  }));
  await _safeLogActivity('user.login', { userId: user.id, detail: { email } });

  _setRedirect(_config.signInRedirect ?? '/');
  } catch (err) {
    await _safeLogActivity('auth.failed', {
      detail: { phase: 'signin', email: email || null, error: _errorMessage(err) },
    });
    throw err as Error;
  }
}

/**
 * Sign out the current user.
 * Resolves the user's database from the cookie, deletes the session.
 */
export async function signOut(_formData?: FormData): Promise<void> {
  const sessionCookie = _getSessionCookie();
  const secret = _getSecret();

  if (sessionCookie) {
    const parsed = await parseSessionCookie(secret, sessionCookie);
    if (parsed) {
      if (isOrgAvailable() && parsed.orgId !== 'default') {
        const stub = getOrgStubByName(parsed.orgId);
        if (stub) {
          const sessionRecord = await stub.getSession(parsed.tokenHash);
          await _safeLogActivity('user.logout', {
            userId: sessionRecord?.user?.id ?? null,
            detail: { orgId: parsed.orgId },
          });
          await stub.deleteSession(parsed.tokenHash);
        }
      } else {
        const db = _getDb();
        const sessionResult = await db.sessions.where({ sessionToken: parsed.tokenHash }).first();
        await _safeLogActivity('user.logout', { userId: sessionResult.data?.userId ?? null });
        await db.sessions.delete({ sessionToken: parsed.tokenHash });
      }
    }
  }

  _pushSetCookie(_buildClearCookieHeader(_getCookieName()));
  _setRedirect(_config.signOutRedirect ?? '/auth/login');
}

// ============================================================================
// Password reset token expiry (15 minutes)
// ============================================================================

const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

/**
 * Request a password reset for the given email.
 *
 * Generates a signed reset token, stores a hashed copy in `passwordResets`,
 * and sends the reset link via email (requires RESEND_API_KEY + EMAIL_FROM).
 *
 * Standard mode only â€” org-mode apps delegate account recovery to their own
 * per-org flow using the same pattern.
 *
 * The response is always identical regardless of whether the email exists to
 * prevent user enumeration.
 */
export async function requestPasswordReset({ formData }: FormData): Promise<void> {
  const email = (formData.get('email') as string)?.trim().toLowerCase();

  if (!email) throw new Error('Email is required');

  // Silently succeed for unrecognised addresses (prevents user enumeration)
  try {
    const db = _getDb();
    const userResult = await db.users.where({ email }).first();
    const user = userResult.data;
    if (!user) {
      _setRedirect('/auth/forgot-password?sent=1');
      return;
    }

    // Clean up any existing unused tokens for this user
    await db.passwordResets.delete({ userId: user.id });

    const token = generateSessionToken();
    const tokenHash = await hashToken(token);
    const expiresAt = Date.now() + PASSWORD_RESET_TTL_MS;

    await db.passwordResets.insert({ userId: user.id, tokenHash, expiresAt });

    const env = _getEnv();
    const origin = env.ORIGIN ?? 'http://localhost:8787';
    const resetUrl = `${origin}/auth/reset-password?token=${token}`;

    await _sendPasswordResetEmail({ email, resetUrl, env });

    await _safeLogActivity('user.password_reset_requested', {
      userId: user.id,
      detail: { email },
    });
  } catch (err) {
    await _safeLogActivity('auth.failed', {
      detail: { phase: 'password_reset_request', email, error: _errorMessage(err) },
    });
    throw err;
  }

  _setRedirect('/auth/forgot-password?sent=1');
}

/**
 * Reset the user's password using a valid reset token.
 *
 * Validates the token, updates the password hash, invalidates all sessions,
 * and deletes the used token. Redirects to login on success.
 */
export async function resetPassword({ formData }: FormData): Promise<void> {
  const token = (formData.get('token') as string)?.trim();
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (!token) throw new Error('Reset token is missing');
  if (!password) throw new Error('Password is required');

  const minLen = _config.minPasswordLength ?? 8;
  if (password.length < minLen) {
    throw new Error(`Password must be at least ${minLen} characters`);
  }
  if (password !== confirmPassword) {
    throw new Error('Passwords do not match');
  }

  try {
    const tokenHash = await hashToken(token);
    const db = _getDb();

    const resetResult = await db.passwordResets.where({ tokenHash }).first();
    const reset = resetResult.data;

    if (!reset) throw new Error('Invalid or expired reset link');
    if (reset.expiresAt < Date.now()) {
      await db.passwordResets.delete({ tokenHash });
      throw new Error('This reset link has expired. Please request a new one.');
    }

    const secret = _getSecret();
    const passwordHash = await hashPassword(password, undefined, secret);

    await db.users.update({ passwordHash }, { id: reset.userId });

    // Invalidate all existing sessions for security
    await db.sessions.delete({ userId: reset.userId });

    // Clean up the used token
    await db.passwordResets.delete({ tokenHash });

    await _safeLogActivity('user.password_reset_completed', {
      userId: reset.userId,
      detail: {},
    });
  } catch (err) {
    await _safeLogActivity('auth.failed', {
      detail: { phase: 'password_reset', error: _errorMessage(err) },
    });
    throw err;
  }

  _setRedirect('/auth/login?reset=1');
}

// â”€â”€ Internal email helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function _sendPasswordResetEmail(opts: {
  email: string;
  resetUrl: string;
  env: Record<string, any>;
}): Promise<void> {
  const { email, resetUrl, env } = opts;
  const apiKey = env.RESEND_API_KEY;
  const from = env.EMAIL_FROM ?? 'noreply@example.com';

  if (!apiKey) {
    // Dev fallback: log to console so the flow still works without email
    console.warn(`[kuratchi/auth] RESEND_API_KEY not set. Password reset URL: ${resetUrl}`);
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Reset your password',
      html: `
        <p>You requested a password reset.</p>
        <p><a href="${resetUrl}">Click here to reset your password</a></p>
        <p>This link expires in 15 minutes. If you didn't request this, you can ignore this email.</p>
        <p style="color:#888;font-size:12px;">${resetUrl}</p>
      `.trim(),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[kuratchi/auth] Failed to send reset email: ${res.status} ${body}`);
  }
}

/**
 * Get the current authenticated user.
 * Resolves the user's database from the cookie, validates session,
 * returns a safe user object (no passwordHash).
 */
export async function getCurrentUser(): Promise<Record<string, any> | null> {
  const sessionCookie = _getSessionCookie();
  if (!sessionCookie) return null;

  const secret = _getSecret();
  const parsed = await parseSessionCookie(secret, sessionCookie);
  if (!parsed) return null;

  // â”€â”€ Org-aware mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (isOrgAvailable() && parsed.orgId !== 'default') {
    const stub = getOrgStubByName(parsed.orgId);
    if (!stub) return null;

    const result = await stub.getSession(parsed.tokenHash);
    if (!result?.user) return null;

    const user = result.user as Record<string, any>;
    user.orgId = parsed.orgId;
    // Enrich with org metadata from admin DB so UI can render org-aware labels.
    try {
      const db = _getDb();
      const orgResult = await db.organizations.where({ doName: parsed.orgId }).first();
      const org = orgResult.data as Record<string, any> | undefined;
      if (org) {
        const orgName = _getOrgNameFromRow(org);
        if (!user.organization && typeof orgName === 'string') {
          user.organization = orgName;
        }
        if (user.organizationId == null && org.id != null) {
          user.organizationId = org.id;
        }
        if (!user.plan && typeof org.plan === 'string') {
          user.plan = org.plan;
        }
      }
    } catch {
      // Do not fail auth if org enrichment is unavailable.
    }
    if (!user.role) user.role = 'user';
    return user;
  }

  // â”€â”€ Standard D1 mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const db = _getDb();

  const sessionResult = await db.sessions.where({ sessionToken: parsed.tokenHash }).first();
  const session = sessionResult.data;
  if (!session) return null;

  if (session.expires < Date.now()) {
    await db.sessions.delete({ sessionToken: parsed.tokenHash });
    return null;
  }

  const userResult = await db.users.where({ id: session.userId }).first();
  const user = userResult.data;
  if (!user) return null;

  const exclude = new Set(_config.excludeFields ?? ['passwordHash']);
  const safeUser: Record<string, any> = {};
  for (const [key, value] of Object.entries(user)) {
    if (!exclude.has(key)) safeUser[key] = value;
  }
  if (!safeUser.role) safeUser.role = 'user';

  return safeUser;
}



