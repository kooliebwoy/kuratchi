import { getRequestEvent, form } from '$app/server';
import * as v from 'valibot';
import { error, redirect } from '@sveltejs/kit';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const signInSchema = v.object({
	email: v.pipe(v.string(), v.email('Invalid email address')),
	password: v.pipe(v.string(), v.nonEmpty('Password is required'))
});

const signupSchema = v.object({
	organizationName: v.pipe(v.string(), v.nonEmpty('Organization name is required')),
	email: v.pipe(v.string(), v.email('Invalid email address')),
	password: v.pipe(v.string(), v.minLength(8, 'Password must be at least 8 characters')),
	userName: v.optional(v.string())
});

// ============================================================================
// SIGN IN WITH CREDENTIALS
// ============================================================================

/**
 * Sign in with email/password using SDK's credentials plugin
 */
export const signInWithCredentials = form('unchecked', async (data: any) => {
	// Validate input
	const result = v.safeParse(signInSchema, data);
	if (!result.success) {
		const firstError = result.issues[0];
		error(400, firstError?.message || 'Validation failed');
	}

	const { email, password } = result.output;
	const { locals, event } = getRequestEvent();

	try {
		// Check if credentials auth is available
		if (!locals.kuratchi?.auth?.credentials?.signIn) {
			error(500, 'Credentials authentication not configured');
		}

		// Use SDK's signIn method - it handles everything:
		// - Finding organization by email
		// - Verifying password
		// - Creating session
		// - Setting cookie
		const authResult = await locals.kuratchi.auth.credentials.signIn(email, password);

		console.log('Auth result:', authResult);

		if (!authResult.success) {
			// Log failed login attempt
			if (locals.kuratchi?.activity?.log) {
				try {
					await locals.kuratchi.activity.log({
						action: 'auth.failed_login',
						status: false,
						data: {
							email,
							reason: authResult.error
						}
					});
				} catch (activityErr) {
					console.warn('[SignIn] Failed to log activity:', activityErr);
				}
			}

			// Map SDK error codes to user-friendly messages
			const errorMessages: Record<string, string> = {
				invalid_credentials: 'Invalid email or password',
				too_many_attempts: 'Too many failed attempts. Please try again later.',
				organization_database_not_found: 'Organization not found',
				admin_database_not_found: 'System configuration error',
				auth_secret_not_configured: 'Authentication not properly configured'
			};

			const message = errorMessages[authResult.error] || authResult.message || 'Sign in failed';
			error(401, message);
		}

		// Success! SDK has already:
		// - Set session in locals.session
		// - Set session cookie
		// - Created session in database

		// Log successful login
		if (locals.kuratchi?.activity?.log) {
			try {
				await locals.kuratchi.activity.log({
					action: 'auth.login',
					organizationId: locals.session?.organizationId,
					userId: authResult.user.id,
					data: {
						email: authResult.user.email,
						name: authResult.user.name
					}
				});
			} catch (activityErr) {
				console.warn('[SignIn] Failed to log activity:', activityErr);
			}
		}

		return {
			success: true,
			message: 'Signed in successfully',
			user: {
				id: authResult.user.id,
				email: authResult.user.email,
				name: authResult.user.name
			}
		};
	} catch (err: any) {
		console.error('[SignIn] Error:', err);
		
		// Re-throw SvelteKit errors
		if (err.status) throw err;
		
		error(500, err.message || 'Sign in failed');
	}
});

// ============================================================================
// SIGN OUT
// ============================================================================

/**
 * Sign out current user using SDK's credentials plugin
 */
export const signOut = form('unchecked', async () => {
	const { locals } = getRequestEvent();

	try {
		if (!locals.kuratchi?.auth?.credentials?.signOut) {
			error(500, 'Sign out not configured');
		}

		// Log logout before signing out (while we still have session)
		if (locals.kuratchi?.activity?.log && locals.session?.user) {
			try {
				await locals.kuratchi.activity.log({
					action: 'auth.logout',
					organizationId: locals.session.organizationId,
					userId: locals.session.user.id,
					data: {
						email: locals.session.user.email,
						name: locals.session.user.name
					}
				});
			} catch (activityErr) {
				console.warn('[SignOut] Failed to log activity:', activityErr);
			}
		}

		const result = await locals.kuratchi.auth.credentials.signOut();

		if (!result.success) {
			error(500, result.error || 'Sign out failed');
		}

		return {
			success: true,
			message: 'Signed out successfully'
		};
	} catch (err: any) {
		console.error('[SignOut] Error:', err);
		
		// Re-throw SvelteKit errors
		if (err.status) throw err;
		
		error(500, err.message || 'Sign out failed');
	}
});

// ============================================================================
// ORGANIZATION SIGNUP
// ============================================================================

/**
 * Create a new organization with database and first user
 */
export const signUp = form('unchecked', async (data: any) => {
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
			error(500, 'Organization creation not configured');
		}

		// Create organization using SDK
		const orgResult = await locals.kuratchi.auth.admin.createOrganization({
			organizationName,
			email,
			password,
			userName: userName || organizationName,
			status: 'active'
		});

		// Log signup activity
		if (locals.kuratchi?.activity?.log) {
			try {
				await locals.kuratchi.activity.log({
					action: 'auth.signup',
					organizationId: orgResult.organization.id,
					data: {
						organizationName,
						email
					}
				});
			} catch (activityErr) {
				console.warn('[SignUp] Failed to log activity:', activityErr);
			}
		}

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
