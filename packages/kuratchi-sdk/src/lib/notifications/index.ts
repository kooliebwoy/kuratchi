/**
 * Kuratchi Notifications Module
 * Comprehensive notification system with in-app, email, and platform monitoring
 *
 * Features:
 * - In-app notifications stored in database
 * - Email notifications via Resend (users) and Cloudflare Email (system)
 * - Platform monitoring and alerts
 * - Queue-based batch processing with Cloudflare Workers Queues
 * - User notification preferences
 * - Reusable notification templates
 * - Rate limiting and quiet hours
 *
 * @example
 * ```typescript
 * import { kuratchi } from 'kuratchi-sdk';
 *
 * const app = kuratchi({
 *   // ... other config
 *   notifications: {
 *     resendApiKey: process.env.RESEND_API_KEY,
 *     resendFrom: 'noreply@yourdomain.com',
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
 *
 * export const handle = app.handle;
 * ```
 */

import type { RequestEvent } from '@sveltejs/kit';
import type {
	NotificationPluginOptions,
	SendInAppNotificationOptions,
	SendEmailNotificationOptions,
	CreatePlatformAlertOptions,
	NotificationResult,
	BatchNotificationResult,
	NotificationFilters,
	InAppNotification,
	EmailNotification,
	PlatformAlert,
	NotificationTemplate,
	NotificationPreferences,
	NotificationStats,
	NotificationCategory,
	NotificationChannel,
	NotificationPriority,
	NotificationQueueMessage,
} from './types.js';

// Import all submodules
import {
	initInAppNotifications,
	sendInAppNotification,
	getUserNotifications,
	getNotificationById,
	markNotificationAsRead,
	markNotificationsAsRead,
	markAllNotificationsAsRead,
	deleteNotification,
	deleteNotifications,
	getUnreadCount,
	getNotificationStats,
	cleanupExpiredNotifications,
	getGroupedNotifications,
} from './in-app.js';

import {
	initEmailNotifications,
	sendEmailNotification,
	getEmailHistory,
	getEmailById,
	updateEmailStatus,
	sendTemplatedEmail,
} from './email.js';

import {
	initPlatformMonitoring,
	createPlatformAlert,
	checkExcessiveDatabaseCreation,
	checkExcessiveSignups,
	checkExcessiveApiCalls,
	trackActivity,
	getPlatformAlerts,
	resolvePlatformAlert,
	getAlertStats,
} from './platform.js';

import {
	initQueue,
	queueNotification,
	processQueueMessage,
	processBatchFromDatabase,
	handleQueueBatch,
	getQueueStats,
	cleanupQueueItems,
} from './queue.js';

import {
	initTemplates,
	createTemplate,
	getTemplateById,
	getTemplateByName,
	getAllTemplates,
	updateTemplate,
	deleteTemplate,
	renderTemplate,
	seedDefaultTemplates,
} from './templates.js';

import {
	initPreferences,
	getUserPreferences,
	createDefaultPreferences,
	updateUserPreferences,
	updateCategoryPreference,
	toggleAllNotifications,
	toggleInAppNotifications,
	toggleEmailNotifications,
	setQuietHours,
	setDigestPreferences,
	shouldSendNotification,
	getPreferredChannel,
	resetPreferences,
} from './preferences.js';

// Export init functions for internal use by kuratchi.ts
export {
	initInAppNotifications,
	initEmailNotifications,
	initPlatformMonitoring,
	initQueue,
	initTemplates,
	initPreferences,
};

/**
 * @deprecated Notifications are now initialized automatically via kuratchi() config.
 * Use the notifications property in your kuratchi() configuration instead.
 *
 * @example
 * ```typescript
 * import { kuratchi } from 'kuratchi-sdk';
 *
 * const app = kuratchi({
 *   notifications: {
 *     resendApiKey: process.env.RESEND_API_KEY,
 *     // ... other options
 *   }
 * });
 * ```
 */
export function initNotifications(config: NotificationPluginOptions): void {
	console.warn('[Notifications] initNotifications() is deprecated. Configure via kuratchi({ notifications: {...} }) instead.');

	// Initialize all submodules for backwards compatibility
	initInAppNotifications(config);
	initEmailNotifications(config);
	initPlatformMonitoring(config);
	initQueue(config);
	initTemplates(config);
	initPreferences(config);
}

// ============================================================================
// UNIFIED NOTIFICATION API
// ============================================================================

/**
 * Send a notification (automatically handles channel routing)
 */
export async function sendNotification(
	event: RequestEvent,
	notification: SendInAppNotificationOptions & {
		email?: string | string[];
		emailSubject?: string;
		emailHtml?: string;
		emailText?: string;
	}
): Promise<NotificationResult> {

	// Check user preferences if userId is provided
	if (notification.userId && notification.category && notification.priority) {
		const check = await shouldSendNotification(
			event,
			notification.userId,
			notification.category,
			notification.priority,
			notification.channel || 'both',
			notification.organizationId
		);

		if (!check.allowed) {
			return {
				success: false,
				error: `Notification blocked: ${check.reason}`,
			};
		}
	}

	const channel = notification.channel || 'both';

	// Send in-app notification
	if (channel === 'in-app' || channel === 'both') {
		const result = await sendInAppNotification(event, notification);
		if (!result.success && channel === 'in-app') {
			return result;
		}
	}

	// Send email notification
	if ((channel === 'email' || channel === 'both') && notification.email) {
		const emailResult = await sendEmailNotification(event, {
			to: notification.email,
			subject: notification.emailSubject || notification.title,
			html: notification.emailHtml,
			text: notification.emailText || notification.message,
			title: notification.title,
			message: notification.message,
			category: notification.category,
			priority: notification.priority,
			userId: notification.userId,
			organizationId: notification.organizationId,
			metadata: notification.metadata,
		});

		if (!emailResult.success && channel === 'email') {
			return emailResult;
		}
	}

	return { success: true };
}

/**
 * Send a templated notification
 */
export async function sendTemplatedNotification(
	event: RequestEvent,
	templateName: string,
	templateVars: Record<string, any>,
	options: {
		userId?: string;
		organizationId?: string;
		email?: string | string[];
		channel?: NotificationChannel;
	}
): Promise<NotificationResult> {

	const template = await getTemplateByName(event, templateName);

	if (!template) {
		return {
			success: false,
			error: `Template not found: ${templateName}`,
		};
	}

	const rendered = renderTemplate(template, templateVars);
	const channel = options.channel || template.channel;

	return await sendNotification(event, {
		title: rendered.title,
		message: rendered.message,
		category: template.category,
		channel,
		userId: options.userId,
		organizationId: options.organizationId,
		email: options.email,
		emailSubject: rendered.subject,
		emailHtml: rendered.html,
		emailText: rendered.message,
		actionUrl: rendered.actionUrl,
		actionLabel: rendered.actionLabel,
	});
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

// Types
export type {
	NotificationPluginOptions,
	SendInAppNotificationOptions,
	SendEmailNotificationOptions,
	CreatePlatformAlertOptions,
	NotificationResult,
	BatchNotificationResult,
	NotificationFilters,
	InAppNotification,
	EmailNotification,
	PlatformAlert,
	NotificationTemplate,
	NotificationPreferences,
	NotificationStats,
	NotificationCategory,
	NotificationChannel,
	NotificationPriority,
	NotificationQueueMessage,
	NotificationStatus,
	EmailProvider,
	PlatformAlertType,
	MonitoringThresholds,
} from './types.js';

// In-app notifications
export {
	sendInAppNotification,
	getUserNotifications,
	getNotificationById,
	markNotificationAsRead,
	markNotificationsAsRead,
	markAllNotificationsAsRead,
	deleteNotification,
	deleteNotifications,
	getUnreadCount,
	getNotificationStats,
	cleanupExpiredNotifications,
	getGroupedNotifications,
};

// Email notifications
export {
	sendEmailNotification,
	getEmailHistory,
	getEmailById,
	updateEmailStatus,
	sendTemplatedEmail,
};

// Platform monitoring
export {
	createPlatformAlert,
	checkExcessiveDatabaseCreation,
	checkExcessiveSignups,
	checkExcessiveApiCalls,
	trackActivity,
	getPlatformAlerts,
	resolvePlatformAlert,
	getAlertStats,
};

// Queue processing
export {
	queueNotification,
	processQueueMessage,
	processBatchFromDatabase,
	handleQueueBatch,
	getQueueStats,
	cleanupQueueItems,
};

// Templates
export {
	createTemplate,
	getTemplateById,
	getTemplateByName,
	getAllTemplates,
	updateTemplate,
	deleteTemplate,
	renderTemplate,
	seedDefaultTemplates,
};

// Preferences
export {
	getUserPreferences,
	createDefaultPreferences,
	updateUserPreferences,
	updateCategoryPreference,
	toggleAllNotifications,
	toggleInAppNotifications,
	toggleEmailNotifications,
	setQuietHours,
	setDigestPreferences,
	shouldSendNotification,
	getPreferredChannel,
	resetPreferences,
};

// Schemas
export {
	notificationsTableSchema,
	emailNotificationsTableSchema,
	platformAlertsTableSchema,
	notificationTemplatesTableSchema,
	notificationPreferencesTableSchema,
	notificationQueueTableSchema,
	notificationSchemas,
} from './schema.js';
