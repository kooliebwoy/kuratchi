import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateApiRequest } from '$lib/server/api-auth';

/**
 * Role-Permission Association API Endpoints
 * Base path: /api/v1/platform/roles/:id/permissions
 * 
 * Endpoints:
 * - GET  /:id/permissions - Get all permissions for a role
 * - POST /:id/permissions - Attach permission to role
 */

/**
 * GET /api/v1/platform/roles/:id/permissions
 * Get all permissions assigned to a role
 */
export const GET: RequestHandler = async (event) => {
	try {
		// Authenticate the request
		await authenticateApiRequest(event);
		
		const { id } = event.params;
		
		if (!id) {
			return json(
				{ success: false, error: 'Role ID is required' },
				{ status: 400 }
			);
		}
		
		// Get role permissions
		const rolePermissions = await (event.locals.kuratchi as any)?.roles?.getRolePermissions?.('admin') ?? { roles: [], permissions: [], byRole: {} };
		const permissions = rolePermissions.byRole[id] || [];
		
		return json({
			success: true,
			data: permissions,
			count: permissions.length
		});
	} catch (err: any) {
		console.error('[Platform API] Error getting role permissions:', err);
		return json(
			{ success: false, error: err.message || 'Failed to get role permissions' },
			{ status: err.status || 500 }
		);
	}
};

/**
 * POST /api/v1/platform/roles/:id/permissions
 * Attach a permission to a role
 * 
 * Request Body:
 * {
 *   "permissionId": "perm-uuid"
 * }
 */
export const POST: RequestHandler = async (event) => {
	try {
		// Authenticate the request
		await authenticateApiRequest(event);
		
		const { id: roleId } = event.params;
		
		if (!roleId) {
			return json(
				{ success: false, error: 'Role ID is required' },
				{ status: 400 }
			);
		}
		
		// Parse request body
		const body = await event.request.json();
		const { permissionId } = body;
		
		if (!permissionId) {
			return json(
				{ success: false, error: 'Permission ID is required' },
				{ status: 400 }
			);
		}
		
		// Attach permission to role using plugin
		await (event.locals.kuratchi as any)?.roles?.attachPermissionToRole?.(roleId, permissionId, 'admin');
		
		return json({
			success: true,
			message: 'Permission attached to role successfully'
		}, { status: 201 });
	} catch (err: any) {
		console.error('[Platform API] Error attaching permission to role:', err);
		return json(
			{ success: false, error: err.message || 'Failed to attach permission to role' },
			{ status: err.status || 500 }
		);
	}
};
