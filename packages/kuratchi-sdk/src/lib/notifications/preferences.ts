/**
 * User Notification Preferences
 * Manage user preferences for notification channels, categories, and delivery settings
 */

import type { RequestEvent } from '@sveltejs/kit';
import type {
	NotificationPreferences,
	NotificationCategory,
	NotificationChannel,
	NotificationPriority,
	NotificationPluginOptions,
} from './types.js';

let pluginOptions: NotificationPluginOptions | null = null;

/**
 * Initialize preferences (called from main notifications module)
 */
export function initPreferences(options: NotificationPluginOptions) {
	pluginOptions = options;
}

/**
 * Get user notification preferences
 */
export async function getUserPreferences(
	event: RequestEvent,
	userId: string,
	organizationId?: string
): Promise<NotificationPreferences | null> {
	try {
		const db = pluginOptions?.storageDb === 'org'
			? await event.locals.kuratchi?.getOrgDb?.(organizationId)
			: await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.notification_preferences) {
			return null;
		}

		const result = await db.notification_preferences
			.where({ userId })
			.first();

		if (result?.data) {
			return result.data as NotificationPreferences;
		}

		// Create default preferences if none exist
		return await createDefaultPreferences(event, userId, organizationId);
	} catch (error) {
		console.error('[Notification Preferences] Failed to get preferences:', error);
		return null;
	}
}

/**
 * Create default notification preferences for a user
 */
export async function createDefaultPreferences(
	event: RequestEvent,
	userId: string,
	organizationId?: string
): Promise<NotificationPreferences> {
	const defaultPreferences: NotificationPreferences = {
		id: crypto.randomUUID(),
		userId,
		organizationId,
		enableInApp: true,
		enableEmail: true,
		categories: {
			system: {
				enabled: true,
				channels: ['both'],
				minPriority: 'normal',
			},
			database: {
				enabled: true,
				channels: ['both'],
				minPriority: 'normal',
			},
			security: {
				enabled: true,
				channels: ['both'],
				minPriority: 'urgent',
			},
			billing: {
				enabled: true,
				channels: ['both'],
				minPriority: 'normal',
			},
			account: {
				enabled: true,
				channels: ['both'],
				minPriority: 'normal',
			},
			feature: {
				enabled: true,
				channels: ['in-app'],
				minPriority: 'low',
			},
			monitoring: {
				enabled: true,
				channels: ['both'],
				minPriority: 'high',
			},
			custom: {
				enabled: true,
				channels: ['both'],
				minPriority: 'normal',
			},
		},
		quietHoursEnabled: false,
		enableDigest: false,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
	};

	try {
		const db = pluginOptions?.storageDb === 'org'
			? await event.locals.kuratchi?.getOrgDb?.(organizationId)
			: await event.locals.kuratchi?.getAdminDb?.();

		if (db && db.notification_preferences) {
			await db.notification_preferences.insert(defaultPreferences);
		}
	} catch (error) {
		console.error('[Notification Preferences] Failed to create default preferences:', error);
	}

	return defaultPreferences;
}

/**
 * Update user notification preferences
 */
export async function updateUserPreferences(
	event: RequestEvent,
	userId: string,
	updates: Partial<Omit<NotificationPreferences, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
	organizationId?: string
): Promise<boolean> {
	try {
		const db = pluginOptions?.storageDb === 'org'
			? await event.locals.kuratchi?.getOrgDb?.(organizationId)
			: await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.notification_preferences) {
			return false;
		}

		// Check if preferences exist
		const existing = await db.notification_preferences
			.where({ userId })
			.first();

		if (!existing?.data) {
			// Create new preferences with updates
			const newPreferences = await createDefaultPreferences(event, userId, organizationId);
			await db.notification_preferences
				.where({ userId })
				.update({
					...updates,
					updated_at: new Date().toISOString(),
				});
			return true;
		}

		// Update existing preferences
		await db.notification_preferences
			.where({ userId })
			.update({
				...updates,
				updated_at: new Date().toISOString(),
			});

		return true;
	} catch (error) {
		console.error('[Notification Preferences] Failed to update preferences:', error);
		return false;
	}
}

/**
 * Update category preferences for a user
 */
export async function updateCategoryPreference(
	event: RequestEvent,
	userId: string,
	category: NotificationCategory,
	settings: {
		enabled: boolean;
		channels?: NotificationChannel[];
		minPriority?: NotificationPriority;
	},
	organizationId?: string
): Promise<boolean> {
	try {
		const preferences = await getUserPreferences(event, userId, organizationId);

		if (!preferences) {
			return false;
		}

		// Update the specific category
		const updatedCategories = {
			...preferences.categories,
			[category]: {
				enabled: settings.enabled,
				channels: settings.channels || preferences.categories[category]?.channels || ['both'],
				minPriority: settings.minPriority || preferences.categories[category]?.minPriority || 'normal',
			},
		};

		return await updateUserPreferences(event, userId, {
			categories: updatedCategories,
		}, organizationId);
	} catch (error) {
		console.error('[Notification Preferences] Failed to update category preference:', error);
		return false;
	}
}

/**
 * Enable/disable all notifications for a user
 */
export async function toggleAllNotifications(
	event: RequestEvent,
	userId: string,
	enabled: boolean,
	organizationId?: string
): Promise<boolean> {
	return await updateUserPreferences(event, userId, {
		enableInApp: enabled,
		enableEmail: enabled,
	}, organizationId);
}

/**
 * Enable/disable in-app notifications for a user
 */
export async function toggleInAppNotifications(
	event: RequestEvent,
	userId: string,
	enabled: boolean,
	organizationId?: string
): Promise<boolean> {
	return await updateUserPreferences(event, userId, {
		enableInApp: enabled,
	}, organizationId);
}

/**
 * Enable/disable email notifications for a user
 */
export async function toggleEmailNotifications(
	event: RequestEvent,
	userId: string,
	enabled: boolean,
	organizationId?: string
): Promise<boolean> {
	return await updateUserPreferences(event, userId, {
		enableEmail: enabled,
	}, organizationId);
}

/**
 * Set quiet hours for a user
 */
export async function setQuietHours(
	event: RequestEvent,
	userId: string,
	enabled: boolean,
	startTime?: string,
	endTime?: string,
	timezone?: string,
	organizationId?: string
): Promise<boolean> {
	return await updateUserPreferences(event, userId, {
		quietHoursEnabled: enabled,
		quietHoursStart: startTime,
		quietHoursEnd: endTime,
		quietHoursTimezone: timezone,
	}, organizationId);
}

/**
 * Configure digest settings for a user
 */
export async function setDigestPreferences(
	event: RequestEvent,
	userId: string,
	enabled: boolean,
	frequency?: 'daily' | 'weekly' | 'monthly',
	time?: string,
	organizationId?: string
): Promise<boolean> {
	return await updateUserPreferences(event, userId, {
		enableDigest: enabled,
		digestFrequency: frequency,
		digestTime: time,
	}, organizationId);
}

/**
 * Check if a notification should be sent based on user preferences
 */
export async function shouldSendNotification(
	event: RequestEvent,
	userId: string,
	category: NotificationCategory,
	priority: NotificationPriority,
	channel: NotificationChannel,
	organizationId?: string
): Promise<{
	allowed: boolean;
	reason?: string;
}> {
	try {
		const preferences = await getUserPreferences(event, userId, organizationId);

		if (!preferences) {
			// If no preferences exist, allow by default
			return { allowed: true };
		}

		// Check global channel settings
		if (channel === 'in-app' && !preferences.enableInApp) {
			return { allowed: false, reason: 'In-app notifications disabled' };
		}

		if (channel === 'email' && !preferences.enableEmail) {
			return { allowed: false, reason: 'Email notifications disabled' };
		}

		if (channel === 'both' && !preferences.enableInApp && !preferences.enableEmail) {
			return { allowed: false, reason: 'All notifications disabled' };
		}

		// Check category preferences
		const categoryPrefs = preferences.categories[category];

		if (!categoryPrefs || !categoryPrefs.enabled) {
			return { allowed: false, reason: `${category} notifications disabled` };
		}

		// Check if channel is allowed for this category
		const allowedChannels = categoryPrefs.channels || ['both'];
		if (!allowedChannels.includes(channel) && !allowedChannels.includes('both')) {
			return { allowed: false, reason: `${channel} not allowed for ${category} notifications` };
		}

		// Check minimum priority
		const minPriority = categoryPrefs.minPriority || 'low';
		const priorityLevels: Record<NotificationPriority, number> = {
			urgent: 4,
			high: 3,
			normal: 2,
			low: 1,
		};

		if (priorityLevels[priority] < priorityLevels[minPriority]) {
			return { allowed: false, reason: `Priority ${priority} below minimum ${minPriority}` };
		}

		// Check quiet hours
		if (preferences.quietHoursEnabled && preferences.quietHoursStart && preferences.quietHoursEnd) {
			const isQuietHours = checkQuietHours(
				preferences.quietHoursStart,
				preferences.quietHoursEnd,
				preferences.quietHoursTimezone
			);

			if (isQuietHours && priority !== 'urgent') {
				return { allowed: false, reason: 'Within quiet hours' };
			}
		}

		return { allowed: true };
	} catch (error) {
		console.error('[Notification Preferences] Failed to check if notification should be sent:', error);
		// Default to allowing on error
		return { allowed: true };
	}
}

/**
 * Check if current time is within quiet hours
 */
function checkQuietHours(
	startTime: string,
	endTime: string,
	timezone?: string
): boolean {
	try {
		const now = new Date();

		// Parse start and end times (HH:MM format)
		const [startHour, startMinute] = startTime.split(':').map(Number);
		const [endHour, endMinute] = endTime.split(':').map(Number);

		const currentHour = now.getHours();
		const currentMinute = now.getMinutes();
		const currentTotalMinutes = currentHour * 60 + currentMinute;
		const startTotalMinutes = startHour * 60 + startMinute;
		const endTotalMinutes = endHour * 60 + endMinute;

		// Handle cases where quiet hours span midnight
		if (endTotalMinutes < startTotalMinutes) {
			return currentTotalMinutes >= startTotalMinutes || currentTotalMinutes <= endTotalMinutes;
		}

		return currentTotalMinutes >= startTotalMinutes && currentTotalMinutes <= endTotalMinutes;
	} catch (error) {
		console.error('[Notification Preferences] Failed to check quiet hours:', error);
		return false;
	}
}

/**
 * Get default channel based on user preferences
 */
export async function getPreferredChannel(
	event: RequestEvent,
	userId: string,
	category: NotificationCategory,
	organizationId?: string
): Promise<NotificationChannel> {
	try {
		const preferences = await getUserPreferences(event, userId, organizationId);

		if (!preferences) {
			return 'both';
		}

		const categoryPrefs = preferences.categories[category];

		if (!categoryPrefs || !categoryPrefs.channels || categoryPrefs.channels.length === 0) {
			return 'both';
		}

		// Return the first preferred channel
		return categoryPrefs.channels[0];
	} catch (error) {
		console.error('[Notification Preferences] Failed to get preferred channel:', error);
		return 'both';
	}
}

/**
 * Reset user preferences to defaults
 */
export async function resetPreferences(
	event: RequestEvent,
	userId: string,
	organizationId?: string
): Promise<boolean> {
	try {
		const db = pluginOptions?.storageDb === 'org'
			? await event.locals.kuratchi?.getOrgDb?.(organizationId)
			: await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.notification_preferences) {
			return false;
		}

		// Delete existing preferences
		await db.notification_preferences
			.where({ userId })
			.delete();

		// Create new default preferences
		await createDefaultPreferences(event, userId, organizationId);

		return true;
	} catch (error) {
		console.error('[Notification Preferences] Failed to reset preferences:', error);
		return false;
	}
}
