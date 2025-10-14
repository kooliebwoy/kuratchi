/**
 * Stripe Plugin - Complete payment and subscription management
 * 
 * Features:
 * - Customer management
 * - Subscription lifecycle (create, update, cancel, resume)
 * - Checkout sessions with automatic callback handling
 * - Billing portal
 * - Automatic database syncing
 */

import type { RequestEvent } from '@sveltejs/kit';

// Re-export types
export type {
	StripePluginOptions,
	CreateCustomerOptions,
	CreateCheckoutOptions,
	CreateSubscriptionOptions,
	UpdateSubscriptionOptions,
	CreatePortalSessionOptions,
	StripeCustomerRecord,
	StripeSubscriptionRecord,
	StripeEventRecord,
	StripeInvoiceRecord,
} from './types.js';

// Initialize
export { initStripePlugin } from './client.js';

// Customer methods
export {
	createCustomer,
	getCustomer,
	getCustomerByUserId,
	updateCustomer,
	deleteCustomer,
} from './customers.js';

// Subscription methods
export {
	createSubscription,
	getSubscription,
	getCustomerSubscriptions,
	getActiveSubscription,
	updateSubscription,
	cancelSubscription,
	resumeSubscription,
} from './subscriptions.js';

// Checkout methods
export {
	createCheckout,
	createPortalSession,
	getCheckoutSession,
} from './checkout.js';

// Product & Price management
export {
	createProduct,
	listProducts,
	getProduct,
	updateProduct,
	archiveProduct,
	createPrice,
	listPrices,
	getPrice,
	updatePrice,
	archivePrice,
	getProductsWithPrices,
} from './products.js';

// Callback handler
export { handleStripeCallback } from './callback.js';

/**
 * Stripe namespace - unified API
 */
export const stripe = {
	// Customers
	createCustomer: async (event: RequestEvent, options: any) => {
		const { createCustomer } = await import('./customers.js');
		return createCustomer(event, options);
	},
	getCustomer: async (event: RequestEvent, stripeCustomerId: string) => {
		const { getCustomer } = await import('./customers.js');
		return getCustomer(event, stripeCustomerId);
	},
	getCustomerByUserId: async (event: RequestEvent, userId: string) => {
		const { getCustomerByUserId } = await import('./customers.js');
		return getCustomerByUserId(event, userId);
	},
	updateCustomer: async (event: RequestEvent, stripeCustomerId: string, updates: any) => {
		const { updateCustomer } = await import('./customers.js');
		return updateCustomer(event, stripeCustomerId, updates);
	},
	deleteCustomer: async (event: RequestEvent, stripeCustomerId: string) => {
		const { deleteCustomer } = await import('./customers.js');
		return deleteCustomer(event, stripeCustomerId);
	},

	// Subscriptions
	createSubscription: async (event: RequestEvent, options: any) => {
		const { createSubscription } = await import('./subscriptions.js');
		return createSubscription(event, options);
	},
	getSubscription: async (event: RequestEvent, stripeSubscriptionId: string) => {
		const { getSubscription } = await import('./subscriptions.js');
		return getSubscription(event, stripeSubscriptionId);
	},
	getCustomerSubscriptions: async (event: RequestEvent, stripeCustomerId: string) => {
		const { getCustomerSubscriptions } = await import('./subscriptions.js');
		return getCustomerSubscriptions(event, stripeCustomerId);
	},
	getActiveSubscription: async (event: RequestEvent, stripeCustomerId: string) => {
		const { getActiveSubscription } = await import('./subscriptions.js');
		return getActiveSubscription(event, stripeCustomerId);
	},
	updateSubscription: async (event: RequestEvent, stripeSubscriptionId: string, options: any) => {
		const { updateSubscription } = await import('./subscriptions.js');
		return updateSubscription(event, stripeSubscriptionId, options);
	},
	cancelSubscription: async (event: RequestEvent, stripeSubscriptionId: string, immediate = false) => {
		const { cancelSubscription } = await import('./subscriptions.js');
		return cancelSubscription(event, stripeSubscriptionId, immediate);
	},
	resumeSubscription: async (event: RequestEvent, stripeSubscriptionId: string) => {
		const { resumeSubscription } = await import('./subscriptions.js');
		return resumeSubscription(event, stripeSubscriptionId);
	},

	// Checkout
	createCheckout: async (event: RequestEvent, options: any) => {
		const { createCheckout } = await import('./checkout.js');
		return createCheckout(event, options);
	},
	createPortalSession: async (event: RequestEvent, options: any) => {
		const { createPortalSession } = await import('./checkout.js');
		return createPortalSession(event, options);
	},
	getCheckoutSession: async (sessionId: string) => {
		const { getCheckoutSession } = await import('./checkout.js');
		return getCheckoutSession(sessionId);
	},

	// Products & Prices
	createProduct: async (event: RequestEvent, options: any) => {
		const { createProduct } = await import('./products.js');
		return createProduct(event, options);
	},
	listProducts: async (event: RequestEvent, activeOnly = true) => {
		const { listProducts } = await import('./products.js');
		return listProducts(event, activeOnly);
	},
	getProduct: async (event: RequestEvent, productId: string) => {
		const { getProduct } = await import('./products.js');
		return getProduct(event, productId);
	},
	updateProduct: async (event: RequestEvent, productId: string, options: any) => {
		const { updateProduct } = await import('./products.js');
		return updateProduct(event, productId, options);
	},
	archiveProduct: async (event: RequestEvent, productId: string) => {
		const { archiveProduct } = await import('./products.js');
		return archiveProduct(event, productId);
	},
	createPrice: async (event: RequestEvent, options: any) => {
		const { createPrice } = await import('./products.js');
		return createPrice(event, options);
	},
	listPrices: async (event: RequestEvent, productId?: string, activeOnly = true) => {
		const { listPrices } = await import('./products.js');
		return listPrices(event, productId, activeOnly);
	},
	getPrice: async (event: RequestEvent, priceId: string) => {
		const { getPrice } = await import('./products.js');
		return getPrice(event, priceId);
	},
	updatePrice: async (event: RequestEvent, priceId: string, options: any) => {
		const { updatePrice } = await import('./products.js');
		return updatePrice(event, priceId, options);
	},
	archivePrice: async (event: RequestEvent, priceId: string) => {
		const { archivePrice } = await import('./products.js');
		return archivePrice(event, priceId);
	},
	getProductsWithPrices: async (event: RequestEvent) => {
		const { getProductsWithPrices } = await import('./products.js');
		return getProductsWithPrices(event);
	},
};
