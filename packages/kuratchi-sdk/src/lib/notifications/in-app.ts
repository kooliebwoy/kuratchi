/**
 * In-App Notification Handlers
 * Functions for creating, managing, and retrieving in-app notifications
 */

import type { RequestEvent } from '@sveltejs/kit';
import type {
	InAppNotification,
	SendInAppNotificationOptions,
	NotificationFilters,
	NotificationResult,
	NotificationStats,
	NotificationPluginOptions,
} from './types.js';

let pluginOptions: NotificationPluginOptions | null = null;

/**
 * Initialize plugin options (called from main notifications module)
 */
export function initInAppNotifications(options: NotificationPluginOptions) {
	pluginOptions = options;
}

/**
 * Send an in-app notification
 */
export async function sendInAppNotification(
	event: RequestEvent,
	options: SendInAppNotificationOptions
): Promise<NotificationResult> {
	if (!pluginOptions?.enableInApp) {
		return { success: false, error: 'In-app notifications are disabled' };
	}

	try {
		const db = pluginOptions.storageDb === 'org'
			? await event.locals.kuratchi?.getOrgDb?.(options.organizationId)
			: await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.notifications) {
			return { success: false, error: 'Notifications table not found' };
		}

		const notification: InAppNotification = {
			id: crypto.randomUUID(),
			userId: options.userId,
			organizationId: options.organizationId,
			title: options.title,
			message: options.message,
			category: options.category || 'custom',
			priority: options.priority || 'normal',
			channel: 'in-app',
			status: 'sent',
			actionUrl: options.actionUrl,
			actionLabel: options.actionLabel,
			iconUrl: options.iconUrl,
			expiresAt: options.expiresAt || getDefaultExpiry(),
			groupKey: options.groupKey,
			metadata: options.metadata,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		await db.notifications.insert(notification);

		return {
			success: true,
			id: notification.id,
		};
	} catch (error: any) {
		console.error('[Notifications] Failed to send in-app notification:', error);
		return {
			success: false,
			error: error.message,
		};
	}
}

/**
 * Get notifications for a user
 */
export async function getUserNotifications(
	event: RequestEvent,
	filters?: NotificationFilters
): Promise<InAppNotification[]> {
	try {
		const db = pluginOptions?.storageDb === 'org'
			? await event.locals.kuratchi?.getOrgDb?.(filters?.organizationId)
			: await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.notifications) {
			return [];
		}

		let query = db.notifications.where({ deleted_at: { is: null } });

		// Apply filters
		if (filters?.userId) {
			query = query.where({ userId: filters.userId });
		}
		if (filters?.organizationId) {
			query = query.where({ organizationId: filters.organizationId });
		}
		if (filters?.category) {
			query = query.where({ category: filters.category });
		}
		if (filters?.priority) {
			query = query.where({ priority: filters.priority });
		}
		if (filters?.status) {
			query = query.where({ status: filters.status });
		}
		if (filters?.unreadOnly) {
			query = query.where({ readAt: { is: null } });
		}
		if (filters?.startDate) {
			query = query.where({ created_at: { gte: filters.startDate } });
		}
		if (filters?.endDate) {
			query = query.where({ created_at: { lte: filters.endDate } });
		}

		// Order by creation date (newest first)
		query = query.orderBy({ created_at: 'desc' });

		// Apply limit and offset
		if (filters?.limit) {
			query = query.limit(filters.limit);
		}
		if (filters?.offset) {
			query = query.offset(filters.offset);
		}

		const result = await query.many();
		return result?.data || [];
	} catch (error) {
		console.error('[Notifications] Failed to get user notifications:', error);
		return [];
	}
}

/**
 * Get a single notification by ID
 */
export async function getNotificationById(
	event: RequestEvent,
	notificationId: string,
	organizationId?: string
): Promise<InAppNotification | null> {
	try {
		const db = pluginOptions?.storageDb === 'org'
			? await event.locals.kuratchi?.getOrgDb?.(organizationId)
			: await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.notifications) {
			return null;
		}

		const result = await db.notifications
			.where({ id: notificationId, deleted_at: { is: null } })
			.first();

		return result?.data || null;
	} catch (error) {
		console.error('[Notifications] Failed to get notification:', error);
		return null;
	}
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(
	event: RequestEvent,
	notificationId: string,
	organizationId?: string
): Promise<boolean> {
	try {
		const db = pluginOptions?.storageDb === 'org'
			? await event.locals.kuratchi?.getOrgDb?.(organizationId)
			: await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.notifications) {
			return false;
		}

		await db.notifications
			.where({ id: notificationId })
			.update({
				status: 'read',
				readAt: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			});

		return true;
	} catch (error) {
		console.error('[Notifications] Failed to mark notification as read:', error);
		return false;
	}
}

/**
 * Mark multiple notifications as read
 */
export async function markNotificationsAsRead(
	event: RequestEvent,
	notificationIds: string[],
	organizationId?: string
): Promise<{ success: number; failed: number }> {
	let success = 0;
	let failed = 0;

	for (const id of notificationIds) {
		const result = await markNotificationAsRead(event, id, organizationId);
		if (result) {
			success++;
		} else {
			failed++;
		}
	}

	return { success, failed };
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(
	event: RequestEvent,
	userId: string,
	organizationId?: string
): Promise<boolean> {
	try {
		const db = pluginOptions?.storageDb === 'org'
			? await event.locals.kuratchi?.getOrgDb?.(organizationId)
			: await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.notifications) {
			return false;
		}

		await db.notifications
			.where({ userId, readAt: { is: null }, deleted_at: { is: null } })
			.update({
				status: 'read',
				readAt: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			});

		return true;
	} catch (error) {
		console.error('[Notifications] Failed to mark all notifications as read:', error);
		return false;
	}
}

/**
 * Delete a notification (soft delete)
 */
export async function deleteNotification(
	event: RequestEvent,
	notificationId: string,
	organizationId?: string
): Promise<boolean> {
	try {
		const db = pluginOptions?.storageDb === 'org'
			? await event.locals.kuratchi?.getOrgDb?.(organizationId)
			: await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.notifications) {
			return false;
		}

		await db.notifications
			.where({ id: notificationId })
			.update({
				deleted_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			});

		return true;
	} catch (error) {
		console.error('[Notifications] Failed to delete notification:', error);
		return false;
	}
}

/**
 * Delete multiple notifications (soft delete)
 */
export async function deleteNotifications(
	event: RequestEvent,
	notificationIds: string[],
	organizationId?: string
): Promise<{ success: number; failed: number }> {
	let success = 0;
	let failed = 0;

	for (const id of notificationIds) {
		const result = await deleteNotification(event, id, organizationId);
		if (result) {
			success++;
		} else {
			failed++;
		}
	}

	return { success, failed };
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(
	event: RequestEvent,
	userId: string,
	organizationId?: string
): Promise<number> {
	try {
		const db = pluginOptions?.storageDb === 'org'
			? await event.locals.kuratchi?.getOrgDb?.(organizationId)
			: await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.notifications) {
			return 0;
		}

		const result = await db.notifications.count({
			userId,
			readAt: { is: null },
			deleted_at: { is: null },
		});

		return result?.data?.[0]?.count || 0;
	} catch (error) {
		console.error('[Notifications] Failed to get unread count:', error);
		return 0;
	}
}

/**
 * Get notification statistics for a user
 */
export async function getNotificationStats(
	event: RequestEvent,
	userId: string,
	organizationId?: string
): Promise<NotificationStats> {
	try {
		const notifications = await getUserNotifications(event, {
			userId,
			organizationId,
		});

		const stats: NotificationStats = {
			total: notifications.length,
			sent: 0,
			delivered: 0,
			read: 0,
			failed: 0,
			pending: 0,
			byCategory: {
				system: 0,
				database: 0,
				security: 0,
				billing: 0,
				account: 0,
				feature: 0,
				monitoring: 0,
				custom: 0,
			},
			byPriority: {
				urgent: 0,
				high: 0,
				normal: 0,
				low: 0,
			},
			byChannel: {
				'in-app': 0,
				'email': 0,
				'both': 0,
			},
		};

		for (const notification of notifications) {
			// Count by status
			switch (notification.status) {
				case 'sent':
					stats.sent++;
					break;
				case 'delivered':
					stats.delivered++;
					break;
				case 'read':
					stats.read++;
					break;
				case 'failed':
					stats.failed++;
					break;
				case 'pending':
					stats.pending++;
					break;
			}

			// Count by category
			if (notification.category) {
				stats.byCategory[notification.category]++;
			}

			// Count by priority
			if (notification.priority) {
				stats.byPriority[notification.priority]++;
			}

			// Count by channel
			if (notification.channel) {
				stats.byChannel[notification.channel]++;
			}
		}

		return stats;
	} catch (error) {
		console.error('[Notifications] Failed to get notification stats:', error);
		return {
			total: 0,
			sent: 0,
			delivered: 0,
			read: 0,
			failed: 0,
			pending: 0,
			byCategory: {
				system: 0,
				database: 0,
				security: 0,
				billing: 0,
				account: 0,
				feature: 0,
				monitoring: 0,
				custom: 0,
			},
			byPriority: {
				urgent: 0,
				high: 0,
				normal: 0,
				low: 0,
			},
			byChannel: {
				'in-app': 0,
				'email': 0,
				'both': 0,
			},
		};
	}
}

/**
 * Clean up expired notifications
 */
export async function cleanupExpiredNotifications(
	event: RequestEvent,
	organizationId?: string
): Promise<number> {
	try {
		const db = pluginOptions?.storageDb === 'org'
			? await event.locals.kuratchi?.getOrgDb?.(organizationId)
			: await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.notifications) {
			return 0;
		}

		const now = new Date().toISOString();

		// Get expired notifications
		const expired = await db.notifications
			.where({
				expiresAt: { lte: now },
				deleted_at: { is: null },
			})
			.many();

		if (!expired?.data || expired.data.length === 0) {
			return 0;
		}

		// Soft delete expired notifications
		await db.notifications
			.where({
				expiresAt: { lte: now },
				deleted_at: { is: null },
			})
			.update({
				deleted_at: now,
				updated_at: now,
			});

		return expired.data.length;
	} catch (error) {
		console.error('[Notifications] Failed to cleanup expired notifications:', error);
		return 0;
	}
}

/**
 * Get default expiry date based on plugin options
 */
function getDefaultExpiry(): string {
	const days = pluginOptions?.defaultExpiryDays || 30;
	const expiry = new Date();
	expiry.setDate(expiry.getDate() + days);
	return expiry.toISOString();
}

/**
 * Group notifications by groupKey
 */
export async function getGroupedNotifications(
	event: RequestEvent,
	userId: string,
	organizationId?: string
): Promise<Record<string, InAppNotification[]>> {
	const notifications = await getUserNotifications(event, {
		userId,
		organizationId,
	});

	const grouped: Record<string, InAppNotification[]> = {};

	for (const notification of notifications) {
		const key = notification.groupKey || 'ungrouped';
		if (!grouped[key]) {
			grouped[key] = [];
		}
		grouped[key].push(notification);
	}

	return grouped;
}
