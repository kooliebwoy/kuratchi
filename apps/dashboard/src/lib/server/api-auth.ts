import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { database } from 'kuratchi-sdk';

export interface ApiKeyValidation {
	organizationId: string;
	organizationSlug: string;
	keyId: string;
	permissions: string[];
}

/**
 * Validates an API key and returns the associated organization
 */
export async function validateApiKey(
	apiKey: string,
	locals: RequestEvent['locals']
): Promise<ApiKeyValidation> {
	try {
		const { orm: adminDb } = await database.admin();
		if (!adminDb) {
			error(500, 'Database connection not available');
		}

		// Query the API keys table
		const apiKeyRecord = await (adminDb as any).apiKeys
			?.where({ key: apiKey, active: true })
			.get();

		if (!apiKeyRecord?.data) {
			error(401, 'Invalid API key');
		}

		const keyData = apiKeyRecord.data;

		// Check if key is expired
		if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) {
			error(401, 'API key has expired');
		}

		// Get organization details
		const orgRecord = await (adminDb as any).organizations
			?.where({ id: keyData.organizationId })
			.get();

		if (!orgRecord?.data) {
			error(404, 'Organization not found');
		}

		// Update last used timestamp
		await (adminDb as any).apiKeys
			?.where({ id: keyData.id })
			.update({
				lastUsedAt: new Date().toISOString(),
				usageCount: (keyData.usageCount || 0) + 1
			});

		return {
			organizationId: keyData.organizationId,
			organizationSlug: orgRecord.data.organizationSlug,
			keyId: keyData.id,
			permissions: keyData.permissions || []
		};
	} catch (err: any) {
		if (err.status) {
			throw err;
		}
		console.error('[API Auth] Error validating API key:', err);
		error(500, 'Failed to validate API key');
	}
}

/**
 * Extracts API key from request headers
 */
export function extractApiKey(request: Request): string | null {
	// Check x-api-key header
	const apiKey = request.headers.get('x-api-key');
	if (apiKey) {
		return apiKey;
	}

	// Check Authorization header (Bearer token)
	const authHeader = request.headers.get('authorization');
	if (authHeader?.startsWith('Bearer ')) {
		return authHeader.substring(7);
	}

	return null;
}

/**
 * Middleware to authenticate API requests
 */
export async function authenticateApiRequest(
	event: RequestEvent
): Promise<ApiKeyValidation> {
	const apiKey = extractApiKey(event.request);
	
	if (!apiKey) {
		error(401, 'Missing API key. Provide via x-api-key header or Authorization: Bearer <key>');
	}

	return await validateApiKey(apiKey, event.locals);
}
