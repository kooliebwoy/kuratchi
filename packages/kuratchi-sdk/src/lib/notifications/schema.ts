/**
 * Notification Database Schemas
 * Add these to your admin or organization schema to enable notifications
 */

/**
 * In-app notifications table schema
 */
export const notificationsTableSchema = {
	notifications: {
		id: 'text primary key not null',
		userId: 'text',
		organizationId: 'text',
		title: 'text not null',
		message: 'text not null',
		category: 'enum(system,database,security,billing,account,feature,monitoring,custom) default custom',
		priority: 'enum(urgent,high,normal,low) default normal',
		channel: 'enum(in-app,email,both) default in-app',
		status: 'enum(pending,sent,delivered,read,failed,cancelled) default pending',
		readAt: 'text',
		actionUrl: 'text',
		actionLabel: 'text',
		iconUrl: 'text',
		expiresAt: 'text',
		groupKey: 'text', // For grouping related notifications
		metadata: 'json',
		created_at: 'text default now',
		updated_at: 'text default now',
		deleted_at: 'text',
	}
} as const;

/**
 * Email notifications tracking table schema
 */
export const emailNotificationsTableSchema = {
	email_notifications: {
		id: 'text primary key not null',
		to: 'text not null',
		from: 'text not null',
		subject: 'text not null',
		html: 'text',
		text: 'text',
		provider: 'enum(resend,cloudflare) default resend',
		userId: 'text',
		organizationId: 'text',
		category: 'enum(system,database,security,billing,account,feature,monitoring,custom) default custom',
		priority: 'enum(urgent,high,normal,low) default normal',
		status: 'enum(pending,sent,delivered,read,failed,cancelled) default pending',
		providerId: 'text', // Email provider's tracking ID (e.g., Resend ID)
		error: 'text',
		sentAt: 'text',
		deliveredAt: 'text',
		openedAt: 'text',
		clickedAt: 'text',
		replyTo: 'text',
		cc: 'text',
		bcc: 'text',
		tags: 'json',
		headers: 'json',
		metadata: 'json',
		created_at: 'text default now',
		updated_at: 'text default now',
		deleted_at: 'text',
	}
} as const;

/**
 * Platform alerts table schema
 */
export const platformAlertsTableSchema = {
	platform_alerts: {
		id: 'text primary key not null',
		type: 'enum(excessive_db_creation,excessive_signups,excessive_api_calls,quota_exceeded,rate_limit_exceeded,suspicious_activity,system_error,performance_degradation) not null',
		severity: 'enum(urgent,high,normal,low) default high',
		title: 'text not null',
		message: 'text not null',
		affectedResource: 'text',
		affectedUserId: 'text',
		affectedOrgId: 'text',
		threshold: 'integer',
		currentValue: 'integer',
		timeWindow: 'text', // e.g., "5 minutes", "1 hour"
		metadata: 'json',
		resolvedAt: 'text',
		created_at: 'text default now',
		updated_at: 'text default now',
	}
} as const;

/**
 * Notification templates table schema
 */
export const notificationTemplatesTableSchema = {
	notification_templates: {
		id: 'text primary key not null',
		name: 'text not null unique',
		category: 'enum(system,database,security,billing,account,feature,monitoring,custom) not null',
		channel: 'enum(in-app,email,both) not null',
		subject: 'text', // For email templates
		title: 'text not null',
		message: 'text not null',
		html: 'text', // For email templates
		actionUrl: 'text',
		actionLabel: 'text',
		variables: 'json', // Array of variable names
		isActive: 'boolean default true',
		created_at: 'text default now',
		updated_at: 'text default now',
	}
} as const;

/**
 * User notification preferences table schema
 */
export const notificationPreferencesTableSchema = {
	notification_preferences: {
		id: 'text primary key not null',
		userId: 'text not null unique',
		organizationId: 'text',

		// Channel preferences
		enableInApp: 'boolean default true',
		enableEmail: 'boolean default true',

		// Category preferences (stored as JSON)
		categories: 'json',

		// Quiet hours
		quietHoursEnabled: 'boolean default false',
		quietHoursStart: 'text', // HH:MM format
		quietHoursEnd: 'text',   // HH:MM format
		quietHoursTimezone: 'text',

		// Digest preferences
		enableDigest: 'boolean default false',
		digestFrequency: 'enum(daily,weekly,monthly)',
		digestTime: 'text', // HH:MM format

		created_at: 'text default now',
		updated_at: 'text default now',
	}
} as const;

/**
 * Notification queue table schema (for batch processing tracking)
 */
export const notificationQueueTableSchema = {
	notification_queue: {
		id: 'text primary key not null',
		type: 'enum(in-app,email,platform-alert) not null',
		priority: 'enum(urgent,high,normal,low) default normal',
		userId: 'text',
		organizationId: 'text',
		email: 'text',
		notification: 'json not null',
		emailData: 'json',
		alertData: 'json',
		retryCount: 'integer default 0',
		maxRetries: 'integer default 3',
		scheduledFor: 'text',
		status: 'enum(pending,processing,completed,failed) default pending',
		error: 'text',
		processedAt: 'text',
		created_at: 'text default now',
		updated_at: 'text default now',
	}
} as const;

/**
 * Combined notification schemas
 */
export const notificationSchemas = {
	...notificationsTableSchema,
	...emailNotificationsTableSchema,
	...platformAlertsTableSchema,
	...notificationTemplatesTableSchema,
	...notificationPreferencesTableSchema,
	...notificationQueueTableSchema,
} as const;

/**
 * Example: Add to your admin schema
 *
 * ```typescript
 * import { notificationSchemas } from 'kuratchi-sdk/notifications';
 *
 * export const adminSchema = {
 *   name: 'admin',
 *   version: 1,
 *   tables: {
 *     ...yourExistingTables,
 *     ...notificationSchemas
 *   }
 * };
 * ```
 *
 * Or add individual schemas:
 *
 * ```typescript
 * import {
 *   notificationsTableSchema,
 *   emailNotificationsTableSchema
 * } from 'kuratchi-sdk/notifications';
 *
 * export const adminSchema = {
 *   name: 'admin',
 *   version: 1,
 *   tables: {
 *     ...yourExistingTables,
 *     ...notificationsTableSchema,
 *     ...emailNotificationsTableSchema
 *   }
 * };
 * ```
 */
