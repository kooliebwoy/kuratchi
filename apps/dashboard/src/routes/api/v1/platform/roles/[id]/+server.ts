import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateApiRequest } from '$lib/server/api-auth';

/**
 * Role Detail API Endpoints
 * Base path: /api/v1/platform/roles/:id
 * 
 * Endpoints:
 * - GET    /:id - Get role details
 * - PATCH  /:id - Update role
 * - DELETE /:id - Archive role
 */

/**
 * GET /api/v1/platform/roles/:id
 * Get detailed information about a specific role
 * 
 * Query Parameters:
 * - includePermissions: Include permission objects (default: false)
 * - includeOrganizations: Include organization objects (default: false)
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
		
		// Get query parameters
		const url = new URL(event.request.url);
		const includePermissions = url.searchParams.get('includePermissions') === 'true';
		const includeOrganizations = url.searchParams.get('includeOrganizations') === 'true';
		
		// Get all roles and find the one we want
		const roles = await (event.locals.kuratchi as any)?.roles?.getAllRoles?.('admin') ?? [];
		const role = roles.find((r: any) => r.id === id);
		
		if (!role) {
			return json(
				{ success: false, error: 'Role not found' },
				{ status: 404 }
			);
		}
		
		// Enhance with permissions if requested
		if (includePermissions) {
			const rolePermissions = await (event.locals.kuratchi as any)?.roles?.getRolePermissions?.('admin') ?? { roles: [], permissions: [], byRole: {} };
			role.permissionObjects = rolePermissions.byRole[id] || [];
		}
		
		// Enhance with organizations if requested
		if (includeOrganizations) {
			const attachments = await (event.locals.kuratchi as any)?.roles?.getRoleAttachments?.('admin') ?? { roles: [], organizations: [], attachments: {} };
			role.organizations = attachments.attachments[id] || [];
		}
		
		return json({
			success: true,
			data: role
		});
	} catch (err: any) {
		console.error('[Platform API] Error getting role:', err);
		return json(
			{ success: false, error: err.message || 'Failed to get role' },
			{ status: err.status || 500 }
		);
	}
};

/**
 * PATCH /api/v1/platform/roles/:id
 * Update role details
 * 
 * Request Body:
 * {
 *   "name": "editor",
 *   "description": "Updated description",
 *   "permissions": [...]
 * }
 */
export const PATCH: RequestHandler = async (event) => {
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
		
		// Parse request body
		const body = await event.request.json();
		
		// Normalize permissions if provided
		const normalizePermissions = (input: any): { value: string; label?: string; description?: string }[] => {
			let arr: any[] = [];
			if (typeof input === 'string') {
				try { arr = JSON.parse(input); } catch { arr = []; }
			} else if (Array.isArray(input)) {
				arr = input;
			} else if (typeof input === 'object' && input) {
				arr = [input];
			}
			return arr
				.map((p) => (typeof p === 'string' ? { value: p } : { value: p.value, label: p.label, description: p.description }))
				.filter((p) => typeof p.value === 'string' && p.value.length > 0);
		};
		
		const updateData: any = {};
		if (body.name !== undefined) updateData.name = body.name;
		if (body.description !== undefined) updateData.description = body.description;
		if (body.permissions !== undefined) updateData.permissions = normalizePermissions(body.permissions);
		
		// Update role using plugin
		const result = await (event.locals.kuratchi as any)?.roles?.updateRole?.(id, updateData, 'admin');
		
		return json({
			success: true,
			data: result,
			message: 'Role updated successfully'
		});
	} catch (err: any) {
		console.error('[Platform API] Error updating role:', err);
		return json(
			{ success: false, error: err.message || 'Failed to update role' },
			{ status: err.status || 500 }
		);
	}
};

/**
 * DELETE /api/v1/platform/roles/:id
 * Archive a role (soft delete)
 */
export const DELETE: RequestHandler = async (event) => {
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
		
		// Archive role using plugin
		await (event.locals.kuratchi as any)?.roles?.archiveRole?.(id, 'admin');
		
		return json({
			success: true,
			message: 'Role archived successfully'
		});
	} catch (err: any) {
		console.error('[Platform API] Error archiving role:', err);
		return json(
			{ success: false, error: err.message || 'Failed to archive role' },
			{ status: err.status || 500 }
		);
	}
};
