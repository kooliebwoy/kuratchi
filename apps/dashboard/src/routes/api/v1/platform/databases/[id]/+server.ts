import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateApiRequest } from '$lib/server/api-auth';
import { database } from 'kuratchi-sdk';
import { env } from '$env/dynamic/private';

/**
 * Database Detail API Endpoints
 * Base path: /api/v1/platform/databases/:id
 * 
 * Endpoints:
 * - GET /:id - Get database details
 * - PATCH /:id - Update database details
 * - GET /:id/analytics - Get database analytics
 */

/**
 * GET /api/v1/platform/databases/:id
 * Get detailed information about a specific database
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "uuid",
 *     "name": "database-name",
 *     "dbuuid": "cloudflare-d1-id",
 *     "organizationId": "org-123",
 *     "isActive": true,
 *     "isArchived": false,
 *     "schemaVersion": 1,
 *     "created_at": "2024-01-01T00:00:00.000Z",
 *     "updated_at": "2024-01-01T00:00:00.000Z"
 *   }
 * }
 */
export const GET: RequestHandler = async (event) => {
	try {
		// Authenticate the request
		const auth = await authenticateApiRequest(event);
		
		const { id } = event.params;
		
		if (!id) {
			return json(
				{ success: false, error: 'Database ID is required' },
				{ status: 400 }
			);
		}
		
		// Get database from admin DB
		const { orm } = await database.admin();
		const result = await orm.databases
			.where({ id: { eq: id } })
			.first();
		
		if (!result?.data) {
			return json(
				{ success: false, error: 'Database not found' },
				{ status: 404 }
			);
		}
		
		return json({
			success: true,
			data: result.data
		});
	} catch (err: any) {
		console.error('[Platform API] Error getting database:', err);
		return json(
			{ success: false, error: err.message || 'Failed to get database' },
			{ status: err.status || 500 }
		);
	}
};

/**
 * PATCH /api/v1/platform/databases/:id
 * Update database details
 * 
 * Request Body:
 * {
 *   "isActive": true,
 *   "isArchived": false,
 *   "needsSchemaUpdate": false
 * }
 */
export const PATCH: RequestHandler = async (event) => {
	try {
		// Authenticate the request
		const auth = await authenticateApiRequest(event);
		
		const { id } = event.params;
		
		if (!id) {
			return json(
				{ success: false, error: 'Database ID is required' },
				{ status: 400 }
			);
		}
		
		// Parse request body
		const body = await event.request.json();
		const allowedFields = ['isActive', 'isArchived', 'needsSchemaUpdate', 'schemaVersion'];
		
		// Filter to only allowed fields
		const updates: any = {};
		for (const field of allowedFields) {
			if (field in body) {
				updates[field] = body[field];
			}
		}
		
		if (Object.keys(updates).length === 0) {
			return json(
				{ success: false, error: 'No valid fields to update' },
				{ status: 400 }
			);
		}
		
		// Add updated_at timestamp
		updates.updated_at = new Date().toISOString();
		
		// Update database
		const { orm } = await database.admin();
		const result = await orm.databases
			.where({ id: { eq: id } })
			.update(updates);
		
		if (!result.success) {
			return json(
				{ success: false, error: 'Failed to update database' },
				{ status: 500 }
			);
		}
		
		// Get updated database
		const updated = await orm.databases
			.where({ id: { eq: id } })
			.first();
		
		return json({
			success: true,
			data: updated?.data,
			message: 'Database updated successfully'
		});
	} catch (err: any) {
		console.error('[Platform API] Error updating database:', err);
		return json(
			{ success: false, error: err.message || 'Failed to update database' },
			{ status: err.status || 500 }
		);
	}
};
