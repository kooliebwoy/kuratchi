/**
 * Cloudflare Workers Queue Integration
 * Handles batch processing and queue-based notification delivery
 */

import type { RequestEvent } from '@sveltejs/kit';
import type {
	NotificationQueueMessage,
	NotificationPluginOptions,
	NotificationResult,
	BatchNotificationResult,
} from './types.js';
import { sendInAppNotification } from './in-app.js';
import { sendEmailNotification } from './email.js';
import { createPlatformAlert } from './platform.js';

let pluginOptions: NotificationPluginOptions | null = null;

/**
 * Initialize queue processing (called from main notifications module)
 */
export function initQueue(options: NotificationPluginOptions) {
	pluginOptions = options;
}

/**
 * Queue a notification for batch processing
 */
export async function queueNotification(
	event: RequestEvent,
	message: Omit<NotificationQueueMessage, 'id' | 'createdAt'>
): Promise<NotificationResult> {
	if (!pluginOptions?.enableQueue) {
		return { success: false, error: 'Queue processing is disabled' };
	}

	try {
		const queueMessage: NotificationQueueMessage = {
			...message,
			id: crypto.randomUUID(),
			created_at: new Date().toISOString(),
		};

		// If Cloudflare Queue binding is available, send to queue
		const queue = (event.platform as any)?.env?.NOTIFICATIONS_QUEUE;

		if (queue) {
			await queue.send(queueMessage);
			return {
				success: true,
				id: queueMessage.id,
				queuedForBatch: true,
			};
		}

		// Fallback: Store in database queue table
		const db = await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.notification_queue) {
			return {
				success: false,
				error: 'notification_queue table not found and no queue binding available',
			};
		}

		await db.notification_queue.insert({
			id: queueMessage.id,
			type: queueMessage.type,
			priority: queueMessage.priority,
			userId: queueMessage.userId,
			organizationId: queueMessage.organizationId,
			email: Array.isArray(queueMessage.email)
				? queueMessage.email.join(',')
				: queueMessage.email,
			notification: queueMessage.notification,
			emailData: queueMessage.emailData,
			alertData: queueMessage.alertData,
			retryCount: queueMessage.retryCount || 0,
			maxRetries: queueMessage.maxRetries || 3,
			scheduledFor: queueMessage.scheduledFor,
			status: 'pending',
			created_at: queueMessage.createdAt,
			updated_at: queueMessage.createdAt,
		});

		return {
			success: true,
			id: queueMessage.id,
			queuedForBatch: true,
		};
	} catch (error: any) {
		console.error('[Notification Queue] Failed to queue notification:', error);
		return {
			success: false,
			error: error.message,
		};
	}
}

/**
 * Process a single notification from the queue
 */
export async function processQueueMessage(
	event: RequestEvent,
	message: NotificationQueueMessage
): Promise<NotificationResult> {
	try {
		let result: NotificationResult;

		switch (message.type) {
			case 'in-app':
				result = await sendInAppNotification(event, {
					...message.notification,
					userId: message.userId,
					organizationId: message.organizationId,
					sendImmediately: true,
				});
				break;

			case 'email':
				if (!message.emailData) {
					return { success: false, error: 'Email data missing from queue message' };
				}
				result = await sendEmailNotification(event, {
					...message.notification,
					...message.emailData,
					to: message.email || '',
					userId: message.userId,
					organizationId: message.organizationId,
					sendImmediately: true,
				});
				break;

			case 'platform-alert':
				if (!message.alertData) {
					return { success: false, error: 'Alert data missing from queue message' };
				}
				result = await createPlatformAlert(event, {
					type: message.alertData.type!,
					severity: message.alertData.severity,
					title: message.alertData.title || message.notification.title,
					message: message.alertData.message || message.notification.message,
					affectedResource: message.alertData.affectedResource,
					affectedUserId: message.alertData.affectedUserId,
					affectedOrgId: message.alertData.affectedOrgId,
					threshold: message.alertData.threshold,
					currentValue: message.alertData.currentValue,
					timeWindow: message.alertData.timeWindow,
					metadata: message.alertData.metadata,
					notifySystemEmail: true,
				});
				break;

			default:
				return { success: false, error: `Unknown notification type: ${message.type}` };
		}

		return result;
	} catch (error: any) {
		console.error('[Notification Queue] Failed to process message:', error);
		return {
			success: false,
			error: error.message,
		};
	}
}

/**
 * Process batch of notifications from database queue
 */
export async function processBatchFromDatabase(
	event: RequestEvent,
	batchSize?: number
): Promise<BatchNotificationResult> {
	const size = batchSize || pluginOptions?.batchSize || 10;

	try {
		const db = await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.notification_queue) {
			return {
				total: 0,
				successful: 0,
				failed: 0,
				results: [],
				errors: ['notification_queue table not found'],
			};
		}

		// Get pending notifications, prioritizing urgent ones
		const pending = await db.notification_queue
			.where({ status: 'pending' })
			.orderBy({ priority: 'asc', created_at: 'asc' })
			.limit(size)
			.many();

		if (!pending?.data || pending.data.length === 0) {
			return {
				total: 0,
				successful: 0,
				failed: 0,
				results: [],
			};
		}

		const results: NotificationResult[] = [];
		const errors: string[] = [];
		let successful = 0;
		let failed = 0;

		for (const item of pending.data) {
			// Mark as processing
			await db.notification_queue
				.where({ id: item.id })
				.update({ status: 'processing', updated_at: new Date().toISOString() });

			// Convert database record to queue message
			const message: NotificationQueueMessage = {
				id: item.id,
				type: item.type as any,
				priority: item.priority as any,
				userId: item.userId,
				organizationId: item.organizationId,
				email: item.email?.split(','),
				notification: item.notification as any,
				emailData: item.emailData as any,
				alertData: item.alertData as any,
				retryCount: item.retryCount || 0,
				maxRetries: item.maxRetries || 3,
				scheduledFor: item.scheduledFor,
				created_at: item.created_at,
			};

			// Process the notification
			const result = await processQueueMessage(event, message);
			results.push(result);

			if (result.success) {
				successful++;
				// Mark as completed
				await db.notification_queue
					.where({ id: item.id })
					.update({
						status: 'completed',
						processedAt: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					});
			} else {
				failed++;
				errors.push(result.error || 'Unknown error');

				// Check if we should retry
				const retryCount = (item.retryCount || 0) + 1;
				const maxRetries = item.maxRetries || 3;

				if (retryCount < maxRetries) {
					// Update retry count
					await db.notification_queue
						.where({ id: item.id })
						.update({
							status: 'pending',
							retryCount,
							updated_at: new Date().toISOString(),
						});
				} else {
					// Mark as failed
					await db.notification_queue
						.where({ id: item.id })
						.update({
							status: 'failed',
							error: result.error,
							processedAt: new Date().toISOString(),
							updated_at: new Date().toISOString(),
						});
				}
			}
		}

		return {
			total: pending.data.length,
			successful,
			failed,
			results,
			errors: errors.length > 0 ? errors : undefined,
		};
	} catch (error: any) {
		console.error('[Notification Queue] Failed to process batch:', error);
		return {
			total: 0,
			successful: 0,
			failed: 0,
			results: [],
			errors: [error.message],
		};
	}
}

/**
 * Cloudflare Queue consumer handler
 * Use this in your queue consumer worker
 */
export async function handleQueueBatch(
	batch: any[], // MessageBatch from Cloudflare Queue
	env: any,
	createEvent: (env: any) => RequestEvent
): Promise<void> {
	console.log(`[Notification Queue] Processing batch of ${batch.length} messages`);

	for (const message of batch) {
		try {
			const queueMessage = message.body as NotificationQueueMessage;
			const event = createEvent(env);

			await processQueueMessage(event, queueMessage);

			// Acknowledge message
			message.ack();
		} catch (error) {
			console.error('[Notification Queue] Failed to process queue message:', error);
			// Retry message (up to max retries)
			message.retry();
		}
	}
}

/**
 * Get queue statistics
 */
export async function getQueueStats(
	event: RequestEvent
): Promise<{
	pending: number;
	processing: number;
	completed: number;
	failed: number;
	byType: Record<string, number>;
	byPriority: Record<string, number>;
}> {
	try {
		const db = await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.notification_queue) {
			return {
				pending: 0,
				processing: 0,
				completed: 0,
				failed: 0,
				byType: {},
				byPriority: {},
			};
		}

		const all = await db.notification_queue.many();
		const items = all?.data || [];

		const stats = {
			pending: 0,
			processing: 0,
			completed: 0,
			failed: 0,
			byType: {} as Record<string, number>,
			byPriority: {} as Record<string, number>,
		};

		for (const item of items) {
			// Count by status
			switch (item.status) {
				case 'pending':
					stats.pending++;
					break;
				case 'processing':
					stats.processing++;
					break;
				case 'completed':
					stats.completed++;
					break;
				case 'failed':
					stats.failed++;
					break;
			}

			// Count by type
			stats.byType[item.type] = (stats.byType[item.type] || 0) + 1;

			// Count by priority
			stats.byPriority[item.priority] = (stats.byPriority[item.priority] || 0) + 1;
		}

		return stats;
	} catch (error) {
		console.error('[Notification Queue] Failed to get queue stats:', error);
		return {
			pending: 0,
			processing: 0,
			completed: 0,
			failed: 0,
			byType: {},
			byPriority: {},
		};
	}
}

/**
 * Clear completed/failed queue items older than specified days
 */
export async function cleanupQueueItems(
	event: RequestEvent,
	olderThanDays: number = 7
): Promise<number> {
	try {
		const db = await event.locals.kuratchi?.getAdminDb?.();

		if (!db || !db.notification_queue) {
			return 0;
		}

		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
		const cutoff = cutoffDate.toISOString();

		// Get items to delete
		const toDelete = await db.notification_queue
			.where({
				status: { in: ['completed', 'failed'] },
				created_at: { lte: cutoff },
			})
			.many();

		if (!toDelete?.data || toDelete.data.length === 0) {
			return 0;
		}

		// Delete the items
		await db.notification_queue
			.where({
				status: { in: ['completed', 'failed'] },
				created_at: { lte: cutoff },
			})
			.delete();

		return toDelete.data.length;
	} catch (error) {
		console.error('[Notification Queue] Failed to cleanup queue items:', error);
		return 0;
	}
}
