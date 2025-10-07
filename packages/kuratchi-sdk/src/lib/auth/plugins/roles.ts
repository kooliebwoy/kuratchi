/**
 * Roles plugin - role utilities and guards
 * Independent plugin that enriches session with roles and exposes helpers
 */

import type { AuthPlugin, SessionContext } from '../core/plugin.js';
import type { RouteGuard } from '../types.js';

export interface RolesPluginOptions {
  // Optional resolver to compute user roles from session/user/db
  getUserRoles?: (ctx: SessionContext) => Promise<string[]> | string[];
}

export function rolesPlugin(options: RolesPluginOptions = {}): AuthPlugin {
  return {
    name: 'roles',
    priority: 78, // after session

    async onSession(ctx: SessionContext) {
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

      // Ensure session has roles array
      if (!Array.isArray(ctx.locals.session?.roles)) {
        ctx.locals.session = { ...(ctx.locals.session || {}), roles };
      } else {
        ctx.locals.session.roles = roles;
      }

      // Expose helpers under locals.kuratchi.roles
      ctx.locals.kuratchi = ctx.locals.kuratchi || ({} as any);
      ctx.locals.kuratchi.roles = {
        list: () => roles,
        has: (role: string) => roles.includes(role),
        hasAny: (...required: string[]) => required.some((r) => roles.includes(r)),
        hasAll: (...required: string[]) => required.every((r) => roles.includes(r))
      };
    }
  };
}

// Guard factory: require one of the roles
export function requireRole(required: string | string[]): RouteGuard {
  const requiredArr = Array.isArray(required) ? required : [required];
  return ({ session }) => {
    const roles: string[] = Array.isArray(session?.roles) ? (session.roles as string[]) : [];
    const ok = requiredArr.some((r) => roles.includes(r));
    if (!ok) return new Response('Forbidden', { status: 403 });
  };
}
