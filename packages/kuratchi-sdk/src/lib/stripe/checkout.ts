/**
 * Stripe Checkout & Billing Portal
 */

import type { RequestEvent } from '@sveltejs/kit';
import { getStripeClient, getStripeOptions } from './client.js';
import type { CreateCheckoutOptions, CreatePortalSessionOptions } from './types.js';

/**
 * Create a Stripe Checkout session
 * Returns the checkout URL to redirect the user to
 */
export async function createCheckout(
	event: RequestEvent,
	options: CreateCheckoutOptions
): Promise<string> {
	const stripe = getStripeClient();
	const pluginOptions = getStripeOptions();

	// Build the callback URLs
	const origin = event.url.origin;
	const callbackPath = pluginOptions.callbackPath || '/kuratchi/stripe/callback';
	
	// Success URL includes session_id for verification
	const successUrl = `${origin}${callbackPath}?session_id={CHECKOUT_SESSION_ID}&success_path=${encodeURIComponent(options.successPath)}`;
	const cancelUrl = `${origin}${options.cancelPath}`;

	// Create checkout session
	const session = await stripe.checkout.sessions.create({
		mode: options.mode || 'subscription',
		customer: options.customerId,
		customer_email: options.customerId ? undefined : options.customerEmail,
		line_items: [
			{
				price: options.priceId,
				quantity: options.quantity || 1,
			},
		],
		success_url: successUrl,
		cancel_url: cancelUrl,
		allow_promotion_codes: options.allowPromotionCodes,
		subscription_data: options.mode === 'subscription' && options.trialPeriodDays
			? {
					trial_period_days: options.trialPeriodDays,
					metadata: options.metadata,
			  }
			: undefined,
		metadata: options.metadata,
	});

	if (!session.url) {
		throw new Error('Failed to create checkout session');
	}

	return session.url;
}

/**
 * Create a Stripe Billing Portal session
 * Returns the portal URL to redirect the user to
 */
export async function createPortalSession(
	event: RequestEvent,
	options: CreatePortalSessionOptions
): Promise<string> {
	const stripe = getStripeClient();

	const origin = event.url.origin;
	const returnUrl = `${origin}${options.returnPath}`;

	const session = await stripe.billingPortal.sessions.create({
		customer: options.customerId,
		return_url: returnUrl,
	});

	return session.url;
}

/**
 * Retrieve a checkout session by ID
 */
export async function getCheckoutSession(sessionId: string) {
	const stripe = getStripeClient();
	return await stripe.checkout.sessions.retrieve(sessionId, {
		expand: ['customer', 'subscription'],
	});
}
