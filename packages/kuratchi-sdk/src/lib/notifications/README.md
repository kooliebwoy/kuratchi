# Kuratchi Notifications

Comprehensive notification system for Kuratchi SDK with support for in-app notifications, email delivery (Resend + Cloudflare Email), platform monitoring, and queue-based processing.

## Features

- ✉️ **In-App Notifications** - Database-stored notifications with read/unread tracking
- 📧 **Email Notifications** - Dual email support:
  - **Resend** for user-facing emails
  - **Cloudflare Email Routing** for system/admin emails
- 🔔 **Platform Monitoring** - Automated alerts for suspicious activity:
  - Excessive database creation
  - Too many signups (rate limiting)
  - API abuse detection
  - Quota violations
- 🚀 **Queue-based Processing** - Cloudflare Workers Queues for batch delivery
- 🎨 **Notification Templates** - Reusable templates with variable substitution
- ⚙️ **User Preferences** - Granular control over notification delivery
- 🕐 **Quiet Hours** - Respect user's do-not-disturb settings
- 📊 **Analytics & Tracking** - Complete notification history and statistics

## Installation

The notifications module is part of `kuratchi-sdk`. Make sure you have it installed:

```bash
npm install kuratchi-sdk resend
```

## Setup

### 1. Add Database Schemas

Add the notification tables to your admin schema:

```typescript
import { notificationSchemas } from 'kuratchi-sdk/notifications';

export const adminSchema = {
  name: 'admin',
  version: 1,
  tables: {
    // Your existing tables...
    ...notificationSchemas, // Adds all 6 notification tables
  }
};
```

Or add individual schemas:

```typescript
import {
  notificationsTableSchema,
  emailNotificationsTableSchema,
  platformAlertsTableSchema,
  notificationTemplatesTableSchema,
  notificationPreferencesTableSchema,
  notificationQueueTableSchema,
} from 'kuratchi-sdk/notifications';
};
```

### 2. Configure Notifications

In your `hooks.server.ts`:

```typescript
import { kuratchi } from 'kuratchi-sdk';
import { sessionPlugin, adminPlugin } from 'kuratchi-sdk/auth';

export const { handle } = kuratchi({
  auth: {
    plugins: [sessionPlugin(), adminPlugin({ /* ... */ })]
  },
  
  // Add notifications configuration
  notifications: {
    // Resend for user emails
    resendApiKey: process.env.RESEND_API_KEY,
    resendFrom: 'notifications@yourdomain.com',
    resendFromName: 'Your App',

    // Cloudflare Email for system emails
    cloudflareEmail: {
      from: 'system@yourdomain.com',
      apiToken: process.env.CLOUDFLARE_API_TOKEN, // Optional
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID, // Optional
    },

    // System admin email for platform alerts
    systemEmail: 'admin@yourdomain.com',

    // Feature flags
    enableInApp: true,
    enableEmail: true,
    enableMonitoring: true,
    enableQueue: true,

    // Platform monitoring thresholds
    monitoringThresholds: {
      maxDatabasesPerHour: 10,
      maxDatabasesPerDay: 50,
      maxSignupsPerMinute: 5,
      maxSignupsPerHour: 50,
      maxApiCallsPerMinute: 100,
      maxApiCallsPerHour: 5000,
    },

    // Storage options
    storageDb: 'admin', // or 'org'
    batchSize: 10,
    defaultExpiryDays: 30,
  },
  
  // Other SDK configuration...
  email: { /* ... */ },
  stripe: { /* ... */ },
});
```

### 3. Add Cloudflare Bindings (Optional)

For Cloudflare Email and Queue support, add to your `wrangler.toml`:

```toml
# Email Sender binding
[[send_email]]
name = "EMAIL_SENDER"

# Notifications Queue
[[queues.producers]]
queue = "notifications-queue"
binding = "NOTIFICATIONS_QUEUE"

[[queues.consumers]]
queue = "notifications-queue"
max_batch_size = 10
max_batch_timeout = 5
```

## Usage

### Basic In-App Notification

```typescript
import { sendInAppNotification } from 'kuratchi-sdk/notifications';

export const POST = async ({ request, locals }) => {
  await sendInAppNotification(event, {
    userId: locals.user.id,
    title: 'Welcome!',
    message: 'Thanks for signing up.',
    category: 'account',
    priority: 'normal',
    actionUrl: '/dashboard',
    actionLabel: 'Get Started',
  });

  return json({ success: true });
};
```

### Send Email Notification

```typescript
import { sendEmailNotification } from 'kuratchi-sdk/notifications';

// User email (via Resend)
await sendEmailNotification(event, {
  to: 'user@example.com',
  subject: 'Your database is ready!',
  html: '<h1>Database Created</h1><p>Your database is ready to use.</p>',
  title: 'Database Created',
  message: 'Your database is ready to use.',
  category: 'database',
  priority: 'high',
  provider: 'resend', // default
  userId: locals.user.id,
});

// System email (via Cloudflare)
await sendEmailNotification(event, {
  to: 'admin@yourdomain.com',
  subject: 'Platform Alert',
  html: '<h1>Alert</h1><p>Suspicious activity detected.</p>',
  title: 'Platform Alert',
  message: 'Suspicious activity detected.',
  category: 'monitoring',
  priority: 'urgent',
  provider: 'cloudflare',
});
```

### Unified Notification (Both In-App & Email)

```typescript
import { sendNotification } from 'kuratchi-sdk/notifications';

await sendNotification(event, {
  userId: locals.user.id,
  email: locals.user.email,
  title: 'Database Created',
  message: 'Your database "my-db" is ready to use.',
  emailSubject: 'Your database is ready!',
  emailHtml: '<h1>Database Created</h1>...',
  category: 'database',
  priority: 'normal',
  channel: 'both', // 'in-app', 'email', or 'both'
  actionUrl: '/databases/my-db',
  actionLabel: 'View Database',
});
```

### Using Templates

Create a template:

```typescript
import { createTemplate } from 'kuratchi-sdk/notifications';

await createTemplate(event, {
  name: 'database_ready',
  category: 'database',
  channel: 'both',
  subject: 'Database {{ databaseName }} is ready!',
  title: 'Database Created',
  message: 'Your database {{ databaseName }} is ready to use.',
  html: `
    <h1>Database Created</h1>
    <p>Your database <strong>{{ databaseName }}</strong> is ready!</p>
    <p>Region: {{ region }}</p>
    <a href="{{ url }}">View Database</a>
  `,
  actionUrl: '/databases/{{ databaseId }}',
  actionLabel: 'View Database',
  variables: ['databaseName', 'databaseId', 'region', 'url'],
  isActive: true,
});
```

Send using template:

```typescript
import { sendTemplatedNotification } from 'kuratchi-sdk/notifications';

await sendTemplatedNotification(event, 'database_ready', {
  databaseName: 'my-awesome-db',
  databaseId: 'db-123',
  region: 'us-east-1',
  url: 'https://app.example.com/databases/db-123',
}, {
  userId: locals.user.id,
  email: locals.user.email,
  channel: 'both',
});
```

### Platform Monitoring

Track and alert on suspicious activity:

```typescript
import {
  trackActivity,
  checkExcessiveDatabaseCreation,
  checkExcessiveSignups,
  createPlatformAlert,
} from 'kuratchi-sdk/notifications';

// Track database creation
await trackActivity(`db_creation:${userId}`, 60); // 60-minute window
const exceeded = await checkExcessiveDatabaseCreation(event, userId);

if (exceeded) {
  // Alert was automatically created and sent to system email
  console.log('User exceeded database creation limits');
}

// Track signups
const ipAddress = request.headers.get('cf-connecting-ip');
await trackActivity(`signups:${ipAddress}`, 1); // 1-minute window
await checkExcessiveSignups(event, ipAddress);

// Manual alert
await createPlatformAlert(event, {
  type: 'quota_exceeded',
  severity: 'high',
  title: 'Storage Quota Exceeded',
  message: `User ${userId} exceeded storage quota`,
  affectedUserId: userId,
  threshold: 100,
  currentValue: 125,
  timeWindow: '1 hour',
  notifySystemEmail: true,
});
```

### User Preferences

Manage user notification preferences:

```typescript
import {
  getUserPreferences,
  updateCategoryPreference,
  setQuietHours,
  toggleEmailNotifications,
} from 'kuratchi-sdk/notifications';

// Get preferences
const prefs = await getUserPreferences(event, userId);

// Disable email notifications
await toggleEmailNotifications(event, userId, false);

// Set quiet hours (22:00 - 08:00)
await setQuietHours(event, userId, true, '22:00', '08:00', 'America/New_York');

// Configure category preferences
await updateCategoryPreference(event, userId, 'feature', {
  enabled: true,
  channels: ['in-app'], // Only in-app for feature announcements
  minPriority: 'low',
});

// Disable all billing notifications
await updateCategoryPreference(event, userId, 'billing', {
  enabled: false,
});
```

### Queue Processing

Queue notifications for batch processing:

```typescript
import { queueNotification } from 'kuratchi-sdk/notifications';

// Queue for later processing
await queueNotification(event, {
  type: 'email',
  priority: 'normal',
  userId: locals.user.id,
  email: locals.user.email,
  notification: {
    title: 'Weekly Digest',
    message: 'Your weekly activity summary...',
    category: 'account',
    priority: 'low',
  },
  emailData: {
    subject: 'Weekly Digest',
    html: '<h1>Weekly Digest</h1>...',
    provider: 'resend',
  },
  scheduledFor: new Date(Date.now() + 3600000).toISOString(), // 1 hour later
});
```

Process queue:

```typescript
import { processBatchFromDatabase } from 'kuratchi-sdk/notifications';

// In a cron job or scheduled worker
const result = await processBatchFromDatabase(event, 10); // Process 10 items

console.log(`Processed ${result.successful} successfully, ${result.failed} failed`);
```

### Get Notification History

```typescript
import { getUserNotifications, getUnreadCount } from 'kuratchi-sdk/notifications';

// Get user's notifications
const notifications = await getUserNotifications(event, {
  userId: locals.user.id,
  unreadOnly: true,
  category: 'database',
  limit: 20,
  offset: 0,
});

// Get unread count
const unreadCount = await getUnreadCount(event, locals.user.id);

// Mark as read
import { markNotificationAsRead } from 'kuratchi-sdk/notifications';
await markNotificationAsRead(event, notificationId);

// Mark all as read
import { markAllNotificationsAsRead } from 'kuratchi-sdk/notifications';
await markAllNotificationsAsRead(event, userId);
```

### Statistics & Analytics

```typescript
import { getNotificationStats, getQueueStats } from 'kuratchi-sdk/notifications';

// Notification stats
const stats = await getNotificationStats(event, userId);
console.log(`Total: ${stats.total}, Unread: ${stats.total - stats.read}`);
console.log(`By category:`, stats.byCategory);
console.log(`By priority:`, stats.byPriority);

// Queue stats
const queueStats = await getQueueStats(event);
console.log(`Pending: ${queueStats.pending}, Failed: ${queueStats.failed}`);
```

## API Reference

### Core Functions

- `initNotifications(options)` - Initialize the notification system
- `sendNotification(event, options)` - Send unified notification (in-app + email)
- `sendTemplatedNotification(event, templateName, vars, options)` - Send using template

### In-App Notifications

- `sendInAppNotification(event, options)` - Send in-app notification
- `getUserNotifications(event, filters)` - Get user's notifications
- `getNotificationById(event, id)` - Get specific notification
- `markNotificationAsRead(event, id)` - Mark as read
- `markAllNotificationsAsRead(event, userId)` - Mark all as read
- `deleteNotification(event, id)` - Delete notification
- `getUnreadCount(event, userId)` - Get unread count
- `getNotificationStats(event, userId)` - Get statistics

### Email Notifications

- `sendEmailNotification(event, options)` - Send email
- `sendTemplatedEmail(event, templateId, vars, options)` - Send with template
- `getEmailHistory(event, filters)` - Get email history
- `getEmailById(event, id)` - Get specific email
- `updateEmailStatus(event, providerId, status)` - Update status (webhooks)

### Platform Monitoring

- `createPlatformAlert(event, options)` - Create alert
- `checkExcessiveDatabaseCreation(event, userId)` - Check DB creation rate
- `checkExcessiveSignups(event, ipAddress)` - Check signup rate
- `checkExcessiveApiCalls(event, userId)` - Check API call rate
- `trackActivity(key, windowMinutes)` - Track activity
- `getPlatformAlerts(event, filters)` - Get alerts
- `resolvePlatformAlert(event, id)` - Mark alert as resolved
- `getAlertStats(event)` - Get alert statistics

### Templates

- `createTemplate(event, template)` - Create template
- `getTemplateById(event, id)` - Get template
- `getTemplateByName(event, name)` - Get template by name
- `getAllTemplates(event, filters)` - Get all templates
- `updateTemplate(event, id, updates)` - Update template
- `deleteTemplate(event, id)` - Delete template
- `renderTemplate(template, vars)` - Render with variables
- `seedDefaultTemplates(event)` - Create default templates

### User Preferences

- `getUserPreferences(event, userId)` - Get preferences
- `updateUserPreferences(event, userId, updates)` - Update preferences
- `updateCategoryPreference(event, userId, category, settings)` - Update category
- `toggleAllNotifications(event, userId, enabled)` - Toggle all
- `toggleInAppNotifications(event, userId, enabled)` - Toggle in-app
- `toggleEmailNotifications(event, userId, enabled)` - Toggle email
- `setQuietHours(event, userId, enabled, start, end, tz)` - Set quiet hours
- `setDigestPreferences(event, userId, enabled, freq, time)` - Configure digest
- `shouldSendNotification(event, userId, category, priority, channel)` - Check if allowed
- `resetPreferences(event, userId)` - Reset to defaults

### Queue Processing

- `queueNotification(event, message)` - Add to queue
- `processQueueMessage(event, message)` - Process single message
- `processBatchFromDatabase(event, batchSize)` - Process batch
- `handleQueueBatch(batch, env, createEvent)` - Queue consumer handler
- `getQueueStats(event)` - Get queue statistics
- `cleanupQueueItems(event, days)` - Cleanup old items

## Database Tables

The notification system uses 6 tables:

1. **notifications** - In-app notifications
2. **email_notifications** - Email tracking
3. **platform_alerts** - Platform monitoring alerts
4. **notification_templates** - Reusable templates
5. **notification_preferences** - User preferences
6. **notification_queue** - Queue for batch processing

## Notification Categories

- `system` - System-level notifications
- `database` - Database-related notifications
- `security` - Security alerts
- `billing` - Billing and payments
- `account` - Account-related
- `feature` - Feature updates
- `monitoring` - Platform monitoring
- `custom` - User-defined

## Priority Levels

- `urgent` - Critical, bypasses quiet hours
- `high` - Important notifications
- `normal` - Standard notifications
- `low` - Low-priority updates

## Best Practices

1. **Use Templates** - Create reusable templates for common notifications
2. **Respect Preferences** - Always check user preferences before sending
3. **Queue Non-Urgent** - Use queue for batch processing of non-urgent notifications
4. **Monitor Rates** - Use platform monitoring to detect abuse
5. **Set Expiry** - Set expiration dates for time-sensitive notifications
6. **Clean Up** - Regularly cleanup old notifications and queue items
7. **Test Both Channels** - Test in-app and email delivery separately

## Examples

See the examples in the `/examples` directory for complete implementations.

## Support

For issues and questions, please open an issue on GitHub.

## License

MIT