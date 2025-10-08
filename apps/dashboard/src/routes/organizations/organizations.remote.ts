import { getRequestEvent, query, form } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { database } from 'kuratchi-sdk';
import { logActivity } from '$lib/server/activity';

// Guarded query helper
const guardedQuery = <R>(fn: () => Promise<R>) => {
	return query(async () => {
		const { locals: { session } } = getRequestEvent();
		if (!session?.user) error(401, 'Unauthorized');
		return fn();
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

// Get all organizations
export const getOrganizations = guardedQuery(async () => {
	try {
		const { orm: adminOrm } = await database.admin();
		
		const result = await adminOrm.organizations
			.where({ deleted_at: { is: null } })
			.many();

		if (!result.success) {
			console.error('Failed to fetch organizations:', result.error);
			return [];
		}

		return result.data || [];
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

			// Log activity (dual: admin + org)
			await logActivity('organization.created', {
				data: {
					organizationId: orgId,
					organizationName: data.organizationName,
					organizationSlug: data.organizationSlug
				},
				isAdminAction: true,
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

			// Log activity (dual: admin + org)
			await logActivity('organization.updated', {
				data: {
					organizationId: data.id,
					changes: updateData
				},
				isAdminAction: true,
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

// Delete organization (soft delete)
export const deleteOrganization = guardedForm(
	v.object({
		id: v.pipe(v.string(), v.nonEmpty())
	}),
	async ({ id }) => {
		try {
			const { orm: adminOrm } = await database.admin();
			const now = new Date().toISOString();

			const result = await adminOrm.organizations
				.where({ id })
				.update({ 
					deleted_at: now,
					updated_at: now
				});

			if (!result.success) {
				console.error('Failed to delete organization:', result.error);
				error(500, `Failed to delete organization: ${result.error}`);
			}

			// Log activity (dual: admin + org, but hidden from org)
			await logActivity('organization.deleted', {
				data: {
					organizationId: id
				},
				isAdminAction: true,
				isHidden: true,  // Don't show deletion in org's activity log
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
