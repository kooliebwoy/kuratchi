/**
 * API Keys Remote
 * Manage master API keys for BaaS access
 */

import { getRequestEvent, query, form } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { ActivityAction } from 'kuratchi-sdk';

// Helpers
const guardedQuery = <R>(fn: () => Promise<R>) => {
	return query(async () => {
		const { locals: { session } } = getRequestEvent();
		if (!session?.user) error(401, 'Unauthorized');
		return fn();
	});
};

const guardedForm = <R>(
	schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
	fn: (data: any) => Promise<R>
) => {
	return form('unchecked', async (data: any) => {
		const { locals: { session } } = getRequestEvent();
		if (!session?.user) error(401, 'Unauthorized');

		const result = v.safeParse(schema, data);
		if (!result.success) {
			console.error('[guardedForm] Validation failed:', result.issues);
			error(400, `Validation failed: ${result.issues.map((i: any) => `${i.path?.map((p: any) => p.key).join('.')}: ${i.message}`).join(', ')}`);
		}

		return fn(result.output);
	});
};

// Schemas
const createApiKeySchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, 'Name is required'), v.maxLength(100, 'Name too long')),
	description: v.optional(v.pipe(v.string(), v.maxLength(500, 'Description too long')))
});

const rotateApiKeySchema = v.object({
	id: v.pipe(v.string(), v.minLength(1, 'API key ID is required'))
});

const deleteApiKeySchema = v.object({
	id: v.pipe(v.string(), v.minLength(1, 'API key ID is required'))
});

// Queries
export const getApiKeys = guardedQuery(async () => {
	try {
		const { locals } = getRequestEvent();
		const adminDb = await locals.kuratchi?.getAdminDb?.();
		
		if (!adminDb) {
			return [];
		}

		const result = await adminDb.platformApiTokens
			.where({ revoked: false })
			.many();
		
		return result?.data?.map(token => ({
			id: token.id,
			name: token.name || 'Unnamed Key',
			prefix: token.token.substring(0, 16) + '...',
			created_at: token.created_at,
			expires: token.expires
		})) || [];
	} catch (err) {
		console.error('[api-keys.getApiKeys] error:', err);
		return [];
	}
});

// Forms
export const createApiKey = guardedForm(createApiKeySchema, async (data) => {
	try {
		const { locals } = getRequestEvent();
		const adminDb = await locals.kuratchi?.getAdminDb?.();
		
		if (!adminDb) {
			error(500, 'Admin database not available');
		}

		// Generate a secure random API token
		const token = `sk_live_${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`;

		const id = crypto.randomUUID();
		
		// Insert into database
		await adminDb.platformApiTokens.insert({
			id,
			token,
			name: data.name,
			revoked: false,
			expires: null, // No expiration by default
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		});

		// Log activity 
		// await locals.kuratchi?.activity?.logActivity?.({
		// 	action: ActivityAction.PLATFORM_API_KEY_CREATED,
		// 	data: {
		// 		apiKeyId: id,
		// 		name: data.name,
		// 	}
		// });

		// Return full key (only time it's shown)
		return { key: token };
	} catch (err) {
		console.error('[api-keys.createApiKey] error:', err);
		error(500, 'Failed to create API key');
	}
});

export const rotateApiKey = guardedForm(rotateApiKeySchema, async (data) => {
	try {
		const { locals } = getRequestEvent();
		const adminDb = await locals.kuratchi?.getAdminDb?.();
		
		if (!adminDb) {
			error(500, 'Admin database not available');
		}

		// Check if key exists and is not revoked
		const existingKey = await adminDb.platformApiTokens
			.where({ id: data.id, revoked: false })
			.first();
		
		if (!existingKey?.data) {
			error(404, 'API key not found or already revoked');
		}

		// Generate new token
		const newToken = `sk_live_${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`;
		
		// Update the token
		await adminDb.platformApiTokens
			.where({ id: data.id })
			.update({
				token: newToken,
				updated_at: new Date().toISOString()
			});

		// Log activity 
		// await locals.kuratchi?.activity?.logActivity?.({
		// 	action: ActivityAction.PLATFORM_API_KEY_ROTATED,
		// 	data: {
		// 		apiKeyId: data.id,
		// 		name: existingKey.data.name,
		// 	}
		// });

		// Return new full key (only time it's shown)
		return { key: newToken };
	} catch (err) {
		console.error('[api-keys.rotateApiKey] error:', err);
		error(500, 'Failed to rotate API key');
	}
});

export const deleteApiKey = guardedForm(deleteApiKeySchema, async (data) => {
	try {
		const { locals } = getRequestEvent();
		const adminDb = await locals.kuratchi?.getAdminDb?.();
		
		if (!adminDb) {
			error(500, 'Admin database not available');
		}

		// Mark as revoked instead of deleting (soft delete for audit trail)
		const result = await adminDb.platformApiTokens
			.where({ id: data.id })
			.update({
				revoked: true,
				updated_at: new Date().toISOString()
			});

		if (!result?.success) {
			error(404, 'API key not found');
		}

		// Log activity 
		// await locals.kuratchi?.activity?.logActivity?.({
		// 	action: ActivityAction.PLATFORM_API_KEY_DELETED,
		// 	data: {
		// 		apiKeyId: data.id
		// 	}
		// });

		return { success: true };
	} catch (err) {
		console.error('[api-keys.deleteApiKey] error:', err);
		error(500, 'Failed to delete API key');
	}
});
