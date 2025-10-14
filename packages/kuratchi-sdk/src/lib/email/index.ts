/**
 * Email Plugin - Standalone email service with tracking
 * Uses Resend for email delivery and tracks all sent emails
 */

import type { RequestEvent } from '@sveltejs/kit';
import { Resend } from 'resend';

export interface EmailPluginOptions {
	/** Resend API key */
	apiKey: string;
	
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
}

export interface SendEmailOptions {
	to: string | string[];
	subject: string;
	html?: string;
	text?: string;
	from?: string;
	fromName?: string;
	replyTo?: string;
	cc?: string | string[];
	bcc?: string | string[];
	tags?: { name: string; value: string }[];
	headers?: Record<string, string>;
	
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
	resendId?: string;
	error?: string;
	userId?: string;
	organizationId?: string;
	metadata?: Record<string, any>;
	sentAt: string;
	createdAt: string;
}

let resendClient: Resend | null = null;
let pluginOptions: EmailPluginOptions | null = null;

export function initEmailPlugin(options: EmailPluginOptions) {
	pluginOptions = options;
	resendClient = new Resend(options.apiKey);
}

/**
 * Send an email via Resend and optionally track it
 */
export async function sendEmail(
	event: RequestEvent,
	options: SendEmailOptions
): Promise<{ success: boolean; id?: string; error?: string }> {
	if (!resendClient || !pluginOptions) {
		throw new Error('Email plugin not initialized. Call initEmailPlugin() first.');
	}

	const from = options.fromName 
		? `${options.fromName} <${options.from || pluginOptions.from}>`
		: options.from || pluginOptions.from;

	try {
		// Send email via Resend
		const result = await resendClient.emails.send({
			from,
			to: options.to,
			subject: options.subject,
			html: options.html,
			text: options.text,
			reply_to: options.replyTo,
			cc: options.cc,
			bcc: options.bcc,
			tags: options.tags,
			headers: options.headers,
		});

		// Track email if enabled
		if (pluginOptions.trackEmails !== false) {
			await trackEmail(event, {
				...options,
				resendId: result.data?.id,
				status: 'sent',
				from,
			});
		}

		return {
			success: true,
			id: result.data?.id,
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
		resendId?: string; 
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
			resendId: options.resendId,
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
