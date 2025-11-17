/**
 * Activity Remote Functions
 * Thin wrapper around SDK activity plugin for SvelteKit app/server context
 */

import { getRequestEvent, query, form } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db-context';

// Guarded query helper
const guardedQuery = <R>(fn: () => Promise<R>) => {
	return query(async () => {
		const { locals: { session } } = getRequestEvent();
		if (!session?.user) error(401, 'Unauthorized');
		return fn();
	});
};

const guardedForm = <R>(
  schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
  fn: (data: any) => Promise<R>
) => {
  return form('unchecked', async (data: any) => {
    const { locals: { session } } = getRequestEvent();
    if (!session?.user) error(401, 'Unauthorized');

    const result = v.safeParse(schema, data);
    if (!result.success) {
      console.error('[guardedForm] Validation failed:', result.issues);
      error(400, `Validation failed: ${result.issues.map((i: any) => `${i.path?.map((p: any) => p.key).join('.')}: ${i.message}`).join(', ')}`);
    }

    return fn(result.output);
  });
};

/**
 * Get activities based on user role:
 * - Superadmins: See all activities from admin DB (system-wide)
 * - Organization users: See only their org's activities from org DB (filtered, no hidden types)
 */
export const getActivities = guardedQuery(async () => {
  try {
    const { locals } = getRequestEvent();
    const session = locals.session;
    const isSuperadmin = (locals.kuratchi as any)?.superadmin?.isSuperadmin?.();
    
    let db;
    let activities = [];
    
    if (isSuperadmin) {
      // Superadmins see everything from admin DB
      db = await (locals.kuratchi as any)?.getAdminDb?.();
      if (!db) {
        console.error('[activity.getActivities] Admin database not configured');
        error(500, 'Admin database not configured');
      }
      
      const activitiesResult = await db.activity
        .where({ deleted_at: { isNullish: true } })
        .many();
      
      activities = activitiesResult?.data || [];
    } else {
      // Organization users see only their org's activities (excluding hidden types)
      const activeOrgId = (locals.kuratchi as any)?.superadmin?.getActiveOrgId?.() || session?.organizationId;
      
      if (!activeOrgId) {
        console.log('[activity.getActivities] No organization ID found');
        return [];
      }
      
      db = await (locals.kuratchi as any)?.orgDatabaseClient?.(activeOrgId);
      if (!db) {
        console.error('[activity.getActivities] Organization database not configured');
        error(500, 'Organization database not configured');
      }
      
      const activitiesResult = await db.activity
        .where({ 
          deleted_at: { isNullish: true },
          isHidden: false  // Filter out hidden activities for non-superadmins
        })
        .many();
      
      activities = activitiesResult?.data || [];
    }

    console.log('[activity.getActivities] Found activities:', activities.length);

    // Sort by most recent
    const sorted = activities.sort((a: any, b: any) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // Get unique user IDs
    const userIds = [...new Set(sorted.map((a: any) => a.userId).filter(Boolean))];
    
    // Get user data from admin DB (users are centralized)
    const adminDb = await (locals.kuratchi as any)?.getAdminDb?.();
    const usersResult = await adminDb?.users
      .where({ id: { in: userIds } })
      .many();
    
    const users = usersResult?.data || [];
    const userMap = new Map(users.map((u: any) => [u.id, u]));

    // Enrich activities with user data
    const enriched = sorted.map((activity: any) => {
      const user = activity.userId ? userMap.get(activity.userId) : null;
      
      return {
        id: activity.id,
        userId: activity.userId,
        userName: (user as any)?.name || 'System',
        userEmail: (user as any)?.email || null,
        action: activity.action,
        data: activity.data,
        status: activity.status,
        isAdminAction: activity.isAdminAction || false,
        isHidden: activity.isHidden || false,
        organizationId: activity.organizationId,
        ip: activity.ip,
        userAgent: activity.userAgent,
        createdAt: activity.created_at
      };
    });

    console.log('[activity.getActivities] Returning enriched activities:', enriched.length);

    return enriched;
  } catch (err) {
    console.error('[activity.getActivities] error:', err);
    return [];
  }
});

/**
 * Clear old activities (older than specified days)
 * Only available to superadmins - clears from admin DB
 * Organization users clear from their org DB
 */
export const clearOldActivities = guardedForm(
  v.object({ daysOld: v.optional(v.number()) }),
  async ({ daysOld = 90 }) => {
    try {
      const { locals } = getRequestEvent();
      const adminDb = await (locals.kuratchi as any)?.getAdminDb?.();
      if (!adminDb) error(500, 'Admin database not configured');

      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();

      // Soft delete old activities
      const result = await adminDb.activity
        .where({ created_at: { lt: cutoffDate } })
        .update({ deleted_at: new Date().toISOString() });

      await getActivities().refresh();

      return { success: true, deletedCount: result?.affectedRows || 0 };
    } catch (err) {
      console.error('[activity.clearOldActivities] error:', err);
      error(500, 'Failed to clear old activities');
    }
  }
);
