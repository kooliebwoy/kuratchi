import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './query/$types';
import { authenticateApiRequest } from '$lib/server/api-auth';
import { database } from 'kuratchi-sdk';

/**
 * POST /api/v1/databases/query
 * 
 * Proxy endpoint that forwards database operations to the Kuratchi database worker.
 * This is a thin authentication layer - the actual database logic is handled by the worker.
 * 
 * The request body should match the worker's expected format for the specific endpoint:
 * - /do/api/run: { query: string, params?: any[] }
 * - /do/api/exec: { query: string }
 * - /do/api/batch: { batch: Array<{ query: string, params?: any[] }> }
 * - /do/api/raw: { query: string, params?: any[] }
 * - /do/api/first: { query: string, params?: any[], columnName?: string }
 * 
 * Headers:
 * - x-api-key or Authorization: Bearer <key> - Your organization API key
 * - x-database-id - The database ID to query
 * - x-endpoint - The worker endpoint to call (default: /do/api/run)
 */
export const POST: RequestHandler = async (event) => {
	const { request } = event;
	
	try {
		// 1. Authenticate the request
		const auth = await authenticateApiRequest(event);

		// 2. Get database ID from header (required)
		const databaseId = request.headers.get('x-database-id');
		if (!databaseId) {
			error(400, 'Missing x-database-id header');
		}

		// 3. Get the admin database to fetch credentials
		const { orm: adminDb } = await database.admin();
		if (!adminDb) {
			error(500, 'Database connection not available');
		}

		// 4. Verify database belongs to the authenticated organization
		const { data: databases } = await adminDb.databases
			.where({ id: databaseId, organizationId: auth.organizationId })
			.many();

		const dbRecord = databases?.[0];
		if (!dbRecord) {
			error(404, 'Database not found or access denied');
		}

		// 5. Get database token
		const { data: tokens } = await (adminDb as any).dbApiTokens
			.where({ databaseId: databaseId, active: true })
			.many();

		const dbToken = tokens?.[0];
		if (!dbToken) {
			error(500, 'Database token not found');
		}

		// 6. Get the endpoint to call (default: /do/api/run)
		const endpoint = request.headers.get('x-endpoint') || '/do/api/run';
		
		// 7. Get environment config
		const gatewayKey = process.env.KURATCHI_GATEWAY_KEY;
		const workersSubdomain = process.env.KURATCHI_WORKERS_SUBDOMAIN;
		const scriptName = process.env.KURATCHI_DO_SCRIPT_NAME || 'kuratchi-do-internal';
		
		if (!gatewayKey) {
			error(500, 'Gateway key not configured');
		}
		if (!workersSubdomain) {
			error(500, 'Workers subdomain not configured');
		}

		// 8. Build the worker URL
		const workerUrl = `https://${scriptName}.${workersSubdomain}${endpoint}`;
		
		// 9. Read the request body (we need to clone it since we already read it once)
		const requestBody = await request.text();
		
		// 10. Forward the request to the worker with proper authentication
		const workerRequest = new Request(workerUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${gatewayKey}`,
				'x-db-name': dbRecord.databaseName,
				'x-db-token': dbToken.token
			},
			body: requestBody
		});

		const response = await fetch(workerRequest);
		const result = await response.json();

		// 11. Return the worker's response
		return json(result, { status: response.status });

	} catch (err: any) {
		console.error('[API] Database query error:', err);
		
		// Handle SvelteKit errors
		if (err.status) {
			throw err;
		}
		
		// Handle other errors
		return json({
			success: false,
			error: err.message || 'Internal server error'
		}, { status: 500 });
	}
};
