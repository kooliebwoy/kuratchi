import { getRequestEvent, form } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';

// Validation schema for superadmin creation
const superadminSchema = v.object({
	email: v.pipe(v.string(), v.email('Invalid email address')),
	password: v.pipe(v.string(), v.minLength(8, 'Password must be at least 8 characters')),
	name: v.optional(v.string()),
	seedKey: v.pipe(v.string(), v.nonEmpty('Seed key is required'))
});

/**
 * Create a superadmin user in the ADMIN database
 * Uses SDK's batteries-included method with proper password hashing
 * 
 * In production, you can:
 * - Create multiple superadmins (support team, admins, etc.)
 * - Remove this route and seed via CLI/script
 * - Add additional auth (e.g., only callable from internal network)
 */
export const createSuperadmin = form('unchecked', async (data: any) => {
	// Validate input
	const result = v.safeParse(superadminSchema, data);
	if (!result.success) {
		const firstError = result.issues[0];
		error(400, firstError?.message || 'Validation failed');
	}

	const { email, password, name, seedKey } = result.output;
	const { locals } = getRequestEvent();

	try {
		// Check if SDK method is available
		if (!locals.kuratchi?.auth?.admin?.seedSuperadmin) {
			error(500, 'Admin plugin not configured');
		}

		// Use SDK's seedSuperadmin method - it handles:
		// - Seed key validation (KURATCHI_SUPERADMIN_KEY)
		// - Password hashing with proper pepper
		// - User existence check
		// - Database insertion
		// - All edge cases
		const sdkResult = await locals.kuratchi.auth.admin.seedSuperadmin({
			email,
			password,
			name: name || 'Super Admin',
			seedKey // SDK validates this internally
		});

		if (!sdkResult.success) {
			// Map SDK error codes to user-friendly messages
			const errorMessages: Record<string, string> = {
				superadmin_key_not_configured: 'KURATCHI_SUPERADMIN_KEY not set in environment',
				invalid_superadmin_key: 'Invalid seed key provided',
				email_and_password_required: 'Email and password are required',
				password_too_short: 'Password must be at least 8 characters',
				admin_database_not_configured: 'Admin database not configured',
				admin_database_not_available: 'Admin database not available',
				user_already_exists: 'User with this email already exists',
				failed_to_create_user: 'Failed to create user in database'
			};

			const message = errorMessages[sdkResult.error] || sdkResult.error || 'Failed to create superadmin';
			error(500, message);
		}

		return {
			success: true,
			message: 'Superadmin created successfully',
			user: sdkResult.user
		};
	} catch (err: any) {
		console.error('[Seed] Error creating superadmin:', err);

		// Re-throw SvelteKit errors
		if (err.status) throw err;

		error(500, err.message || 'Failed to create superadmin');
	}
});
