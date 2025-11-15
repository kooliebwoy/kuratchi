/**
 * Platform Monitoring and Alert Handlers
 * System-level monitoring for detecting and alerting on suspicious or excessive activity
 */

import type { RequestEvent } from '@sveltejs/kit';
import type {
	PlatformAlert,
	PlatformAlertType,
	CreatePlatformAlertOptions,
	NotificationPluginOptions,
	MonitoringThresholds,
} from './types.js';
import { sendEmailNotification } from './email.js';

let pluginOptions: NotificationPluginOptions | null = null;

// In-memory tracking for rate limiting (in production, use KV or Durable Objects)
const activityTracking = new Map<string, { count: number; windowStart: number }>();

/**
 * Initialize platform monitoring (called from main notifications module)
 */
export function initPlatformMonitoring(options: NotificationPluginOptions) {
	pluginOptions = options;
}

/**
 * Create a platform alert
 */
export async function createPlatformAlert(
	event: RequestEvent,
	options: CreatePlatformAlertOptions
): Promise<{ success: boolean; id?: string; error?: string }> {
	if (!pluginOptions?.enableMonitoring) {
		return { success: false, error: 'Platform monitoring is disabled' };
	}

	try {
		const db = await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.platform_alerts) {
			return { success: false, error: 'platform_alerts table not found' };
		}

		const alert: PlatformAlert = {
			id: crypto.randomUUID(),
			type: options.type,
			severity: options.severity || 'high',
			title: options.title,
			message: options.message,
			affectedResource: options.affectedResource,
			affectedUserId: options.affectedUserId,
			affectedOrgId: options.affectedOrgId,
			threshold: options.threshold,
			currentValue: options.currentValue,
			timeWindow: options.timeWindow,
			metadata: options.metadata,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		await db.platform_alerts.insert(alert);

		// Send email to system admin if configured
		if (options.notifySystemEmail && pluginOptions.systemEmail) {
			await sendSystemAlertEmail(event, alert, options.systemEmail);
		}

		return {
			success: true,
			id: alert.id,
		};
	} catch (error: any) {
		console.error('[Platform Monitoring] Failed to create alert:', error);
		return {
			success: false,
			error: error.message,
		};
	}
}

/**
 * Send system alert email to admin
 */
async function sendSystemAlertEmail(
	event: RequestEvent,
	alert: PlatformAlert,
	systemEmail: string
): Promise<void> {
	const severityEmoji = {
		urgent: '🚨',
		high: '⚠️',
		normal: 'ℹ️',
		low: '📋',
	};

	const html = `
		<h2>${severityEmoji[alert.severity]} Platform Alert: ${alert.title}</h2>
		<p><strong>Type:</strong> ${alert.type}</p>
		<p><strong>Severity:</strong> ${alert.severity}</p>
		<p><strong>Message:</strong> ${alert.message}</p>
		${alert.affectedResource ? `<p><strong>Affected Resource:</strong> ${alert.affectedResource}</p>` : ''}
		${alert.affectedUserId ? `<p><strong>Affected User:</strong> ${alert.affectedUserId}</p>` : ''}
		${alert.affectedOrgId ? `<p><strong>Affected Organization:</strong> ${alert.affectedOrgId}</p>` : ''}
		${alert.threshold ? `<p><strong>Threshold:</strong> ${alert.threshold}</p>` : ''}
		${alert.currentValue ? `<p><strong>Current Value:</strong> ${alert.currentValue}</p>` : ''}
		${alert.timeWindow ? `<p><strong>Time Window:</strong> ${alert.timeWindow}</p>` : ''}
		<p><strong>Time:</strong> ${new Date(alert.createdAt).toLocaleString()}</p>
		${alert.metadata ? `<p><strong>Metadata:</strong> <pre>${JSON.stringify(alert.metadata, null, 2)}</pre></p>` : ''}
	`;

	await sendEmailNotification(event, {
		to: systemEmail,
		subject: `[${alert.severity.toUpperCase()}] Platform Alert: ${alert.title}`,
		html,
		title: alert.title,
		message: alert.message,
		category: 'monitoring',
		priority: alert.severity,
		provider: 'cloudflare', // Use Cloudflare for system emails
	});
}

/**
 * Check for excessive database creation
 */
export async function checkExcessiveDatabaseCreation(
	event: RequestEvent,
	userId: string,
	organizationId?: string
): Promise<boolean> {
	const thresholds = pluginOptions?.monitoringThresholds;
	if (!thresholds) return false;

	const key = `db_creation:${userId}`;
	const hourlyLimit = thresholds.maxDatabasesPerHour || 10;
	const dailyLimit = thresholds.maxDatabasesPerDay || 50;

	// Check hourly limit
	const hourlyCount = await getActivityCount(key, 60); // 60 minutes
	if (hourlyCount >= hourlyLimit) {
		await createPlatformAlert(event, {
			type: 'excessive_db_creation',
			severity: 'high',
			title: 'Excessive Database Creation Detected',
			message: `User ${userId} has created ${hourlyCount} databases in the last hour (limit: ${hourlyLimit})`,
			affectedUserId: userId,
			affectedOrgId: organizationId,
			threshold: hourlyLimit,
			currentValue: hourlyCount,
			timeWindow: '1 hour',
			notifySystemEmail: true,
			systemEmail: pluginOptions?.systemEmail,
		});
		return true;
	}

	// Check daily limit
	const dailyCount = await getActivityCount(key, 1440); // 1440 minutes = 24 hours
	if (dailyCount >= dailyLimit) {
		await createPlatformAlert(event, {
			type: 'excessive_db_creation',
			severity: 'urgent',
			title: 'Excessive Database Creation Detected (Daily)',
			message: `User ${userId} has created ${dailyCount} databases in the last 24 hours (limit: ${dailyLimit})`,
			affectedUserId: userId,
			affectedOrgId: organizationId,
			threshold: dailyLimit,
			currentValue: dailyCount,
			timeWindow: '24 hours',
			notifySystemEmail: true,
			systemEmail: pluginOptions?.systemEmail,
		});
		return true;
	}

	return false;
}

/**
 * Check for excessive signups
 */
export async function checkExcessiveSignups(
	event: RequestEvent,
	ipAddress?: string
): Promise<boolean> {
	const thresholds = pluginOptions?.monitoringThresholds;
	if (!thresholds) return false;

	const key = `signups:${ipAddress || 'global'}`;
	const perMinuteLimit = thresholds.maxSignupsPerMinute || 5;
	const perHourLimit = thresholds.maxSignupsPerHour || 50;

	// Check per-minute limit
	const minuteCount = await getActivityCount(key, 1);
	if (minuteCount >= perMinuteLimit) {
		await createPlatformAlert(event, {
			type: 'excessive_signups',
			severity: 'urgent',
			title: 'Excessive Signups Detected',
			message: `${minuteCount} signups detected in the last minute from ${ipAddress || 'unknown IP'} (limit: ${perMinuteLimit})`,
			affectedResource: ipAddress,
			threshold: perMinuteLimit,
			currentValue: minuteCount,
			timeWindow: '1 minute',
			notifySystemEmail: true,
			systemEmail: pluginOptions?.systemEmail,
		});
		return true;
	}

	// Check hourly limit
	const hourlyCount = await getActivityCount(key, 60);
	if (hourlyCount >= perHourLimit) {
		await createPlatformAlert(event, {
			type: 'excessive_signups',
			severity: 'high',
			title: 'Excessive Signups Detected (Hourly)',
			message: `${hourlyCount} signups detected in the last hour from ${ipAddress || 'unknown IP'} (limit: ${perHourLimit})`,
			affectedResource: ipAddress,
			threshold: perHourLimit,
			currentValue: hourlyCount,
			timeWindow: '1 hour',
			notifySystemEmail: true,
			systemEmail: pluginOptions?.systemEmail,
		});
		return true;
	}

	return false;
}

/**
 * Check for excessive API calls
 */
export async function checkExcessiveApiCalls(
	event: RequestEvent,
	userId: string,
	endpoint?: string
): Promise<boolean> {
	const thresholds = pluginOptions?.monitoringThresholds;
	if (!thresholds) return false;

	const key = `api_calls:${userId}:${endpoint || 'all'}`;
	const perMinuteLimit = thresholds.maxApiCallsPerMinute || 100;
	const perHourLimit = thresholds.maxApiCallsPerHour || 5000;

	// Check per-minute limit
	const minuteCount = await getActivityCount(key, 1);
	if (minuteCount >= perMinuteLimit) {
		await createPlatformAlert(event, {
			type: 'excessive_api_calls',
			severity: 'high',
			title: 'Excessive API Calls Detected',
			message: `User ${userId} has made ${minuteCount} API calls in the last minute (limit: ${perMinuteLimit})`,
			affectedUserId: userId,
			affectedResource: endpoint,
			threshold: perMinuteLimit,
			currentValue: minuteCount,
			timeWindow: '1 minute',
			notifySystemEmail: true,
			systemEmail: pluginOptions?.systemEmail,
		});
		return true;
	}

	// Check hourly limit
	const hourlyCount = await getActivityCount(key, 60);
	if (hourlyCount >= perHourLimit) {
		await createPlatformAlert(event, {
			type: 'excessive_api_calls',
			severity: 'urgent',
			title: 'Excessive API Calls Detected (Hourly)',
			message: `User ${userId} has made ${hourlyCount} API calls in the last hour (limit: ${perHourLimit})`,
			affectedUserId: userId,
			affectedResource: endpoint,
			threshold: perHourLimit,
			currentValue: hourlyCount,
			timeWindow: '1 hour',
			notifySystemEmail: true,
			systemEmail: pluginOptions?.systemEmail,
		});
		return true;
	}

	return false;
}

/**
 * Track activity (increment counter)
 */
export async function trackActivity(
	key: string,
	windowMinutes: number = 60
): Promise<void> {
	const now = Date.now();
	const windowMs = windowMinutes * 60 * 1000;

	const existing = activityTracking.get(key);

	if (!existing || now - existing.windowStart > windowMs) {
		// Start new window
		activityTracking.set(key, {
			count: 1,
			windowStart: now,
		});
	} else {
		// Increment existing window
		existing.count++;
	}

	// Cleanup old entries periodically
	if (Math.random() < 0.01) {
		cleanupOldActivityTracking(windowMs);
	}
}

/**
 * Get activity count within time window
 */
async function getActivityCount(
	key: string,
	windowMinutes: number = 60
): Promise<number> {
	const now = Date.now();
	const windowMs = windowMinutes * 60 * 1000;

	const existing = activityTracking.get(key);

	if (!existing || now - existing.windowStart > windowMs) {
		return 0;
	}

	return existing.count;
}

/**
 * Cleanup old activity tracking entries
 */
function cleanupOldActivityTracking(maxAgeMs: number): void {
	const now = Date.now();
	const keysToDelete: string[] = [];

	for (const [key, value] of activityTracking.entries()) {
		if (now - value.windowStart > maxAgeMs) {
			keysToDelete.push(key);
		}
	}

	for (const key of keysToDelete) {
		activityTracking.delete(key);
	}
}

/**
 * Get all platform alerts
 */
export async function getPlatformAlerts(
	event: RequestEvent,
	filters?: {
		type?: PlatformAlertType;
		severity?: 'urgent' | 'high' | 'normal' | 'low';
		affectedUserId?: string;
		affectedOrgId?: string;
		resolved?: boolean;
		limit?: number;
		offset?: number;
	}
): Promise<PlatformAlert[]> {
	try {
		const db = await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.platform_alerts) {
			return [];
		}

		let query = db.platform_alerts;

		// Apply filters
		const whereConditions: any = {};

		if (filters?.type) {
			whereConditions.type = filters.type;
		}
		if (filters?.severity) {
			whereConditions.severity = filters.severity;
		}
		if (filters?.affectedUserId) {
			whereConditions.affectedUserId = filters.affectedUserId;
		}
		if (filters?.affectedOrgId) {
			whereConditions.affectedOrgId = filters.affectedOrgId;
		}
		if (filters?.resolved !== undefined) {
			whereConditions.resolvedAt = filters.resolved ? { isNot: null } : { is: null };
		}

		if (Object.keys(whereConditions).length > 0) {
			query = query.where(whereConditions);
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
		console.error('[Platform Monitoring] Failed to get alerts:', error);
		return [];
	}
}

/**
 * Resolve a platform alert
 */
export async function resolvePlatformAlert(
	event: RequestEvent,
	alertId: string
): Promise<boolean> {
	try {
		const db = await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.platform_alerts) {
			return false;
		}

		await db.platform_alerts
			.where({ id: alertId })
			.update({
				resolvedAt: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			});

		return true;
	} catch (error) {
		console.error('[Platform Monitoring] Failed to resolve alert:', error);
		return false;
	}
}

/**
 * Get alert statistics
 */
export async function getAlertStats(
	event: RequestEvent,
	timeWindow?: number // in hours
): Promise<{
	total: number;
	resolved: number;
	unresolved: number;
	byType: Record<PlatformAlertType, number>;
	bySeverity: Record<string, number>;
}> {
	try {
		const filters: any = {};

		if (timeWindow) {
			const since = new Date();
			since.setHours(since.getHours() - timeWindow);
			// Note: You'd need to add date filtering to getPlatformAlerts
		}

		const alerts = await getPlatformAlerts(event, filters);

		const stats = {
			total: alerts.length,
			resolved: 0,
			unresolved: 0,
			byType: {
				excessive_db_creation: 0,
				excessive_signups: 0,
				excessive_api_calls: 0,
				quota_exceeded: 0,
				rate_limit_exceeded: 0,
				suspicious_activity: 0,
				system_error: 0,
				performance_degradation: 0,
			} as Record<PlatformAlertType, number>,
			bySeverity: {
				urgent: 0,
				high: 0,
				normal: 0,
				low: 0,
			},
		};

		for (const alert of alerts) {
			if (alert.resolvedAt) {
				stats.resolved++;
			} else {
				stats.unresolved++;
			}

			stats.byType[alert.type]++;
			stats.bySeverity[alert.severity]++;
		}

		return stats;
	} catch (error) {
		console.error('[Platform Monitoring] Failed to get alert stats:', error);
		return {
			total: 0,
			resolved: 0,
			unresolved: 0,
			byType: {
				excessive_db_creation: 0,
				excessive_signups: 0,
				excessive_api_calls: 0,
				quota_exceeded: 0,
				rate_limit_exceeded: 0,
				suspicious_activity: 0,
				system_error: 0,
				performance_degradation: 0,
			},
			bySeverity: {
				urgent: 0,
				high: 0,
				normal: 0,
				low: 0,
			},
		};
	}
}
