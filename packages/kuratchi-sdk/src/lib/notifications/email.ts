/**
 * Email Notification Handlers
 * Supports both Cloudflare Email Routing (system emails) and Amazon SES (user emails)
 */

import type { RequestEvent } from '@sveltejs/kit';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type {
	EmailNotification,
	SendEmailNotificationOptions,
	NotificationResult,
	NotificationPluginOptions,
	EmailProvider,
	NotificationFilters,
} from './types.js';

let sesClient: SESv2Client | null = null;
let pluginOptions: NotificationPluginOptions | null = null;

/**
 * Initialize email notifications (called from main notifications module)
 */
export function initEmailNotifications(options: NotificationPluginOptions) {
	pluginOptions = options;

	if (options.sesRegion && options.sesAccessKeyId && options.sesSecretAccessKey) {
		sesClient = new SESv2Client({
			region: options.sesRegion,
			credentials: {
				accessKeyId: options.sesAccessKeyId,
				secretAccessKey: options.sesSecretAccessKey,
			}
		});
	}
}

/**
 * Send an email notification
 */
export async function sendEmailNotification(
	event: RequestEvent,
	options: SendEmailNotificationOptions
): Promise<NotificationResult> {
	if (!pluginOptions?.enableEmail) {
		return { success: false, error: 'Email notifications are disabled' };
	}

	const provider: EmailProvider = options.provider || 'ses';

	try {
		let result: NotificationResult;

		if (provider === 'cloudflare') {
			result = await sendViaCloudflare(event, options);
		} else {
			result = await sendViaSES(event, options);
		}

		// Track email in database if successful
		if (result.success && pluginOptions.enableEmail) {
			await trackEmailNotification(event, {
				...options,
				provider,
				providerId: result.id,
				status: 'sent',
			});
		} else if (!result.success) {
			await trackEmailNotification(event, {
				...options,
				provider,
				status: 'failed',
				error: result.error,
			});
		}

		return result;
	} catch (error: any) {
		console.error('[Email Notifications] Failed to send email:', error);

		// Track failed email
		await trackEmailNotification(event, {
			...options,
			provider,
			status: 'failed',
			error: error.message,
		});

		return {
			success: false,
			error: error.message,
		};
	}
}

/**
 * Send email via Amazon SES V2 (for user emails)
 */
async function sendViaSES(
	event: RequestEvent,
	options: SendEmailNotificationOptions
): Promise<NotificationResult> {
	if (!sesClient) {
		return {
			success: false,
			error: 'Amazon SES not configured. Please provide sesRegion, sesAccessKeyId, and sesSecretAccessKey in plugin options.',
		};
	}

	const from = options.fromName && (options.from || pluginOptions?.sesFrom)
		? `${options.fromName} <${options.from || pluginOptions?.sesFrom}>`
		: options.from || pluginOptions?.sesFrom;

	if (!from) {
		return {
			success: false,
			error: 'No from email address configured for Amazon SES',
		};
	}

	try {
		// Prepare email content
		const content: any = {
			Simple: {
				Subject: { Data: options.subject, Charset: 'UTF-8' },
				Body: {}
			}
		};

		if (options.html && options.text) {
			content.Simple.Body.Html = { Data: options.html, Charset: 'UTF-8' };
			content.Simple.Body.Text = { Data: options.text, Charset: 'UTF-8' };
		} else if (options.html) {
			content.Simple.Body.Html = { Data: options.html, Charset: 'UTF-8' };
		} else if (options.text) {
			content.Simple.Body.Text = { Data: options.text, Charset: 'UTF-8' };
		} else {
			return {
				success: false,
				error: 'Either html or text content is required',
			};
		}

		// Prepare destination
		const destination: any = {
			ToAddresses: Array.isArray(options.to) ? options.to : [options.to]
		};
		if (options.cc) {
			destination.CcAddresses = Array.isArray(options.cc) ? options.cc : [options.cc];
		}
		if (options.bcc) {
			destination.BccAddresses = Array.isArray(options.bcc) ? options.bcc : [options.bcc];
		}

		// Prepare command parameters
		const params: any = {
			FromEmailAddress: from,
			Destination: destination,
			Content: content
		};

		// Add optional parameters
		if (options.replyTo) {
			params.ReplyToAddresses = Array.isArray(options.replyTo) ? options.replyTo : [options.replyTo];
		}
		if (options.headers) {
			params.EmailHeaders = Object.entries(options.headers).map(([Name, Value]) => ({ Name, Value }));
		}
		if (pluginOptions?.sesConfigurationSetName) {
			params.ConfigurationSetName = pluginOptions.sesConfigurationSetName;
		}

		// Add email tags (SES uses different format than Resend)
		if (options.tags) {
			params.EmailTags = options.tags.map(tag => ({ Name: tag.name, Value: tag.value }));
		}

		// Send email via SES V2
		const command = new SendEmailCommand(params);
		const result = await sesClient.send(command);

		return {
			success: true,
			id: result.MessageId,
		};
	} catch (error: any) {
		console.error('[Email Notifications] Amazon SES error:', error);
		return {
			success: false,
			error: error.message,
		};
	}
}

/**
 * Send email via Cloudflare Email Routing (for system emails)
 * Uses Cloudflare Workers Email API
 */
async function sendViaCloudflare(
	event: RequestEvent,
	options: SendEmailNotificationOptions
): Promise<NotificationResult> {
	const cfEmail = pluginOptions?.cloudflareEmail;

	if (!cfEmail?.from) {
		return {
			success: false,
			error: 'Cloudflare Email not configured. Please provide cloudflareEmail.from in plugin options.',
		};
	}

	// If we have EMAIL_SENDER binding available (Cloudflare Workers Email)
	const emailSender = (event.platform as any)?.env?.EMAIL_SENDER;

	if (emailSender) {
		try {
			// Use Cloudflare Workers Email Send API
			const message = {
				from: options.from || cfEmail.from,
				to: Array.isArray(options.to) ? options.to : [options.to],
				subject: options.subject,
				...(options.html ? { html: options.html } : {}),
				...(options.text ? { text: options.text } : {}),
				...(options.replyTo ? { reply_to: options.replyTo } : {}),
				...(options.cc ? { cc: Array.isArray(options.cc) ? options.cc : [options.cc] } : {}),
				...(options.bcc ? { bcc: Array.isArray(options.bcc) ? options.bcc : [options.bcc] } : {}),
				...(options.headers ? { headers: options.headers } : {}),
			};

			await emailSender.send(message);

			return {
				success: true,
				id: crypto.randomUUID(), // Generate our own ID for tracking
			};
		} catch (error: any) {
			console.error('[Email Notifications] Cloudflare Email error:', error);
			return {
				success: false,
				error: error.message,
			};
		}
	}

	// Fallback: Use Cloudflare API if API token and account ID are provided
	if (cfEmail.apiToken && cfEmail.accountId) {
		try {
			const response = await fetch(
				`https://api.cloudflare.com/client/v4/accounts/${cfEmail.accountId}/email/routing/addresses/send`,
				{
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${cfEmail.apiToken}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						from: options.from || cfEmail.from,
						to: Array.isArray(options.to) ? options.to : [options.to],
						subject: options.subject,
						html: options.html,
						text: options.text,
						reply_to: options.replyTo,
						cc: options.cc,
						bcc: options.bcc,
						headers: options.headers,
					}),
				}
			);

			const data = await response.json() as any;

			if (!response.ok) {
				return {
					success: false,
					error: data.errors?.[0]?.message || 'Cloudflare API error',
				};
			}

			return {
				success: true,
				id: data.result?.id || crypto.randomUUID(),
			};
		} catch (error: any) {
			console.error('[Email Notifications] Cloudflare API error:', error);
			return {
				success: false,
				error: error.message,
			};
		}
	}

	return {
		success: false,
		error: 'Cloudflare Email not properly configured. Need either EMAIL_SENDER binding or apiToken + accountId.',
	};
}

/**
 * Track email notification in database
 */
async function trackEmailNotification(
	event: RequestEvent,
	options: SendEmailNotificationOptions & {
		provider: EmailProvider;
		providerId?: string;
		status: 'sent' | 'failed' | 'pending';
		error?: string;
	}
) {
	try {
		const db = pluginOptions?.storageDb === 'org'
			? await event.locals.kuratchi?.getOrgDb?.(options.organizationId)
			: await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.email_notifications) {
			console.warn('[Email Notifications] email_notifications table not found');
			return;
		}

		const emailRecord: EmailNotification = {
			id: crypto.randomUUID(),
			to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
			from: options.from || pluginOptions?.sesFrom || pluginOptions?.cloudflareEmail?.from || '',
			subject: options.subject,
			html: options.html,
			text: options.text,
			provider: options.provider,
			userId: options.userId,
			organizationId: options.organizationId,
			category: options.category,
			priority: options.priority || 'normal',
			status: options.status,
			providerId: options.providerId,
			error: options.error,
			sentAt: options.status === 'sent' ? new Date().toISOString() : undefined,
			replyTo: options.replyTo,
			cc: Array.isArray(options.cc) ? options.cc.join(', ') : options.cc,
			bcc: Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc,
			tags: options.tags,
			headers: options.headers,
			metadata: options.metadata,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		await db.email_notifications.insert(emailRecord);
	} catch (error) {
		console.error('[Email Notifications] Failed to track email:', error);
	}
}

/**
 * Get email notification history
 */
export async function getEmailHistory(
	event: RequestEvent,
	filters?: NotificationFilters
): Promise<EmailNotification[]> {
	try {
		const db = pluginOptions?.storageDb === 'org'
			? await event.locals.kuratchi?.getOrgDb?.(filters?.organizationId)
			: await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.email_notifications) {
			return [];
		}

		let query = db.email_notifications.where({ deleted_at: { is: null } });

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
		console.error('[Email Notifications] Failed to get email history:', error);
		return [];
	}
}

/**
 * Get email notification by ID
 */
export async function getEmailById(
	event: RequestEvent,
	emailId: string,
	organizationId?: string
): Promise<EmailNotification | null> {
	try {
		const db = pluginOptions?.storageDb === 'org'
			? await event.locals.kuratchi?.getOrgDb?.(organizationId)
			: await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.email_notifications) {
			return null;
		}

		const result = await db.email_notifications
			.where({ id: emailId, deleted_at: { is: null } })
			.first();

		return result?.data || null;
	} catch (error) {
		console.error('[Email Notifications] Failed to get email:', error);
		return null;
	}
}

/**
 * Update email notification status (for webhooks)
 */
export async function updateEmailStatus(
	event: RequestEvent,
	providerId: string,
	status: 'delivered' | 'read' | 'failed',
	metadata?: Record<string, any>
): Promise<boolean> {
	try {
		const db = await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.email_notifications) {
			return false;
		}

		const updateData: any = {
			status,
			updated_at: new Date().toISOString(),
		};

		if (status === 'delivered') {
			updateData.deliveredAt = new Date().toISOString();
		} else if (status === 'read') {
			updateData.openedAt = new Date().toISOString();
		}

		if (metadata) {
			updateData.metadata = metadata;
		}

		await db.email_notifications
			.where({ providerId })
			.update(updateData);

		return true;
	} catch (error) {
		console.error('[Email Notifications] Failed to update email status:', error);
		return false;
	}
}

/**
 * Send email using a template
 */
export async function sendTemplatedEmail(
	event: RequestEvent,
	templateId: string,
	templateVars: Record<string, any>,
	options: Omit<SendEmailNotificationOptions, 'subject' | 'html' | 'text'>
): Promise<NotificationResult> {
	try {
		const db = await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.notification_templates) {
			return {
				success: false,
				error: 'Notification templates table not found',
			};
		}

		// Get template
		const templateResult = await db.notification_templates
			.where({ id: templateId, isActive: true })
			.first();

		if (!templateResult?.data) {
			return {
				success: false,
				error: `Template not found: ${templateId}`,
			};
		}

		const template = templateResult.data;

		// Replace variables in subject, html, and text
		const subject = replaceVariables(template.subject || '', templateVars);
		const html = template.html ? replaceVariables(template.html, templateVars) : undefined;
		const text = replaceVariables(template.message, templateVars);

		// Send email with template content
		return await sendEmailNotification(event, {
			...options,
			subject,
			html,
			text,
			title: replaceVariables(template.title, templateVars),
			message: text,
			category: template.category,
		});
	} catch (error: any) {
		console.error('[Email Notifications] Failed to send templated email:', error);
		return {
			success: false,
			error: error.message,
		};
	}
}

/**
 * Replace variables in a string template
 */
function replaceVariables(template: string, vars: Record<string, any>): string {
	let result = template;

	for (const [key, value] of Object.entries(vars)) {
		const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
		result = result.replace(regex, String(value));
	}

	return result;
}
