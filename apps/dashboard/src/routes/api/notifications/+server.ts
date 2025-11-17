/**
 * Notifications API
 * GET - Fetch user notifications
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserNotifications, getUnreadCount } from 'kuratchi-sdk/notifications';

export const GET: RequestHandler = async (event) => {
  const { locals, url } = event;

  // Check authentication
  if (!locals.session?.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get query parameters
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
    const category = url.searchParams.get('category') || undefined;

    // Fetch notifications
    const notifications = await getUserNotifications(event, {
      userId: locals.session.user.id,
      organizationId: locals.session.organizationId,
      limit,
      offset,
      unreadOnly,
      category: category as any,
    });

    // Get unread count
    const unreadCount = await getUnreadCount(
      event,
      locals.session.user.id,
      locals.session.organizationId
    );

    return json({
      success: true,
      notifications,
      unreadCount,
      pagination: {
        limit,
        offset,
        hasMore: notifications.length === limit,
      },
    });
  } catch (error: any) {
    console.error('[API] Failed to fetch notifications:', error);
    return json(
      {
        success: false,
        error: error.message || 'Failed to fetch notifications',
      },
      { status: 500 }
    );
  }
};
