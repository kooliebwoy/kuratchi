/**
 * @kuratchi/auth â€” Roles & Permissions API
 *
 * Ready-to-use server functions for RBAC.
 * Define roles in config, then use hasRole/hasPermission anywhere.
 *
 * @example
 * ```ts
 * import { defineRoles, hasRole, hasPermission, assignRole, getRolesData } from '@kuratchi/auth';
 *
 * const Roles = defineRoles({
 *   admin:  ['*'],
 *   editor: ['todos.*', 'users.read'],
 *   user:   ['todos.read', 'todos.create'],
 * });
 *
 * // Check permissions:
 * const user = await getCurrentUser();
 * if (hasPermission(user, 'todos.delete')) { ... }
 *
 * // Assign role:
 * await assignRole(formData); // reads userId + role from FormData
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export type RoleDefinitions = Record<string, string[]>;

export interface RolesConfig {
  /** Default role for new users (default: 'user') */
  defaultRole?: string;
}

// ============================================================================
// Module state
// ============================================================================

let _definitions: RoleDefinitions = {};
let _allRoles: string[] = [];
let _defaultRole: string = 'user';

/**
 * Define role â†’ permission mappings. Returns a typed constant object
 * mapping role names to themselves (for type-safe usage).
 */
export function defineRoles<T extends RoleDefinitions>(
  definitions: T,
  config?: RolesConfig,
): { [K in keyof T]: K } {
  _definitions = definitions;
  _allRoles = Object.keys(definitions);
  if (config?.defaultRole) _defaultRole = config.defaultRole;

  const roles = {} as { [K in keyof T]: K };
  for (const key of Object.keys(definitions) as (keyof T & string)[]) {
    (roles as any)[key] = key;
  }
  return roles;
}

/**
 * Get the registered role definitions.
 */
export function getRoleDefinitions(): RoleDefinitions {
  return _definitions;
}

/**
 * Get all defined role names.
 */
export function getAllRoles(): string[] {
  return _allRoles;
}

/**
 * Get the default role name.
 */
export function getDefaultRole(): string {
  return _defaultRole;
}

// ============================================================================
// Permission matching
// ============================================================================

function _matchesPermission(permission: string, pattern: string): boolean {
  if (pattern === permission) return true;
  if (pattern === '*') return true;
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2);
    return permission === prefix || permission.startsWith(prefix + '.');
  }
  return false;
}

/**
 * Get all concrete permissions for a given role.
 * Expands wildcards against all known permissions from all role definitions.
 */
export function getPermissionsForRole(role: string): string[] {
  const patterns = _definitions[role] || [];
  if (patterns.includes('*')) return _getAllPermissions();
  return _getAllPermissions().filter(p =>
    patterns.some(pattern => _matchesPermission(p, pattern))
  );
}

/**
 * Check if a user object has a specific permission based on their role.
 */
export function hasPermission(user: { role?: string } | null, permission: string): boolean {
  if (!user) return false;
  const role = user.role || _defaultRole;
  const patterns = _definitions[role] || [];
  return patterns.some(pattern => _matchesPermission(permission, pattern));
}

/**
 * Check if a user object has a specific role.
 */
export function hasRole(user: { role?: string } | null, role: string): boolean {
  if (!user) return false;
  return (user.role || _defaultRole) === role;
}

// ============================================================================
// Framework context + DB
// ============================================================================

function _getDb(): any {
  const bindingName = getAuthDbBinding();
  const binding = (env as unknown as Record<string, any>)[bindingName];
  if (!binding) throw new Error(`[kuratchi/auth] No ${bindingName} binding found.`);
  return binding;
}

// ============================================================================
// Server functions
// ============================================================================

/**
 * Assign a role to a user. Reads userId and role from FormData.
 * Callable by users who can manage users via `users.*` permission.
 */
export async function assignRole({ formData }: FormData): Promise<void> {
  // Import getCurrentUser at call time to avoid circular deps
  const { getCurrentUser } = await import('./credentials.js');
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasPermission(currentUser, 'users.update')) {
    throw new Error('Not authorized to assign roles');
  }

  const userId = formData.get('userId') as string;
  const role = formData.get('role') as string;

  if (!userId || !role) throw new Error('User ID and role are required');
  if (!_allRoles.includes(role)) throw new Error(`Invalid role: ${role}`);

  const db = _getDb();
  await db.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, userId).run();
}

/**
 * Get full roles data for the roles management page.
 * Returns current user, their permissions, role definitions, and all users (if allowed).
 */
export async function getRolesData() {
  const { getCurrentUser } = await import('./credentials.js');
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { isAuthenticated: false, user: null, roles: [], userRole: null, permissions: [], roleDefinitions: {}, allPermissions: [], allUsers: [] };
  }

  const userRole = currentUser.role || _defaultRole;
  const permissions = getPermissionsForRole(userRole);

  let allUsers: any[] = [];
  if (hasPermission(currentUser, 'users.read')) {
    const db = _getDb();
    const result = await db.prepare('SELECT id, email, name, role, createdAt FROM users').all();
    allUsers = (result?.results ?? []).map((u: any) => ({
      ...u,
      role: u.role || _defaultRole,
    }));
  }

  return {
    isAuthenticated: true,
    user: currentUser,
    userRole,
    roles: _allRoles,
    roleDefinitions: _definitions,
    permissions,
    allPermissions: _getAllPermissions(),
    allUsers,
  };
}

// ============================================================================
// Internal: collect all concrete permissions from role definitions
// ============================================================================

function _getAllPermissions(): string[] {
  const perms = new Set<string>();
  for (const patterns of Object.values(_definitions)) {
    for (const p of patterns) {
      if (p !== '*' && !p.endsWith('.*')) {
        perms.add(p);
      }
    }
  }
  return Array.from(perms);
}



import { env } from 'cloudflare:workers';
import { getAuthDbBinding } from './config.js';
