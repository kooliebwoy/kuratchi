/**
 * Notification Helper Utilities
 * Helper functions for sending notifications in the dashboard
 */

import type { RequestEvent } from '@sveltejs/kit';
import { sendNotification } from 'kuratchi-sdk/notifications';

/**
 * Send a welcome notification to a new user
 */
export async function sendWelcomeNotification(
  event: RequestEvent,
  userId: string,
  userEmail: string,
  userName: string
) {
  return await sendNotification(event, {
    userId,
    email: userEmail,
    title: 'Welcome to Kuratchi! 🎉',
    message: `Hi ${userName}! Welcome to Kuratchi. Get started by creating your first database.`,
    emailSubject: 'Welcome to Kuratchi',
    emailHtml: `
      <h1>Welcome to Kuratchi!</h1>
      <p>Hi ${userName},</p>
      <p>We're excited to have you on board! Kuratchi makes it easy to build and deploy applications with Cloudflare Workers.</p>
      <h2>Get Started:</h2>
      <ul>
        <li>Create your first database</li>
        <li>Explore our API documentation</li>
        <li>Join our community</li>
      </ul>
      <p><a href="https://dashboard.kuratchi.dev" style="display: inline-block; padding: 12px 24px; background-color: #0066ff; color: white; text-decoration: none; border-radius: 6px;">Go to Dashboard</a></p>
    `,
    category: 'account',
    priority: 'normal',
    channel: 'both',
    actionUrl: '/database',
    actionLabel: 'Create Database',
  });
}

/**
 * Send notification when a database is created
 */
export async function sendDatabaseCreatedNotification(
  event: RequestEvent,
  userId: string,
  userEmail: string,
  databaseName: string,
  databaseId: string
) {
  return await sendNotification(event, {
    userId,
    email: userEmail,
    title: 'Database Created Successfully',
    message: `Your database "${databaseName}" is ready to use.`,
    emailSubject: `Database "${databaseName}" is Ready!`,
    emailHtml: `
      <h1>Database Created Successfully ✓</h1>
      <p>Your database <strong>${databaseName}</strong> has been created and is ready to use.</p>
      <p><strong>Database ID:</strong> ${databaseId}</p>
      <p><a href="https://dashboard.kuratchi.dev/database/${databaseId}" style="display: inline-block; padding: 12px 24px; background-color: #0066ff; color: white; text-decoration: none; border-radius: 6px;">View Database</a></p>
    `,
    category: 'database',
    priority: 'high',
    channel: 'both',
    actionUrl: `/database/${databaseId}`,
    actionLabel: 'View Database',
  });
}

/**
 * Send notification when a database creation fails
 */
export async function sendDatabaseCreationFailedNotification(
  event: RequestEvent,
  userId: string,
  userEmail: string,
  databaseName: string,
  errorMessage: string
) {
  return await sendNotification(event, {
    userId,
    email: userEmail,
    title: 'Database Creation Failed',
    message: `Failed to create database "${databaseName}". ${errorMessage}`,
    emailSubject: `Database Creation Failed`,
    emailHtml: `
      <h1>Database Creation Failed</h1>
      <p>We encountered an error while creating your database <strong>${databaseName}</strong>.</p>
      <p><strong>Error:</strong> ${errorMessage}</p>
      <p>Please try again or contact support if the problem persists.</p>
    `,
    category: 'database',
    priority: 'high',
    channel: 'both',
  });
}

/**
 * Send notification when user's subscription changes
 */
export async function sendSubscriptionChangeNotification(
  event: RequestEvent,
  userId: string,
  userEmail: string,
  planName: string,
  action: 'upgraded' | 'downgraded' | 'cancelled'
) {
  const actionText = {
    upgraded: 'upgraded to',
    downgraded: 'downgraded to',
    cancelled: 'cancelled'
  }[action];

  return await sendNotification(event, {
    userId,
    email: userEmail,
    title: 'Subscription Updated',
    message: `You've ${actionText} ${action === 'cancelled' ? 'your subscription' : planName}.`,
    emailSubject: 'Subscription Updated',
    emailHtml: `
      <h1>Subscription Updated</h1>
      <p>Your subscription has been ${actionText} ${action === 'cancelled' ? '' : planName}.</p>
      <p><a href="https://dashboard.kuratchi.dev/settings/billing" style="display: inline-block; padding: 12px 24px; background-color: #0066ff; color: white; text-decoration: none; border-radius: 6px;">View Billing</a></p>
    `,
    category: 'billing',
    priority: 'normal',
    channel: 'both',
    actionUrl: '/settings/billing',
    actionLabel: 'View Billing',
  });
}

/**
 * Send security alert notification
 */
export async function sendSecurityAlertNotification(
  event: RequestEvent,
  userId: string,
  userEmail: string,
  alertType: string,
  message: string
) {
  return await sendNotification(event, {
    userId,
    email: userEmail,
    title: `Security Alert: ${alertType}`,
    message,
    emailSubject: `⚠️ Security Alert: ${alertType}`,
    emailHtml: `
      <h1>⚠️ Security Alert</h1>
      <p><strong>Type:</strong> ${alertType}</p>
      <p><strong>Message:</strong> ${message}</p>
      <p>If this wasn't you, please secure your account immediately.</p>
      <p><a href="https://dashboard.kuratchi.dev/settings/security" style="display: inline-block; padding: 12px 24px; background-color: #ff3333; color: white; text-decoration: none; border-radius: 6px;">Review Security</a></p>
    `,
    category: 'security',
    priority: 'urgent',
    channel: 'both',
    actionUrl: '/settings/security',
    actionLabel: 'Review Security',
  });
}

/**
 * Send API token created notification
 */
export async function sendApiTokenCreatedNotification(
  event: RequestEvent,
  userId: string,
  userEmail: string,
  tokenName: string
) {
  return await sendNotification(event, {
    userId,
    email: userEmail,
    title: 'API Token Created',
    message: `New API token "${tokenName}" has been created.`,
    emailSubject: 'New API Token Created',
    emailHtml: `
      <h1>API Token Created</h1>
      <p>A new API token <strong>${tokenName}</strong> has been created for your account.</p>
      <p>If you didn't create this token, please revoke it immediately.</p>
      <p><a href="https://dashboard.kuratchi.dev/settings/api-tokens" style="display: inline-block; padding: 12px 24px; background-color: #0066ff; color: white; text-decoration: none; border-radius: 6px;">Manage Tokens</a></p>
    `,
    category: 'security',
    priority: 'high',
    channel: 'both',
    actionUrl: '/settings/api-tokens',
    actionLabel: 'Manage Tokens',
  });
}

/**
 * Send quota warning notification
 */
export async function sendQuotaWarningNotification(
  event: RequestEvent,
  userId: string,
  userEmail: string,
  resourceType: string,
  percentUsed: number,
  currentUsage: number,
  limit: number
) {
  return await sendNotification(event, {
    userId,
    email: userEmail,
    title: `Quota Warning: ${resourceType}`,
    message: `You've used ${percentUsed}% of your ${resourceType} quota (${currentUsage}/${limit}).`,
    emailSubject: `Quota Warning: ${resourceType}`,
    emailHtml: `
      <h1>Quota Warning</h1>
      <p>You've used <strong>${percentUsed}%</strong> of your ${resourceType} quota.</p>
      <p><strong>Current Usage:</strong> ${currentUsage} / ${limit}</p>
      <p>Consider upgrading your plan to avoid service interruptions.</p>
      <p><a href="https://dashboard.kuratchi.dev/pricing" style="display: inline-block; padding: 12px 24px; background-color: #0066ff; color: white; text-decoration: none; border-radius: 6px;">Upgrade Plan</a></p>
    `,
    category: 'billing',
    priority: percentUsed >= 90 ? 'urgent' : 'high',
    channel: 'both',
    actionUrl: '/pricing',
    actionLabel: 'Upgrade Plan',
  });
}

/**
 * Send payment successful notification
 */
export async function sendPaymentSuccessNotification(
  event: RequestEvent,
  userId: string,
  userEmail: string,
  amount: string,
  invoiceUrl?: string
) {
  return await sendNotification(event, {
    userId,
    email: userEmail,
    title: 'Payment Successful',
    message: `Your payment of ${amount} has been processed successfully.`,
    emailSubject: `Payment Successful - ${amount}`,
    emailHtml: `
      <h1>Payment Successful</h1>
      <p>Your payment of <strong>${amount}</strong> has been processed successfully.</p>
      ${invoiceUrl ? `<p><a href="${invoiceUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0066ff; color: white; text-decoration: none; border-radius: 6px;">View Invoice</a></p>` : ''}
    `,
    category: 'billing',
    priority: 'normal',
    channel: 'both',
    actionUrl: '/settings/billing',
    actionLabel: 'View Billing',
  });
}

/**
 * Send in-app only notification (no email)
 */
export async function sendInAppNotification(
  event: RequestEvent,
  userId: string,
  title: string,
  message: string,
  options?: {
    category?: string;
    priority?: string;
    actionUrl?: string;
    actionLabel?: string;
  }
) {
  return await sendNotification(event, {
    userId,
    title,
    message,
    category: options?.category as any || 'custom',
    priority: options?.priority as any || 'normal',
    channel: 'in-app',
    actionUrl: options?.actionUrl,
    actionLabel: options?.actionLabel,
  });
}
