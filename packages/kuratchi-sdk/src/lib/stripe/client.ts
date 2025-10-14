/**
 * Stripe Client Initialization
 */

import Stripe from 'stripe';
import type { StripePluginOptions } from './types.js';

let stripeClient: Stripe | null = null;
let pluginOptions: StripePluginOptions | null = null;

export function initStripePlugin(options: StripePluginOptions) {
	pluginOptions = options;
	stripeClient = new Stripe(options.apiKey, {
		apiVersion: '2025-09-30.clover',
		typescript: true,
	});
}

export function getStripeClient(): Stripe {
	if (!stripeClient) {
		throw new Error('Stripe plugin not initialized. Configure stripe in kuratchi().');
	}
	return stripeClient;
}

export function getStripeOptions(): StripePluginOptions {
	if (!pluginOptions) {
		throw new Error('Stripe plugin not initialized. Configure stripe in kuratchi().');
	}
	return pluginOptions;
}

export function getTableName(type: 'customers' | 'subscriptions' | 'events' | 'invoices'): string {
	const options = getStripeOptions();
	const defaults = {
		customers: 'stripeCustomers',
		subscriptions: 'stripeSubscriptions',
		events: 'stripeEvents',
		invoices: 'stripeInvoices',
	};
	return options.tables?.[type] || defaults[type];
}
