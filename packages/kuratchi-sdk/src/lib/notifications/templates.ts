/**
 * Notification Templates
 * Reusable templates for common notification scenarios
 */

import type { RequestEvent } from '@sveltejs/kit';
import type {
	NotificationTemplate,
	NotificationCategory,
	NotificationChannel,
	NotificationPluginOptions,
} from './types.js';

let pluginOptions: NotificationPluginOptions | null = null;

/**
 * Initialize templates (called from main notifications module)
 */
export function initTemplates(options: NotificationPluginOptions) {
	pluginOptions = options;
}

/**
 * Create a notification template
 */
export async function createTemplate(
	event: RequestEvent,
	template: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<{ success: boolean; id?: string; error?: string }> {
	try {
		const db = await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.notification_templates) {
			return { success: false, error: 'notification_templates table not found' };
		}

		const newTemplate: NotificationTemplate = {
			...template,
			id: crypto.randomUUID(),
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		await db.notification_templates.insert(newTemplate);

		return {
			success: true,
			id: newTemplate.id,
		};
	} catch (error: any) {
		console.error('[Notification Templates] Failed to create template:', error);
		return {
			success: false,
			error: error.message,
		};
	}
}

/**
 * Get a template by ID
 */
export async function getTemplateById(
	event: RequestEvent,
	templateId: string
): Promise<NotificationTemplate | null> {
	try {
		const db = await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.notification_templates) {
			return null;
		}

		const result = await db.notification_templates
			.where({ id: templateId })
			.first();

		return result?.data || null;
	} catch (error) {
		console.error('[Notification Templates] Failed to get template:', error);
		return null;
	}
}

/**
 * Get a template by name
 */
export async function getTemplateByName(
	event: RequestEvent,
	name: string
): Promise<NotificationTemplate | null> {
	try {
		const db = await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.notification_templates) {
			return null;
		}

		const result = await db.notification_templates
			.where({ name, isActive: true })
			.first();

		return result?.data || null;
	} catch (error) {
		console.error('[Notification Templates] Failed to get template by name:', error);
		return null;
	}
}

/**
 * Get all templates
 */
export async function getAllTemplates(
	event: RequestEvent,
	filters?: {
		category?: NotificationCategory;
		channel?: NotificationChannel;
		isActive?: boolean;
	}
): Promise<NotificationTemplate[]> {
	try {
		const db = await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.notification_templates) {
			return [];
		}

		let query = db.notification_templates;

		const whereConditions: any = {};

		if (filters?.category) {
			whereConditions.category = filters.category;
		}
		if (filters?.channel) {
			whereConditions.channel = filters.channel;
		}
		if (filters?.isActive !== undefined) {
			whereConditions.isActive = filters.isActive;
		}

		if (Object.keys(whereConditions).length > 0) {
			query = query.where(whereConditions);
		}

		query = query.orderBy({ name: 'asc' });

		const result = await query.many();
		return result?.data || [];
	} catch (error) {
		console.error('[Notification Templates] Failed to get templates:', error);
		return [];
	}
}

/**
 * Update a template
 */
export async function updateTemplate(
	event: RequestEvent,
	templateId: string,
	updates: Partial<Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<boolean> {
	try {
		const db = await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.notification_templates) {
			return false;
		}

		await db.notification_templates
			.where({ id: templateId })
			.update({
				...updates,
				updated_at: new Date().toISOString(),
			});

		return true;
	} catch (error) {
		console.error('[Notification Templates] Failed to update template:', error);
		return false;
	}
}

/**
 * Delete a template
 */
export async function deleteTemplate(
	event: RequestEvent,
	templateId: string
): Promise<boolean> {
	try {
		const db = await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.notification_templates) {
			return false;
		}

		await db.notification_templates
			.where({ id: templateId })
			.delete();

		return true;
	} catch (error) {
		console.error('[Notification Templates] Failed to delete template:', error);
		return false;
	}
}

/**
 * Render a template with variables
 */
export function renderTemplate(
	template: NotificationTemplate,
	variables: Record<string, any>
): {
	title: string;
	message: string;
	subject?: string;
	html?: string;
	actionUrl?: string;
	actionLabel?: string;
} {
	return {
		title: replaceVariables(template.title, variables),
		message: replaceVariables(template.message, variables),
		subject: template.subject ? replaceVariables(template.subject, variables) : undefined,
		html: template.html ? replaceVariables(template.html, variables) : undefined,
		actionUrl: template.actionUrl ? replaceVariables(template.actionUrl, variables) : undefined,
		actionLabel: template.actionLabel ? replaceVariables(template.actionLabel, variables) : undefined,
	};
}

/**
 * Replace variables in a string
 * Supports {{ variable }} and {{variable}} syntax
 */
function replaceVariables(text: string, variables: Record<string, any>): string {
	let result = text;

	for (const [key, value] of Object.entries(variables)) {
		const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
		result = result.replace(regex, String(value));
	}

	return result;
}

/**
 * Create default templates for common scenarios
 */
export async function seedDefaultTemplates(event: RequestEvent): Promise<void> {
	const defaultTemplates: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
		// Database creation
		{
			name: 'database_created',
			category: 'database',
			channel: 'both',
			subject: 'Your database "{{ databaseName }}" is ready!',
			title: 'Database Created',
			message: 'Your database "{{ databaseName }}" has been successfully created and is ready to use.',
			html: `
				<h2>Database Created Successfully</h2>
				<p>Your database <strong>{{ databaseName }}</strong> has been created and is ready to use.</p>
				<p><strong>Details:</strong></p>
				<ul>
					<li>Database ID: {{ databaseId }}</li>
					<li>Region: {{ region }}</li>
					<li>Created: {{ createdAt }}</li>
				</ul>
				<p><a href="{{ actionUrl }}" style="display: inline-block; padding: 12px 24px; background-color: #0066ff; color: white; text-decoration: none; border-radius: 6px;">View Database</a></p>
			`,
			actionUrl: '/databases/{{ databaseId }}',
			actionLabel: 'View Database',
			variables: ['databaseName', 'databaseId', 'region', 'createdAt', 'actionUrl'],
			isActive: true,
		},
		// Database creation failed
		{
			name: 'database_creation_failed',
			category: 'database',
			channel: 'both',
			subject: 'Database creation failed',
			title: 'Database Creation Failed',
			message: 'We encountered an error while creating your database "{{ databaseName }}". Error: {{ error }}',
			html: `
				<h2>Database Creation Failed</h2>
				<p>We encountered an error while creating your database <strong>{{ databaseName }}</strong>.</p>
				<p><strong>Error:</strong> {{ error }}</p>
				<p>Please try again or contact support if the problem persists.</p>
			`,
			variables: ['databaseName', 'error'],
			isActive: true,
		},
		// Welcome email
		{
			name: 'welcome',
			category: 'account',
			channel: 'both',
			subject: 'Welcome to {{ appName }}!',
			title: 'Welcome!',
			message: 'Welcome to {{ appName }}, {{ userName }}! We\'re excited to have you on board.',
			html: `
				<h2>Welcome to {{ appName }}!</h2>
				<p>Hi {{ userName }},</p>
				<p>We're excited to have you on board! Get started by exploring our platform.</p>
				<p><a href="{{ actionUrl }}" style="display: inline-block; padding: 12px 24px; background-color: #0066ff; color: white; text-decoration: none; border-radius: 6px;">Get Started</a></p>
			`,
			actionUrl: '/dashboard',
			actionLabel: 'Get Started',
			variables: ['appName', 'userName', 'actionUrl'],
			isActive: true,
		},
		// Security alert
		{
			name: 'security_alert',
			category: 'security',
			channel: 'both',
			subject: 'Security Alert: {{ alertType }}',
			title: 'Security Alert',
			message: 'Security alert: {{ message }}',
			html: `
				<h2>⚠️ Security Alert</h2>
				<p><strong>Type:</strong> {{ alertType }}</p>
				<p><strong>Message:</strong> {{ message }}</p>
				<p><strong>Time:</strong> {{ timestamp }}</p>
				<p>If this wasn't you, please secure your account immediately.</p>
				<p><a href="{{ actionUrl }}" style="display: inline-block; padding: 12px 24px; background-color: #ff3333; color: white; text-decoration: none; border-radius: 6px;">Review Activity</a></p>
			`,
			actionUrl: '/security',
			actionLabel: 'Review Activity',
			variables: ['alertType', 'message', 'timestamp', 'actionUrl'],
			isActive: true,
		},
		// Quota warning
		{
			name: 'quota_warning',
			category: 'billing',
			channel: 'both',
			subject: 'Quota Warning: {{ resourceType }}',
			title: 'Quota Warning',
			message: 'You\'ve used {{ percentUsed }}% of your {{ resourceType }} quota.',
			html: `
				<h2>Quota Warning</h2>
				<p>You've used <strong>{{ percentUsed }}%</strong> of your {{ resourceType }} quota.</p>
				<p><strong>Current Usage:</strong> {{ currentUsage }} / {{ limit }}</p>
				<p>Consider upgrading your plan to avoid service interruptions.</p>
				<p><a href="{{ actionUrl }}" style="display: inline-block; padding: 12px 24px; background-color: #0066ff; color: white; text-decoration: none; border-radius: 6px;">Upgrade Plan</a></p>
			`,
			actionUrl: '/billing/upgrade',
			actionLabel: 'Upgrade Plan',
			variables: ['resourceType', 'percentUsed', 'currentUsage', 'limit', 'actionUrl'],
			isActive: true,
		},
		// Payment successful
		{
			name: 'payment_successful',
			category: 'billing',
			channel: 'both',
			subject: 'Payment Successful - {{ amount }}',
			title: 'Payment Successful',
			message: 'Your payment of {{ amount }} has been processed successfully.',
			html: `
				<h2>Payment Successful</h2>
				<p>Your payment of <strong>{{ amount }}</strong> has been processed successfully.</p>
				<p><strong>Details:</strong></p>
				<ul>
					<li>Transaction ID: {{ transactionId }}</li>
					<li>Date: {{ date }}</li>
					<li>Plan: {{ planName }}</li>
				</ul>
				<p><a href="{{ actionUrl }}" style="display: inline-block; padding: 12px 24px; background-color: #0066ff; color: white; text-decoration: none; border-radius: 6px;">View Invoice</a></p>
			`,
			actionUrl: '/billing/invoices/{{ transactionId }}',
			actionLabel: 'View Invoice',
			variables: ['amount', 'transactionId', 'date', 'planName', 'actionUrl'],
			isActive: true,
		},
		// Feature announcement
		{
			name: 'feature_announcement',
			category: 'feature',
			channel: 'in-app',
			title: 'New Feature: {{ featureName }}',
			message: '{{ description }}',
			actionUrl: '/features/{{ featureId }}',
			actionLabel: 'Learn More',
			variables: ['featureName', 'description', 'featureId', 'actionUrl'],
			isActive: true,
		},
	];

	for (const template of defaultTemplates) {
		try {
			// Check if template already exists
			const existing = await getTemplateByName(event, template.name);
			if (!existing) {
				await createTemplate(event, template);
				console.log(`[Templates] Created default template: ${template.name}`);
			}
		} catch (error) {
			console.error(`[Templates] Failed to seed template ${template.name}:`, error);
		}
	}
}
