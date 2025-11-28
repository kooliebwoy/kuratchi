/**
 * Create Notification API
 * POST - Create a new in-app notification for the current user
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sendInAppNotification } from 'kuratchi-sdk/notifications';

export const POST: RequestHandler = async (event) => {
  const { locals, request } = event;

  // Check authentication
  if (!locals.session?.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, message, category, priority, actionUrl, actionLabel } = body;

    if (!title || !message) {
      return json({ error: 'Title and message are required' }, { status: 400 });
    }

    // Create the notification
    const result = await sendInAppNotification(event, {
      userId: locals.session.user.id,
      organizationId: locals.session.organizationId,
      title,
      message,
      category: category || 'system',
      priority: priority || 'normal',
      actionUrl,
      actionLabel,
    });

    if (result.success) {
      return json({
        success: true,
        notificationId: result.notificationId,
      });
    } else {
      return json(
        {
          success: false,
          error: result.error || 'Failed to create notification',
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[API] Failed to create notification:', error);
    return json(
      {
        success: false,
        error: error.message || 'Failed to create notification',
      },
      { status: 500 }
    );
  }
};
