import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateApiRequest } from '$lib/server/api-auth';

/**
 * Permissions API Endpoints
 * Base path: /api/v1/platform/permissions
 * 
 * Endpoints:
 * - GET    /permissions - List all permissions
 * - POST   /permissions - Create a new permission
 * - PATCH  /permissions/:id - Update permission (handled in [id]/+server.ts)
 * - DELETE /permissions/:id - Archive permission (handled in [id]/+server.ts)
 * 
 * Authentication: Requires platform API key via x-api-key header or Authorization: Bearer <key>
 */

/**
 * GET /api/v1/platform/permissions
 * List all permissions with optional filtering
 * 
 * Query Parameters:
 * - category: Filter by category (auth, users, content, etc.)
 * - includeArchived: Include archived permissions (default: false)
 * 
 * Example:
 * GET /api/v1/platform/permissions?category=content&includeArchived=true
 */
export const GET: RequestHandler = async (event) => {
	try {
		// Authenticate the request
		await authenticateApiRequest(event);
		
		// Get query parameters
		const url = new URL(event.request.url);
		const category = url.searchParams.get('category');
		const includeArchived = url.searchParams.get('includeArchived') === 'true';
		
		// Get permissions from plugin
		const permissions = await (event.locals.kuratchi as any)?.roles?.getAllPermissions?.('admin') ?? [];
		
		// Filter by category if specified
		let filtered = permissions;
		if (category) {
			filtered = permissions.filter((p: any) => p.category === category);
		}
		
		// Filter out archived unless requested
		if (!includeArchived) {
			filtered = filtered.filter((p: any) => !p.isArchived);
		}
		
		return json({
			success: true,
			data: filtered,
			count: filtered.length,
			meta: {
				category: category || null,
				includeArchived
			}
		});
	} catch (err: any) {
		console.error('[Platform API] Error listing permissions:', err);
		return json(
			{ success: false, error: err.message || 'Failed to list permissions' },
			{ status: err.status || 500 }
		);
	}
};

/**
 * POST /api/v1/platform/permissions
 * Create a new permission
 * 
 * Request Body:
 * {
 *   "value": "posts.create",
 *   "label": "Create Posts",
 *   "description": "Ability to create new posts",
 *   "category": "content"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "uuid",
 *     "value": "posts.create",
 *     "label": "Create Posts",
 *     "description": "Ability to create new posts",
 *     "category": "content",
 *     "created_at": "2024-01-01T00:00:00.000Z"
 *   },
 *   "message": "Permission created successfully"
 * }
 */
export const POST: RequestHandler = async (event) => {
	try {
		// Authenticate the request
		await authenticateApiRequest(event);
		
		// Parse request body
		const body = await event.request.json();
		const { value, label, description, category } = body;
		
		// Validate required fields
		if (!value) {
			return json(
				{ success: false, error: 'Permission value is required' },
				{ status: 400 }
			);
		}
		
		// Create permission using plugin
		const result = await (event.locals.kuratchi as any)?.roles?.createPermission?.(
			{ value, label, description, category },
			'admin'
		);
		
		return json({
			success: true,
			data: result,
			message: 'Permission created successfully'
		}, { status: 201 });
	} catch (err: any) {
		console.error('[Platform API] Error creating permission:', err);
		return json(
			{ success: false, error: err.message || 'Failed to create permission' },
			{ status: err.status || 500 }
		);
	}
};
