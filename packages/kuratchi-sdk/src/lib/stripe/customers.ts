/**
 * Stripe Customer Management
 */

import type { RequestEvent } from '@sveltejs/kit';
import { getStripeClient, getStripeOptions, getTableName } from './client.js';
import type { CreateCustomerOptions, StripeCustomerRecord } from './types.js';

/**
 * Create a Stripe customer and store in local DB
 */
export async function createCustomer(
	event: RequestEvent,
	options: CreateCustomerOptions
): Promise<StripeCustomerRecord> {
	const stripe = getStripeClient();
	const pluginOptions = getStripeOptions();

	// Create customer in Stripe
	const customer = await stripe.customers.create({
		email: options.email,
		name: options.name,
		phone: options.phone,
		metadata: options.metadata || {},
	});

	// Store in local DB
	const record: StripeCustomerRecord = {
		id: crypto.randomUUID(),
		stripeCustomerId: customer.id,
		email: options.email,
		name: options.name,
		userId: options.userId,
		organizationId: options.organizationId,
		metadata: options.metadata,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};

	const db = pluginOptions.trackingDb === 'org'
		? await event.locals.kuratchi?.orgDatabaseClient?.(options.organizationId)
		: await event.locals.kuratchi?.getAdminDb?.();

	if (db) {
		const tableName = getTableName('customers');
		const table = db[tableName as keyof typeof db] as any;
		if (table) {
			await table.insert(record);
		}
	}

	return record;
}

/**
 * Get customer by Stripe customer ID
 */
export async function getCustomer(
	event: RequestEvent,
	stripeCustomerId: string
): Promise<StripeCustomerRecord | null> {
	const pluginOptions = getStripeOptions();

	const db = await event.locals.kuratchi?.getAdminDb?.();
	if (!db) return null;

	const tableName = getTableName('customers');
	const table = db[tableName as keyof typeof db] as any;
	if (!table) return null;

	const result = await table.where({ stripeCustomerId }).first();
	return result?.data || null;
}

/**
 * Get customer by user ID
 */
export async function getCustomerByUserId(
	event: RequestEvent,
	userId: string
): Promise<StripeCustomerRecord | null> {
	const pluginOptions = getStripeOptions();

	const db = await event.locals.kuratchi?.getAdminDb?.();
	if (!db) return null;

	const tableName = getTableName('customers');
	const table = db[tableName as keyof typeof db] as any;
	if (!table) return null;

	const result = await table.where({ userId }).first();
	return result?.data || null;
}

/**
 * Update customer in Stripe and local DB
 */
export async function updateCustomer(
	event: RequestEvent,
	stripeCustomerId: string,
	updates: Partial<CreateCustomerOptions>
): Promise<StripeCustomerRecord | null> {
	const stripe = getStripeClient();
	const pluginOptions = getStripeOptions();

	// Update in Stripe
	await stripe.customers.update(stripeCustomerId, {
		email: updates.email,
		name: updates.name,
		phone: updates.phone,
		metadata: updates.metadata,
	});

	// Update in local DB
	const db = await event.locals.kuratchi?.getAdminDb?.();
	if (!db) return null;

	const tableName = getTableName('customers');
	const table = db[tableName as keyof typeof db] as any;
	if (!table) return null;

	await table.where({ stripeCustomerId }).update({
		...updates,
		updatedAt: new Date().toISOString(),
	});

	return await getCustomer(event, stripeCustomerId);
}

/**
 * Delete customer from Stripe and local DB
 */
export async function deleteCustomer(
	event: RequestEvent,
	stripeCustomerId: string
): Promise<void> {
	const stripe = getStripeClient();
	const pluginOptions = getStripeOptions();

	// Delete from Stripe
	await stripe.customers.del(stripeCustomerId);

	// Soft delete in local DB
	const db = await event.locals.kuratchi?.getAdminDb?.();
	if (!db) return;

	const tableName = getTableName('customers');
	const table = db[tableName as keyof typeof db] as any;
	if (!table) return;

	await table.where({ stripeCustomerId }).update({
		deleted_at: new Date().toISOString(),
	});
}
