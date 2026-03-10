/**
 * @kuratchi/auth â€” Activity Tracking API
 *
 * Ready-to-use server functions for activity logging.
 * Reads DB from framework globals â€” zero config needed.
 * Define allowed activity types for type safety.
 *
 * @example
 * ```ts
 * import { defineActivities, logActivity, getActivity } from '@kuratchi/auth';
 *
 * // Define allowed actions (once, at module scope):
 * const Activity = defineActivities({
 *   'user.signup':  { label: 'User Signed Up',  severity: 'info' },
 *   'user.login':   { label: 'User Logged In',  severity: 'info' },
 *   'admin.access': { label: 'Admin Accessed',   severity: 'warning' },
 * });
 *
 * // Type-safe logging:
 * await logActivity(Activity['user.login'], { detail: 'Login from Chrome' });
 *
 * // Query:
 * const recent = await getActivity({ limit: 50 });
 * ```
 */

import { env } from 'cloudflare:workers';
import { parseSessionCookie } from '../utils/crypto.js';
import { getOrgStubByName, isOrgAvailable } from './organization.js';
import { getAuthDbBinding } from './config.js';

// ============================================================================
// Types
// ============================================================================

export interface ActivityTypeDefinition {
  label: string;
  category?: string;
  severity?: 'info' | 'warning' | 'critical';
  description?: string;
}

export interface LogActivityOptions {
  /** Optional detail string or structured data */
  detail?: string | Record<string, any>;
  /** Override userId (defaults to current session user) */
  userId?: number | string | null;
  /** Override IP address (defaults to request header) */
  ip?: string | null;
  /** Override user agent (defaults to request header) */
  userAgent?: string | null;
}

export interface GetActivityOptions {
  /** Max number of records to return (default: 50) */
  limit?: number;
  /** Filter by userId */
  userId?: number | string;
  /** Filter by action */
  action?: string;
}

export interface ActivityConfig {
  /** Table name (default: 'activityLog') */
  table?: string;
}

// ============================================================================
// Module state
// ============================================================================

let _table: string = 'activityLog';
let _definitions: Record<string, ActivityTypeDefinition> | null = null;

/**
 * Define allowed activity types. Returns a typed constant object
 * mapping action names to themselves (for type-safe logActivity calls).
 *
 * Also registers the definitions so getActivity() can enrich results with labels.
 *
 * @example
 * ```ts
 * const Activity = defineActivities({
 *   'user.login': { label: 'User Logged In', severity: 'info' },
 *   'todo.create': { label: 'Todo Created', severity: 'info' },
 * });
 *
 * await logActivity(Activity['user.login']); // type-safe
 * await logActivity('unknown.action');       // still works, but no autocomplete
 * ```
 */
export function defineActivities<T extends Record<string, ActivityTypeDefinition>>(
  definitions: T,
  config?: ActivityConfig,
): { [K in keyof T]: K } {
  _definitions = definitions;
  if (config?.table) {
    // Validate table name to prevent SQL injection via interpolation.
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(config.table)) {
      throw new Error(`[kuratchi/auth] Invalid activity table name: "${config.table}". Only letters, digits, and underscores are allowed.`);
    }
    _table = config.table;
  }

  // Build a constant object: { 'user.login': 'user.login', ... }
  const actions = {} as { [K in keyof T]: K };
  for (const key of Object.keys(definitions) as (keyof T & string)[]) {
    (actions as any)[key] = key;
  }
  return actions;
}

/**
 * Get the registered activity type definitions.
 */
export function getActivityDefinitions(): Record<string, ActivityTypeDefinition> {
  return _definitions ?? {};
}

// ============================================================================
// Framework context resolution (same pattern as getAuth / credentials)
// ============================================================================

function _getContext() {
  const dezContext = (globalThis as any).__kuratchi_context__;
  const request: Request = dezContext?.request ?? new Request('http://localhost');
  const locals: Record<string, any> = dezContext?.locals ?? {};
  return { env: env as unknown as Record<string, any>, request, locals };
}

function _getDb(): any {
  const { env } = _getContext();
  const binding = env[getAuthDbBinding()];
  if (!binding) return null;
  return binding;
}

async function _getOrgStub(): Promise<any | null> {
  if (!isOrgAvailable()) return null;
  const { env, locals, request } = _getContext();
  const cookieName = locals.auth?.cookieName || 'kuratchi_session';
  const sessionCookie =
    locals.auth?.sessionCookie
    ?? request.headers?.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1)
    ?? null;
  if (!sessionCookie) return null;
  const secret = env.AUTH_SECRET;
  if (!secret) return null;
  const parsed = await parseSessionCookie(secret, sessionCookie);
  if (parsed && parsed.orgId && parsed.orgId !== 'default') {
    return getOrgStubByName(parsed.orgId);
  }

  // Fallback when cookie parsing is unavailable but user/session context exists.
  const fallbackOrgId = locals.session?.orgId ?? locals.user?.orgId ?? null;
  if (fallbackOrgId && fallbackOrgId !== 'default') {
    return getOrgStubByName(String(fallbackOrgId));
  }
  return null;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Log an activity event to the database.
 *
 * Reads the current request context (IP, user agent, session user)
 * automatically from the framework globals.
 *
 * @param action - Activity action identifier (e.g., 'user.login')
 * @param detailOrOptions - String detail, or LogActivityOptions
 */
export async function logActivity(
  action: string,
  detailOrOptions?: string | LogActivityOptions,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { request } = _getContext();

    // Resolve options
    let opts: LogActivityOptions;
    if (typeof detailOrOptions === 'string') {
      opts = { detail: detailOrOptions };
    } else {
      opts = detailOrOptions || {};
    }

    // Auto-resolve from request context.
    // Use cf-connecting-ip only — x-forwarded-for is client-controlled and would
    // allow spoofed IPs to appear in audit logs.
    const ip = opts.ip ?? request.headers?.get('cf-connecting-ip') ?? null;
    const userAgent = opts.userAgent ?? request.headers?.get('user-agent') ?? null;

    // Resolve userId from session if not provided
    let userId = opts.userId;
    if (userId === undefined) {
      const { locals } = _getContext();
      userId = locals.session?.userId ?? locals.user?.id ?? null;
    }

    // Serialize detail
    const detail = typeof opts.detail === 'object'
      ? JSON.stringify(opts.detail)
      : (opts.detail ?? null);

    const orgStub = await _getOrgStub();
    if (orgStub?.__kuratchiLogActivity) {
      await orgStub.__kuratchiLogActivity({
        userId: userId ?? null,
        action,
        detail,
        ip,
        userAgent,
      });
      return { success: true };
    }

    const db = _getDb();
    if (!db) {
      console.warn('[kuratchi/auth activity] No org stub and no DB binding for logActivity', { action });
      return { success: false, error: '[kuratchi/auth] No DB binding found. Ensure D1 is configured.' };
    }
    const now = new Date().toISOString();

    await db.prepare(
      `INSERT INTO ${_table} (userId, action, detail, ip, userAgent, createdAt) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(userId ?? null, action, detail, ip, userAgent, now).run();

    return { success: true };
  } catch (err: any) {
    console.warn('[kuratchi/auth activity] logActivity failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Query activity log entries from the database.
 * Enriches results with labels/severity from defineActivities() if set.
 *
 * @param options - Filter and pagination options
 */
export async function getActivity(
  options?: GetActivityOptions,
): Promise<{ success: boolean; data: any[]; error?: string }> {
  try {
    let rows: any[] = [];
    const orgStub = await _getOrgStub();
    if (orgStub?.__kuratchiGetActivity) {
      const result = await orgStub.__kuratchiGetActivity({ limit: options?.limit, action: options?.action });
      rows = Array.isArray(result) ? result : [];
      if (options?.userId !== undefined) {
        rows = rows.filter((row: any) => row?.userId === options.userId);
      }
    } else {
      const db = _getDb();
      if (!db) return { success: false, data: [], error: '[kuratchi/auth] No DB binding found.' };

      let sql = `SELECT * FROM ${_table}`;
      const params: any[] = [];
      const clauses: string[] = [];

      if (options?.userId !== undefined) {
        clauses.push('userId = ?');
        params.push(options.userId);
      }
      if (options?.action) {
        clauses.push('action = ?');
        params.push(options.action);
      }
      if (clauses.length > 0) sql += ' WHERE ' + clauses.join(' AND ');
      sql += ' ORDER BY createdAt DESC';
      if (options?.limit) {
        sql += ' LIMIT ?';
        params.push(options.limit);
      }

      const result = await db.prepare(sql).bind(...params).all();
      rows = result?.results ?? [];
    }

    // Enrich with definitions if available
    if (_definitions) {
      rows = rows.map((row: any) => {
        const def = _definitions![row.action];
        return def
          ? { ...row, label: def.label, severity: def.severity ?? 'info', category: def.category }
          : { ...row, label: row.action, severity: 'info' };
      });
    }

    return { success: true, data: rows };
  } catch (err: any) {
    console.warn('[kuratchi/auth activity] getActivity failed:', err);
    return { success: false, data: [], error: err.message };
  }
}



