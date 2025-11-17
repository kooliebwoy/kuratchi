/**
 * Mark Notification as Read API
 * POST - Mark one or more notifications as read
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  markNotificationAsRead,
  markNotificationsAsRead,
  markAllNotificationsAsRead,
} from 'kuratchi-sdk/notifications';

export const POST: RequestHandler = async (event) => {
  const { locals, request } = event;

  // Check authentication
  if (!locals.session?.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { notificationId, notificationIds, markAll } = body;

    // Mark all notifications as read
    if (markAll) {
      const success = await markAllNotificationsAsRead(
        event,
        locals.session.user.id,
        locals.session.organizationId
      );

      return json({
        success,
        message: success ? 'All notifications marked as read' : 'Failed to mark notifications as read',
      });
    }

    // Mark multiple notifications as read
    if (notificationIds && Array.isArray(notificationIds)) {
      const result = await markNotificationsAsRead(
        event,
        notificationIds,
        locals.session.organizationId
      );

      return json({
        success: result.success > 0,
        successCount: result.success,
        failedCount: result.failed,
        message: `Marked ${result.success} notification(s) as read`,
      });
    }

    // Mark single notification as read
    if (notificationId) {
      const success = await markNotificationAsRead(
        event,
        notificationId,
        locals.session.organizationId
      );

      return json({
        success,
        message: success ? 'Notification marked as read' : 'Failed to mark notification as read',
      });
    }

    return json(
      {
        success: false,
        error: 'Missing notificationId, notificationIds, or markAll parameter',
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[API] Failed to mark notification as read:', error);
    return json(
      {
        success: false,
        error: error.message || 'Failed to mark notification as read',
      },
      { status: 500 }
    );
  }
};
