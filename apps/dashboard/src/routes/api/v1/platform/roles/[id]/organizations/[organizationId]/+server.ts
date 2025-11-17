import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateApiRequest } from '$lib/server/api-auth';

/**
 * Role-Organization Detachment API Endpoint
 * Base path: /api/v1/platform/roles/:id/organizations/:organizationId
 * 
 * Endpoints:
 * - DELETE /:id/organizations/:organizationId - Detach role from organization
 */

/**
 * DELETE /api/v1/platform/roles/:id/organizations/:organizationId
 * Detach a role from an organization
 */
export const DELETE: RequestHandler = async (event) => {
	try {
		// Authenticate the request
		await authenticateApiRequest(event);
		
		const { id: roleId, organizationId } = event.params;
		
		if (!roleId) {
			return json(
				{ success: false, error: 'Role ID is required' },
				{ status: 400 }
			);
		}
		
		if (!organizationId) {
			return json(
				{ success: false, error: 'Organization ID is required' },
				{ status: 400 }
			);
		}
		
		// Detach role from organization using plugin
		await (event.locals.kuratchi as any)?.roles?.detachRoleFromOrganization?.(roleId, organizationId, 'admin');
		
		return json({
			success: true,
			message: 'Role detached from organization successfully'
		});
	} catch (err: any) {
		console.error('[Platform API] Error detaching role from organization:', err);
		return json(
			{ success: false, error: err.message || 'Failed to detach role from organization' },
			{ status: err.status || 500 }
		);
	}
};
