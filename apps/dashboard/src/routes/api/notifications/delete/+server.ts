/**
 * Delete Notification API
 * DELETE - Delete one or more notifications
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  deleteNotification,
  deleteNotifications,
} from 'kuratchi-sdk/notifications';

export const DELETE: RequestHandler = async (event) => {
  const { locals, url } = event;

  // Check authentication
  if (!locals.session?.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get notification ID(s) from query params
    const notificationId = url.searchParams.get('id');
    const notificationIds = url.searchParams.get('ids')?.split(',');

    // Delete multiple notifications
    if (notificationIds && notificationIds.length > 0) {
      const result = await deleteNotifications(
        event,
        notificationIds,
        locals.session.organizationId
      );

      return json({
        success: result.success > 0,
        successCount: result.success,
        failedCount: result.failed,
        message: `Deleted ${result.success} notification(s)`,
      });
    }

    // Delete single notification
    if (notificationId) {
      const success = await deleteNotification(
        event,
        notificationId,
        locals.session.organizationId
      );

      return json({
        success,
        message: success ? 'Notification deleted' : 'Failed to delete notification',
      });
    }

    return json(
      {
        success: false,
        error: 'Missing id or ids parameter',
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[API] Failed to delete notification:', error);
    return json(
      {
        success: false,
        error: error.message || 'Failed to delete notification',
      },
      { status: 500 }
    );
  }
};
