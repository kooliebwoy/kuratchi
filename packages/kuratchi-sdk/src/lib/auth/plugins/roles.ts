/**
 * Roles plugin - Role-based access control with permissions and guards
 * Enriches session with roles and exposes powerful role/permission helpers
 */

import type { AuthPlugin, SessionContext } from '../core/plugin.js';

export interface PermissionDef {
  value: string;
  label?: string;
  description?: string;
  meta?: any;
}

export type RoleDefinitions = Record<string, (string | PermissionDef)[]>;

export interface RolesDbOptions {
  /** Which database to read definitions from */
  source?: 'admin' | 'org';
  /** Table name that contains role definitions */
  table: string; // e.g. 'roles'
  /** Column with role name (default: 'name') */
  nameColumn?: string;
  /** Column with permissions JSON (default: 'permissions') */
  permissionsColumn?: string;
  /** Optional filter for the query */
  where?: Record<string, any>;
}

export interface RolesDbJoinOptions {
  /** Which database to read definitions from */
  source?: 'admin' | 'org';
  /** Roles table and columns */
  rolesTable: string; // 'roles'
  roleIdColumn?: string; // 'id'
  roleNameColumn?: string; // 'name'
  roleWhere?: Record<string, any>;
  /** Join table rolePermissions */
  rolePermissionsTable: string; // 'rolePermissions'
  rpRoleIdColumn?: string; // 'roleId'
  rpPermissionIdColumn?: string; // 'permissionId'
  rpWhere?: Record<string, any>;
  /** Permissions table and columns */
  permissionsTable: string; // 'permissions'
  permIdColumn?: string; // 'id'
  permValueColumn?: string; // 'value'
  permLabelColumn?: string; // 'label'
  permDescriptionColumn?: string; // 'description'
  permWhere?: Record<string, any>;
}

export interface RolesPluginOptions {
  /**
   * Define roles and their permissions. Supports wildcards like 'posts.*' and '*'.
   */
  define?: RoleDefinitions;
  /** Default role when no role is found */
  default?: string;
  /** Optional resolver to compute user roles from session/user/db */
  getUserRoles?: (ctx: SessionContext) => Promise<string[]> | string[];
  /** Optional loader to fetch role definitions dynamically (e.g., from DB or API) */
  loadRoleDefinitions?: (ctx: SessionContext) => Promise<RoleDefinitions> | RoleDefinitions;
  /** Optional: read role definitions from a database table with JSON permissions */
  db?: RolesDbOptions;
  /** Optional: read role definitions via join tables (roles + rolePermissions + permissions) */
  dbJoin?: RolesDbJoinOptions;
  /** Optional: add user-specific direct permissions (independent of roles) */
  getUserDirectPermissions?: (ctx: SessionContext) => Promise<(string | PermissionDef)[]> | (string | PermissionDef)[];
}

/** Match a permission string against a pattern (supports '*' and suffix '.*') */
function matchesPermission(permission: string, pattern: string): boolean {
  if (pattern === permission) return true;
  if (pattern === '*') return true;
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2);
    return permission === prefix || permission.startsWith(prefix + '.');
  }
  return false;
}

function normalizePermission(p: string | PermissionDef): PermissionDef {
  if (typeof p === 'string') return { value: p };
  return { value: p.value, label: p.label, description: p.description, meta: p.meta };
}

function uniqueByValue(items: PermissionDef[]): PermissionDef[] {
  const seen = new Set<string>();
  const out: PermissionDef[] = [];
  for (const it of items) {
    if (!seen.has(it.value)) {
      seen.add(it.value);
      out.push(it);
    }
  }
  return out;
}

export function rolesPlugin(options: RolesPluginOptions = {}): AuthPlugin {
  const staticDefinitions = options.define || {};

  return {
    name: 'roles',
    priority: 78, // after session

    async onSession(ctx: SessionContext) {
      // 0) Build role definitions from multiple sources (static + dynamic + DB)
      let definitions: RoleDefinitions = { ...staticDefinitions };

      // From custom loader
      if (options.loadRoleDefinitions) {
        try {
          const loaded = await options.loadRoleDefinitions(ctx);
          if (loaded && typeof loaded === 'object') {
            for (const [role, perms] of Object.entries(loaded)) {
              definitions[role] = (definitions[role] || []).concat(perms);
            }
          }
        } catch (e) {
          console.warn('[RolesPlugin] loadRoleDefinitions failed:', e);
        }
      }

      // From DB (simple JSON-in-roles)
      if (options.db?.table) {
        try {
          const src = options.db.source || 'admin';
          const db = src === 'admin'
            ? await ctx.locals.kuratchi?.getAdminDb?.()
            : await ctx.locals.kuratchi?.getOrgDb?.(ctx.locals.session?.organizationId);

          const tableName = options.db.table;
          const nameCol = options.db.nameColumn || 'name';
          const permsCol = options.db.permissionsColumn || 'permissions';
          const where = options.db.where || {};

          if (db && db[tableName]) {
            let query = db[tableName];
            if (query.where && Object.keys(where).length > 0) {
              query = query.where(where);
            }
            const result = query.many ? await query.many() : await query.all?.();
            const rowsRaw = (result as any)?.data ?? result ?? [];
            const rows: any[] = Array.isArray(rowsRaw) ? rowsRaw : [];
            for (const row of rows) {
              const roleName = row[nameCol];
              let permsRaw = row[permsCol];
              if (typeof permsRaw === 'string') {
                try { permsRaw = JSON.parse(permsRaw); } catch {}
              }
              const permsArr: (string | PermissionDef)[] = Array.isArray(permsRaw) ? permsRaw : [];
              if (!definitions[roleName]) definitions[roleName] = [];
              definitions[roleName] = (definitions[roleName] as any[]).concat(permsArr);
            }
          }
        } catch (e) {
          console.warn('[RolesPlugin] DB role load failed:', e);
        }
      }

      // From DB (join: roles + rolePermissions + permissions)
      if (options.dbJoin?.rolesTable && options.dbJoin?.rolePermissionsTable && options.dbJoin?.permissionsTable) {
        try {
          const j = options.dbJoin;
          const src = j.source || 'admin';
          const db = src === 'admin'
            ? await ctx.locals.kuratchi?.getAdminDb?.()
            : await ctx.locals.kuratchi?.getOrgDb?.(ctx.locals.session?.organizationId);

          if (db) {
            const rt = j.rolesTable;
            const rpt = j.rolePermissionsTable;
            const pt = j.permissionsTable;
            const roleIdCol = j.roleIdColumn || 'id';
            const roleNameCol = j.roleNameColumn || 'name';
            const rpRoleIdCol = j.rpRoleIdColumn || 'roleId';
            const rpPermIdCol = j.rpPermissionIdColumn || 'permissionId';
            const permIdCol = j.permIdColumn || 'id';
            const permValueCol = j.permValueColumn || 'value';
            const permLabelCol = j.permLabelColumn || 'label';
            const permDescCol = j.permDescriptionColumn || 'description';

            // Load tables
            const rolesQ = db[rt];
            const rpQ = db[rpt];
            const permsQ = db[pt];
            const [rolesRes, rpRes, permsRes] = await Promise.all([
              j.roleWhere && rolesQ.where ? rolesQ.where(j.roleWhere).many() : rolesQ.many?.(),
              j.rpWhere && rpQ.where ? rpQ.where(j.rpWhere).many() : rpQ.many?.(),
              j.permWhere && permsQ.where ? permsQ.where(j.permWhere).many() : permsQ.many?.(),
            ]);

            const rolesArr = Array.isArray((rolesRes as any)?.data) ? (rolesRes as any).data : (Array.isArray(rolesRes) ? rolesRes : []);
            const rpArr = Array.isArray((rpRes as any)?.data) ? (rpRes as any).data : (Array.isArray(rpRes) ? rpRes : []);
            const permsArr = Array.isArray((permsRes as any)?.data) ? (permsRes as any).data : (Array.isArray(permsRes) ? permsRes : []);

            // Index permissions by id
            const permById = new Map<string, PermissionDef>();
            for (const p of permsArr) {
              const id = p[permIdCol];
              if (!id) continue;
              permById.set(id, normalizePermission({
                value: p[permValueCol],
                label: p[permLabelCol],
                description: p[permDescCol]
              }));
            }

            // Group rp by roleId
            const permsByRoleId: Record<string, PermissionDef[]> = {};
            for (const rp of rpArr) {
              const rid = rp[rpRoleIdCol];
              const pid = rp[rpPermIdCol];
              const def = pid ? permById.get(pid) : undefined;
              if (!rid || !def) continue;
              if (!permsByRoleId[rid]) permsByRoleId[rid] = [];
              permsByRoleId[rid].push(def);
            }

            // Merge into definitions by role name
            for (const r of rolesArr) {
              const roleName = r[roleNameCol];
              const roleId = r[roleIdCol];
              const list = uniqueByValue(permsByRoleId[roleId] || []);
              if (!definitions[roleName]) definitions[roleName] = [];
              (definitions[roleName] as any[]).push(...list);
            }
          }
        } catch (e) {
          console.warn('[RolesPlugin] DB join role load failed:', e);
        }
      }
      // 1) Resolve roles for current user
      const currentRoles: string[] = Array.isArray(ctx.session?.roles)
        ? (ctx.session.roles as string[])
        : ([] as string[]);

      let roles = currentRoles;
      if (options.getUserRoles) {
        try {
          const resolved = await options.getUserRoles(ctx);
          if (Array.isArray(resolved)) roles = resolved;
        } catch (e) {
          console.warn('[RolesPlugin] getUserRoles failed:', e);
        }
      } else if (roles.length === 0 && ctx.session?.user?.role) {
        roles = [ctx.session.user.role];
      }
      if (roles.length === 0 && options.default) {
        roles = [options.default];
      }

      // 2) Build permission objects and patterns from role definitions
      const permObjects: PermissionDef[] = [];
      for (const r of roles) {
        (definitions[r] || []).forEach((p) => permObjects.push(normalizePermission(p)));
      }

      // Add user-specific direct permissions if provided
      if (options.getUserDirectPermissions) {
        try {
          const direct = await options.getUserDirectPermissions(ctx);
          if (Array.isArray(direct)) {
            direct.forEach((p) => permObjects.push(normalizePermission(p)));
          }
        } catch (e) {
          console.warn('[RolesPlugin] getUserDirectPermissions failed:', e);
        }
      }

      const uniquePermObjects = uniqueByValue(permObjects);
      const permissions = uniquePermObjects.map((p) => p.value);

      // 3) Store roles on session
      if (!Array.isArray(ctx.locals.session?.roles)) {
        ctx.locals.session = { ...(ctx.locals.session || {}), roles };
      } else {
        ctx.locals.session.roles = roles;
      }

      // 4) Attach user-centric helpers on session.user
      const u: any = ctx.locals.session?.user || ({} as any);
      if (ctx.locals.session?.user) {
        u.getRoles = () => roles.slice();
        u.hasRole = (role: string) => roles.includes(role);
        u.hasAnyRole = (...required: string[]) => required.some((r) => roles.includes(r));
        u.hasAllRoles = (...required: string[]) => required.every((r) => roles.includes(r));

        u.getPermissions = () => permissions.slice(); // values only
        u.getPermissionObjects = () => uniquePermObjects.map((p) => ({ ...p }));
        u.hasPermission = (permission: string) => permissions.some((p) => matchesPermission(permission, p));
        u.hasAnyPermission = (...required: string[]) =>
          required.some((req) => permissions.some((p) => matchesPermission(req, p)));
        u.hasAllPermissions = (...required: string[]) =>
          required.every((req) => permissions.some((p) => matchesPermission(req, p)));
      }

      // 5) Expose advanced API under locals.kuratchi.roles (legacy/advanced + catalogs)
      ctx.locals.kuratchi = ctx.locals.kuratchi || ({} as any);
      ctx.locals.kuratchi.roles = {
        // Roles
        getRoles: () => roles.slice(),
        hasRole: (role: string) => roles.includes(role),
        hasAnyRole: (...required: string[]) => required.some((r) => roles.includes(r)),
        hasAllRoles: (...required: string[]) => required.every((r) => roles.includes(r)),

        // Permissions
        getPermissions: () => permissions.slice(), // returns patterns; wildcards may be present
        getPermissionObjects: () => uniquePermObjects.map((p) => ({ ...p })),
        hasPermission: (permission: string) => permissions.some((p) => matchesPermission(permission, p)),
        hasAnyPermission: (arg1: string | string[], ...rest: string[]) => {
          const required = Array.isArray(arg1) ? arg1 : [arg1, ...rest];
          return required.some((req) => permissions.some((p) => matchesPermission(req, p)));
        },
        hasAllPermissions: (arg1: string | string[], ...rest: string[]) => {
          const required = Array.isArray(arg1) ? arg1 : [arg1, ...rest];
          return required.every((req) => permissions.some((p) => matchesPermission(req, p)));
        },

        // Catalog: full role definitions for UI builders (labels, descriptions preserved)
        getDefinitions: () => {
          const out: Record<string, PermissionDef[]> = {};
          for (const [role, perms] of Object.entries(definitions)) {
            out[role] = uniqueByValue(perms.map(normalizePermission));
          }
          return out;
        },

        // Legacy aliases (backward compatible)
        list: () => roles,
        has: (role: string) => roles.includes(role),
        hasAny: (...required: string[]) => required.some((r) => roles.includes(r))
      };
    }
  };
}
