import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateApiRequest } from '$lib/server/api-auth';

/**
 * Role-Organization Association API Endpoints
 * Base path: /api/v1/platform/roles/:id/organizations
 * 
 * Endpoints:
 * - GET  /:id/organizations - Get all organizations for a role
 * - POST /:id/organizations - Attach role to organization
 */

/**
 * GET /api/v1/platform/roles/:id/organizations
 * Get all organizations that have this role assigned
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
		
		// Get role attachments
		const attachments = await (event.locals.kuratchi as any)?.roles?.getRoleAttachments?.('admin') ?? { roles: [], organizations: [], attachments: {} };
		const organizations = attachments.attachments[id] || [];
		
		return json({
			success: true,
			data: organizations,
			count: organizations.length
		});
	} catch (err: any) {
		console.error('[Platform API] Error getting role organizations:', err);
		return json(
			{ success: false, error: err.message || 'Failed to get role organizations' },
			{ status: err.status || 500 }
		);
	}
};

/**
 * POST /api/v1/platform/roles/:id/organizations
 * Attach a role to an organization
 * 
 * Request Body:
 * {
 *   "organizationId": "org-uuid"
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
		const { organizationId } = body;
		
		if (!organizationId) {
			return json(
				{ success: false, error: 'Organization ID is required' },
				{ status: 400 }
			);
		}
		
		// Attach role to organization using plugin
		await (event.locals.kuratchi as any)?.roles?.attachRoleToOrganization?.(roleId, organizationId, 'admin');
		
		return json({
			success: true,
			message: 'Role attached to organization successfully'
		}, { status: 201 });
	} catch (err: any) {
		console.error('[Platform API] Error attaching role to organization:', err);
		return json(
			{ success: false, error: err.message || 'Failed to attach role to organization' },
			{ status: err.status || 500 }
		);
	}
};
