import { getRequestEvent, form, query } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const signInSchema = v.object({
	email: v.pipe(v.string(), v.email('Invalid email address')),
	password: v.pipe(v.string(), v.nonEmpty('Password is required')),
	organizationId: v.optional(v.string()) // For multi-org sign-in
});

const signupSchema = v.object({
	organizationName: v.pipe(v.string(), v.nonEmpty('Organization name is required')),
	email: v.pipe(v.string(), v.email('Invalid email address')),
	password: v.pipe(v.string(), v.minLength(8, 'Password must be at least 8 characters')),
	userName: v.optional(v.string())
});

const acceptInviteSchema = v.object({
	inviteToken: v.pipe(v.string(), v.nonEmpty()),
	organizationId: v.pipe(v.string(), v.nonEmpty()),
	password: v.optional(v.pipe(v.string(), v.minLength(8, 'Password must be at least 8 characters')))
});

// ============================================================================
// SIGN IN WITH CREDENTIALS
// ============================================================================

/**
 * Sign in with email/password using SDK's credentials plugin
 */
export const signInWithCredentials = form(signInSchema, async (data: v.InferOutput<typeof signInSchema>) => {
	const { email, password, organizationId } = data;
	const { locals } = getRequestEvent();
	const kur = locals.kuratchi as any;

	try {
		// Check if credentials auth is available
		if (!kur?.auth?.credentials?.signIn) {
			error(500, 'Credentials authentication not configured');
		}

		// Use SDK's signIn method - it handles everything:
		// - Finding organization by email
		// - Verifying password
		// - Creating session
		// - Setting cookie
		const authResult = await (organizationId
			? kur.auth.credentials.signIn(email, password, { organizationId })
			: kur.auth.credentials.signIn(email, password));

		console.log('Auth result:', authResult);

		if (!authResult.success) {
			// Log failed login attempt
			if (kur?.activity?.log) {
				try {
					await kur.activity.log({
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
		if (kur?.activity?.log) {
			try {
				await kur.activity.log({
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
	const kur = locals.kuratchi as any;

	try {
		if (!kur?.auth?.credentials?.signOut) {
			error(500, 'Sign out not configured');
		}

		// Log logout before signing out (while we still have session)
		if (kur?.activity?.log && locals.session?.user) {
			try {
				await kur.activity.log({
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

		const result = await kur.auth.credentials.signOut();

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
export const signUp = form(signupSchema, async (data: v.InferOutput<typeof signupSchema>) => {
console.log('first hit and first hit ')

	const { organizationName, email, password, userName } = data;
	const { locals } = getRequestEvent();
	const kur = locals.kuratchi as any;

	console.log('are we hitting this endpoint any at all? ')

	try {
		// Check if admin operations are available
		if (!kur?.auth?.admin?.createOrganization) {
			error(500, 'Organization creation not configured');
		}

		// console.log 
		console.log('org data: ', {
			organizationName,
			email,
			password,
			userName: userName || organizationName,
			status: 'active'
		})

		// Create organization using SDK
		const orgResult = await kur.auth.admin.createOrganization({
			organizationName,
			email,
			password,
			userName: userName || organizationName,
			status: 'active'
		});

		// Log signup activity
		if (kur?.activity?.log) {
			try {
				await kur.activity.log({
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

// ============================================================================
// GET USER ORGANIZATIONS (for multi-org login)
// ============================================================================

/**
 * Get all organizations a user belongs to
 * Used when user has multiple orgs and needs to select one
 */
export const getUserOrganizations = query(async () => {
	const { locals, url } = getRequestEvent();
	const email = url.searchParams.get('email');
	
	if (!email) {
		return { organizations: [] };
	}
	
	try {
		const adminDb = await (locals.kuratchi as any)?.getAdminDb?.();
		if (!adminDb) {
			return { organizations: [] };
		}
		
		// Find all organizations this email belongs to
		const { data: orgUsers } = await adminDb.organizationUsers
			.where({ email, deleted_at: { isNullish: true } })
			.many();
		
		if (!orgUsers || orgUsers.length === 0) {
			return { organizations: [] };
		}
		
		// Get organization details
		const organizations = await Promise.all(
			orgUsers.map(async (ou: any) => {
				const { data: org } = await adminDb.organizations
					.where({ id: ou.organizationId })
					.first();
				
				if (!org) return null;
				
				return {
					id: org.id,
					name: org.organizationName || org.name,
					slug: org.organizationSlug
				};
			})
		);
		
		return {
			organizations: organizations.filter(Boolean),
			hasMultiple: organizations.filter(Boolean).length > 1
		};
	} catch (err) {
		console.error('[getUserOrganizations] Error:', err);
		return { organizations: [] };
	}
});

// ============================================================================
// ACCEPT INVITE
// ============================================================================

/**
 * Accept an organization invite
 * - Validates invite token
 * - Updates user status from 'invited' to active
 * - Optionally sets password if provided
 * - Creates session and signs user in
 */
export const acceptInvite = form(acceptInviteSchema, async (data: v.InferOutput<typeof acceptInviteSchema>) => {
	const { inviteToken, organizationId, password } = data;
	const { locals } = getRequestEvent();
	
	try {
		const orgDb = await (locals.kuratchi as any)?.orgDatabaseClient?.(organizationId);
		if (!orgDb) {
			error(404, 'Organization not found');
		}
		
		// Find user with this invite token
		const { data: user } = await orgDb.users
			.where({ invite_token: inviteToken, status: 'invited' })
			.first();
		
		if (!user) {
			error(400, 'Invalid or expired invitation');
		}
		
		// Check if invite is expired
		if (user.invite_expires_at && user.invite_expires_at < Date.now()) {
			error(400, 'Invitation has expired. Please request a new one.');
		}
		
		const now = new Date().toISOString();
		const updateData: any = {
			status: true, // Active
			invite_token: null,
			invite_expires_at: null,
			updated_at: now
		};
		
		// If password provided, hash and store it
		if (password) {
			const authHelper = (locals.kuratchi as any)?.authHelper;
			if (authHelper?.hashPassword) {
				updateData.password_hash = await authHelper.hashPassword(password);
			}
		}
		
		// Update user
		await orgDb.users
			.where({ id: user.id })
			.update(updateData);
		
		// Log activity
		if (locals.kuratchi?.activity?.log) {
			try {
				await locals.kuratchi.activity.log({
					action: 'user.invite_accepted',
					organizationId,
					userId: user.id,
					data: { email: user.email, name: user.name }
				});
			} catch (activityErr) {
				console.warn('[acceptInvite] Failed to log activity:', activityErr);
			}
		}
		
		// If password was set, sign them in automatically
		if (password && (locals.kuratchi as any)?.auth?.credentials?.signIn) {
			const authResult = await (locals.kuratchi as any).auth.credentials.signIn(
				user.email,
				password,
				{ organizationId }
			);
			
			if (authResult.success) {
				return {
					success: true,
					signedIn: true,
					message: 'Invitation accepted! You are now signed in.',
					user: {
						id: user.id,
						email: user.email,
						name: user.name
					}
				};
			}
		}
		
		return {
			success: true,
			signedIn: false,
			message: 'Invitation accepted! Please sign in to continue.',
			user: {
				id: user.id,
				email: user.email,
				name: user.name
			}
		};
	} catch (err: any) {
		console.error('[acceptInvite] Error:', err);
		if (err.status) throw err;
		error(500, err.message || 'Failed to accept invitation');
	}
});
