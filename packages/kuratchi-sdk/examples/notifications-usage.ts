/**
 * Kuratchi Notifications - Comprehensive Usage Examples
 *
 * This file demonstrates all the features of the notifications module
 */

import type { RequestEvent } from '@sveltejs/kit';
import {
  sendNotification,
  sendInAppNotification,
  sendEmailNotification,
  sendTemplatedNotification,
  createPlatformAlert,
  checkExcessiveDatabaseCreation,
  trackActivity,
  getUserNotifications,
  getUnreadCount,
  markNotificationAsRead,
  getUserPreferences,
  updateCategoryPreference,
  setQuietHours,
  createTemplate,
  seedDefaultTemplates,
  queueNotification,
} from 'kuratchi-sdk/notifications';
import { kuratchi } from 'kuratchi-sdk';
import { sessionPlugin, adminPlugin } from 'kuratchi-sdk/auth';

// ============================================================================
// 1. INITIALIZATION (hooks.server.ts)
// ============================================================================

/**
 * Configure Kuratchi with notifications in hooks.server.ts
 *
 * @example
 * ```typescript
 * import { kuratchi } from 'kuratchi-sdk';
 * import { sessionPlugin, adminPlugin } from 'kuratchi-sdk/auth';
 *
 * export const { handle } = kuratchi({
 *   auth: {
 *     plugins: [sessionPlugin(), adminPlugin({ ... })]
 *   },
 *   notifications: {
 *     sesRegion: 'us-east-1',
 *     sesAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
 *     sesSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
 *     sesFrom: 'notifications@yourdomain.com',
 *     sesFromName: 'Your App Name',
 *     cloudflareEmail: {
 *       from: 'system@yourdomain.com',
 *     },
 *     systemEmail: 'admin@yourdomain.com',
 *     enableMonitoring: true,
 *     monitoringThresholds: {
 *       maxDatabasesPerHour: 10,
 *       maxSignupsPerMinute: 5,
 *     },
 *   },
 * });
 * ```
 */
export function setupNotifications() {
  // Notifications are now configured via kuratchi() in hooks.server.ts
  // See example above
  console.log('Configure notifications in kuratchi() config');
}

// ============================================================================
// 2. IN-APP NOTIFICATIONS
// ============================================================================

/**
 * Send a simple in-app notification
 */
export async function sendWelcomeNotification(event: RequestEvent, userId: string) {
  return await sendInAppNotification(event, {
    userId,
    title: 'Welcome to Our Platform!',
    message: 'Thanks for signing up. Get started by creating your first database.',
    category: 'account',
    priority: 'normal',
    actionUrl: '/dashboard',
    actionLabel: 'Get Started',
    iconUrl: '/icons/welcome.png',
  });
}

/**
 * Send a database creation notification
 */
export async function notifyDatabaseCreated(
  event: RequestEvent,
  userId: string,
  databaseName: string,
  databaseId: string
) {
  return await sendInAppNotification(event, {
    userId,
    title: 'Database Created Successfully',
    message: `Your database "${databaseName}" is ready to use.`,
    category: 'database',
    priority: 'high',
    actionUrl: `/databases/${databaseId}`,
    actionLabel: 'View Database',
    metadata: {
      databaseId,
      databaseName,
      createdAt: new Date().toISOString(),
    },
  });
}

/**
 * Get user's notifications with pagination
 */
export async function getUserNotificationsList(
  event: RequestEvent,
  userId: string,
  page: number = 1,
  limit: number = 20
) {
  const notifications = await getUserNotifications(event, {
    userId,
    unreadOnly: false,
    limit,
    offset: (page - 1) * limit,
  });

  const unreadCount = await getUnreadCount(event, userId);

  return {
    notifications,
    unreadCount,
    page,
    limit,
  };
}

// ============================================================================
// 3. EMAIL NOTIFICATIONS
// ============================================================================

/**
 * Send a user email via Amazon SES
 */
export async function sendDatabaseReadyEmail(
  event: RequestEvent,
  userEmail: string,
  userId: string,
  databaseName: string
) {
  return await sendEmailNotification(event, {
    to: userEmail,
    subject: `Your database "${databaseName}" is ready!`,
    html: `
      <h1>Database Created Successfully</h1>
      <p>Your database <strong>${databaseName}</strong> has been created and is ready to use.</p>
      <p><a href="https://app.yourdomain.com/databases" style="display: inline-block; padding: 12px 24px; background-color: #0066ff; color: white; text-decoration: none; border-radius: 6px;">View Database</a></p>
    `,
    text: `Your database "${databaseName}" is ready! Visit https://app.yourdomain.com/databases to get started.`,
    title: 'Database Ready',
    message: `Your database ${databaseName} is ready.`,
    category: 'database',
    priority: 'high',
    provider: 'ses',
    userId,
  });
}

/**
 * Send a system alert email via Cloudflare
 */
export async function sendSystemAlertEmail(
  event: RequestEvent,
  alertMessage: string
) {
  return await sendEmailNotification(event, {
    to: 'admin@yourdomain.com',
    subject: '🚨 Platform Alert',
    html: `
      <h2>Platform Alert</h2>
      <p>${alertMessage}</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
    `,
    title: 'Platform Alert',
    message: alertMessage,
    category: 'monitoring',
    priority: 'urgent',
    provider: 'cloudflare',
  });
}

// ============================================================================
// 4. UNIFIED NOTIFICATIONS (IN-APP + EMAIL)
// ============================================================================

/**
 * Send notification to both in-app and email
 */
export async function sendPaymentSuccessNotification(
  event: RequestEvent,
  userId: string,
  userEmail: string,
  amount: string,
  planName: string
) {
  return await sendNotification(event, {
    userId,
    email: userEmail,
    title: 'Payment Successful',
    message: `Your payment of ${amount} has been processed successfully.`,
    emailSubject: `Payment Successful - ${amount}`,
    emailHtml: `
      <h2>Payment Successful</h2>
      <p>Your payment of <strong>${amount}</strong> has been processed successfully.</p>
      <p><strong>Plan:</strong> ${planName}</p>
      <p>Thank you for your business!</p>
    `,
    category: 'billing',
    priority: 'normal',
    channel: 'both', // Send to both in-app and email
    actionUrl: '/billing/invoices',
    actionLabel: 'View Invoices',
  });
}

// ============================================================================
// 5. NOTIFICATION TEMPLATES
// ============================================================================

/**
 * Seed default templates on app initialization
 */
export async function setupNotificationTemplates(event: RequestEvent) {
  await seedDefaultTemplates(event);
}

/**
 * Create a custom template
 */
export async function createCustomTemplate(event: RequestEvent) {
  return await createTemplate(event, {
    name: 'new_feature_announcement',
    category: 'feature',
    channel: 'both',
    subject: '🎉 New Feature: {{ featureName }}',
    title: 'New Feature Available',
    message: 'We just launched {{ featureName }}! {{ description }}',
    html: `
      <h2>🎉 New Feature: {{ featureName }}</h2>
      <p>{{ description }}</p>
      <p><a href="{{ learnMoreUrl }}" style="display: inline-block; padding: 12px 24px; background-color: #0066ff; color: white; text-decoration: none; border-radius: 6px;">Learn More</a></p>
    `,
    actionUrl: '{{ learnMoreUrl }}',
    actionLabel: 'Learn More',
    variables: ['featureName', 'description', 'learnMoreUrl'],
    isActive: true,
  });
}

/**
 * Send notification using a template
 */
export async function announceNewFeature(
  event: RequestEvent,
  userId: string,
  userEmail: string
) {
  return await sendTemplatedNotification(
    event,
    'new_feature_announcement',
    {
      featureName: 'Real-time Collaboration',
      description: 'Now you can collaborate with your team in real-time.',
      learnMoreUrl: 'https://app.yourdomain.com/features/collaboration',
    },
    {
      userId,
      email: userEmail,
      channel: 'both',
    }
  );
}

// ============================================================================
// 6. PLATFORM MONITORING
// ============================================================================

/**
 * Monitor database creation rate
 */
export async function monitorDatabaseCreation(
  event: RequestEvent,
  userId: string,
  organizationId?: string
) {
  // Track the activity
  await trackActivity(`db_creation:${userId}`, 60);

  // Check if limits exceeded
  const exceeded = await checkExcessiveDatabaseCreation(event, userId, organizationId);

  if (exceeded) {
    console.log(`User ${userId} exceeded database creation limits`);
    // Alert was automatically sent to system email
  }

  return !exceeded;
}

/**
 * Create a custom platform alert
 */
export async function createQuotaAlert(
  event: RequestEvent,
  userId: string,
  resourceType: string,
  currentUsage: number,
  limit: number
) {
  return await createPlatformAlert(event, {
    type: 'quota_exceeded',
    severity: 'high',
    title: `${resourceType} Quota Exceeded`,
    message: `User ${userId} has exceeded their ${resourceType} quota (${currentUsage}/${limit})`,
    affectedUserId: userId,
    affectedResource: resourceType,
    threshold: limit,
    currentValue: currentUsage,
    timeWindow: '1 hour',
    notifySystemEmail: true,
    metadata: {
      resourceType,
      currentUsage,
      limit,
      percentUsed: Math.round((currentUsage / limit) * 100),
    },
  });
}

// ============================================================================
// 7. USER PREFERENCES
// ============================================================================

/**
 * Get user's notification preferences
 */
export async function getNotificationPreferences(
  event: RequestEvent,
  userId: string
) {
  return await getUserPreferences(event, userId);
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
  event: RequestEvent,
  userId: string
) {
  // Disable feature announcements in email, keep in-app
  await updateCategoryPreference(event, userId, 'feature', {
    enabled: true,
    channels: ['in-app'],
    minPriority: 'low',
  });

  // Set quiet hours (10 PM - 8 AM)
  await setQuietHours(
    event,
    userId,
    true,
    '22:00',
    '08:00',
    'America/New_York'
  );

  return { success: true };
}

// ============================================================================
// 8. QUEUE-BASED PROCESSING
// ============================================================================

/**
 * Queue a notification for batch processing
 */
export async function queueWeeklyDigest(
  event: RequestEvent,
  userId: string,
  userEmail: string,
  digestData: any
) {
  return await queueNotification(event, {
    type: 'email',
    priority: 'low',
    userId,
    email: userEmail,
    notification: {
      title: 'Your Weekly Digest',
      message: 'Here\'s your activity summary for the week.',
      category: 'account',
      priority: 'low',
    },
    emailData: {
      subject: 'Your Weekly Digest',
      html: generateWeeklyDigestHTML(digestData),
      provider: 'ses',
    },
    scheduledFor: getNextMondayAt9AM().toISOString(),
  });
}

function generateWeeklyDigestHTML(data: any): string {
  return `
    <h1>Your Weekly Digest</h1>
    <p>Here's what happened this week:</p>
    <ul>
      <li>Databases created: ${data.databasesCreated}</li>
      <li>API calls: ${data.apiCalls}</li>
      <li>Storage used: ${data.storageUsed}</li>
    </ul>
  `;
}

function getNextMondayAt9AM(): Date {
  const now = new Date();
  const daysUntilMonday = (8 - now.getDay()) % 7;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(9, 0, 0, 0);
  return nextMonday;
}

// ============================================================================
// 9. COMPLETE WORKFLOW EXAMPLES
// ============================================================================

/**
 * Complete database creation workflow with notifications
 */
export async function handleDatabaseCreation(
  event: RequestEvent,
  userId: string,
  userEmail: string,
  databaseName: string
) {
  try {
    // 1. Monitor rate limiting
    const allowed = await monitorDatabaseCreation(event, userId);
    if (!allowed) {
      throw new Error('Database creation rate limit exceeded');
    }

    // 2. Create database (your logic here)
    const databaseId = await createDatabase(databaseName);

    // 3. Send success notification (both in-app and email)
    await sendNotification(event, {
      userId,
      email: userEmail,
      title: 'Database Created Successfully',
      message: `Your database "${databaseName}" is ready to use.`,
      emailSubject: `Database "${databaseName}" is ready!`,
      emailHtml: `
        <h1>Database Created Successfully</h1>
        <p>Your database <strong>${databaseName}</strong> is ready!</p>
        <p><a href="https://app.yourdomain.com/databases/${databaseId}">View Database</a></p>
      `,
      category: 'database',
      priority: 'high',
      channel: 'both',
      actionUrl: `/databases/${databaseId}`,
      actionLabel: 'View Database',
      metadata: {
        databaseId,
        databaseName,
      },
    });

    return { success: true, databaseId };

  } catch (error: any) {
    // Send failure notification
    await sendNotification(event, {
      userId,
      email: userEmail,
      title: 'Database Creation Failed',
      message: `Failed to create database "${databaseName}". ${error.message}`,
      emailSubject: 'Database Creation Failed',
      emailHtml: `
        <h1>Database Creation Failed</h1>
        <p>We encountered an error while creating your database <strong>${databaseName}</strong>.</p>
        <p><strong>Error:</strong> ${error.message}</p>
        <p>Please try again or contact support if the problem persists.</p>
      `,
      category: 'database',
      priority: 'high',
      channel: 'both',
    });

    throw error;
  }
}

/**
 * User signup workflow with notifications and monitoring
 */
export async function handleUserSignup(
  event: RequestEvent,
  email: string,
  name: string,
  ipAddress?: string
) {
  try {
    // 1. Check signup rate limiting
    const { checkExcessiveSignups } = await import('kuratchi-sdk/notifications');
    await trackActivity(`signups:${ipAddress || 'unknown'}`, 1);
    await checkExcessiveSignups(event, ipAddress);

    // 2. Create user account (your logic here)
    const userId = await createUser(email, name);

    // 3. Send welcome notification using template
    await sendTemplatedNotification(
      event,
      'welcome',
      {
        appName: 'Your App',
        userName: name,
        actionUrl: 'https://app.yourdomain.com/dashboard',
      },
      {
        userId,
        email,
        channel: 'both',
      }
    );

    return { success: true, userId };

  } catch (error: any) {
    console.error('Signup failed:', error);
    throw error;
  }
}

// ============================================================================
// 10. UTILITY FUNCTIONS
// ============================================================================

async function createDatabase(name: string): Promise<string> {
  // Your database creation logic
  return 'db-' + crypto.randomUUID();
}

async function createUser(email: string, name: string): Promise<string> {
  // Your user creation logic
  return 'user-' + crypto.randomUUID();
}

/**
 * Mark notification as read when user views it
 */
export async function handleNotificationViewed(
  event: RequestEvent,
  notificationId: string
) {
  return await markNotificationAsRead(event, notificationId);
}

/**
 * Example hooks.server.ts configuration
 */
export const exampleConfig = {
  auth: {
    plugins: [sessionPlugin(), adminPlugin({ /* ... */ })]
  },
  notifications: {
    sesRegion: 'us-east-1',
    sesAccessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    sesSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    sesFrom: 'notifications@yourdomain.com',
    sesFromName: 'Your App Name',
    cloudflareEmail: {
      from: 'system@yourdomain.com',
      apiToken: process.env.CLOUDFLARE_API_TOKEN,
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    },
    systemEmail: 'admin@yourdomain.com',
    enableInApp: true,
    enableEmail: true,
    enableMonitoring: true,
    enableQueue: true,
    monitoringThresholds: {
      maxDatabasesPerHour: 10,
      maxDatabasesPerDay: 50,
      maxSignupsPerMinute: 5,
      maxSignupsPerHour: 50,
      maxApiCallsPerMinute: 100,
      maxApiCallsPerHour: 5000,
    },
    storageDb: 'admin',
    batchSize: 10,
    defaultExpiryDays: 30,
  },
  email: { /* ... */ },
  stripe: { /* ... */ },
};

/**
 * Export all functions for use in your app
 */
export {
  setupNotifications,
  sendWelcomeNotification,
  notifyDatabaseCreated,
  getUserNotificationsList,
  sendDatabaseReadyEmail,
  sendSystemAlertEmail,
  sendPaymentSuccessNotification,
  setupNotificationTemplates,
  createCustomTemplate,
  announceNewFeature,
  monitorDatabaseCreation,
  createQuotaAlert,
  getNotificationPreferences,
  updateNotificationPreferences,
  queueWeeklyDigest,
  handleDatabaseCreation,
  handleUserSignup,
  handleNotificationViewed,
};
