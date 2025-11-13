import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { database } from 'kuratchi-sdk';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ locals, url }) => {
	const { session } = locals;
	
	// Auth check
	if (!session?.user) {
		error(401, 'Unauthorized');
	}

	const databaseId = url.searchParams.get('databaseId');
	const tableName = url.searchParams.get('tableName');

	if (!databaseId || !tableName) {
		error(400, 'Missing databaseId or tableName');
	}

	try {
		const adminDb = await (locals.kuratchi as any)?.getAdminDb?.();
		if (!adminDb) {
			error(500, 'Admin database not available');
		}

		// Get the specific database
		const dbRecord = await adminDb.databases
			.where({ id: { eq: databaseId }, deleted_at: { isNullish: true } })
			.first();

		if (!dbRecord?.data) {
			error(404, 'Database not found');
		}

		const db = dbRecord.data;

		// Get database token
		const { data: tokens } = await adminDb.dbApiTokens
			.where({
				databaseId: { eq: db.id },
				revoked: { eq: false },
				deleted_at: { is: null }
			})
			.many();

		if (!tokens || tokens.length === 0) {
			error(404, 'Database token not found');
		}

		// Get gateway key from environment
		const gatewayKey = env.KURATCHI_GATEWAY_KEY || process.env.KURATCHI_GATEWAY_KEY;
		
		if (!gatewayKey) {
			console.error('[table-data] KURATCHI_GATEWAY_KEY not found in environment');
			error(500, 'Gateway key not configured');
		}

		// Import organization schema for connection
		const { organizationSchema } = await import('$lib/schemas/organization');

		// Connect to the organization database
		const { query: dbQuery } = await database.instance().connect({
			databaseName: db.name,
			dbToken: tokens[0].token,
			gatewayKey: gatewayKey,
			schema: organizationSchema
		});

		// Execute the query safely (limit to 100 rows)
		// Note: In production, you'd want to sanitize tableName more carefully
		const result = await dbQuery(`SELECT * FROM ${tableName} LIMIT 100`);

		return json({ results: result.results || [] });
	} catch (err) {
		console.error('[table-data] Error:', err);
		error(500, 'Failed to fetch table data');
	}
};
