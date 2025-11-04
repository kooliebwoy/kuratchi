import { getRequestEvent, query, form } from '$app/server';
import { env } from '$env/dynamic/private';
import * as v from 'valibot';
import { error, fail } from '@sveltejs/kit';
import { database } from 'kuratchi-sdk';

// Guarded query helper
const guardedQuery = <R>(fn: () => Promise<R>) => {
	return query(async () => {
		const { locals: { session } } = getRequestEvent();
		if (!session?.user) error(401, 'Unauthorized');

		return fn();
	});
};

// Guarded form helper - using unchecked validation
const guardedForm = <R>(
	schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
	fn: (data: any) => Promise<R>
) => {
	return form('unchecked', async (data: any) => {
		const { locals: { session } } = getRequestEvent();
		if (!session?.user) error(401, 'Unauthorized');

		// Validate with valibot
		const result = v.safeParse(schema, data);
		if (!result.success) {
			error(400, 'Validation failed');
		}

		return fn(result.output);
	});
};

// Log route activity
export const logRouteActivity = guardedQuery(async () => {
	// TODO: Implement activity logging
	console.log('Database route accessed');
});

// Get all databases for the organization
export const getDatabases = guardedQuery(async () => {
  const { locals } = getRequestEvent();
  const session = locals.session;
  const activeOrgId = locals?.kuratchi?.superadmin?.getActiveOrgId?.() || session?.organizationId;
  
  try {
    // Require an active organization context; otherwise, return empty to avoid platform-wide exposure
    if (!activeOrgId) {
      console.warn('[getDatabases] No active organization selected; returning empty list');
      return [] as any[];
    }

    // Do not show platform admin org databases
    if (activeOrgId === 'admin') {
      return [] as any[];
    }

    const adminDb = await (locals.kuratchi as any)?.getAdminDb?.();
    if (!adminDb) error(500, 'Admin database not available');

    const result = await adminDb.databases
      .where({ organizationId: { eq: activeOrgId }, isPrimary: { eq: false }, deleted_at: { isNullish: true } })
      .many();

    const databases = (result?.data ?? result) || [];

		console.log('[getDatabases] activeOrgId:', activeOrgId, 'count:', databases?.length ?? 0);
		
		return databases;
	} catch (err) {
		console.error('Error fetching databases:', err);
		return [];
	}
});

// Get database tables and schema info
export const getDatabaseTables = guardedQuery(async () => {
	const { locals } = getRequestEvent();
	const session = locals.session;
	const activeOrgId = locals?.kuratchi?.superadmin?.getActiveOrgId?.() || session?.organizationId;
	
	try {
		// Get the organization's database info
		const { orm: adminOrm } = await database.admin();
		const { data: databases } = await adminOrm.databases
			.where({ organizationId: { eq: activeOrgId } })
			.many();
		
		if (!databases || databases.length === 0) {
			return [];
		}

		// Get the first database (or you could allow selecting which one)
		const db = databases[0];
		
		// Get database token
		const { data: tokens } = await adminOrm.dbApiTokens
			.where({ 
				databaseId: { eq: db.id },
				revoked: { eq: false },
				deleted_at: { is: null }
			})
			.many();
		
		if (!tokens || tokens.length === 0) {
			return [];
		}

		// Import organization schema for connection
		const { organizationSchema } = await import('$lib/schemas/organization');

		// Connect to the organization database
		const { query: dbQuery } = await database.instance().connect({
			databaseName: db.name,
			dbToken: tokens[0].token,
			gatewayKey: process.env.KURATCHI_GATEWAY_KEY!,
			schema: organizationSchema
		});

		// Get table information
		const tables = await dbQuery(
			`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
		);

		// Get column count and indexes for each table
		const tablesWithInfo = await Promise.all(
			(tables.results || []).map(async (table: any) => {
				const columns = await dbQuery(`PRAGMA table_info(${table.name})`);
				const indexes = await dbQuery(`PRAGMA index_list(${table.name})`);
				
				return {
					name: table.name,
					columnCount: (columns.results || []).length,
					indexCount: (indexes.results || []).length,
					replication: 'Multi-region'
				};
			})
		);

		return tablesWithInfo;
	} catch (err) {
		console.error('Error fetching database tables:', err);
		return [];
	}
});

// Create a new database
export const createDatabase = guardedForm(
	v.object({
		name: v.pipe(v.string(), v.nonEmpty(), v.regex(/^[a-z0-9-]+$/)),
		description: v.pipe(v.string(), v.nonEmpty()),
	}),
	async ({ name, description }) => {
		const { locals } = getRequestEvent();
		const session = locals.session;
		const activeOrgId = locals?.kuratchi?.superadmin?.getActiveOrgId?.() || session?.organizationId;

		try {
			// Create database name (system-level or org-level)
			const dbName = activeOrgId && activeOrgId !== 'admin' 
				? `org-${activeOrgId}-${name}` 
				: `sys-${name}`;

			// Create the database with organization schema
			const created = await database.create({
				name: dbName,
				migrate: false
			});


			console.log('[createDatabase] D1 database created:', {
				databaseName: created.databaseName,
				databaseId: created.databaseId,
				workerName: created.workerName,
				token: created.token ? '***' : undefined
			});

			// Store database info in admin DB using ORM
			const { orm: adminOrm } = await database.admin();
			const now = new Date().toISOString();
			const dbId = crypto.randomUUID();
			
			// organizationId can be null for system-level databases
			const orgId = activeOrgId && activeOrgId !== 'admin' ? activeOrgId : null;
			
			const newDB = await adminOrm.databases.insert({
				id: dbId,
				name: created.databaseName,
				dbuuid: created.databaseId || created.databaseName, // Use D1 database ID if available
				organizationId: orgId,
				isArchived: false,
				isActive: true,
				schemaVersion: 1,
				needsSchemaUpdate: false,
				created_at: now,
				updated_at: now,
				deleted_at: null
			});

			console.log('newDB: ', newDB);

			if (!newDB.success) {
				console.error('Failed to insert database:', newDB.error);
				error(500, `Failed to create database: ${newDB.error}`);
			}

			// Store the database token
			const dbApiToken = await adminOrm.dbApiTokens.insert({
				id: crypto.randomUUID(),
				token: created.token,
				name: `${name}-token`,
				databaseId: dbId,
				created_at: now,
				updated_at: now,
				revoked: false,
				expires: null,
				deleted_at: null
			});

			if (!dbApiToken.success) {
				console.error('Failed to insert database token:', dbApiToken.error);
				error(500, `Failed to create database token: ${dbApiToken.error}`);
			}

			// Refresh databases list
			await getDatabases().refresh();

			return { success: true, message: 'Database created successfully' };
		} catch (err) {
			console.error('Error creating database:', err);
			error(500, 'Failed to create database');
		}
	}
);

// Get D1 analytics from Cloudflare GraphQL API for a specific database
export const getDatabaseAnalytics = guardedQuery(async () => {
	const { locals } = getRequestEvent();
	const { url } = getRequestEvent();
	
	// Get database ID from URL path
	const pathParts = url.pathname.split('/');
	const dbId = pathParts[pathParts.indexOf('database') + 1];
	
	if (!dbId) {
		console.warn('[getDatabaseAnalytics] No database ID in URL');
		return { readQueries: 0, writeQueries: 0, rowsRead: 0, rowsWritten: 0 };
	}
	
	try {
		// Get account ID and API token from environment
		const accountId = env.CLOUDFLARE_ACCOUNT_ID;
		const apiToken = env.CLOUDFLARE_API_TOKEN;
		
		if (!accountId || !apiToken) {
			console.warn('[getDatabaseAnalytics] Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN');
			return { readQueries: 0, writeQueries: 0, rowsRead: 0, rowsWritten: 0 };
		}

		// Fetch the database record to get the D1 UUID (dbuuid)
		const { orm: adminOrm } = await database.admin();
		const dbRecord = await adminOrm.databases
			.where({ id: { eq: dbId } })
			.first();
		
		if (!dbRecord?.data?.dbuuid) {
			console.warn('[getDatabaseAnalytics] No dbuuid found for database:', dbId);
			return { readQueries: 0, writeQueries: 0, rowsRead: 0, rowsWritten: 0 };
		}

		const d1DatabaseId = dbRecord.data.dbuuid;
		console.log('[getDatabaseAnalytics] Fetching analytics for D1 database:', d1DatabaseId);

		// Calculate date range (last 7 days)
		const endDate = new Date();
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - 7);
		
		const start = startDate.toISOString().split('T')[0];
		const end = endDate.toISOString().split('T')[0];
		
		// Using string interpolation with specific databaseId filter
		const query = `
			query {
				viewer {
					accounts(filter: { accountTag: "${accountId}" }) {
						d1AnalyticsAdaptiveGroups(
							limit: 10000
							filter: {
								date_geq: "${start}"
								date_leq: "${end}"
								databaseId: "${d1DatabaseId}"
							}
							orderBy: [date_DESC]
						) {
							sum {
								readQueries
								writeQueries
								rowsRead
								rowsWritten
							}
							dimensions {
								date
								databaseId
							}
						}
					}
				}
			}
		`;

		console.log('[getDatabaseAnalytics] Query:', query);
		console.log('[getDatabaseAnalytics] Date range:', start, 'to', end);

		const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${apiToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ query })
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('[getDatabaseAnalytics] GraphQL request failed:', response.status, errorText);
			return { readQueries: 0, writeQueries: 0, rowsRead: 0, rowsWritten: 0 };
		}

		const data = await response.json();
		console.log('[getDatabaseAnalytics] Raw response:', JSON.stringify(data, null, 2));
		
		if (data.errors) {
			console.error('[getDatabaseAnalytics] GraphQL errors:', data.errors);
			return { readQueries: 0, writeQueries: 0, rowsRead: 0, rowsWritten: 0 };
		}
		
		const groups = data?.data?.viewer?.accounts?.[0]?.d1AnalyticsAdaptiveGroups || [];
		
		if (groups.length === 0) {
			console.warn('[getDatabaseAnalytics] No analytics data found');
			return { readQueries: 0, writeQueries: 0, rowsRead: 0, rowsWritten: 0 };
		}
		
		// Sum up all metrics across all groups
		let totalReadQueries = 0;
		let totalWriteQueries = 0;
		let totalRowsRead = 0;
		let totalRowsWritten = 0;
		
		for (const group of groups) {
			totalReadQueries += group.sum?.readQueries || 0;
			totalWriteQueries += group.sum?.writeQueries || 0;
			totalRowsRead += group.sum?.rowsRead || 0;
			totalRowsWritten += group.sum?.rowsWritten || 0;
		}

		console.log('[getDatabaseAnalytics] Totals:', {
			readQueries: totalReadQueries,
			writeQueries: totalWriteQueries,
			rowsRead: totalRowsRead,
			rowsWritten: totalRowsWritten,
			groupsCount: groups.length
		});

		return {
			readQueries: totalReadQueries,
			writeQueries: totalWriteQueries,
			rowsRead: totalRowsRead,
			rowsWritten: totalRowsWritten
		};
	} catch (err) {
		console.error('[getDatabaseAnalytics] Error:', err);
		return { readQueries: 0, writeQueries: 0, rowsRead: 0, rowsWritten: 0 };
	}
});

// Execute a SQL query
export const executeQuery = guardedForm(
	v.object({
		sql: v.pipe(v.string(), v.nonEmpty()),
		databaseId: v.pipe(v.string(), v.nonEmpty()),
	}),
	async ({ sql, databaseId }) => {
		try {
			// Get database token
			const { orm: adminOrm } = await database.admin();
			const { data: tokens } = await adminOrm.dbApiTokens
				.where({ 
					databaseId: { eq: databaseId },
					revoked: { eq: false },
					deleted_at: { is: null }
				})
				.many();
			
			if (!tokens || tokens.length === 0) {
				error(404, 'Database token not found');
			}

			// Import organization schema for connection
			const { organizationSchema } = await import('$lib/schemas/organization');

			// Execute query
			const { query: dbQuery } = await database.instance().connect({
				databaseName: databaseId,
				dbToken: tokens[0].token,
				gatewayKey: process.env.KURATCHI_GATEWAY_KEY!,
				schema: organizationSchema
			});

			const queryResult = await dbQuery(sql);

			return { success: true, results: queryResult.results || [] };
		} catch (err) {
			console.error('Error executing query:', err);
			error(500, 'Failed to execute query');
		}
	}
);
