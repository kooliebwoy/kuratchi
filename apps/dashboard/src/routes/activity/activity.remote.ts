/**
 * Activity Remote Functions
 * Thin wrapper around SDK activity plugin for SvelteKit app/server context
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
 * Get all activities from admin database with enriched user data
 */
export const getActivities = guardedQuery(async () => {
  try {
    const { locals } = getRequestEvent();
    const adminDb = await locals.kuratchi?.getAdminDb?.();
    if (!adminDb) error(500, 'Admin database not configured');

    // Get all activities
    const activitiesResult = await adminDb.activity
      .where({ deleted_at: { isNullish: true } })
      .many();
    
    const activities = activitiesResult?.data || [];

    // Sort by most recent
    const sorted = activities.sort((a: any, b: any) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // Get unique user IDs
    const userIds = [...new Set(sorted.map((a: any) => a.userId).filter(Boolean))];
    
    // Get user data
    const usersResult = await adminDb.users
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
        userName: user?.name || 'System',
        userEmail: user?.email || null,
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

    return enriched;
  } catch (err) {
    console.error('[activity.getActivities] error:', err);
    return [];
  }
});

/**
 * Get activity statistics
 */
export const getActivityStats = guardedQuery(async () => {
  try {
    const { locals } = getRequestEvent();
    const adminDb = await locals.kuratchi?.getAdminDb?.();
    if (!adminDb) error(500, 'Admin database not configured');

    const activitiesResult = await adminDb.activity
      .where({ deleted_at: { isNullish: true } })
      .many();
    
    const activities = activitiesResult?.data || [];

    // Calculate stats
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

    const last24h = activities.filter((a: any) => new Date(a.created_at).getTime() > oneDayAgo).length;
    const last7d = activities.filter((a: any) => new Date(a.created_at).getTime() > oneWeekAgo).length;
    const last30d = activities.filter((a: any) => new Date(a.created_at).getTime() > oneMonthAgo).length;
    
    const adminActions = activities.filter((a: any) => a.isAdminAction).length;
    const userActions = activities.length - adminActions;
    const failedActions = activities.filter((a: any) => a.status === false).length;

    // Get unique active users
    const activeUsers = new Set(activities.map((a: any) => a.userId).filter(Boolean)).size;

    return {
      total: activities.length,
      last24h,
      last7d,
      last30d,
      adminActions,
      userActions,
      failedActions,
      activeUsers
    };
  } catch (err) {
    console.error('[activity.getActivityStats] error:', err);
    return {
      total: 0,
      last24h: 0,
      last7d: 0,
      last30d: 0,
      adminActions: 0,
      userActions: 0,
      failedActions: 0,
      activeUsers: 0
    };
  }
});

/**
 * Clear old activities (older than 90 days)
 */
export const clearOldActivities = guardedForm(
  v.object({ daysOld: v.optional(v.number()) }),
  async ({ daysOld = 90 }) => {
    try {
      const { locals } = getRequestEvent();
      const adminDb = await locals.kuratchi?.getAdminDb?.();
      if (!adminDb) error(500, 'Admin database not configured');

      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();

      // Soft delete old activities
      const result = await adminDb.activity
        .where({ created_at: { lt: cutoffDate } })
        .update({ deleted_at: new Date().toISOString() });

      await getActivities().refresh();
      await getActivityStats().refresh();

      return { success: true, deletedCount: result?.affectedRows || 0 };
    } catch (err) {
      console.error('[activity.clearOldActivities] error:', err);
      error(500, 'Failed to clear old activities');
    }
  }
);
