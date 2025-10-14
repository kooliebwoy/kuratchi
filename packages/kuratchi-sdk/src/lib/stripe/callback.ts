/**
 * Stripe Callback Handler
 * Handles the redirect from Stripe Checkout
 */

import type { RequestEvent } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { getCheckoutSession } from './checkout.js';
import { getCustomer } from './customers.js';
import { getTableName, getStripeOptions } from './client.js';
import type { StripeSubscriptionRecord } from './types.js';

/**
 * Handle Stripe checkout callback
 * This is called internally by the SDK when user returns from Stripe
 */
export async function handleStripeCallback(event: RequestEvent): Promise<Response> {
	const sessionId = event.url.searchParams.get('session_id');
	const successPath = event.url.searchParams.get('success_path');

	if (!sessionId || !successPath) {
		throw redirect(303, '/');
	}

	try {
		// Retrieve the checkout session from Stripe
		const session = await getCheckoutSession(sessionId);

		if (session.payment_status === 'paid' || session.status === 'complete') {
			// Save customer if not already saved
			const customerId = typeof session.customer === 'string' 
				? session.customer 
				: session.customer?.id;

			if (customerId) {
				const existingCustomer = await getCustomer(event, customerId);
				
				if (!existingCustomer && session.customer_details?.email) {
					// Customer was created during checkout, save to our DB
					const pluginOptions = getStripeOptions();
					const db = await event.locals.kuratchi?.getAdminDb?.();
					
					if (db) {
						const tableName = getTableName('customers');
						const table = db[tableName as keyof typeof db] as any;
						if (table) {
							await table.insert({
								id: crypto.randomUUID(),
								stripeCustomerId: customerId,
								email: session.customer_details.email,
								name: session.customer_details.name,
								metadata: session.metadata,
								createdAt: new Date().toISOString(),
								updatedAt: new Date().toISOString(),
							});
						}
					}
				}

				// Save subscription if this was a subscription checkout
				if (session.mode === 'subscription' && session.subscription) {
					const subscriptionId = typeof session.subscription === 'string'
						? session.subscription
						: session.subscription.id;

					if (subscriptionId) {
						await syncSubscriptionFromStripe(event, subscriptionId);
					}
				}
			}

			// Track successful checkout event
			await trackStripeEvent(event, {
				type: 'checkout.session.completed',
				data: session,
			});
		}

		// Redirect to success path
		throw redirect(303, successPath);
	} catch (error: any) {
		console.error('[Stripe] Callback error:', error);
		
		// If it's a redirect, re-throw it
		if (error?.status === 303) {
			throw error;
		}

		// Otherwise redirect to home or error page
		throw redirect(303, '/');
	}
}

/**
 * Sync subscription from Stripe to local DB
 */
async function syncSubscriptionFromStripe(
	event: RequestEvent,
	subscriptionId: string
): Promise<void> {
	const { getStripeClient } = await import('./client.js');
	const stripe = getStripeClient();

	const subscription = await stripe.subscriptions.retrieve(subscriptionId);
	
	// Type guard to ensure we have the subscription data
	if (!subscription || typeof subscription !== 'object') {
		throw new Error('Invalid subscription data');
	}

	const record: StripeSubscriptionRecord = {
		id: crypto.randomUUID(),
		stripeSubscriptionId: subscription.id,
		stripeCustomerId: typeof subscription.customer === 'string' 
			? subscription.customer 
			: subscription.customer.id,
		status: subscription.status,
		priceId: subscription.items.data[0].price.id,
		productId: typeof subscription.items.data[0].price.product === 'string'
			? subscription.items.data[0].price.product
			: subscription.items.data[0].price.product.id,
		quantity: subscription.items.data[0].quantity || 1,
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
					id: existing.data.id,
				});
			} else {
				await table.insert(record);
			}
		}
	}
}

/**
 * Track Stripe event in database
 */
async function trackStripeEvent(
	event: RequestEvent,
	stripeEvent: { type: string; data: any }
): Promise<void> {
	const pluginOptions = getStripeOptions();
	
	if (pluginOptions.trackEvents === false) return;

	const db = await event.locals.kuratchi?.getAdminDb?.();
	if (!db) return;

	const tableName = getTableName('events');
	const table = db[tableName as keyof typeof db] as any;
	if (!table) return;

	await table.insert({
		id: crypto.randomUUID(),
		stripeEventId: `evt_${crypto.randomUUID()}`,
		type: stripeEvent.type,
		data: stripeEvent.data,
		processed: true,
		createdAt: new Date().toISOString(),
	});
}
