/**
 * Notifications Queue Worker Example
 *
 * This worker processes notifications from a Cloudflare Workers Queue.
 * Deploy this as a separate worker that consumes from your notifications queue.
 *
 * Setup:
 * 1. Add queue binding to wrangler.toml
 * 2. Deploy this worker
 * 3. Configure queue consumer settings
 */

import type { Queue, QueueEvent, ExecutionContext } from '@cloudflare/workers-types';
import { handleQueueBatch } from 'kuratchi-sdk/notifications';
import type { NotificationQueueMessage } from 'kuratchi-sdk/notifications';

export interface Env {
	// Cloudflare Queue binding
	NOTIFICATIONS_QUEUE: Queue<NotificationQueueMessage>;

	// Add your other bindings here
	// KV namespaces, D1 databases, etc.
	ADMIN_DB?: any;

	// Environment variables
	AWS_ACCESS_KEY_ID?: string;
	AWS_SECRET_ACCESS_KEY?: string;
	AWS_REGION?: string;
	SES_FROM_EMAIL?: string;
	CLOUDFLARE_API_TOKEN?: string;
	CLOUDFLARE_ACCOUNT_ID?: string;
	SYSTEM_EMAIL?: string;
}

/**
 * Queue consumer handler
 * This function is called when messages are available in the queue
 */
export default {
	async queue(batch: QueueEvent<NotificationQueueMessage>, env: Env, ctx: ExecutionContext): Promise<void> {
		console.log(`[Notifications Queue] Processing batch of ${batch.messages.length} messages`);

		// Process each message in the batch
		for (const message of batch.messages) {
			try {
				const notification = message.body;

				console.log(`[Queue] Processing notification: ${notification.id} (${notification.type})`);

				// Create a mock RequestEvent for the handler
				// In production, you might want to pass more context
				const mockEvent = createMockEvent(env);

				// Process the notification based on type
				switch (notification.type) {
					case 'in-app':
						await processInAppNotification(mockEvent, notification);
						break;

					case 'email':
						await processEmailNotification(mockEvent, notification, env);
						break;

					case 'platform-alert':
						await processPlatformAlert(mockEvent, notification, env);
						break;

					default:
						console.error(`[Queue] Unknown notification type: ${notification.type}`);
						message.retry();
						continue;
				}

				// Acknowledge successful processing
				message.ack();
				console.log(`[Queue] Successfully processed: ${notification.id}`);

			} catch (error) {
				console.error('[Queue] Error processing message:', error);

				// Retry the message (up to max retries configured in queue)
				message.retry();
			}
		}
	},
};

/**
 * Process in-app notification
 */
async function processInAppNotification(
	event: any,
	notification: NotificationQueueMessage
): Promise<void> {
	// Import dynamically to avoid bundling issues
	const { sendInAppNotification } = await import('kuratchi-sdk/notifications');

	await sendInAppNotification(event, {
		...notification.notification,
		userId: notification.userId,
		organizationId: notification.organizationId,
		sendImmediately: true,
	});
}

/**
 * Process email notification
 */
async function processEmailNotification(
	event: any,
	notification: NotificationQueueMessage,
	env: Env
): Promise<void> {
	if (!notification.emailData) {
		throw new Error('Email data missing from notification');
	}

	const { sendEmailNotification } = await import('kuratchi-sdk/notifications');

	await sendEmailNotification(event, {
		...notification.notification,
		...notification.emailData,
		to: notification.email || '',
		userId: notification.userId,
		organizationId: notification.organizationId,
		sendImmediately: true,
	});
}

/**
 * Process platform alert
 */
async function processPlatformAlert(
	event: any,
	notification: NotificationQueueMessage,
	env: Env
): Promise<void> {
	if (!notification.alertData) {
		throw new Error('Alert data missing from notification');
	}

	const { createPlatformAlert } = await import('kuratchi-sdk/notifications');

	await createPlatformAlert(event, {
		type: notification.alertData.type!,
		severity: notification.alertData.severity,
		title: notification.alertData.title || notification.notification.title,
		message: notification.alertData.message || notification.notification.message,
		affectedResource: notification.alertData.affectedResource,
		affectedUserId: notification.alertData.affectedUserId,
		affectedOrgId: notification.alertData.affectedOrgId,
		threshold: notification.alertData.threshold,
		currentValue: notification.alertData.currentValue,
		timeWindow: notification.alertData.timeWindow,
		metadata: notification.alertData.metadata,
		notifySystemEmail: true,
		systemEmail: env.SYSTEM_EMAIL,
	});
}

/**
 * Create a mock RequestEvent for processing
 * In production, you might want to add more context
 */
function createMockEvent(env: Env): any {
	return {
		platform: {
			env,
		},
		locals: {
			kuratchi: {
				async getAdminDb() {
					// Return your admin database instance
					// This depends on your setup
					return env.ADMIN_DB;
				},
				async getOrgDb(orgId?: string) {
					// Return your org database instance
					// This depends on your setup
					return null;
				},
			},
		},
	};
}

/**
 * Optional: Scheduled handler for batch processing from database
 * Run this on a cron schedule to process queued notifications
 */
export async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
	console.log('[Scheduled] Processing queued notifications from database');

	try {
		const mockEvent = createMockEvent(env);
		const { processBatchFromDatabase } = await import('kuratchi-sdk/notifications');

		const result = await processBatchFromDatabase(mockEvent, 50); // Process 50 at a time

		console.log(`[Scheduled] Processed ${result.successful} successfully, ${result.failed} failed`);

		if (result.errors && result.errors.length > 0) {
			console.error('[Scheduled] Errors:', result.errors);
		}
	} catch (error) {
		console.error('[Scheduled] Error processing batch:', error);
	}
}

/**
 * Optional: HTTP handler for manual queue processing
 * Useful for testing or manual intervention
 */
export async function fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
	const url = new URL(request.url);

	// Process queue manually
	if (url.pathname === '/process-queue') {
		try {
			const mockEvent = createMockEvent(env);
			const { processBatchFromDatabase } = await import('kuratchi-sdk/notifications');

			const batchSize = parseInt(url.searchParams.get('batch') || '10');
			const result = await processBatchFromDatabase(mockEvent, batchSize);

			return new Response(JSON.stringify({
				success: true,
				processed: result.successful,
				failed: result.failed,
				total: result.total,
				errors: result.errors,
			}), {
				headers: { 'Content-Type': 'application/json' },
			});
		} catch (error: any) {
			return new Response(JSON.stringify({
				success: false,
				error: error.message,
			}), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	}

	// Get queue stats
	if (url.pathname === '/queue-stats') {
		try {
			const mockEvent = createMockEvent(env);
			const { getQueueStats } = await import('kuratchi-sdk/notifications');

			const stats = await getQueueStats(mockEvent);

			return new Response(JSON.stringify({
				success: true,
				stats,
			}), {
				headers: { 'Content-Type': 'application/json' },
			});
		} catch (error: any) {
			return new Response(JSON.stringify({
				success: false,
				error: error.message,
			}), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	}

	// Cleanup old queue items
	if (url.pathname === '/cleanup-queue') {
		try {
			const mockEvent = createMockEvent(env);
			const { cleanupQueueItems } = await import('kuratchi-sdk/notifications');

			const days = parseInt(url.searchParams.get('days') || '7');
			const cleaned = await cleanupQueueItems(mockEvent, days);

			return new Response(JSON.stringify({
				success: true,
				cleaned,
			}), {
				headers: { 'Content-Type': 'application/json' },
			});
		} catch (error: any) {
			return new Response(JSON.stringify({
				success: false,
				error: error.message,
			}), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	}

	return new Response('Notifications Queue Worker\n\nEndpoints:\n- /process-queue?batch=10\n- /queue-stats\n- /cleanup-queue?days=7', {
		headers: { 'Content-Type': 'text/plain' },
	});
}
