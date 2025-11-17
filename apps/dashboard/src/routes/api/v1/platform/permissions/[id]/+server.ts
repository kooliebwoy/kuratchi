import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateApiRequest } from '$lib/server/api-auth';

/**
 * Permission Detail API Endpoints
 * Base path: /api/v1/platform/permissions/:id
 * 
 * Endpoints:
 * - GET    /:id - Get permission details
 * - PATCH  /:id - Update permission
 * - DELETE /:id - Archive permission
 */

/**
 * GET /api/v1/platform/permissions/:id
 * Get detailed information about a specific permission
 */
export const GET: RequestHandler = async (event) => {
	try {
		// Authenticate the request
		await authenticateApiRequest(event);
		
		const { id } = event.params;
		
		if (!id) {
			return json(
				{ success: false, error: 'Permission ID is required' },
				{ status: 400 }
			);
		}
		
		// Get all permissions and find the one we want
		const permissions = await (event.locals.kuratchi as any)?.roles?.getAllPermissions?.('admin') ?? [];
		const permission = permissions.find((p: any) => p.id === id);
		
		if (!permission) {
			return json(
				{ success: false, error: 'Permission not found' },
				{ status: 404 }
			);
		}
		
		return json({
			success: true,
			data: permission
		});
	} catch (err: any) {
		console.error('[Platform API] Error getting permission:', err);
		return json(
			{ success: false, error: err.message || 'Failed to get permission' },
			{ status: err.status || 500 }
		);
	}
};

/**
 * PATCH /api/v1/platform/permissions/:id
 * Update permission details
 * 
 * Request Body:
 * {
 *   "value": "posts.create",
 *   "label": "Create Posts",
 *   "description": "Updated description",
 *   "category": "content"
 * }
 */
export const PATCH: RequestHandler = async (event) => {
	try {
		// Authenticate the request
		await authenticateApiRequest(event);
		
		const { id } = event.params;
		
		if (!id) {
			return json(
				{ success: false, error: 'Permission ID is required' },
				{ status: 400 }
			);
		}
		
		// Parse request body
		const body = await event.request.json();
		
		// Update permission using plugin
		const result = await (event.locals.kuratchi as any)?.roles?.updatePermission?.(id, body, 'admin');
		
		return json({
			success: true,
			data: result,
			message: 'Permission updated successfully'
		});
	} catch (err: any) {
		console.error('[Platform API] Error updating permission:', err);
		return json(
			{ success: false, error: err.message || 'Failed to update permission' },
			{ status: err.status || 500 }
		);
	}
};

/**
 * DELETE /api/v1/platform/permissions/:id
 * Archive a permission (soft delete)
 */
export const DELETE: RequestHandler = async (event) => {
	try {
		// Authenticate the request
		await authenticateApiRequest(event);
		
		const { id } = event.params;
		
		if (!id) {
			return json(
				{ success: false, error: 'Permission ID is required' },
				{ status: 400 }
			);
		}
		
		// Archive permission using plugin
		await (event.locals.kuratchi as any)?.roles?.archivePermission?.(id, 'admin');
		
		return json({
			success: true,
			message: 'Permission archived successfully'
		});
	} catch (err: any) {
		console.error('[Platform API] Error archiving permission:', err);
		return json(
			{ success: false, error: err.message || 'Failed to archive permission' },
			{ status: err.status || 500 }
		);
	}
};
