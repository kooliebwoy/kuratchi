# Kuratchi Notifications - Quick Start Guide

Get up and running with notifications in 5 minutes!

## Step 1: Add Database Schemas

Add to your admin schema (e.g., `schema/admin.ts`):

```typescript
import { notificationSchemas } from 'kuratchi-sdk/notifications';

export const adminSchema = {
  name: 'admin',
  version: 1, // Increment if you already have a schema
  tables: {
    // ... your existing tables
    ...notificationSchemas, // Adds 6 notification tables
  }
};
```

## Step 2: Configure Notifications

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
    // Resend for user emails (required for user notifications)
    resendApiKey: process.env.RESEND_API_KEY!,
    resendFrom: 'noreply@yourdomain.com',
    resendFromName: 'Your App',

    // Cloudflare Email for system emails (optional but recommended)
    cloudflareEmail: {
      from: 'system@yourdomain.com',
    },

    // System admin email for alerts (optional)
    systemEmail: 'admin@yourdomain.com',

    // Enable features
    enableInApp: true,
    enableEmail: true,
    enableMonitoring: true,
  },
  
  // Other SDK configuration...
  email: { /* ... */ },
  stripe: { /* ... */ },
});
```

## Step 3: Send Your First Notification

### In-App Only

```typescript
import { sendInAppNotification } from 'kuratchi-sdk/notifications';

export const POST = async ({ request, locals }) => {
  await sendInAppNotification(locals.event, {
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

### Email Only

```typescript
import { sendEmailNotification } from 'kuratchi-sdk/notifications';

await sendEmailNotification(event, {
  to: user.email,
  subject: 'Welcome to Our App!',
  html: '<h1>Welcome!</h1><p>Thanks for joining.</p>',
  title: 'Welcome',
  message: 'Welcome to our app',
  category: 'account',
  provider: 'resend', // or 'cloudflare'
  userId: user.id,
});
```

### Both In-App & Email

```typescript
import { sendNotification } from 'kuratchi-sdk/notifications';

await sendNotification(event, {
  userId: user.id,
  email: user.email,
  title: 'Database Created',
  message: 'Your database is ready!',
  emailSubject: 'Database Ready',
  emailHtml: '<h1>Your database is ready!</h1>',
  category: 'database',
  priority: 'high',
  channel: 'both', // Sends to both in-app and email
  actionUrl: '/databases/my-db',
  actionLabel: 'View Database',
});
```

## Step 4: Display In-App Notifications (Frontend)

```typescript
import { getUserNotifications, getUnreadCount } from 'kuratchi-sdk/notifications';

// In your +page.server.ts
export const load = async ({ locals }) => {
  const notifications = await getUserNotifications(locals.event, {
    userId: locals.user.id,
    limit: 10,
  });

  const unreadCount = await getUnreadCount(locals.event, locals.user.id);

  return { notifications, unreadCount };
};
```

```svelte
<!-- In your +page.svelte -->
<script lang="ts">
  export let data;
</script>

<div class="notifications">
  <h2>Notifications ({data.unreadCount})</h2>
  
  {#each data.notifications as notification}
    <div class="notification" class:unread={!notification.readAt}>
      <h3>{notification.title}</h3>
      <p>{notification.message}</p>
      {#if notification.actionUrl}
        <a href={notification.actionUrl}>{notification.actionLabel || 'View'}</a>
      {/if}
    </div>
  {/each}
</div>
```

## Step 5: Add Platform Monitoring (Optional)

Monitor and prevent abuse:

```typescript
import { trackActivity, checkExcessiveDatabaseCreation } from 'kuratchi-sdk/notifications';

export const createDatabase = async ({ request, locals }) => {
  const userId = locals.user.id;

  // Track activity
  await trackActivity(`db_creation:${userId}`, 60);

  // Check if user is creating too many databases
  const exceeded = await checkExcessiveDatabaseCreation(locals.event, userId);

  if (exceeded) {
    return json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // Create database...
};
```

## Environment Variables

Add to your `.env`:

```bash
# Required for user emails
RESEND_API_KEY=re_xxxxxxxxxxxxx

# Optional for system emails via Cloudflare API
CLOUDFLARE_API_TOKEN=your_token
CLOUDFLARE_ACCOUNT_ID=your_account_id
```

## Cloudflare Bindings (Optional)

Add to `wrangler.toml` for Cloudflare Email and Queues:

```toml
# Email sender binding
[[send_email]]
name = "EMAIL_SENDER"

# Queue for batch processing (optional)
[[queues.producers]]
queue = "notifications-queue"
binding = "NOTIFICATIONS_QUEUE"
```

## Common Use Cases

### Welcome Email

```typescript
await sendNotification(event, {
  userId: newUser.id,
  email: newUser.email,
  title: 'Welcome!',
  message: 'Thanks for signing up.',
  emailSubject: 'Welcome to Our App',
  emailHtml: welcomeEmailTemplate,
  category: 'account',
  channel: 'both',
});
```

### Database Ready

```typescript
await sendNotification(event, {
  userId: user.id,
  email: user.email,
  title: 'Database Created',
  message: `Your database "${dbName}" is ready.`,
  emailSubject: 'Database Ready',
  emailHtml: `<h1>Database Ready!</h1>...`,
  category: 'database',
  priority: 'high',
  channel: 'both',
  actionUrl: `/databases/${dbId}`,
});
```

### Security Alert

```typescript
await sendNotification(event, {
  userId: user.id,
  email: user.email,
  title: 'Security Alert',
  message: 'New login from unknown device',
  emailSubject: '⚠️ Security Alert',
  category: 'security',
  priority: 'urgent',
  channel: 'both',
});
```

### System Alert (to admin)

```typescript
await sendEmailNotification(event, {
  to: 'admin@yourdomain.com',
  subject: '🚨 Platform Alert',
  html: '<h2>High error rate detected</h2>',
  title: 'Platform Alert',
  message: 'High error rate',
  category: 'monitoring',
  priority: 'urgent',
  provider: 'cloudflare', // Use Cloudflare for system emails
});
```

## Next Steps

- 📖 Read the [full README](./README.md) for advanced features
- 🎨 Use [templates](./templates.ts) for reusable notifications
- ⚙️ Configure [user preferences](./preferences.ts)
- 🚀 Set up [queue processing](../examples/notifications-queue-worker/)
- 📊 View [analytics](./in-app.ts) and statistics

## Troubleshooting

### Notifications not appearing?
- Check that schemas are added to your database
- Verify `initNotifications()` is called at app startup
- Check user preferences aren't blocking notifications

### Emails not sending?
- Verify `RESEND_API_KEY` is set correctly
- Check `resendFrom` email is verified in Resend
- For Cloudflare Email, verify bindings in `wrangler.toml`

### Platform monitoring not working?
- Ensure `enableMonitoring: true` in config
- Set `systemEmail` for alert delivery
- Configure `monitoringThresholds` as needed

## Support

Questions? Check:
- [Full Documentation](./README.md)
- [Examples](../examples/notifications-usage.ts)
- [Type Definitions](./types.ts)

---

That's it! You're ready to send notifications. 🎉