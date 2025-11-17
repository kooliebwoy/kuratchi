/**
 * Test Notification API
 * POST - Send a test notification to the current user
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sendInAppNotification } from '$lib/utils/notifications';

export const POST: RequestHandler = async (event) => {
  const { locals } = event;

  // Check authentication
  if (!locals.session?.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await event.request.json();
    const { type = 'welcome' } = body;

    let result;

    switch (type) {
      case 'welcome':
        result = await sendInAppNotification(
          event,
          locals.session.user.id,
          'Welcome to Kuratchi! 🎉',
          'Thanks for trying out our notifications system. This is a test notification.',
          {
            category: 'account',
            priority: 'normal',
            actionUrl: '/database',
            actionLabel: 'Get Started',
          }
        );
        break;

      case 'database':
        result = await sendInAppNotification(
          event,
          locals.session.user.id,
          'Database Created Successfully',
          'Your test database "my-awesome-db" is ready to use.',
          {
            category: 'database',
            priority: 'high',
            actionUrl: '/database',
            actionLabel: 'View Database',
          }
        );
        break;

      case 'security':
        result = await sendInAppNotification(
          event,
          locals.session.user.id,
          'Security Alert',
          'New login detected from a different location.',
          {
            category: 'security',
            priority: 'urgent',
            actionUrl: '/settings',
            actionLabel: 'Review Activity',
          }
        );
        break;

      case 'billing':
        result = await sendInAppNotification(
          event,
          locals.session.user.id,
          'Payment Successful',
          'Your payment of $29.99 has been processed successfully.',
          {
            category: 'billing',
            priority: 'normal',
            actionUrl: '/settings/billing',
            actionLabel: 'View Invoice',
          }
        );
        break;

      default:
        result = await sendInAppNotification(
          event,
          locals.session.user.id,
          'Test Notification',
          'This is a test notification from Kuratchi.',
          {
            category: 'custom',
            priority: 'low',
          }
        );
    }

    return json({
      success: result.success,
      message: 'Test notification sent successfully',
      notificationId: result.id,
    });
  } catch (error: any) {
    console.error('[API] Failed to send test notification:', error);
    return json(
      {
        success: false,
        error: error.message || 'Failed to send test notification',
      },
      { status: 500 }
    );
  }
};
