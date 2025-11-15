import { getRequestEvent, query, form } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { database, ActivityAction } from 'kuratchi-sdk';
import { getAdminDatabase, getDatabase } from '$lib/server/db-context';

// Guarded query helper
const guardedQuery = <R>(fn: () => Promise<R>) => {
	return query(async () => {
		const { locals: { session } } = getRequestEvent();
		if (!session?.user) error(401, 'Unauthorized');
		return fn();
	});
};

// Guarded query helper with parameters and validation
const guardedQueryWithParams = <T, R>(
	schema: v.BaseSchema<unknown, T, v.BaseIssue<unknown>>,
	fn: (params: T) => Promise<R>
) => {
	return query(schema, async (params: T) => {
		const { locals: { session } } = getRequestEvent();
		if (!session?.user) error(401, 'Unauthorized');
		return fn(params);
	});
};

// Guarded form helper
const guardedForm = <R>(
	schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
	fn: (data: any) => Promise<R>
) => {
	return form('unchecked', async (data: any) => {
		const { locals: { session } } = getRequestEvent();
		if (!session?.user) error(401, 'Unauthorized');

		const result = v.safeParse(schema, data);
		if (!result.success) {
			error(400, 'Validation failed');
		}

		return fn(result.output);
	});
};

// Get organizations (context-aware: all orgs for superadmin, current org for regular users)
export const getOrganizations = guardedQuery(async () => {
	try {
		const { locals } = getRequestEvent();
		const db = await getAdminDatabase(locals);
		const isSuperadmin = locals.kuratchi?.superadmin?.isSuperadmin?.();
		
		// Superadmins see all organizations from admin DB
		// Regular users see only their organization
		const result = await db.organizations
			.where({ deleted_at: { isNullish: true } })
			.many();

		if (!result.success) {
			console.error('Failed to fetch organizations:', result.error);
			return [];
		}

		// For regular users, filter to just their org (though DB should already handle this)
		let organizations = result.data || [];
		
		if (!isSuperadmin && locals.session?.organizationId) {
			organizations = organizations.filter((org: any) => org.id === locals.session.organizationId);
		}

		return organizations;
	} catch (err) {
		console.error('Error fetching organizations:', err);
		return [];
	}
});

// Create organization
export const createOrganization = guardedForm(
	v.object({
		organizationName: v.pipe(v.string(), v.nonEmpty()),
		email: v.pipe(v.string(), v.email()),
		organizationSlug: v.pipe(v.string(), v.nonEmpty(), v.regex(/^[a-z0-9-]+$/)),
		notes: v.optional(v.string()),
		status: v.optional(v.picklist(['active', 'inactive', 'lead']))
	}),
	async (data) => {
		try {
			const { orm: adminOrm } = await database.admin();
			const now = new Date().toISOString();
			const orgId = crypto.randomUUID();

			const result = await adminOrm.organizations.insert({
				id: orgId,
				organizationName: data.organizationName,
				email: data.email,
				organizationSlug: data.organizationSlug,
				notes: data.notes || null,
				status: data.status || 'lead',
				stripeCustomerId: null,
				stripeSubscriptionId: null,
				created_at: now,
				updated_at: now,
				deleted_at: null
			});

			if (!result.success) {
				console.error('Failed to create organization:', result.error);
				error(500, `Failed to create organization: ${result.error}`);
			}

			// Log activity (isAdminAction auto-applied from type definition)
			const { locals } = getRequestEvent();
			await locals.kuratchi?.activity?.logActivity?.({
				action: ActivityAction.ORGANIZATION_CREATED,
				data: {
					organizationId: orgId,
					organizationName: data.organizationName,
					organizationSlug: data.organizationSlug
				},
				organizationId: orgId
			});

			// Refresh organizations list
			await getOrganizations().refresh();

			return { success: true, message: 'Organization created successfully', id: orgId };
		} catch (err) {
			console.error('Error creating organization:', err);
			error(500, 'Failed to create organization');
		}
	}
);

// Update organization
export const updateOrganization = guardedForm(
	v.object({
		id: v.pipe(v.string(), v.nonEmpty()),
		organizationName: v.optional(v.pipe(v.string(), v.nonEmpty())),
		email: v.optional(v.pipe(v.string(), v.email())),
		organizationSlug: v.optional(v.pipe(v.string(), v.nonEmpty(), v.regex(/^[a-z0-9-]+$/))),
		notes: v.optional(v.string()),
		status: v.optional(v.picklist(['active', 'inactive', 'lead']))
	}),
	async (data) => {
		try {
			const { orm: adminOrm } = await database.admin();
			const now = new Date().toISOString();

			const updateData: any = { updated_at: now };
			if (data.organizationName) updateData.organizationName = data.organizationName;
			if (data.email) updateData.email = data.email;
			if (data.organizationSlug) updateData.organizationSlug = data.organizationSlug;
			if (data.notes !== undefined) updateData.notes = data.notes;
			if (data.status) updateData.status = data.status;

			const result = await adminOrm.organizations
				.where({ id: data.id })
				.update(updateData);

			if (!result.success) {
				console.error('Failed to update organization:', result.error);
				error(500, `Failed to update organization: ${result.error}`);
			}

			// Log activity 
			const { locals } = getRequestEvent();
			await locals.kuratchi?.activity?.logActivity?.({
				action: ActivityAction.ORGANIZATION_UPDATED,
				data: {
					organizationId: data.id,
					changes: updateData
				},
				organizationId: data.id
			});

			// Refresh organizations list
			await getOrganizations().refresh();

			return { success: true, message: 'Organization updated successfully' };
		} catch (err) {
			console.error('Error updating organization:', err);
			error(500, 'Failed to update organization');
		}
	}
);

// Delete organization (soft delete + cleanup)
export const deleteOrganization = guardedForm(
	v.object({
		id: v.pipe(v.string(), v.nonEmpty())
	}),
	async ({ id }) => {
		try {
			const { locals } = getRequestEvent();
			
			// Use SDK's deleteOrganization which handles:
			// - Physical deletion of D1 database and worker
			// - Soft delete of organization, databases, tokens, and user mappings
			if (!locals.kuratchi?.auth?.admin?.deleteOrganization) {
				error(500, 'Organization deletion not configured');
			}
			
			const result = await locals.kuratchi.auth.admin.deleteOrganization(id);
			
			if (!result.success) {
				console.error('Failed to delete organization:', result);
				error(500, 'Failed to delete organization');
			}

			// Log activity 
			await locals.kuratchi?.activity?.logActivity?.({
				action: ActivityAction.ORGANIZATION_DELETED,
				data: {
					organizationId: id
				},
				organizationId: id
			});

			// Refresh organizations list
			await getOrganizations().refresh();

			return { success: true, message: 'Organization deleted successfully' };
		} catch (err) {
			console.error('Error deleting organization:', err);
			error(500, 'Failed to delete organization');
		}
	}
);

export const getOrganizationNameById = guardedQueryWithParams(
	v.pipe(v.string(), v.nonEmpty()),
	async (id) => {
		try {
			const { locals: { kuratchi } } = getRequestEvent();
			const org = await kuratchi?.auth?.admin?.getOrganization(id);
			return org?.organizationName || 'Unknown Organization';
		} catch (err) {
			console.error('Error fetching organization name:', err);
			return 'Unknown Organization';
		}
	}
);