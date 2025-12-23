import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateApiRequest } from '$lib/server/api-auth';
import { database } from 'kuratchi-sdk';
import { env } from '$env/dynamic/private';

/**
 * POST /api/v1/databases
 * 
 * Execute SQL queries on a specific database (not to be confused with /api/v1/platform/databases).
 * 
 * Purpose:
 * - SQL query execution endpoint
 * - Used by customers to run queries on their databases
 * - Handles parameterized queries, batches, raw SQL
 * 
 * For database MANAGEMENT (create, list, delete):
 * - Use /api/v1/platform/databases instead
 * 
 * Authentication:
 * - Header: Authorization: Bearer <your-platform-api-key>
 * - Or: x-api-key: <your-platform-api-key>
 * 
 * Required Headers:
 * - x-database-id: Your database ID (found in dashboard)
 * 
 * Optional Headers:
 * - x-endpoint: D1 worker endpoint to call (automatically set by SDK)
 *   Available endpoints: /api/run, /api/exec, /api/batch, /api/raw, /api/first
 *   Note: When using the Kuratchi SDK, this header is set automatically
 * - x-d1-bookmark: D1 session bookmark for consistency (returned in response)
 * 
 * Request Body Examples:
 * 
 * 1. Run a query (default):
 *    { "query": "SELECT * FROM users WHERE id = ?", "params": [1] }
 * 
 * 2. Execute raw SQL:
 *    { "query": "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)" }
 * 
 * 3. Batch operations:
 *    { "batch": [
 *        { "query": "INSERT INTO users (name) VALUES (?)", "params": ["Alice"] },
 *        { "query": "INSERT INTO users (name) VALUES (?)", "params": ["Bob"] }
 *      ]
 *    }
 * 
 * 4. Get first result:
 *    { "query": "SELECT COUNT(*) as count FROM users", "columnName": "count" }
 * 
 * Response includes:
 * - success: boolean
 * - results: query results
 * - d1Latency: query execution time
 * - sessionBookmark: bookmark for next request (for consistency)
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

		// 4. Verify database exists (platform keys have access to all databases)
		// Match by dbuuid (Cloudflare D1 UUID) instead of internal id
		const { data: databases } = await adminDb.databases
			.where({ dbuuid: databaseId })
			.many();

		const dbRecord = databases?.[0];
		if (!dbRecord) {
			error(404, 'Database not found');
		}

		// 5. Get database token (use internal database ID, not UUID)
		const { data: tokens } = await (adminDb as any).dbApiTokens
			.where({ databaseId: dbRecord.id, revoked: false })
			.many();

		const dbToken = tokens?.[0];
		if (!dbToken) {
			error(500, 'Database token not found');
		}

		// 6. Get the endpoint to call (default: /api/run for D1 worker)
		const endpoint = request.headers.get('x-endpoint') || '/api/run';
		
		// 7. Get environment config
		const gatewayKey = env.KURATCHI_GATEWAY_KEY;
		const workersSubdomain = env.KURATCHI_WORKERS_SUBDOMAIN || env.CLOUDFLARE_WORKERS_SUBDOMAIN;
		const scriptName = env.KURATCHI_DO_SCRIPT_NAME || 'kuratchi-do-internal';
		
		if (!gatewayKey) {
			error(500, 'Gateway key not configured');
		}
		if (!workersSubdomain) {
			error(500, 'Workers subdomain not configured');
		}

		// 8. Build the worker URL
		const workerUrl = `https://${scriptName}.${workersSubdomain}${endpoint}`;
		
		// 9. Read the request body
		const requestBody = await request.text();
		
		// 10. Get optional D1 bookmark for session consistency
		const d1Bookmark = request.headers.get('x-d1-bookmark');
		
		// 11. Forward the request to the worker with proper authentication
		const workerHeaders: Record<string, string> = {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${gatewayKey}`,
			'x-db-name': dbRecord.name,
			'x-db-token': dbToken.token
		};
		
		// Include bookmark if provided (for D1 session consistency)
		if (d1Bookmark) {
			workerHeaders['x-d1-bookmark'] = d1Bookmark;
		}
		
		const workerRequest = new Request(workerUrl, {
			method: 'POST',
			headers: workerHeaders,
			body: requestBody
		});

		const response = await fetch(workerRequest);
		const result = await response.json();

		// 12. Extract the session bookmark from worker response
		const responseBookmark = response.headers.get('x-d1-bookmark');
		
		// 13. Return the worker's response with bookmark header
		const responseHeaders: Record<string, string> = {
			'Content-Type': 'application/json'
		};
		
		if (responseBookmark) {
			responseHeaders['x-d1-bookmark'] = responseBookmark;
		}
		
		return json(result, { 
			status: response.status,
			headers: responseHeaders
		});

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
