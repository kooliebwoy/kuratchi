import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateApiRequest } from '$lib/server/api-auth';
import { database } from 'kuratchi-sdk';
import * as v from 'valibot';

/**
 * Platform API Endpoints
 * Base path: /api/v1/platform
 * 
 * Endpoints:
 * - GET /databases - List all databases
 * - POST /databases - Create a new database
 * - DELETE /databases - Delete a database
 * 
 * Authentication: Requires platform API key via x-api-key header or Authorization: Bearer <key>
 */

// Validation schemas
const createDatabaseSchema = v.object({
	name: v.pipe(v.string(), v.nonEmpty(), v.regex(/^[a-z0-9-]+$/)),
	description: v.pipe(v.string(), v.nonEmpty()),
	organizationId: v.optional(v.string())
});

const deleteDatabaseSchema = v.object({
	id: v.pipe(v.string(), v.nonEmpty())
});

/**
 * GET /api/v1/platform/databases
 * List all databases (platform-wide or filtered by organization)
 * 
 * Query Parameters:
 * - organizationId: Filter by organization ID
 * - includeArchived: Include archived databases (default: false)
 * 
 * Example:
 * GET /api/v1/platform/databases?organizationId=org-123&includeArchived=true
 */
export const GET: RequestHandler = async (event) => {
	try {
		// Authenticate the request
		const auth = await authenticateApiRequest(event);
		
		// Get query parameters
		const url = new URL(event.request.url);
		const organizationId = url.searchParams.get('organizationId');
		const includeArchived = url.searchParams.get('includeArchived') === 'true';
		
		// Get databases from admin DB
		const { orm } = await database.admin();
		
		let query = orm.databases;
		
		// Filter by organization if specified
		if (organizationId) {
			query = query.where({ organizationId: { eq: organizationId } });
		}
		
		// Filter out archived unless requested
		if (!includeArchived) {
			query = query.where({ isArchived: { eq: false } });
		}
		
		const result = await query.many();
		const databases = result?.data || result || [];
		
		return json({
			success: true,
			data: databases,
			count: databases.length,
			meta: {
				organizationId: organizationId || null,
				includeArchived
			}
		});
	} catch (err: any) {
		console.error('[Platform API] Error listing databases:', err);
		return json(
			{ success: false, error: err.message || 'Failed to list databases' },
			{ status: err.status || 500 }
		);
	}
};

/**
 * POST /api/v1/platform/databases
 * Create a new database
 * 
 * Request Body:
 * {
 *   "name": "my-database",
 *   "description": "My database description",
 *   "organizationId": "org-123" (optional)
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "uuid",
 *     "name": "org-123-my-database",
 *     "databaseId": "cloudflare-d1-id",
 *     "workerName": "worker-name",
 *     "organizationId": "org-123",
 *     "created_at": "2024-01-01T00:00:00.000Z"
 *   },
 *   "message": "Database created successfully"
 * }
 */
export const POST: RequestHandler = async (event) => {
	try {
		// Authenticate the request
		const auth = await authenticateApiRequest(event);
		
		// Parse and validate request body
		const body = await event.request.json();
		const validation = v.safeParse(createDatabaseSchema, body);
		
		if (!validation.success) {
			return json(
				{ 
					success: false, 
					error: 'Validation failed',
					issues: validation.issues.map((issue: any) => ({
						field: issue.path?.map((p: any) => p.key).join('.'),
						message: issue.message
					}))
				},
				{ status: 400 }
			);
		}
		
		const { name, description, organizationId } = validation.output;
		
		// Create database name (system-level or org-level)
		const dbName = organizationId && organizationId !== 'admin' 
			? `org-${organizationId}-${name}` 
			: `sys-${name}`;
		
		// Create the database
		const created = await database.create({
			name: dbName,
			migrate: false
		});
		
		console.log('[Platform API] D1 database created:', {
			databaseName: created.databaseName,
			databaseId: created.databaseId,
			workerName: created.workerName
		});
		
		// Store database info in admin DB
		const { orm: adminOrm } = await database.admin();
		const now = new Date().toISOString();
		const dbId = crypto.randomUUID();
		
		// organizationId can be null for system-level databases
		const orgId = organizationId && organizationId !== 'admin' ? organizationId : null;
		
		const newDB = await adminOrm.databases.insert({
			id: dbId,
			name: created.databaseName,
			dbuuid: created.databaseId || created.databaseName,
			organizationId: orgId,
			isArchived: false,
			isActive: true,
			schemaVersion: 1,
			needsSchemaUpdate: false,
			created_at: now,
			updated_at: now,
			deleted_at: null
		});
		
		if (!newDB.success) {
			console.error('[Platform API] Failed to insert database:', newDB.error);
			return json(
				{ success: false, error: `Failed to create database: ${newDB.error}` },
				{ status: 500 }
			);
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
			console.error('[Platform API] Failed to insert database token:', dbApiToken.error);
			return json(
				{ success: false, error: `Failed to create database token: ${dbApiToken.error}` },
				{ status: 500 }
			);
		}
		
		return json({
			success: true,
			data: {
				id: dbId,
				name: created.databaseName,
				databaseId: created.databaseId,
				workerName: created.workerName,
				organizationId: orgId,
				created_at: now
			},
			message: 'Database created successfully'
		}, { status: 201 });
	} catch (err: any) {
		console.error('[Platform API] Error creating database:', err);
		return json(
			{ success: false, error: err.message || 'Failed to create database' },
			{ status: err.status || 500 }
		);
	}
};

/**
 * DELETE /api/v1/platform/databases
 * Delete a database (soft delete by default, hard delete with ?hard=true)
 * 
 * Query Parameters:
 * - hard: If true, permanently delete from Cloudflare (default: false)
 * 
 * Request Body:
 * {
 *   "id": "database-uuid"
 * }
 * 
 * Soft Delete (default):
 * - Marks database as archived
 * - Sets isActive to false
 * - Sets deleted_at timestamp
 * - Database remains in admin DB
 * 
 * Hard Delete (?hard=true):
 * - Deletes D1 database from Cloudflare
 * - Removes all tokens
 * - Removes database record from admin DB
 * 
 * Example:
 * DELETE /api/v1/platform/databases?hard=true
 * Body: { "id": "uuid" }
 */
export const DELETE: RequestHandler = async (event) => {
	try {
		// Authenticate the request
		const auth = await authenticateApiRequest(event);
		
		// Parse and validate request body
		const body = await event.request.json();
		const validation = v.safeParse(deleteDatabaseSchema, body);
		
		if (!validation.success) {
			return json(
				{ 
					success: false, 
					error: 'Validation failed',
					issues: validation.issues.map((issue: any) => ({
						field: issue.path?.map((p: any) => p.key).join('.'),
						message: issue.message
					}))
				},
				{ status: 400 }
			);
		}
		
		const { id } = validation.output;
		const url = new URL(event.request.url);
		const hardDelete = url.searchParams.get('hard') === 'true';
		
		const { orm: adminOrm } = await database.admin();
		
		// Get the database record
		const dbRecord = await adminOrm.databases
			.where({ id: { eq: id } })
			.first();
		
		if (!dbRecord?.data) {
			return json(
				{ success: false, error: 'Database not found' },
				{ status: 404 }
			);
		}
		
		if (hardDelete) {
			// Hard delete: Remove from Cloudflare and database
			try {
				// Delete the D1 database from Cloudflare
				await database.delete({
					databaseName: dbRecord.data.name
				});
				
				// Delete tokens
				await adminOrm.dbApiTokens
					.where({ databaseId: { eq: id } })
					.delete();
				
				// Delete database record
				await adminOrm.databases
					.where({ id: { eq: id } })
					.delete();
				
				return json({
					success: true,
					message: 'Database permanently deleted',
					data: {
						id,
						name: dbRecord.data.name,
						deletedAt: new Date().toISOString()
					}
				});
			} catch (err: any) {
				console.error('[Platform API] Error hard deleting database:', err);
				return json(
					{ success: false, error: 'Failed to delete database from Cloudflare' },
					{ status: 500 }
				);
			}
		} else {
			// Soft delete: Mark as archived
			const now = new Date().toISOString();
			const result = await adminOrm.databases
				.where({ id: { eq: id } })
				.update({
					isArchived: true,
					isActive: false,
					deleted_at: now,
					updated_at: now
				});
			
			if (!result.success) {
				return json(
					{ success: false, error: 'Failed to archive database' },
					{ status: 500 }
				);
			}
			
			return json({
				success: true,
				message: 'Database archived successfully',
				data: {
					id,
					name: dbRecord.data.name,
					archivedAt: now
				}
			});
		}
	} catch (err: any) {
		console.error('[Platform API] Error deleting database:', err);
		return json(
			{ success: false, error: err.message || 'Failed to delete database' },
			{ status: err.status || 500 }
		);
	}
};
