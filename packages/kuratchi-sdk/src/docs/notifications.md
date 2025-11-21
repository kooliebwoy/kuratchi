# Notifications

The notifications module ships with in-app records, email delivery (Resend or Cloudflare Email Routing), platform monitoring alerts, queues, templates, and user preferences. Everything is initialized from the `notifications` block when you call `kuratchi()`—no extra wiring is required.

## Configure

```ts
import { kuratchi } from 'kuratchi-sdk';

const app = kuratchi({
  notifications: {
    resendApiKey: process.env.RESEND_API_KEY,
    resendFrom: 'noreply@example.com',
    cloudflareEmail: { from: 'system@example.com' },
    systemEmail: 'ops@example.com',
    monitoringThresholds: {
      maxDatabasesPerHour: 10,
      maxSignupsPerMinute: 5
    },
    storageDb: 'admin',      // or 'org'
    queueName: 'notifications',
    enableQueue: true,
    defaultExpiryDays: 30
  }
});

export const handle = app.handle;
```

Options mirror `NotificationPluginOptions` in `src/lib/notifications/types.ts` (enable/disable channels, thresholds, queue settings, and where to store records).

## Send notifications

Use `sendNotification` to route to in-app and/or email automatically based on the payload and user preferences.

```ts
import { notifications } from 'kuratchi-sdk';

export const POST = async (event) => {
  await notifications.sendNotification(event, {
    userId: event.locals.user?.id,
    title: 'Database created',
    message: 'Your org database is ready.',
    category: 'database',
    priority: 'high',
    channel: 'both',
    email: event.locals.user?.email,
    emailSubject: 'Your database is ready'
  });

  return new Response('ok');
};
```

All convenience methods in `src/lib/notifications/index.ts` are available for finer control:

- In-app: `getUserNotifications`, `markNotificationAsRead`, `markNotificationsAsRead`, `getUnreadCount`, `cleanupExpiredNotifications`
- Email: `sendEmailNotification`, `getEmailHistory`, `updateEmailStatus`, `sendTemplatedEmail`
- Platform monitoring: `createPlatformAlert`, `checkExcessiveDatabaseCreation`, `checkExcessiveSignups`, `checkExcessiveApiCalls`
- Templates & preferences: `createTemplate`, `renderTemplate`, `getUserPreferences`, `updateUserPreferences`, `toggleAllNotifications`, `setQuietHours`
- Queue processing: `queueNotification`, `processQueueMessage`, `processBatchFromDatabase`, `getQueueStats`

All functions are typed and return `null`/`false` rather than throwing when bindings are missing so production apps can degrade gracefully.
