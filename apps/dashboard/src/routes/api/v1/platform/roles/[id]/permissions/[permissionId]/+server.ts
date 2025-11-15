import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateApiRequest } from '$lib/server/api-auth';

/**
 * Role-Permission Detachment API Endpoint
 * Base path: /api/v1/platform/roles/:id/permissions/:permissionId
 * 
 * Endpoints:
 * - DELETE /:id/permissions/:permissionId - Detach permission from role
 */

/**
 * DELETE /api/v1/platform/roles/:id/permissions/:permissionId
 * Detach a permission from a role
 */
export const DELETE: RequestHandler = async (event) => {
	try {
		// Authenticate the request
		await authenticateApiRequest(event);
		
		const { id: roleId, permissionId } = event.params;
		
		if (!roleId) {
			return json(
				{ success: false, error: 'Role ID is required' },
				{ status: 400 }
			);
		}
		
		if (!permissionId) {
			return json(
				{ success: false, error: 'Permission ID is required' },
				{ status: 400 }
			);
		}
		
		// Detach permission from role using plugin
		await (event.locals.kuratchi as any)?.roles?.detachPermissionFromRole?.(roleId, permissionId, 'admin');
		
		return json({
			success: true,
			message: 'Permission detached from role successfully'
		});
	} catch (err: any) {
		console.error('[Platform API] Error detaching permission from role:', err);
		return json(
			{ success: false, error: err.message || 'Failed to detach permission from role' },
			{ status: err.status || 500 }
		);
	}
};
