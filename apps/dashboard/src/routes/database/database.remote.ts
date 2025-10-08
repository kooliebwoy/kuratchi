import { getRequestEvent, query, form } from '$app/server';
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
		const { orm } = await database.admin();
		let result: any;
		if (activeOrgId) {
			result = await orm.databases
				.many();
		} else {
			// Superadmin with no org selected: list all
			result = await orm.databases.many();
		}
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
			// Import organization schema
			const { organizationSchema } = await import('$lib/schemas/organization');

			// Create database name (system-level or org-level)
			const dbName = activeOrgId && activeOrgId !== 'admin' 
				? `org-${activeOrgId}-${name}` 
				: `sys-${name}`;

			// Create the database
			const created = await database.create({
				name: dbName,
				migrate: true,
				schema: organizationSchema
			});

			console.log('database created: ', created);

			// Store database info in admin DB using ORM
			const { orm: adminOrm } = await database.admin();
			const now = new Date().toISOString();
			const dbId = crypto.randomUUID();
			
			// organizationId can be null for system-level databases
			const orgId = activeOrgId && activeOrgId !== 'admin' ? activeOrgId : null;
			
			const newDB = await adminOrm.databases.insert({
				id: dbId,
				name: created.databaseName,
				dbuuid: created.databaseName,
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
