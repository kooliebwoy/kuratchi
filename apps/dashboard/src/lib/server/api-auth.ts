import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

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
		// Use the same database source as the Settings page
		const adminDb = await locals.kuratchi?.getAdminDb?.();
		if (!adminDb) {
			error(500, 'Database connection not available');
		}

		// Get all non-revoked tokens and find the matching one in JavaScript
		// (ORM's where() has issues with long strings causing LIKE pattern errors)
		const allTokensResult = await (adminDb as any).platformApiTokens
			?.where({ revoked: false })
			.many();

		if (!allTokensResult?.data) {
			error(500, 'Failed to query API tokens');
		}

		// Find the matching token by exact string comparison
		const keyData = allTokensResult.data.find((t: any) => t.token === apiKey);

		if (!keyData) {
			error(401, 'Invalid API key');
		}

		// Check if key is expired
		if (keyData.expires && new Date(keyData.expires) < new Date()) {
			error(401, 'API key has expired');
		}

		// For platform API keys, we use 'admin' as the organization
		// This gives access to all databases owned by the platform
		const organizationId = 'admin';
		const organizationSlug = 'admin';

		// Update last used timestamp
		await (adminDb as any).platformApiTokens
			?.where({ id: keyData.id })
			.update({
				updated_at: new Date().toISOString()
			});

		return {
			organizationId,
			organizationSlug,
			keyId: keyData.id,
			permissions: ['*'] // Platform keys have full access
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
