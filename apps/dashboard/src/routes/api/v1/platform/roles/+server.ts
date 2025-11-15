import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateApiRequest } from '$lib/server/api-auth';

/**
 * Roles API Endpoints
 * Base path: /api/v1/platform/roles
 * 
 * Endpoints:
 * - GET  /roles - List all roles
 * - POST /roles - Create a new role
 * 
 * Authentication: Requires platform API key via x-api-key header or Authorization: Bearer <key>
 */

/**
 * GET /api/v1/platform/roles
 * List all roles with optional filtering
 * 
 * Query Parameters:
 * - organizationId: Filter by organization ID
 * - includeArchived: Include archived roles (default: false)
 * - includePermissions: Include permission objects (default: false)
 * 
 * Example:
 * GET /api/v1/platform/roles?organizationId=org-123&includePermissions=true
 */
export const GET: RequestHandler = async (event) => {
	try {
		// Authenticate the request
		await authenticateApiRequest(event);
		
		// Get query parameters
		const url = new URL(event.request.url);
		const organizationId = url.searchParams.get('organizationId');
		const includeArchived = url.searchParams.get('includeArchived') === 'true';
		const includePermissions = url.searchParams.get('includePermissions') === 'true';
		
		// Get roles from plugin
		const roles = await (event.locals.kuratchi as any)?.roles?.getAllRoles?.('admin') ?? [];
		
		// Filter out archived unless requested
		let filtered = roles;
		if (!includeArchived) {
			filtered = roles.filter((r: any) => !r.isArchived);
		}
		
		// Filter by organization if specified
		if (organizationId) {
			const attachments = await (event.locals.kuratchi as any)?.roles?.getRoleAttachments?.('admin') ?? { roles: [], organizations: [], attachments: {} };
			const roleIds = Object.entries(attachments.attachments)
				.filter(([_, orgs]: [string, any]) => orgs.includes(organizationId))
				.map(([roleId, _]) => roleId);
			
			filtered = filtered.filter((r: any) => roleIds.includes(r.id));
		}
		
		// Include permissions if requested
		if (includePermissions) {
			const rolePermissions = await (event.locals.kuratchi as any)?.roles?.getRolePermissions?.('admin') ?? { roles: [], permissions: [], byRole: {} };
			filtered = filtered.map((role: any) => ({
				...role,
				permissionObjects: rolePermissions.byRole[role.id] || []
			}));
		}
		
		return json({
			success: true,
			data: filtered,
			count: filtered.length,
			meta: {
				organizationId: organizationId || null,
				includeArchived,
				includePermissions
			}
		});
	} catch (err: any) {
		console.error('[Platform API] Error listing roles:', err);
		return json(
			{ success: false, error: err.message || 'Failed to list roles' },
			{ status: err.status || 500 }
		);
	}
};

/**
 * POST /api/v1/platform/roles
 * Create a new role
 * 
 * Request Body:
 * {
 *   "name": "editor",
 *   "description": "Content editor role",
 *   "permissions": [
 *     { "value": "posts.create", "label": "Create Posts" },
 *     { "value": "posts.edit", "label": "Edit Posts" }
 *   ]
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "uuid",
 *     "name": "editor",
 *     "description": "Content editor role",
 *     "permissions": [...],
 *     "created_at": "2024-01-01T00:00:00.000Z"
 *   },
 *   "message": "Role created successfully"
 * }
 */
export const POST: RequestHandler = async (event) => {
	try {
		// Authenticate the request
		await authenticateApiRequest(event);
		
		// Parse request body
		const body = await event.request.json();
		const { name, description, permissions } = body;
		
		// Validate required fields
		if (!name) {
			return json(
				{ success: false, error: 'Role name is required' },
				{ status: 400 }
			);
		}
		
		// Normalize permissions
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
		
		const perms = normalizePermissions(permissions ?? []);
		
		// Create role using plugin
		const result = await (event.locals.kuratchi as any)?.roles?.createRole?.({ name, description, permissions: perms }, 'admin');
		
		return json({
			success: true,
			data: result,
			message: 'Role created successfully'
		}, { status: 201 });
	} catch (err: any) {
		console.error('[Platform API] Error creating role:', err);
		return json(
			{ success: false, error: err.message || 'Failed to create role' },
			{ status: err.status || 500 }
		);
	}
};
