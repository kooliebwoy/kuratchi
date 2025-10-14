/**
 * Stripe Product & Price Management
 */

import type { RequestEvent } from '@sveltejs/kit';
import { getStripeClient, getStripeOptions, getTableName } from './client.js';

export interface CreateProductOptions {
	name: string;
	description?: string;
	active?: boolean;
	metadata?: Record<string, string>;
	features?: string[];
}

export interface CreatePriceOptions {
	productId: string;
	unitAmount: number; // Amount in cents
	currency?: string;
	recurring?: {
		interval: 'day' | 'week' | 'month' | 'year';
		intervalCount?: number;
	};
	active?: boolean;
	metadata?: Record<string, string>;
}

export interface UpdateProductOptions {
	name?: string;
	description?: string;
	active?: boolean;
	metadata?: Record<string, string>;
	features?: string[];
}

export interface UpdatePriceOptions {
	active?: boolean;
	metadata?: Record<string, string>;
}

/**
 * Create a product in Stripe
 */
export async function createProduct(
	event: RequestEvent,
	options: CreateProductOptions
) {
	const stripe = getStripeClient();

	const product = await stripe.products.create({
		name: options.name,
		description: options.description,
		active: options.active ?? true,
		metadata: {
			...options.metadata,
			...(options.features ? { features: JSON.stringify(options.features) } : {})
		},
	});

	return product;
}

/**
 * List all products
 */
export async function listProducts(event: RequestEvent, activeOnly = true) {
	const stripe = getStripeClient();

	const products = await stripe.products.list({
		active: activeOnly,
		limit: 100,
	});

	return products.data;
}

/**
 * Get a single product
 */
export async function getProduct(event: RequestEvent, productId: string) {
	const stripe = getStripeClient();
	return await stripe.products.retrieve(productId);
}

/**
 * Update a product
 */
export async function updateProduct(
	event: RequestEvent,
	productId: string,
	options: UpdateProductOptions
) {
	const stripe = getStripeClient();

	const product = await stripe.products.update(productId, {
		name: options.name,
		description: options.description,
		active: options.active,
		metadata: {
			...options.metadata,
			...(options.features ? { features: JSON.stringify(options.features) } : {})
		},
	});

	return product;
}

/**
 * Archive (soft delete) a product
 */
export async function archiveProduct(event: RequestEvent, productId: string) {
	const stripe = getStripeClient();

	const product = await stripe.products.update(productId, {
		active: false,
	});

	return product;
}

/**
 * Create a price for a product
 */
export async function createPrice(
	event: RequestEvent,
	options: CreatePriceOptions
) {
	const stripe = getStripeClient();

	const price = await stripe.prices.create({
		product: options.productId,
		unit_amount: options.unitAmount,
		currency: options.currency || 'usd',
		recurring: options.recurring,
		active: options.active ?? true,
		metadata: options.metadata || {},
	});

	return price;
}

/**
 * List prices for a product
 */
export async function listPrices(
	event: RequestEvent,
	productId?: string,
	activeOnly = true
) {
	const stripe = getStripeClient();

	const prices = await stripe.prices.list({
		product: productId,
		active: activeOnly,
		limit: 100,
	});

	return prices.data;
}

/**
 * Get a single price
 */
export async function getPrice(event: RequestEvent, priceId: string) {
	const stripe = getStripeClient();
	return await stripe.prices.retrieve(priceId);
}

/**
 * Update a price (can only update metadata and active status)
 */
export async function updatePrice(
	event: RequestEvent,
	priceId: string,
	options: UpdatePriceOptions
) {
	const stripe = getStripeClient();

	const price = await stripe.prices.update(priceId, {
		active: options.active,
		metadata: options.metadata,
	});

	return price;
}

/**
 * Archive (deactivate) a price
 */
export async function archivePrice(event: RequestEvent, priceId: string) {
	const stripe = getStripeClient();

	const price = await stripe.prices.update(priceId, {
		active: false,
	});

	return price;
}

/**
 * Get products with their prices (convenience method)
 */
export async function getProductsWithPrices(event: RequestEvent) {
	const stripe = getStripeClient();

	const products = await stripe.products.list({
		active: true,
		limit: 100,
		expand: ['data.default_price'],
	});

	const productsWithPrices = await Promise.all(
		products.data.map(async (product) => {
			const prices = await stripe.prices.list({
				product: product.id,
				active: true,
			});

			return {
				...product,
				prices: prices.data,
			};
		})
	);

	return productsWithPrices;
}
