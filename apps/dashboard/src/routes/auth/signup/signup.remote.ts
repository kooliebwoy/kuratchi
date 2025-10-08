import { getRequestEvent, form } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';

// Validation schema for organization signup
const signupSchema = v.object({
	organizationName: v.pipe(v.string(), v.nonEmpty('Organization name is required')),
	email: v.pipe(v.string(), v.email('Invalid email address')),
	password: v.pipe(v.string(), v.minLength(8, 'Password must be at least 8 characters')),
	userName: v.optional(v.string())
});

/**
 * Create a new organization with database and first user
 */
export const createOrganization = form('unchecked', async (data: any) => {
	// Validate input
	const result = v.safeParse(signupSchema, data);
	if (!result.success) {
		const firstError = result.issues[0];
		error(400, firstError?.message || 'Validation failed');
	}

	const { organizationName, email, password, userName } = result.output;
	const { locals } = getRequestEvent();

	try {
		// Check if admin operations are available
		if (!locals.kuratchi?.auth?.admin?.createOrganization) {
			error(500, 'Admin operations not configured');
		}

		// Create organization using SDK
		const orgResult = await locals.kuratchi.auth.admin.createOrganization({
			organizationName,
			email,
			password,
			userName: userName || organizationName,
			status: 'active'
		});

		return {
			success: true,
			message: 'Organization created successfully',
			organization: {
				id: orgResult.organization.id,
				name: orgResult.organization.name,
				email: orgResult.organization.email
			}
		};
	} catch (err: any) {
		console.error('[Signup] Error creating organization:', err);

		// Handle specific errors
		if (err.message?.includes('UNIQUE constraint failed')) {
			error(409, 'Email already registered');
		}

		error(500, err.message || 'Failed to create organization');
	}
});
