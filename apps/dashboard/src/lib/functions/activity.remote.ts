/**
 * Activity Remote Functions
 * Thin wrapper around SDK activity plugin for SvelteKit app/server context
 * 
 * Note: Database caching is now handled natively by the SDK's organization plugin
 * when cache.enabled is true in kuratchi() config
 */

import { getRequestEvent, query, form } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';

// Guarded query helper
const guardedQuery = <R>(fn: () => Promise<R>) => {
	return query(async () => {
		const { locals: { session } } = getRequestEvent();
		if (!session?.user) error(401, 'Unauthorized');
		return fn();
	});
};

const guardedForm = <Schema extends v.BaseSchema<any, any, any>, R>(
  schema: Schema,
  fn: (data: v.InferOutput<Schema>) => Promise<R>
) => {
  return form(schema as any, async (data: v.InferOutput<Schema>) => {
    const { locals: { session } } = getRequestEvent();
    if (!session?.user) error(401, 'Unauthorized');

    return fn(data);
  });
};

/**
 * Get activities based on user role:
 * - Superadmins: See all activities from admin DB (system-wide)
 * - Organization users: See only their org's activities from org DB (filtered, no hidden types)
 */
export const getActivities = guardedQuery(async () => {
  const perfStart = performance.now();
  console.log('[activity.getActivities] 🚀 Starting fetch at', new Date().toISOString());
  
  try {
    const { locals } = getRequestEvent();
    const session = locals.session;
    const isSuperadmin = (locals.kuratchi as any)?.superadmin?.isSuperadmin?.();
    
    let db;
    let activities = [];
    
    if (isSuperadmin) {
      // Superadmins see everything from admin DB
      const dbAccessStart = performance.now();
      db = await (locals.kuratchi as any)?.getAdminDb?.();
      console.log(`[activity.getActivities] ⚡ Admin DB access: ${(performance.now() - dbAccessStart).toFixed(2)}ms`);
      
      if (!db) {
        console.error('[activity.getActivities] Admin database not configured');
        error(500, 'Admin database not configured');
      }
      
      const queryStart = performance.now();
      const activitiesResult = await db.activity
        .where({ deleted_at: { isNullish: true } })
        .orderBy({ created_at: 'desc' })
        .limit(100)
        .many();
      console.log(`[activity.getActivities] ⚡ Admin activities query (limit 100): ${(performance.now() - queryStart).toFixed(2)}ms`);
      
      activities = activitiesResult?.data || [];
    } else {
      // Organization users see only their org's activities (excluding hidden types)
      const activeOrgId = (locals.kuratchi as any)?.superadmin?.getActiveOrgId?.() || session?.organizationId;
      
      if (!activeOrgId) {
        console.log('[activity.getActivities] No organization ID found');
        return [];
      }
      
      const dbAccessStart = performance.now();
      // SDK now caches org metadata and ORM clients internally
      db = await (locals.kuratchi as any)?.orgDatabaseClient?.(activeOrgId);
      console.log(`[activity.getActivities] ⚡ Org DB access (${activeOrgId}): ${(performance.now() - dbAccessStart).toFixed(2)}ms`);
      
      if (!db) {
        console.error('[activity.getActivities] Organization database not configured');
        error(500, 'Organization database not configured');
      }
      
      // Note: org schema doesn't have isHidden field - hidden activities are only logged to admin DB
      const queryStart = performance.now();
      const activitiesResult = await db.activity
        .where({ deleted_at: { isNullish: true } })
        .orderBy({ created_at: 'desc' })
        .limit(100)
        .many();
      console.log(`[activity.getActivities] ⚡ Org activities query (limit 100): ${(performance.now() - queryStart).toFixed(2)}ms`);
      
      activities = activitiesResult?.data || [];
    }

    console.log('[activity.getActivities] Found activities:', activities.length);

    // Sort by most recent
    const sortStart = performance.now();
    const sorted = activities.sort((a: any, b: any) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    console.log(`[activity.getActivities] ⚡ Sorting: ${(performance.now() - sortStart).toFixed(2)}ms`);

    // Get unique user IDs
    const userIds = [...new Set(sorted.map((a: any) => a.userId).filter(Boolean))];
    console.log(`[activity.getActivities] Found ${userIds.length} unique users to fetch`);
    
    // Get user data from admin DB (users are centralized)
    const adminDbStart = performance.now();
    const adminDb = await (locals.kuratchi as any)?.getAdminDb?.();
    console.log(`[activity.getActivities] ⚡ Admin DB access for users: ${(performance.now() - adminDbStart).toFixed(2)}ms`);
    
    const usersQueryStart = performance.now();
    const usersResult = await adminDb?.users
      .where({ id: { in: userIds } })
      .many();
    console.log(`[activity.getActivities] ⚡ Users query: ${(performance.now() - usersQueryStart).toFixed(2)}ms`);
    
    const users = usersResult?.data || [];
    const userMap = new Map(users.map((u: any) => [u.id, u]));

    // Enrich activities with user data
    const enrichStart = performance.now();
    const enriched = sorted.map((activity: any) => {
      const user = activity.userId ? userMap.get(activity.userId) : null;
      
      // Parse data if it's a JSON string
      let parsedData = activity.data;
      if (typeof activity.data === 'string') {
        try {
          parsedData = JSON.parse(activity.data);
        } catch (e) {
          parsedData = activity.data;
        }
      }
      
      return {
        id: activity.id,
        userId: activity.userId,
        userName: (user as any)?.name || 'System',
        userEmail: (user as any)?.email || null,
        action: activity.action,
        data: parsedData,
        status: activity.status ?? true,
        isAdminAction: activity.isAdminAction || false,
        isHidden: activity.isHidden || false,
        organizationId: activity.organizationId,
        ip: activity.ip,
        userAgent: activity.userAgent,
        createdAt: activity.created_at
      };
    });

    console.log(`[activity.getActivities] ⚡ Enrichment: ${(performance.now() - enrichStart).toFixed(2)}ms`);
    
    const totalTime = performance.now() - perfStart;
    console.log(`[activity.getActivities] ✅ TOTAL TIME: ${totalTime.toFixed(2)}ms (${(totalTime / 1000).toFixed(2)}s)`);
    console.log('[activity.getActivities] Returning enriched activities:', enriched.length);

    return enriched;
  } catch (err) {
    const totalTime = performance.now() - perfStart;
    console.error(`[activity.getActivities] ❌ ERROR after ${totalTime.toFixed(2)}ms:`, err);
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
