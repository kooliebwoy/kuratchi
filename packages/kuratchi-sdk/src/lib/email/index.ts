/**
 * Email Plugin - Standalone email service with tracking
 * Uses Amazon SES V2 for email delivery with tenant isolation
 */

import type { RequestEvent } from '@sveltejs/kit';
import { 
	SESv2Client, 
	SendEmailCommand,
	CreateEmailIdentityCommand,
	GetEmailIdentityCommand,
	DeleteEmailIdentityCommand,
	ListEmailIdentitiesCommand
} from '@aws-sdk/client-sesv2';

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
	
	/** Path for SNS webhook events (default: '/.well-known/kuratchi/email-events') */
	eventsPath?: string;
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
	recipient: string;
	sender: string;
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

	const recipients = Array.isArray(options.to) ? options.to : [options.to];
	const normalizedRecipients = recipients.map((email) => email.toLowerCase());

	// Block sending to suppressed recipients (org-level tracking only)
	if (pluginOptions.trackingDb === 'org') {
		const orgId = options.organizationId || (event.locals.session as any)?.organizationId;
		if (orgId) {
			try {
				const orgDb = await event.locals.kuratchi?.orgDatabaseClient?.(orgId);
				const suppressionTable = orgDb?.email_suppressions as any;

				if (suppressionTable) {
					const suppressed = await suppressionTable
						.where({
							email: { in: normalizedRecipients },
							blocked: { is: true }
						})
						.many();

					if (suppressed?.data?.length) {
						const reasons = suppressed.data
							.map((row: any) => row.reason || 'suppressed')
							.join(', ');

						const errorMessage = `Recipient suppressed (${reasons})`;

						if (pluginOptions.trackEmails !== false) {
							await trackEmail(event, {
								...options,
								from,
								status: 'failed',
								error: errorMessage,
								organizationId: orgId
							});
						}

						return { success: false, error: errorMessage };
					}
				}
			} catch (suppressionError) {
				console.warn('[Email] Suppression check failed:', suppressionError);
				// Continue sending to avoid blocking legitimate traffic if suppression lookup fails
			}
		}
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
		// Get organizationId from session if using org DB and not explicitly provided
		const organizationId = pluginOptions.trackingDb === 'org'
			? (options.organizationId || (event.locals.session as any)?.organizationId)
			: options.organizationId;

		console.log('[Email] trackEmail - trackingDb:', pluginOptions.trackingDb, 'organizationId:', organizationId);

		const db = pluginOptions.trackingDb === 'org'
			? await event.locals.kuratchi?.orgDatabaseClient?.(organizationId)
			: await event.locals.kuratchi?.getAdminDb?.();

		if (!db) {
			console.error('[Email] No database available for tracking - db is null/undefined');
			console.error('[Email] event.locals.kuratchi exists:', !!event.locals.kuratchi);
			console.error('[Email] orgDatabaseClient exists:', !!event.locals.kuratchi?.orgDatabaseClient);
			return;
		}

		console.log('[Email] Database client obtained successfully');

		const tableName = pluginOptions.trackingTable || 'emails';
		const table = db[tableName as keyof typeof db] as any;
		
		if (!table) {
			console.error(`[Email] Tracking table "${tableName}" not found in database`);
			console.error('[Email] Available tables:', Object.keys(db));
			return;
		}

		console.log('[Email] Table found:', tableName);

		const emailRecord = {
			id: crypto.randomUUID(),
			recipient: Array.isArray(options.to) ? options.to.join(', ') : options.to,
			sender: options.from,
			subject: options.subject,
			emailType: options.emailType,
			status: options.status,
			sesMessageId: options.sesMessageId,
			error: options.error,
			userId: options.userId,
			metadata: options.metadata,
			sentAt: new Date().toISOString(),
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			deleted_at: null,
		};
		
		console.log('[Email] Attempting to insert email record:', {
			id: emailRecord.id,
			recipient: emailRecord.recipient,
			sesMessageId: emailRecord.sesMessageId,
			tableName
		});
		
		const insertResult = await table.insert(emailRecord);
		
		console.log('[Email] Insert result:', insertResult);
		
		if (!insertResult.success) {
			console.error('[Email] Failed to insert email:', insertResult.error);
		} else {
			console.log('[Email] Email tracked successfully with ID:', emailRecord.id);
		}
		
		// If using org DB and we have a sesMessageId, store lookup in admin DB
		if (pluginOptions.trackingDb === 'org' && options.sesMessageId && organizationId) {
			try {
				const adminDb = await event.locals.kuratchi?.getAdminDb?.();
				if (adminDb?.email_message_lookup) {
					await (adminDb.email_message_lookup as any).insert({
						id: crypto.randomUUID(),
						sesMessageId: options.sesMessageId,
						organizationId: organizationId,
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					});
					console.log('[Email] Saved message lookup for webhook routing');
				}
			} catch (lookupError) {
				console.error('[Email] Failed to save message lookup:', lookupError);
			}
		}
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
		// Get organizationId from session if using org DB and not explicitly provided
		const organizationId = pluginOptions.trackingDb === 'org'
			? (filters?.organizationId || (event.locals.session as any)?.organizationId)
			: filters?.organizationId;

		console.log('[Email] getEmailHistory - trackingDb:', pluginOptions.trackingDb, 'organizationId:', organizationId);

		const db = pluginOptions.trackingDb === 'org'
			? await event.locals.kuratchi?.orgDatabaseClient?.(organizationId)
			: await event.locals.kuratchi?.getAdminDb?.();

		if (!db) {
			console.warn('[Email] No database available for history');
			return [];
		}

		const tableName = pluginOptions.trackingTable || 'email_logs';
		const table = db[tableName as keyof typeof db] as any;
		
		if (!table) {
			console.warn(`[Email] Table "${tableName}" not found in database`);
			return [];
		}
		
		let query = table.where({ deleted_at: { isNullish: true } });

		if (filters?.userId) {
			query = query.where({ userId: filters.userId });
		}
		// Don't filter by organizationId when using org DB - it's already scoped
		if (pluginOptions.trackingDb === 'admin' && filters?.organizationId) {
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
		// Get organizationId from session if using org DB
		const organizationId = pluginOptions.trackingDb === 'org'
			? (event.locals.session as any)?.organizationId
			: undefined;

		const db = pluginOptions.trackingDb === 'org'
			? await event.locals.kuratchi?.orgDatabaseClient?.(organizationId)
			: await event.locals.kuratchi?.getAdminDb?.();
			
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

// ============================================================================
// SES Identity Verification (for sandbox mode)
// ============================================================================

export interface SesIdentityStatus {
	email: string;
	verified: boolean;
	verificationStatus?: string;
	error?: string;
}

/**
 * Request SES to send a verification email to the given address.
 * In sandbox mode, recipients must verify their email before receiving emails.
 * 
 * @param email - Email address to verify
 * @returns Result with success status
 */
export async function requestSesVerification(
	email: string
): Promise<{ success: boolean; error?: string; alreadyVerified?: boolean }> {
	if (!sesClient) {
		return { success: false, error: 'Email plugin not initialized' };
	}

	try {
		// First check if already verified
		const status = await getSesIdentityStatus(email);
		if (status.verified) {
			return { success: true, alreadyVerified: true };
		}

		// Create email identity - this triggers SES to send a verification email
		const command = new CreateEmailIdentityCommand({
			EmailIdentity: email
		});
		
		await sesClient.send(command);
		console.log(`[SES] Verification email requested for: ${email}`);
		
		return { success: true };
	} catch (error: any) {
		// If identity already exists, that's fine
		if (error.name === 'AlreadyExistsException') {
			console.log(`[SES] Identity already exists for: ${email}`);
			return { success: true };
		}
		
		console.error('[SES] Failed to request verification:', error);
		return { success: false, error: error.message };
	}
}

/**
 * Check if an email address is verified in SES.
 * 
 * @param email - Email address to check
 * @returns Status object with verification info
 */
export async function getSesIdentityStatus(
	email: string
): Promise<SesIdentityStatus> {
	if (!sesClient) {
		return { email, verified: false, error: 'Email plugin not initialized' };
	}

	try {
		const command = new GetEmailIdentityCommand({
			EmailIdentity: email
		});
		
		const result = await sesClient.send(command);
		
		// Check verification status
		const verified = result.VerifiedForSendingStatus === true;
		
		return {
			email,
			verified,
			verificationStatus: result.VerificationStatus
		};
	} catch (error: any) {
		// If identity doesn't exist, it's not verified
		if (error.name === 'NotFoundException') {
			return { email, verified: false, verificationStatus: 'NOT_STARTED' };
		}
		
		console.error('[SES] Failed to get identity status:', error);
		return { email, verified: false, error: error.message };
	}
}

/**
 * Check multiple email addresses for SES verification status.
 * Useful for batch checking.
 * 
 * @param emails - Array of email addresses to check
 * @returns Array of status objects
 */
export async function checkSesVerificationBatch(
	emails: string[]
): Promise<SesIdentityStatus[]> {
	if (!sesClient) {
		return emails.map(email => ({ email, verified: false, error: 'Email plugin not initialized' }));
	}

	// Check each email in parallel
	const results = await Promise.all(
		emails.map(email => getSesIdentityStatus(email))
	);
	
	return results;
}

/**
 * List all verified email identities in SES.
 * Useful for syncing verification status with app database.
 * 
 * @returns Array of verified email addresses
 */
export async function listVerifiedSesIdentities(): Promise<string[]> {
	if (!sesClient) {
		return [];
	}

	try {
		const verified: string[] = [];
		let nextToken: string | undefined;
		
		do {
			const command = new ListEmailIdentitiesCommand({
				PageSize: 100,
				NextToken: nextToken
			});
			
			const result = await sesClient.send(command);
			
			// Filter for verified email identities (not domains)
			if (result.EmailIdentities) {
				for (const identity of result.EmailIdentities) {
					if (identity.IdentityType === 'EMAIL_ADDRESS' && identity.SendingEnabled) {
						verified.push(identity.IdentityName!);
					}
				}
			}
			
			nextToken = result.NextToken;
		} while (nextToken);
		
		return verified;
	} catch (error) {
		console.error('[SES] Failed to list identities:', error);
		return [];
	}
}

/**
 * Delete an email identity from SES.
 * 
 * @param email - Email address to remove
 */
export async function deleteSesIdentity(
	email: string
): Promise<{ success: boolean; error?: string }> {
	if (!sesClient) {
		return { success: false, error: 'Email plugin not initialized' };
	}

	try {
		const command = new DeleteEmailIdentityCommand({
			EmailIdentity: email
		});
		
		await sesClient.send(command);
		console.log(`[SES] Identity deleted: ${email}`);
		
		return { success: true };
	} catch (error: any) {
		console.error('[SES] Failed to delete identity:', error);
		return { success: false, error: error.message };
	}
}

/**
 * Sync SES verification status with app database.
 * Checks all users with unverified emails and updates their status
 * if they've verified through SES.
 * 
 * @param event - Request event for database access
 * @param organizationId - Organization to sync (optional, uses session if not provided)
 * @returns Number of users updated
 */
export async function syncSesVerificationStatus(
	event: RequestEvent,
	organizationId?: string
): Promise<{ updated: number; checked: number; errors: string[] }> {
	const errors: string[] = [];
	let updated = 0;
	let checked = 0;

	try {
		const orgId = organizationId || (event.locals.session as any)?.organizationId;
		if (!orgId) {
			return { updated: 0, checked: 0, errors: ['No organization ID available'] };
		}

		const orgDb = await event.locals.kuratchi?.orgDatabaseClient?.(orgId);
		if (!orgDb) {
			return { updated: 0, checked: 0, errors: ['Organization database not available'] };
		}

		// Get all users with unverified emails
		const { data: unverifiedUsers } = await orgDb.users
			.where({ emailVerified: { isNullish: true } })
			.many();

		if (!unverifiedUsers || unverifiedUsers.length === 0) {
			return { updated: 0, checked: 0, errors: [] };
		}

		checked = unverifiedUsers.length;

		// Check each user's email in SES
		for (const user of unverifiedUsers) {
			if (!user.email) continue;

			try {
				const status = await getSesIdentityStatus(user.email);
				
				if (status.verified) {
					// Update user's emailVerified field
					await orgDb.users.update(
						{ id: user.id },
						{ 
							emailVerified: Date.now(),
							updated_at: new Date().toISOString()
						}
					);
					updated++;
					console.log(`[SES Sync] Verified email for user: ${user.email}`);
				}
			} catch (e: any) {
				errors.push(`Failed to check ${user.email}: ${e.message}`);
			}
		}

		return { updated, checked, errors };
	} catch (error: any) {
		console.error('[SES Sync] Failed:', error);
		return { updated, checked, errors: [error.message] };
	}
}
