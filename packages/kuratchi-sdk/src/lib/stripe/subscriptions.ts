/**
 * Stripe Subscription Management
 */

import type { RequestEvent } from '@sveltejs/kit';
import { getStripeClient, getStripeOptions, getTableName } from './client.js';
import type {
	CreateSubscriptionOptions,
	UpdateSubscriptionOptions,
	StripeSubscriptionRecord,
} from './types.js';

/**
 * Create a subscription and store in local DB
 */
export async function createSubscription(
	event: RequestEvent,
	options: CreateSubscriptionOptions
): Promise<StripeSubscriptionRecord> {
	const stripe = getStripeClient();
	const pluginOptions = getStripeOptions();

	// Create subscription in Stripe
	const subscription = await stripe.subscriptions.create({
		customer: options.customerId,
		items: [
			{
				price: options.priceId,
				quantity: options.quantity || 1,
			},
		],
		trial_period_days: options.trialPeriodDays,
		metadata: options.metadata || {},
		proration_behavior: options.prorationBehavior || 'create_prorations',
	});

	// Store in local DB
	const record = await saveSubscriptionToDb(event, subscription);
	return record;
}

/**
 * Get subscription by Stripe subscription ID
 */
export async function getSubscription(
	event: RequestEvent,
	stripeSubscriptionId: string
): Promise<StripeSubscriptionRecord | null> {
	const db = await event.locals.kuratchi?.getAdminDb?.();
	if (!db) return null;

	const tableName = getTableName('subscriptions');
	const table = db[tableName as keyof typeof db] as any;
	if (!table) return null;

	const result = await table.where({ stripeSubscriptionId }).first();
	return result?.data || null;
}

/**
 * Get all subscriptions for a customer
 */
export async function getCustomerSubscriptions(
	event: RequestEvent,
	stripeCustomerId: string
): Promise<StripeSubscriptionRecord[]> {
	const db = await event.locals.kuratchi?.getAdminDb?.();
	if (!db) return [];

	const tableName = getTableName('subscriptions');
	const table = db[tableName as keyof typeof db] as any;
	if (!table) return [];

	const result = await table
		.where({ stripeCustomerId, deleted_at: { is: null } })
		.orderBy({ createdAt: 'desc' })
		.many();

	return result?.data || [];
}

/**
 * Get active subscription for a customer
 */
export async function getActiveSubscription(
	event: RequestEvent,
	stripeCustomerId: string
): Promise<StripeSubscriptionRecord | null> {
	const db = await event.locals.kuratchi?.getAdminDb?.();
	if (!db) return null;

	const tableName = getTableName('subscriptions');
	const table = db[tableName as keyof typeof db] as any;
	if (!table) return null;

	const result = await table
		.where({
			stripeCustomerId,
			status: 'active',
			deleted_at: { is: null },
		})
		.first();

	return result?.data || null;
}

/**
 * Update a subscription
 */
export async function updateSubscription(
	event: RequestEvent,
	stripeSubscriptionId: string,
	options: UpdateSubscriptionOptions
): Promise<StripeSubscriptionRecord> {
	const stripe = getStripeClient();

	const updateData: any = {
		metadata: options.metadata,
		cancel_at_period_end: options.cancelAtPeriodEnd,
		proration_behavior: options.prorationBehavior || 'create_prorations',
	};

	// If changing price, update the subscription items
	if (options.priceId) {
		const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
		updateData.items = [
			{
				id: subscription.items.data[0].id,
				price: options.priceId,
				quantity: options.quantity || 1,
			},
		];
	}

	const subscription = await stripe.subscriptions.update(stripeSubscriptionId, updateData);

	// Update in local DB
	const record = await saveSubscriptionToDb(event, subscription);
	return record;
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
	event: RequestEvent,
	stripeSubscriptionId: string,
	cancelImmediately = false
): Promise<StripeSubscriptionRecord> {
	const stripe = getStripeClient();

	let subscription;
	if (cancelImmediately) {
		subscription = await stripe.subscriptions.cancel(stripeSubscriptionId);
	} else {
		subscription = await stripe.subscriptions.update(stripeSubscriptionId, {
			cancel_at_period_end: true,
		});
	}

	// Update in local DB
	const record = await saveSubscriptionToDb(event, subscription);
	return record;
}

/**
 * Resume a canceled subscription
 */
export async function resumeSubscription(
	event: RequestEvent,
	stripeSubscriptionId: string
): Promise<StripeSubscriptionRecord> {
	const stripe = getStripeClient();

	const subscription = await stripe.subscriptions.update(stripeSubscriptionId, {
		cancel_at_period_end: false,
	});

	// Update in local DB
	const record = await saveSubscriptionToDb(event, subscription);
	return record;
}

/**
 * Helper: Save or update subscription in local DB
 */
async function saveSubscriptionToDb(
	event: RequestEvent,
	subscription: any
): Promise<StripeSubscriptionRecord> {
	const pluginOptions = getStripeOptions();

	const record: StripeSubscriptionRecord = {
		id: crypto.randomUUID(),
		stripeSubscriptionId: subscription.id,
		stripeCustomerId: subscription.customer,
		status: subscription.status,
		priceId: subscription.items.data[0].price.id,
		productId: subscription.items.data[0].price.product,
		quantity: subscription.items.data[0].quantity,
		cancelAtPeriodEnd: subscription.cancel_at_period_end,
		currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
		currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
		trialStart: subscription.trial_start
			? new Date(subscription.trial_start * 1000).toISOString()
			: undefined,
		trialEnd: subscription.trial_end
			? new Date(subscription.trial_end * 1000).toISOString()
			: undefined,
		canceledAt: subscription.canceled_at
			? new Date(subscription.canceled_at * 1000).toISOString()
			: undefined,
		endedAt: subscription.ended_at
			? new Date(subscription.ended_at * 1000).toISOString()
			: undefined,
		metadata: subscription.metadata,
		createdAt: new Date(subscription.created * 1000).toISOString(),
		updatedAt: new Date().toISOString(),
	};

	const db = await event.locals.kuratchi?.getAdminDb?.();
	if (db) {
		const tableName = getTableName('subscriptions');
		const table = db[tableName as keyof typeof db] as any;
		if (table) {
			// Check if exists
			const existing = await table.where({ stripeSubscriptionId: subscription.id }).first();
			if (existing?.data) {
				await table.where({ stripeSubscriptionId: subscription.id }).update({
					...record,
					id: existing.data.id, // Keep existing ID
				});
			} else {
				await table.insert(record);
			}
		}
	}

	return record;
}
