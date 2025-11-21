/**
 * Email Event Handling - SES SNS Webhook Handler
 * Batteries-included event tracking for email delivery, opens, clicks, bounces
 */

import type { RequestEvent } from '@sveltejs/kit';
import type { EmailPluginOptions } from './index.js';

let pluginOptions: EmailPluginOptions | null = null;

export function initEmailEvents(options: EmailPluginOptions) {
	pluginOptions = options;
}

/**
 * Handle SES events from SNS webhook
 * Auto-mounted at /.well-known/kuratchi/email-events
 */
export async function handleEmailEvent(event: RequestEvent): Promise<Response> {
	try {
		const body = await event.request.text();
		const message = JSON.parse(body);
		
		console.log('[Email Events] Received SNS message type:', message.Type);
		
		// Step 1: Handle SNS subscription confirmation
		if (message.Type === 'SubscriptionConfirmation') {
			console.log('[Email Events] Auto-confirming SNS subscription...');
			const confirmUrl = message.SubscribeURL;
			await fetch(confirmUrl);
			return new Response(JSON.stringify({ message: 'Subscription confirmed' }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		
		// Step 2: Handle notification (actual SES event)
		if (message.Type === 'Notification') {
			const sesMessage = JSON.parse(message.Message);
			console.log('[Email Events] Processing SES event:', sesMessage.eventType);
			
			await processSESEvent(sesMessage, event);
			
			return new Response(JSON.stringify({ received: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		
		return new Response(JSON.stringify({ message: 'Unknown message type' }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('[Email Events] Error processing event:', error);
		return new Response(JSON.stringify({ error: 'Failed to process event' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

async function processSESEvent(sesEvent: any, event: RequestEvent) {
	if (!pluginOptions) {
		console.warn('[Email Events] Plugin not initialized');
		return;
	}
	
	const { eventType, mail } = sesEvent;
	const messageId = mail?.messageId;
	
	if (!messageId) {
		console.warn('[Email Events] No message ID in event');
		return;
	}
	
	console.log('[Email Events] Processing', eventType, 'for message:', messageId);
	
	// Find the email record by SES message ID
	// We need to check both admin and org databases
	const emailRecord = await findEmailByMessageId(messageId, event);
	
	if (!emailRecord) {
		console.warn('[Email Events] Email record not found for message:', messageId);
		return;
	}
	
	// Get the correct database (org or admin)
	const db = pluginOptions.trackingDb === 'org'
		? await event.locals.kuratchi?.orgDatabaseClient?.(emailRecord.organizationId)
		: await event.locals.kuratchi?.getAdminDb?.();
	
	if (!db) {
		console.warn('[Email Events] Database not available');
		return;
	}
	
	const tableName = pluginOptions.trackingTable || 'email_logs';
	const table = db[tableName as keyof typeof db] as any;
	
	if (!table) {
		console.warn('[Email Events] Table not found:', tableName);
		return;
	}
	
	// Build update based on event type
	const updates: any = {
		updated_at: new Date().toISOString()
	};
	
	switch (eventType) {
		case 'Send':
			// Email was sent from SES
			updates.status = 'sent';
			updates.sentAt = sesEvent.mail?.timestamp;
			break;
			
		case 'Delivery':
			updates.status = 'delivered';
			updates.deliveredAt = sesEvent.delivery?.timestamp;
			updates.deliveryDelay = sesEvent.delivery?.processingTimeMillis;
			break;
			
		case 'Open':
			updates.openedAt = sesEvent.open?.timestamp;
			updates.openCount = (emailRecord.openCount || 0) + 1;
			updates.userAgent = sesEvent.open?.userAgent;
			break;
			
		case 'Click':
			updates.clickedAt = sesEvent.click?.timestamp;
			updates.clickCount = (emailRecord.clickCount || 0) + 1;
			updates.lastClickedLink = sesEvent.click?.link;
			break;
			
		case 'Bounce':
			updates.status = 'bounced';
			updates.bouncedAt = sesEvent.bounce?.timestamp;
			updates.bounceType = sesEvent.bounce?.bounceType;
			updates.bounceSubType = sesEvent.bounce?.bounceSubType;
			updates.error = `Bounce: ${sesEvent.bounce?.bounceSubType}`;
			break;
			
		case 'Complaint':
			updates.status = 'complained';
			updates.complainedAt = sesEvent.complaint?.timestamp;
			updates.complaintFeedbackType = sesEvent.complaint?.complaintFeedbackType;
			updates.error = 'Spam complaint received';
			break;
			
		case 'Reject':
			updates.status = 'rejected';
			updates.rejectedAt = sesEvent.reject?.timestamp;
			updates.rejectReason = sesEvent.reject?.reason;
			updates.error = `Rejected: ${sesEvent.reject?.reason}`;
			break;
			
		case 'RenderingFailure':
			updates.status = 'failed';
			updates.error = `Rendering failure: ${sesEvent.failure?.errorMessage}`;
			break;
			
		case 'DeliveryDelay':
			updates.deliveryDelayed = true;
			updates.deliveryDelayType = sesEvent.deliveryDelay?.delayType;
			break;
	}
	
	// Update the email record
	await table.where({ sesMessageId: messageId }).update(updates);
	
	console.log('[Email Events] Updated email', messageId, 'with event:', eventType);
}

/**
 * Find email record by SES message ID
 * Uses admin DB lookup table to find the organization, then queries org DB
 */
async function findEmailByMessageId(messageId: string, event: RequestEvent): Promise<any> {
	if (!pluginOptions) return null;
	
	const tableName = pluginOptions.trackingTable || 'email_logs';
	
	if (pluginOptions.trackingDb === 'org') {
		// Use lookup table in admin DB to find which org this message belongs to
		const adminDb = await event.locals.kuratchi?.getAdminDb?.();
		if (!adminDb) {
			console.error('[Email Events] Admin DB not available');
			return null;
		}
		
		// Check if lookup table exists
		if (!adminDb.email_message_lookup) {
			console.error('[Email Events] email_message_lookup table not found in admin DB');
			console.error('[Email Events] Available tables:', Object.keys(adminDb).filter(k => !k.startsWith('_')));
			console.error('[Email Events] Please ensure admin schema version is 9+ and restart server');
			return null;
		}
		
		const lookup = await (adminDb.email_message_lookup as any)
			.where({ sesMessageId: messageId })
			.first();
		
		if (!lookup?.data?.organizationId) {
			console.log('[Email Events] No lookup entry found for message:', messageId);
			return null;
		}
		
		const organizationId = lookup.data.organizationId;
		console.log('[Email Events] Found organization from lookup:', organizationId);
		
		// Now query the org database
		const orgDb = await event.locals.kuratchi?.orgDatabaseClient?.(organizationId);
		if (!orgDb) {
			console.error('[Email Events] Could not get org DB for:', organizationId);
			return null;
		}
		
		const table = orgDb[tableName as keyof typeof orgDb] as any;
		if (!table) {
			console.error('[Email Events] Table not found:', tableName);
			return null;
		}
		
		const result = await table.where({ sesMessageId: messageId }).first();
		if (result?.data) {
			return { ...result.data, organizationId };
		}
		
		return null;
	} else {
		// Admin DB - simple lookup
		const adminDb = await event.locals.kuratchi?.getAdminDb?.();
		if (adminDb) {
			const table = adminDb[tableName as keyof typeof adminDb] as any;
			if (table) {
				const result = await table.where({ sesMessageId: messageId }).first();
				return result?.data || null;
			}
		}
	}
	
	return null;
}
