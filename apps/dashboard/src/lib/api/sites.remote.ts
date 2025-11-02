import { getRequestEvent, query, form } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';

// Guarded query helper
const guardedQuery = <R>(fn: () => Promise<R>) => {
	return query(async () => {
		const { locals: { session } } = getRequestEvent();
		if (!session?.user) error(401, 'Unauthorized');

		return fn();
	});
};

// Guarded form helper - using unchecked validation
const guardedForm = <R>(
	schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
	fn: (data: any) => Promise<R>
) => {
	return form('unchecked', async (data: any) => {
		const { locals: { session } } = getRequestEvent();
		if (!session?.user) error(401, 'Unauthorized');

		// Validate with valibot
		const result = v.safeParse(schema, data);
		if (!result.success) {
			error(400, 'Validation failed');
		}

		return fn(result.output);
	});
};

// Log route activity
export const logRouteActivity = guardedQuery(async () => {
	// TODO: Implement activity logging
	console.log('Sites route accessed');
});

// Get all sites for the organization
export const getSites = guardedQuery(async () => {
	const { locals } = getRequestEvent();
	const session = locals.session;
	const activeOrgId = locals?.kuratchi?.superadmin?.getActiveOrgId?.() || session?.organizationId;
	
	try {
		// TODO: Implement actual database query when sites table is created
		// For now, return mock data for UI development
		const mockSites = [
			{
				id: '1',
				name: 'My Portfolio',
				subdomain: 'portfolio',
				description: 'Personal portfolio website',
				theme: 'minimal',
				created_at: new Date().toISOString(),
				organizationId: activeOrgId
			},
			{
				id: '2',
				name: 'Company Blog',
				subdomain: 'blog',
				description: 'Company news and updates',
				theme: 'modern',
				created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
				organizationId: activeOrgId
			}
		];

		console.log('[getSites] activeOrgId:', activeOrgId, 'count:', mockSites.length);
		
		return mockSites;
	} catch (err) {
		console.error('Error fetching sites:', err);
		return [];
	}
});

// Get a single site by ID
export const getSiteById = guardedQuery(async () => {
	const { locals, params } = getRequestEvent();
	const session = locals.session;
	const activeOrgId = locals?.kuratchi?.superadmin?.getActiveOrgId?.() || session?.organizationId;
	const siteId = params.id;
	
	try {
		// TODO: Implement actual database query when sites table is created
		// For now, return mock data for UI development
		const mockSite = {
			id: siteId,
			name: 'My Portfolio',
			subdomain: 'portfolio',
			description: 'Personal portfolio website',
			theme: 'minimal',
			created_at: new Date().toISOString(),
			organizationId: activeOrgId
		};

		console.log('[getSiteById] siteId:', siteId, 'activeOrgId:', activeOrgId);
		
		return mockSite;
	} catch (err) {
		console.error('Error fetching site:', err);
		error(404, 'Site not found');
	}
});

// Create site schema
const createSiteSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, 'Site name is required')),
	subdomain: v.pipe(
		v.string(),
		v.minLength(1, 'Subdomain is required'),
		v.regex(/^[a-z0-9-]+$/, 'Subdomain must contain only lowercase letters, numbers, and hyphens')
	),
	description: v.optional(v.string(), '')
});

// Create a new site
export const createSite = guardedForm(
	createSiteSchema,
	async (data) => {
		const { locals } = getRequestEvent();
		const session = locals.session;
		const activeOrgId = locals?.kuratchi?.superadmin?.getActiveOrgId?.() || session?.organizationId;

		if (!activeOrgId) {
			error(400, 'Organization ID is required');
		}

		try {
			// TODO: Implement actual database insertion when sites table is created
			// For now, just log the data
			console.log('[createSite] Creating site:', {
				name: data.name,
				subdomain: data.subdomain,
				description: data.description,
				organizationId: activeOrgId
			});

			// Simulate API delay
			await new Promise(resolve => setTimeout(resolve, 1000));

			return {
				success: true,
				message: 'Site created successfully',
				data: {
					id: Math.random().toString(36).substring(7),
					name: data.name,
					subdomain: data.subdomain,
					description: data.description,
					theme: 'minimal',
					created_at: new Date().toISOString(),
					organizationId: activeOrgId
				}
			};
		} catch (err) {
			console.error('Error creating site:', err);
			error(500, 'Failed to create site');
		}
	}
);

// Update site schema
const updateSiteSchema = v.object({
	id: v.string(),
	name: v.optional(v.string()),
	subdomain: v.optional(v.pipe(
		v.string(),
		v.regex(/^[a-z0-9-]+$/, 'Subdomain must contain only lowercase letters, numbers, and hyphens')
	)),
	description: v.optional(v.string()),
	theme: v.optional(v.string())
});

// Update an existing site
export const updateSite = guardedForm(
	updateSiteSchema,
	async (data) => {
		const { locals } = getRequestEvent();
		const session = locals.session;
		const activeOrgId = locals?.kuratchi?.superadmin?.getActiveOrgId?.() || session?.organizationId;

		if (!activeOrgId) {
			error(400, 'Organization ID is required');
		}

		try {
			// TODO: Implement actual database update when sites table is created
			console.log('[updateSite] Updating site:', data);

			// Simulate API delay
			await new Promise(resolve => setTimeout(resolve, 1000));

			return {
				success: true,
				message: 'Site updated successfully',
				data
			};
		} catch (err) {
			console.error('Error updating site:', err);
			error(500, 'Failed to update site');
		}
	}
);

// Delete site schema
const deleteSiteSchema = v.object({
	id: v.string()
});

// Delete a site
export const deleteSite = guardedForm(
	deleteSiteSchema,
	async (data) => {
		const { locals } = getRequestEvent();
		const session = locals.session;
		const activeOrgId = locals?.kuratchi?.superadmin?.getActiveOrgId?.() || session?.organizationId;

		if (!activeOrgId) {
			error(400, 'Organization ID is required');
		}

		try {
			// TODO: Implement actual database deletion when sites table is created
			console.log('[deleteSite] Deleting site:', data.id);

			// Simulate API delay
			await new Promise(resolve => setTimeout(resolve, 1000));

			return {
				success: true,
				message: 'Site deleted successfully'
			};
		} catch (err) {
			console.error('Error deleting site:', err);
			error(500, 'Failed to delete site');
		}
	}
);
