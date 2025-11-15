/**
 * Example hooks.server.ts with Notifications
 *
 * This shows how to integrate the notifications module into your existing
 * Kuratchi SDK configuration alongside auth, email, and Stripe.
 */

import {
  sessionPlugin,
  adminPlugin,
  organizationPlugin,
  credentialsPlugin,
  activityPlugin,
  rolesPlugin,
  oauthPlugin
} from 'kuratchi-sdk/auth';
import { adminSchema } from '$lib/schemas/admin';
import { organizationSchema } from '$lib/schemas/organization';
import { activityTypes } from '$lib/config/activity-types';
import { roles } from '$lib/config/roles';
import { kuratchi } from 'kuratchi-sdk';
import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const { handle }: { handle: Handle } = kuratchi({
  // Authentication configuration
  auth: {
    plugins: [
      sessionPlugin(),
      adminPlugin({
        adminSchema,
        organizationSchema,
        adminDatabase: 'ADMIN_DB'
      }),
      organizationPlugin({ organizationSchema }),
      credentialsPlugin(),
      oauthPlugin({
        providers: [
          {
            name: 'google',
            clientId: env.GOOGLE_CLIENT_ID || '',
            clientSecret: env.GOOGLE_CLIENT_SECRET || ''
          },
          {
            name: 'github',
            clientId: env.GITHUB_CLIENT_ID || '',
            clientSecret: env.GITHUB_CLIENT_SECRET || ''
          }
        ]
      }),
      activityPlugin({ define: activityTypes }),
      rolesPlugin({
        define: roles,
        default: 'viewer'
      })
    ]
  },

  // Email configuration (existing)
  email: {
    apiKey: env.RESEND_API_KEY,
    from: env.RESEND_FROM_EMAIL,
    fromName: 'Kuratchi',
    trackEmails: true,
    trackingDb: 'admin',
    trackingTable: 'emails'
  },

  // Storage configuration
  storage: {
    kv: { default: 'KV', KV: 'KV' },
    r2: { default: 'BUCKET', R2: 'BUCKET' }
  },

  // Stripe configuration (existing)
  stripe: {
    apiKey: env.STRIPE_SECRET_KEY,
    trackEvents: true,
    trackingDb: 'admin'
  },

  // Notifications configuration (NEW!)
  notifications: {
    // Resend for user-facing emails (uses same API key as email config)
    resendApiKey: env.RESEND_API_KEY,
    resendFrom: env.RESEND_FROM_EMAIL,
    resendFromName: 'Kuratchi',

    // Cloudflare Email for system/admin emails (cost-effective for internal alerts)
    cloudflareEmail: {
      from: 'system@kuratchi.dev',
      apiToken: env.CLOUDFLARE_API_TOKEN,
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
    },

    // System admin email for platform monitoring alerts
    systemEmail: env.ADMIN_EMAIL || 'admin@kuratchi.dev',

    // Enable all notification features
    enableInApp: true,
    enableEmail: true,
    enableMonitoring: true,
    enableQueue: true,

    // Platform monitoring thresholds
    monitoringThresholds: {
      // Database creation limits
      maxDatabasesPerHour: 10,
      maxDatabasesPerDay: 50,

      // Signup rate limiting
      maxSignupsPerMinute: 5,
      maxSignupsPerHour: 50,

      // API abuse detection
      maxApiCallsPerMinute: 100,
      maxApiCallsPerHour: 5000,
    },

    // Storage and queue settings
    storageDb: 'admin', // Store notifications in admin DB
    batchSize: 10,      // Process 10 notifications per batch
    defaultExpiryDays: 30, // Auto-expire old notifications after 30 days
  },
});

/**
 * Usage Examples
 *
 * 1. Send in-app notification when database is created:
 *
 *    import { sendNotification } from 'kuratchi-sdk/notifications';
 *
 *    await sendNotification(event, {
 *      userId: user.id,
 *      email: user.email,
 *      title: 'Database Created',
 *      message: `Your database "${dbName}" is ready!`,
 *      emailSubject: 'Database Ready',
 *      emailHtml: '<h1>Database Ready!</h1>...',
 *      category: 'database',
 *      priority: 'high',
 *      channel: 'both', // Both in-app and email
 *      actionUrl: `/databases/${dbId}`,
 *    });
 *
 * 2. Monitor database creation rate:
 *
 *    import { trackActivity, checkExcessiveDatabaseCreation } from 'kuratchi-sdk/notifications';
 *
 *    await trackActivity(`db_creation:${userId}`, 60);
 *    const exceeded = await checkExcessiveDatabaseCreation(event, userId);
 *
 *    if (exceeded) {
 *      // Alert was automatically sent to admin@kuratchi.dev
 *      // Take action (block user, show warning, etc.)
 *    }
 *
 * 3. Monitor signup rate:
 *
 *    import { checkExcessiveSignups } from 'kuratchi-sdk/notifications';
 *
 *    const ipAddress = request.headers.get('cf-connecting-ip');
 *    await checkExcessiveSignups(event, ipAddress);
 *
 * 4. Get user's notifications:
 *
 *    import { getUserNotifications, getUnreadCount } from 'kuratchi-sdk/notifications';
 *
 *    const notifications = await getUserNotifications(event, {
 *      userId: user.id,
 *      limit: 20,
 *      unreadOnly: true,
 *    });
 *
 *    const unreadCount = await getUnreadCount(event, user.id);
 *
 * 5. Use templates:
 *
 *    import { sendTemplatedNotification } from 'kuratchi-sdk/notifications';
 *
 *    await sendTemplatedNotification(event, 'database_created', {
 *      databaseName: 'my-db',
 *      databaseId: 'db-123',
 *      region: 'us-east-1',
 *    }, {
 *      userId: user.id,
 *      email: user.email,
 *      channel: 'both',
 *    });
 */
