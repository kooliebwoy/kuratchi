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
 * Get all activities from admin database with enriched user data
 */
export const getActivities = guardedQuery(async () => {
  try {
    const { locals } = getRequestEvent();
    const adminDb = await getDatabase(locals);
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

/**
 * Get all activity types
 */
export const getActivityTypes = guardedQuery(async () => {
  try {
    const { locals } = getRequestEvent();
    const adminDb = await locals.kuratchi?.getAdminDb?.();
    if (!adminDb) error(500, 'Admin database not configured');

    const result = await adminDb.activityTypes
      .where({ deleted_at: { isNullish: true } })
      .many();

    return result?.data || [];
  } catch (err) {
    console.error('[activity.getActivityTypes] error:', err);
    return [];
  }
});

/**
 * Create activity type
 */
export const createActivityType = guardedForm(
  v.object({
    action: v.pipe(v.string(), v.nonEmpty()),
    label: v.pipe(v.string(), v.nonEmpty()),
    category: v.optional(v.string()),
    severity: v.optional(v.picklist(['info', 'warning', 'critical'])),
    description: v.optional(v.string()),
    isAdminAction: v.optional(v.boolean()),
    isHidden: v.optional(v.boolean())
  }),
  async (data) => {
    try {
      const { locals } = getRequestEvent();
      const adminDb = await locals.kuratchi?.getAdminDb?.();
      if (!adminDb) error(500, 'Admin database not configured');

      const now = new Date().toISOString();
      const id = crypto.randomUUID();

      const result = await adminDb.activityTypes.insert({
        id,
        action: data.action,
        label: data.label,
        category: data.category || null,
        severity: data.severity || 'info',
        description: data.description || null,
        isAdminAction: data.isAdminAction ?? false,
        isHidden: data.isHidden ?? false,
        created_at: now,
        updated_at: now,
        deleted_at: null
      });

      if (!result.success) {
        console.error('[activity.createActivityType] error:', result.error);
        error(500, `Failed to create activity type: ${result.error}`);
      }

      await getActivityTypes().refresh();

      return { success: true, id };
    } catch (err) {
      console.error('[activity.createActivityType] error:', err);
      error(500, 'Failed to create activity type');
    }
  }
);

/**
 * Update activity type
 */
export const updateActivityType = guardedForm(
  v.object({
    id: v.pipe(v.string(), v.nonEmpty()),
    label: v.optional(v.pipe(v.string(), v.nonEmpty())),
    category: v.optional(v.string()),
    severity: v.optional(v.picklist(['info', 'warning', 'critical'])),
    description: v.optional(v.string()),
    isAdminAction: v.optional(v.boolean()),
    isHidden: v.optional(v.boolean())
  }),
  async (data) => {
    try {
      const { locals } = getRequestEvent();
      const adminDb = await locals.kuratchi?.getAdminDb?.();
      if (!adminDb) error(500, 'Admin database not configured');

      const now = new Date().toISOString();
      const updateData: any = { updated_at: now };

      if (data.label !== undefined) updateData.label = data.label;
      if (data.category !== undefined) updateData.category = data.category;
      if (data.severity !== undefined) updateData.severity = data.severity;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.isAdminAction !== undefined) updateData.isAdminAction = data.isAdminAction;
      if (data.isHidden !== undefined) updateData.isHidden = data.isHidden;

      const result = await adminDb.activityTypes
        .where({ id: data.id })
        .update(updateData);

      if (!result.success) {
        console.error('[activity.updateActivityType] error:', result.error);
        error(500, `Failed to update activity type: ${result.error}`);
      }

      await getActivityTypes().refresh();

      return { success: true };
    } catch (err) {
      console.error('[activity.updateActivityType] error:', err);
      error(500, 'Failed to update activity type');
    }
  }
);

/**
 * Delete activity type
 */
export const deleteActivityType = guardedForm(
  v.object({
    id: v.pipe(v.string(), v.nonEmpty())
  }),
  async ({ id }) => {
    try {
      const { locals } = getRequestEvent();
      const adminDb = await locals.kuratchi?.getAdminDb?.();
      if (!adminDb) error(500, 'Admin database not configured');

      const now = new Date().toISOString();

      const result = await adminDb.activityTypes
        .where({ id })
        .update({
          deleted_at: now,
          updated_at: now
        });

      if (!result.success) {
        console.error('[activity.deleteActivityType] error:', result.error);
        error(500, `Failed to delete activity type: ${result.error}`);
      }

      await getActivityTypes().refresh();

      return { success: true };
    } catch (err) {
      console.error('[activity.deleteActivityType] error:', err);
      error(500, 'Failed to delete activity type');
    }
  }
);
