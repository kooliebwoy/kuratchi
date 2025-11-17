/**
 * Email Plugin - Standalone email service with tracking
 * Uses Amazon SES V2 for email delivery with tenant isolation
 */

import type { RequestEvent } from '@sveltejs/kit';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

export interface EmailPluginOptions {
	/** AWS Region for SES (e.g., 'us-east-1') */
	region: string;
	
	/** AWS Access Key ID */
	accessKeyId: string;
	
	/** AWS Secret Access Key */
	secretAccessKey: string;
	
	/** Default from email address */
	from: string;
	
	/** Default from name */
	fromName?: string;
	
	/** Enable email tracking in database (default: true) */
	trackEmails?: boolean;
	
	/** Database source for tracking (default: 'admin') */
	trackingDb?: 'admin' | 'org';
	
	/** Table name for email tracking (default: 'emails') */
	trackingTable?: string;
	
	/** Optional SES configuration set name */
	configurationSetName?: string;
}

export interface SendEmailOptions {
	to: string | string[];
	subject: string;
	html?: string;
	text?: string;
	from?: string;
	fromName?: string;
	replyTo?: string | string[];
	cc?: string | string[];
	bcc?: string | string[];
	tags?: Record<string, string>; // SES tags for categorization
	headers?: Record<string, string>;
	
	// SES V2-specific options
	configurationSetName?: string; // Override default configuration set
	returnPath?: string; // Email address for bounces
	fromEmailAddressIdentityArn?: string; // ARN for specific identity
	
	// Tracking metadata
	userId?: string;
	organizationId?: string;
	emailType?: string; // e.g., 'magic_link', 'password_reset', 'notification'
	metadata?: Record<string, any>;
}

export interface EmailRecord {
	id: string;
	to: string;
	from: string;
	subject: string;
	emailType?: string;
	status: 'sent' | 'failed' | 'pending';
	sesMessageId?: string;
	error?: string;
	userId?: string;
	organizationId?: string;
	metadata?: Record<string, any>;
	sentAt: string;
	createdAt: string;
}

let sesClient: SESv2Client | null = null;
let pluginOptions: EmailPluginOptions | null = null;

export function initEmailPlugin(options: EmailPluginOptions) {
	pluginOptions = options;
	sesClient = new SESv2Client({
		region: options.region,
		credentials: {
			accessKeyId: options.accessKeyId,
			secretAccessKey: options.secretAccessKey,
		}
	});
}

/**
 * Send an email via Amazon SES V2 and optionally track it
 */
export async function sendEmail(
	event: RequestEvent,
	options: SendEmailOptions
): Promise<{ success: boolean; id?: string; error?: string }> {
	if (!sesClient || !pluginOptions) {
		throw new Error('Email plugin not initialized. Call initEmailPlugin() first.');
	}

	const from = options.fromName 
		? `${options.fromName} <${options.from || pluginOptions.from}>`
		: options.from || pluginOptions.from;

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
			throw new Error('Either html or text content is required');
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
		if (options.configurationSetName || pluginOptions.configurationSetName) {
			params.ConfigurationSetName = options.configurationSetName || pluginOptions.configurationSetName;
		}
		if (options.fromEmailAddressIdentityArn) {
			params.FromEmailAddressIdentityArn = options.fromEmailAddressIdentityArn;
		}

		// Add email tags
		if (options.tags) {
			params.EmailTags = Object.entries(options.tags).map(([Name, Value]) => ({ Name, Value }));
		}

		// Send email via SES V2
		const command = new SendEmailCommand(params);
		const result = await sesClient.send(command);

		// Track email if enabled
		if (pluginOptions.trackEmails !== false) {
			await trackEmail(event, {
				...options,
				sesMessageId: result.MessageId,
				status: 'sent',
				from,
			});
		}

		return {
			success: true,
			id: result.MessageId,
		};
	} catch (error: any) {
		console.error('[Email] Failed to send email:', error);

		// Track failed email
		if (pluginOptions.trackEmails !== false) {
			await trackEmail(event, {
				...options,
				status: 'failed',
				error: error.message,
				from,
			});
		}

		return {
			success: false,
			error: error.message,
		};
	}
}

/**
 * Track email in database
 */
async function trackEmail(
	event: RequestEvent,
	options: SendEmailOptions & { 
		sesMessageId?: string; 
		status: 'sent' | 'failed' | 'pending';
		error?: string;
		from: string;
	}
) {
	if (!pluginOptions) return;

	try {
		const db = pluginOptions.trackingDb === 'org'
			? await event.locals.kuratchi?.getOrgDb?.(options.organizationId)
			: await event.locals.kuratchi?.getAdminDb?.();

		if (!db) return;

		const tableName = pluginOptions.trackingTable || 'emails';
		const table = db[tableName as keyof typeof db] as any;
		
		if (!table) {
			console.warn(`[Email] Tracking table "${tableName}" not found`);
			return;
		}

		const emailRecord = {
			id: crypto.randomUUID(),
			to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
			from: options.from,
			subject: options.subject,
			emailType: options.emailType,
			status: options.status,
			sesMessageId: options.sesMessageId,
			error: options.error,
			userId: options.userId,
			organizationId: options.organizationId,
			metadata: options.metadata,
			sentAt: new Date().toISOString(),
			createdAt: new Date().toISOString(),
		};

		await table.insert(emailRecord);
	} catch (error) {
		console.error('[Email] Failed to track email:', error);
	}
}

/**
 * Get email history
 */
export async function getEmailHistory(
	event: RequestEvent,
	filters?: {
		userId?: string;
		organizationId?: string;
		emailType?: string;
		status?: 'sent' | 'failed' | 'pending';
		limit?: number;
	}
): Promise<EmailRecord[]> {
	if (!pluginOptions) {
		throw new Error('Email plugin not initialized');
	}

	try {
		const db = pluginOptions.trackingDb === 'org'
			? await event.locals.kuratchi?.getOrgDb?.(filters?.organizationId)
			: await event.locals.kuratchi?.getAdminDb?.();

		if (!db) return [];

		const tableName = pluginOptions.trackingTable || 'emails';
		const table = db[tableName as keyof typeof db] as any;
		
		if (!table) return [];

		let query = table.where({ deleted_at: { is: null } });

		if (filters?.userId) {
			query = query.where({ userId: filters.userId });
		}
		if (filters?.organizationId) {
			query = query.where({ organizationId: filters.organizationId });
		}
		if (filters?.emailType) {
			query = query.where({ emailType: filters.emailType });
		}
		if (filters?.status) {
			query = query.where({ status: filters.status });
		}

		query = query.orderBy({ sentAt: 'desc' });

		if (filters?.limit) {
			query = query.limit(filters.limit);
		}

		const result = await query.many();
		return result?.data || [];
	} catch (error) {
		console.error('[Email] Failed to get email history:', error);
		return [];
	}
}

/**
 * Get email by ID
 */
export async function getEmailById(
	event: RequestEvent,
	emailId: string
): Promise<EmailRecord | null> {
	if (!pluginOptions) {
		throw new Error('Email plugin not initialized');
	}

	try {
		const db = await event.locals.kuratchi?.getAdminDb?.();
		if (!db) return null;

		const tableName = pluginOptions.trackingTable || 'emails';
		const table = db[tableName as keyof typeof db] as any;
		
		if (!table) return null;

		const result = await table.where({ id: emailId }).first();
		return result?.data || null;
	} catch (error) {
		console.error('[Email] Failed to get email:', error);
		return null;
	}
}
