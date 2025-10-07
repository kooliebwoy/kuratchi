/**
 * Superadmin plugin - superadmin detection and org switching helpers
 * Independent plugin that relies on admin plugin's getAdminDb()
 */

import type { AuthPlugin, PluginContext, SessionContext } from '../core/plugin.js';
import type { RouteGuard } from '../types.js';

export interface SuperadminPluginOptions {
  // Optionally customize how we detect superadmin
  isSuperadmin?: (ctx: SessionContext, adminDb: any) => Promise<boolean> | boolean;
  // Cookie name to persist org override
  cookieName?: string; // default: 'kuratchi_super_org'
}

export function superadminPlugin(options: SuperadminPluginOptions = {}): AuthPlugin {
  return {
    name: 'superadmin',
    priority: 76, // after session

    async onRequest(ctx: PluginContext) {
      const cookieName = options.cookieName || 'kuratchi_super_org';
      const existing = ctx.event.cookies.get(cookieName) || null;

      ctx.locals.kuratchi = ctx.locals.kuratchi || ({} as any);
      // Initialize container with defaults
      ctx.locals.kuratchi.superadmin = {
        __isSuperadmin: false,
        __orgOverride: existing,
        // Read-only helpers
        isSuperadmin: () => !!ctx.locals.kuratchi.superadmin.__isSuperadmin,
        getActiveOrgId: () => ctx.locals.kuratchi.superadmin.__orgOverride || ctx.locals.session?.organizationId || null,
        // Mutators (per-request only)
        setOrganization: (orgId: string | null, persist: boolean = true) => {
          ctx.locals.kuratchi.superadmin.__orgOverride = orgId;
          if (persist) {
            if (orgId) {
              const isHttps = new URL(ctx.event.request.url).protocol === 'https:';
              ctx.event.cookies.set(cookieName, orgId, {
                path: '/', httpOnly: true, sameSite: 'lax', secure: isHttps
              });
            } else {
              ctx.event.cookies.delete(cookieName, { path: '/' });
            }
          }
        },
        clearOrganization: () => {
          ctx.locals.kuratchi.superadmin.__orgOverride = null;
          ctx.event.cookies.delete(cookieName, { path: '/' });
        }
      };
    },

    async onSession(ctx: SessionContext) {
      const locals = ctx.locals as any;
      const getAdminDb = locals.kuratchi?.getAdminDb;
      if (!getAdminDb) {
        // Admin plugin not present; nothing to do
        return;
      }

      let isSuper = false;
      try {
        const adminDb = await getAdminDb();
        if (!adminDb) return;

        if (options.isSuperadmin) {
          isSuper = !!(await options.isSuperadmin(ctx, adminDb));
        } else if (ctx.session?.email) {
          // Default detection: admin users table role === 'superadmin'
          const { data: adminUser } = await adminDb.users
            .where({ email: ctx.session.email })
            .first();
          isSuper = adminUser?.role === 'superadmin';
        }
      } catch (e) {
        console.warn('[SuperadminPlugin] Failed to determine superadmin:', e);
      }

      locals.kuratchi.superadmin.__isSuperadmin = isSuper;
      // If not superadmin, clear any override cookie for safety
      if (!isSuper && locals.kuratchi.superadmin.__orgOverride) {
        locals.kuratchi.superadmin.clearOrganization();
      }
    }
  };
}

// Guard: require superadmin
export function requireSuperadmin(): RouteGuard {
  return ({ locals }) => {
    const isSuper = !!locals?.kuratchi?.superadmin?.__isSuperadmin;
    if (!isSuper) return new Response('Forbidden', { status: 403 });
  };
}
