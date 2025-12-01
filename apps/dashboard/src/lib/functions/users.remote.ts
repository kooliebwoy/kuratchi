import { getRequestEvent, query, form } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db-context';
import { sendEmail } from 'kuratchi-sdk/email';

// Helpers
const guardedQuery = <R>(fn: () => Promise<R>) => {
  return query(async () => {
    const { locals: { session } } = getRequestEvent();
    if (!session?.user) error(401, 'Unauthorized');
    return fn();
  });
};

const guardedForm = <R>(
  schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
  fn: (data: any) => Promise<R>
) => {
  return form('unchecked', async (data: any) => {
    const { locals: { session } } = getRequestEvent();
    if (!session?.user) error(401, 'Unauthorized');

    const result = v.safeParse(schema, data);
    if (!result.success) {
      console.error('[guardedForm] Validation failed:', result.issues);
      error(400, `Validation failed: ${result.issues.map((i: any) => `${i.path?.map((p: any) => p.key).join('.')}: ${i.message}`).join(', ')}`);
    }

    return fn(result.output);
  });
};

// Queries
export const getUsers = guardedQuery(async () => {
  try {
    const { locals } = getRequestEvent();
    const orgDb = await (locals.kuratchi as any)?.orgDatabaseClient?.();

    if (!orgDb) {
      throw new Error('Organization database not available in current context');
    }

    const usersResult = await orgDb.users
      .where({ deleted_at: { isNullish: true } })
      .orderBy({ created_at: 'desc' })
      .many();

    const users = usersResult?.data ?? [];

    return users.map((user: any) => ({
      ...user,
      isOwner: user.role === 'owner',
      isAdmin: user.role === 'owner' || user.role === 'editor'
    }));
  } catch (err) {
    console.error('[users.getUsers] error:', err);
    return [];
  }
});

export const getUserDetails = guardedQuery(async () => {
  try {
    const { locals, url } = getRequestEvent();
    const userId = url.searchParams.get('id');
    if (!userId) error(400, 'User ID required');

    const db = await getDatabase(locals);

    // Get user from admin database
    const userResult = await db.users
      .where({ id: userId, deleted_at: { isNullish: true } })
      .first();
    
    const user = userResult?.data;
    if (!user) error(404, 'User not found');

    // Get organization mappings
    const orgUsersResult = await db.organizationUsers
      .where({ email: user.email, deleted_at: { isNullish: true } })
      .many();
    
    const orgUsers = orgUsersResult?.data || [];

    // Get organizations
    const orgIds = orgUsers.map((ou: any) => ou.organizationId);
    const organizations = await Promise.all(orgIds.map(async (orgId: string) => {
      const orgResult = await db.organizations
        .where({ id: orgId, deleted_at: { isNullish: true } })
        .first();
      return orgResult?.data;
    }));

    // Get roles in each organization
    const orgDetails = await Promise.all(organizations.filter(Boolean).map(async (org: any) => {
      try {
        const orgDb = await getDatabase(locals, org.id);

        const orgUserResult = await orgDb.users
          .where({ email: user.email })
          .first();
        
        const orgUser = orgUserResult?.data;
        
        // Get role permissions if user has a role
        let permissions = [];
        if (orgUser?.role && locals.kuratchi?.roles?.getRolePermissions) {
          const rolePerms = await locals.kuratchi.roles.getRolePermissions(org.id);
          permissions = rolePerms?.byRole?.[orgUser.role] || [];
        }
        
        return {
          ...org,
          userRole: orgUser?.role || null,
          isOrgAdmin: orgUser?.role === 'owner' || orgUser?.role === 'admin',
          permissions
        };
      } catch (err) {
        console.error(`[getUserDetails] Failed to get details for org ${org.id}:`, err);
        return { ...org, userRole: null, permissions: [] };
      }
    }));

    return {
      ...user,
      organizations: orgDetails,
      isSuperAdmin: user.role === 'superadmin'
    };
  } catch (err) {
    console.error('[users.getUserDetails] error:', err);
    error(500, 'Failed to get user details');
  }
});

export const getAvailableOrganizations = guardedQuery(async () => {
  try {
    const { locals } = getRequestEvent();
    const db = await getDatabase(locals);

    const orgsResult = await db.organizations
      .where({ deleted_at: { isNullish: true } })
      .orderBy({ created_at: 'desc' })
      .many();
    
    return orgsResult?.data || [];
  } catch (err) {
    console.error('[users.getAvailableOrganizations] error:', err);
    return [];
  }
});

export const getOrganizationRoles = guardedQuery(async () => {
  try {
    const { locals, url } = getRequestEvent();
    const orgId = url.searchParams.get('orgId');
    if (!orgId) return [];

    const roles = await locals.kuratchi?.roles?.getAllRoles?.(orgId);
    return roles || [];
  } catch (err) {
    console.error('[users.getOrganizationRoles] error:', err);
    return [];
  }
});

// Available roles for invite (owner cannot be assigned via invite)
const INVITABLE_ROLES = ['editor', 'member', 'viewer', 'moderator', 'developer', 'billing'] as const;

// Forms
export const inviteUser = guardedForm(
  v.object({
    email: v.pipe(v.string(), v.email()),
    name: v.pipe(v.string(), v.nonEmpty()),
    role: v.pipe(v.string(), v.nonEmpty())
  }),
  async ({ email, name, role }) => {
    try {
      const event = getRequestEvent();
      const { locals } = event;
      const session = locals.session as any;
      const orgDb = await (locals.kuratchi as any)?.orgDatabaseClient?.();
      const organizationId = session?.organizationId;

      if (!orgDb) {
        throw new Error('Organization database not available');
      }

      if (!organizationId) {
        throw new Error('Organization ID not found');
      }

      // Validate role - owner cannot be assigned via invite
      if (role === 'owner') {
        error(400, 'Cannot invite users as owner. Transfer ownership instead.');
      }

      if (!INVITABLE_ROLES.includes(role as any)) {
        error(400, `Invalid role. Must be one of: ${INVITABLE_ROLES.join(', ')}`);
      }

      // Check if user already exists in this organization
      const existingResult = await orgDb.users
        .where({ email, deleted_at: { isNullish: true } })
        .first();
      
      if (existingResult?.data) {
        error(400, 'User with this email already exists in this organization');
      }

      // Check admin database for existing user across organizations
      const adminDb = await getDatabase(locals);
      const existingAdminUser = await adminDb.organizationUsers
        ?.where({ email, deleted_at: { isNullish: true } })
        .many();
      
      const isExistingUser = existingAdminUser?.data?.length > 0;

      // Create user in org database (pending invite status)
      const userId = crypto.randomUUID();
      const now = new Date().toISOString();
      const inviteToken = crypto.randomUUID();
      const inviteExpiry = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days

      await orgDb.users.insert({
        id: userId,
        email,
        name,
        password_hash: null, // No password - user will set via OAuth or credentials setup
        role,
        status: null, // null = pending/invited (invite_token presence indicates invited)
        emailVerified: null,
        invite_token: inviteToken,
        invite_expires_at: inviteExpiry,
        invited_by: session?.user?.id,
        created_at: now,
        updated_at: now,
        deleted_at: null
      });

      // Add to admin organizationUsers mapping
      await adminDb.organizationUsers?.insert({
        id: crypto.randomUUID(),
        organizationId,
        email,
        created_at: now,
        updated_at: now,
        deleted_at: null
      });

      // Get organization name for the email
      const orgResult = await adminDb.organizations
        ?.where({ id: organizationId })
        .first();
      const orgName = orgResult?.data?.organizationName || orgResult?.data?.name || 'the organization';

      // Build invite link - directs to sign in page with invite context
      const origin = (locals as any).env?.ORIGIN || `${event.url.protocol}//${event.url.host}`;
      const inviteLink = `${origin}/auth/signin?invite=${encodeURIComponent(inviteToken)}&org=${encodeURIComponent(organizationId)}`;

      // Send invite email
      const inviterName = session?.user?.name || session?.user?.email || 'Someone';
      let emailResult: { success: boolean; error?: string } = { success: false };
      let sesVerificationRequested = false;
      
      // Try to send invite email
      emailResult = await sendEmail(event, {
        to: email,
        subject: `You've been invited to join ${orgName}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <h2 style="color: #0f172a; margin-bottom: 24px;">You're invited!</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
              Hi ${name},
            </p>
            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              <strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> on Kuratchi as a <strong>${role}</strong>.
            </p>
            ${isExistingUser ? `
              <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 24px; padding: 12px; background: #f1f5f9; border-radius: 8px;">
                <strong>Note:</strong> You already have a Kuratchi account. When you sign in, you'll be able to switch between your organizations.
              </p>
            ` : ''}
            <a href="${inviteLink}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Accept Invitation
            </a>
            <p style="color: #94a3b8; font-size: 14px; margin-top: 32px;">
              This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        `,
        emailType: 'user_invite',
        organizationId,
        userId,
        metadata: {
          inviteToken,
          invitedBy: session?.user?.id,
          role,
          expiresAt: new Date(inviteExpiry).toISOString()
        }
      });

      // If email failed (likely SES sandbox), request SES verification for the recipient
      if (!emailResult.success) {
        console.warn('[inviteUser] Failed to send invite email (likely SES sandbox):', emailResult.error);
        
        // Try to request SES verification for the recipient
        try {
          const { requestSesVerification } = await import('kuratchi-sdk/email');
          const sesResult = await requestSesVerification(email);
          sesVerificationRequested = sesResult.success;
          
          if (sesResult.success) {
            console.log('[inviteUser] SES verification requested for:', email);
          }
        } catch (sesErr) {
          console.warn('[inviteUser] Failed to request SES verification:', sesErr);
        }
      }

      // Log activity
      if (locals.kuratchi?.activity?.log) {
        try {
          await locals.kuratchi.activity.log({
            action: 'user.invited',
            data: { userId, email, name, role, invitedBy: session?.user?.id }
          });
        } catch (activityErr) {
          console.warn('[inviteUser] Failed to log activity:', activityErr);
        }
      }

      await getUsers().refresh();
      return { 
        success: true, 
        userId, 
        emailSent: emailResult.success,
        sesVerificationRequested,
        isExistingUser 
      };
    } catch (err: any) {
      console.error('[users.inviteUser] error:', err);
      error(500, err.message || 'Failed to invite user');
    }
  }
);

// Resend invite email
export const resendInvite = guardedForm(
  v.object({
    id: v.pipe(v.string(), v.nonEmpty())
  }),
  async ({ id }) => {
    try {
      const event = getRequestEvent();
      const { locals } = event;
      const session = locals.session as any;
      const orgDb = await (locals.kuratchi as any)?.orgDatabaseClient?.();
      const organizationId = session?.organizationId;

      if (!orgDb) {
        throw new Error('Organization database not available');
      }

      // Get user
      const userResult = await orgDb.users.where({ id }).first();
      const user = userResult?.data;
      
      if (!user) {
        error(404, 'User not found');
      }

      if (user.status !== 'invited') {
        error(400, 'User has already accepted the invitation');
      }

      // Generate new invite token
      const inviteToken = crypto.randomUUID();
      const inviteExpiry = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
      const now = new Date().toISOString();

      await orgDb.users
        .where({ id })
        .update({
          invite_token: inviteToken,
          invite_expires_at: inviteExpiry,
          updated_at: now
        });

      // Get organization name
      const adminDb = await getDatabase(locals);
      const orgResult = await adminDb.organizations
        ?.where({ id: organizationId })
        .first();
      const orgName = orgResult?.data?.organizationName || orgResult?.data?.name || 'the organization';

      // Build invite link
      const origin = (locals as any).env?.ORIGIN || `${event.url.protocol}//${event.url.host}`;
      const inviteLink = `${origin}/auth/signin?invite=${encodeURIComponent(inviteToken)}&org=${encodeURIComponent(organizationId)}`;

      // Send invite email
      const inviterName = session?.user?.name || session?.user?.email || 'Someone';
      const emailResult = await sendEmail(event, {
        to: user.email,
        subject: `Reminder: You've been invited to join ${orgName}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <h2 style="color: #0f172a; margin-bottom: 24px;">Invitation Reminder</h2>
            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
              Hi ${user.name},
            </p>
            <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              This is a reminder that <strong>${inviterName}</strong> invited you to join <strong>${orgName}</strong> on Kuratchi as a <strong>${user.role}</strong>.
            </p>
            <a href="${inviteLink}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Accept Invitation
            </a>
            <p style="color: #94a3b8; font-size: 14px; margin-top: 32px;">
              This invitation will expire in 7 days.
            </p>
          </div>
        `,
        emailType: 'user_invite_reminder',
        organizationId,
        userId: id,
        metadata: {
          inviteToken,
          role: user.role
        }
      });

      return { success: true, emailSent: emailResult.success };
    } catch (err: any) {
      console.error('[users.resendInvite] error:', err);
      error(500, err.message || 'Failed to resend invite');
    }
  }
);

// Legacy createUser - kept for backwards compatibility but redirects to inviteUser
export const createUser = guardedForm(
  v.object({
    email: v.pipe(v.string(), v.email()),
    name: v.pipe(v.string(), v.nonEmpty()),
    role: v.optional(v.string())
  }),
  async ({ email, name, role }) => {
    // Redirect to invite flow
    const event = getRequestEvent();
    const { locals } = event;
    const session = locals.session as any;
    const orgDb = await (locals.kuratchi as any)?.orgDatabaseClient?.();
    const organizationId = session?.organizationId;

    if (!orgDb) {
      throw new Error('Organization database not available');
    }

    // Use inviteUser logic
    const finalRole = role || 'member';
    
    // Validate role
    if (finalRole === 'owner') {
      error(400, 'Cannot create users as owner. Transfer ownership instead.');
    }

    // Check if user already exists
    const existingResult = await orgDb.users
      .where({ email, deleted_at: { isNullish: true } })
      .first();
    
    if (existingResult?.data) {
      error(400, 'User with this email already exists in this organization');
    }

    // Create user with invited status
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const inviteToken = crypto.randomUUID();
    const inviteExpiry = Date.now() + (7 * 24 * 60 * 60 * 1000);

    await orgDb.users.insert({
      id: userId,
      email,
      name,
      password_hash: null,
      role: finalRole,
      status: 'invited',
      emailVerified: null,
      invite_token: inviteToken,
      invite_expires_at: inviteExpiry,
      invited_by: session?.user?.id,
      created_at: now,
      updated_at: now,
      deleted_at: null
    });

    // Add to admin mapping
    const adminDb = await getDatabase(locals);
    await adminDb.organizationUsers?.insert({
      id: crypto.randomUUID(),
      organizationId,
      email,
      created_at: now,
      updated_at: now,
      deleted_at: null
    });

    // Get org name and send invite
    const orgResult = await adminDb.organizations?.where({ id: organizationId }).first();
    const orgName = orgResult?.data?.organizationName || orgResult?.data?.name || 'the organization';
    const origin = (locals as any).env?.ORIGIN || `${event.url.protocol}//${event.url.host}`;
    const inviteLink = `${origin}/auth/signin?invite=${encodeURIComponent(inviteToken)}&org=${encodeURIComponent(organizationId)}`;
    const inviterName = session?.user?.name || session?.user?.email || 'Someone';

    await sendEmail(event, {
      to: email,
      subject: `You've been invited to join ${orgName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #0f172a; margin-bottom: 24px;">You're invited!</h2>
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">Hi ${name},</p>
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
            <strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> on Kuratchi as a <strong>${finalRole}</strong>.
          </p>
          <a href="${inviteLink}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Accept Invitation
          </a>
          <p style="color: #94a3b8; font-size: 14px; margin-top: 32px;">
            This invitation will expire in 7 days.
          </p>
        </div>
      `,
      emailType: 'user_invite',
      organizationId,
      userId
    });

    if (locals.kuratchi?.activity?.log) {
      try {
        await locals.kuratchi.activity.log({
          action: 'user.invited',
          data: { userId, email, name, role: finalRole }
        });
      } catch (e) {}
    }

    await getUsers().refresh();
    return { success: true, userId };
  }
);

export const updateUser = guardedForm(
  v.object({
    id: v.pipe(v.string(), v.nonEmpty()),
    email: v.optional(v.pipe(v.string(), v.email())),
    name: v.optional(v.pipe(v.string(), v.nonEmpty()))
  }),
  async ({ id, email, name }) => {
    try {
      const { locals } = getRequestEvent();
      const orgDb = await (locals.kuratchi as any)?.orgDatabaseClient?.();

      if (!orgDb) {
        throw new Error('Organization database not available');
      }

      const updateData: any = { updated_at: new Date().toISOString() };
      if (email !== undefined) updateData.email = email;
      if (name !== undefined) updateData.name = name;

      await orgDb.users
        .where({ id })
        .update(updateData);

      // Log activity
      if (locals.kuratchi?.activity?.log) {
        try {
          await locals.kuratchi.activity.log({
            action: 'user.updated',
            data: { userId: id, changes: updateData }
          });
        } catch (activityErr) {
          console.warn('[updateUser] Failed to log activity:', activityErr);
        }
      }

      await getUsers().refresh();
      return { success: true };
    } catch (err) {
      console.error('[users.updateUser] error:', err);
      error(500, 'Failed to update user');
    }
  }
);

export const suspendUser = guardedForm(
  v.object({ id: v.pipe(v.string(), v.nonEmpty()) }),
  async ({ id }) => {
    try {
      const { locals } = getRequestEvent();
      const orgDb = await (locals.kuratchi as any)?.orgDatabaseClient?.();

      if (!orgDb) {
        throw new Error('Organization database not available');
      }

      const userResult = await orgDb.users.where({ id }).first();
      const user = userResult?.data;

      await orgDb.users
        .where({ id })
        .update({ 
          status: false,
          updated_at: new Date().toISOString() 
        });

      // Log activity
      if (locals.kuratchi?.activity?.log && user) {
        try {
          await locals.kuratchi.activity.log({
            action: 'user.suspended',
            data: { userId: id, email: user.email, name: user.name }
          });
        } catch (activityErr) {
          console.warn('[suspendUser] Failed to log activity:', activityErr);
        }
      }

      await getUsers().refresh();
      return { success: true };
    } catch (err) {
      console.error('[users.suspendUser] error:', err);
      error(500, 'Failed to suspend user');
    }
  }
);

export const activateUser = guardedForm(
  v.object({ id: v.pipe(v.string(), v.nonEmpty()) }),
  async ({ id }) => {
    try {
      const { locals } = getRequestEvent();
      const orgDb = await (locals.kuratchi as any)?.orgDatabaseClient?.();

      if (!orgDb) {
        throw new Error('Organization database not available');
      }

      const userResult = await orgDb.users.where({ id }).first();
      const user = userResult?.data;

      await orgDb.users
        .where({ id })
        .update({ 
          status: true,
          updated_at: new Date().toISOString() 
        });

      // Log activity
      if (locals.kuratchi?.activity?.log && user) {
        try {
          await locals.kuratchi.activity.log({
            action: 'user.unsuspended',
            data: { userId: id, email: user.email, name: user.name }
          });
        } catch (activityErr) {
          console.warn('[activateUser] Failed to log activity:', activityErr);
        }
      }

      await getUsers().refresh();
      return { success: true };
    } catch (err) {
      console.error('[users.activateUser] error:', err);
      error(500, 'Failed to activate user');
    }
  }
);

export const deleteUser = guardedForm(
  v.object({ id: v.pipe(v.string(), v.nonEmpty()) }),
  async ({ id }) => {
    try {
      const { locals } = getRequestEvent();
      const orgDb = await (locals.kuratchi as any)?.orgDatabaseClient?.();

      if (!orgDb) {
        throw new Error('Organization database not available');
      }

      const now = new Date().toISOString();

      // Get user email first
      const userResult = await orgDb.users.where({ id }).first();
      const email = userResult?.data?.email;

      // Soft delete user
      await orgDb.users
        .where({ id })
        .update({ deleted_at: now });

      // Log activity
      if (locals.kuratchi?.activity?.log && email) {
        try {
          await locals.kuratchi.activity.log({
            action: 'user.deleted',
            data: { userId: id, email }
          });
        } catch (activityErr) {
          console.warn('[deleteUser] Failed to log activity:', activityErr);
        }
      }

      await getUsers().refresh();
      return { success: true };
    } catch (err) {
      console.error('[users.deleteUser] error:', err);
      error(500, 'Failed to delete user');
    }
  }
);

export const addUserToOrganization = guardedForm(
  v.object({
    userId: v.pipe(v.string(), v.nonEmpty()),
    organizationId: v.pipe(v.string(), v.nonEmpty()),
    roleId: v.optional(v.string())
  }),
  async ({ userId, organizationId, roleId }) => {
    try {
      const { locals } = getRequestEvent();
      const db = await getDatabase(locals);

      // Get user
      const userResult = await db.users.where({ id: userId }).first();
      const user = userResult?.data;
      if (!user) error(404, 'User not found');

      const now = new Date().toISOString();

      // Check if already in organization
      const existingResult = await db.organizationUsers
        .where({ email: user.email, organizationId })
        .first();
      
      if (existingResult?.data && !existingResult.data.deleted_at) {
        error(400, 'User already in organization');
      }

      // Add to organizationUsers mapping
      if (existingResult?.data) {
        // Restore soft-deleted mapping
        await db.organizationUsers
          .where({ id: existingResult.data.id })
          .update({ deleted_at: null, updated_at: now });
      } else {
        // Create new mapping
        await db.organizationUsers.insert({
          id: crypto.randomUUID(),
          organizationId,
          email: user.email,
          created_at: now,
          updated_at: now,
          deleted_at: null
        });
      }

      // Add to organization database
      try {
        const orgDb = await getDatabase(locals, organizationId);
        // Get role name if roleId provided
        let roleName = 'member';
        if (roleId) {
          const roles = await locals.kuratchi?.roles?.getAllRoles?.(organizationId);
          const role = roles?.find((r: any) => r.id === roleId);
          roleName = role?.name || 'member';
        }

        // Check if user exists in org database
        const orgUserResult = await orgDb.users
          .where({ email: user.email })
          .first();
        
        if (orgUserResult?.data) {
          // Update existing user
          await orgDb.users
            .where({ id: orgUserResult.data.id })
            .update({ 
              role: roleName,
              deleted_at: null,
              updated_at: now 
            });
        } else {
          // Create new user in org
          await orgDb.users.insert({
            id: crypto.randomUUID(),
            email: user.email,
            name: user.name,
            password_hash: user.password_hash,
            role: roleName,
            created_at: now,
            updated_at: now,
            deleted_at: null
          });
        }
      } catch (err) {
        console.error(`[addUserToOrganization] Failed to add user to org database:`, err);
      }

      await getUsers().refresh();
      return { success: true };
    } catch (err: any) {
      console.error('[users.addUserToOrganization] error:', err);
      error(500, err.message || 'Failed to add user to organization');
    }
  }
);

export const removeUserFromOrganization = guardedForm(
  v.object({
    userId: v.pipe(v.string(), v.nonEmpty()),
    organizationId: v.pipe(v.string(), v.nonEmpty())
  }),
  async ({ userId, organizationId }) => {
    try {
      const { locals } = getRequestEvent();
      const db = await getDatabase(locals);

      // Get user
      const userResult = await db.users.where({ id: userId }).first();
      const user = userResult?.data;
      if (!user) error(404, 'User not found');

      const now = new Date().toISOString();

      // Soft delete from organizationUsers mapping
      await db.organizationUsers
        .where({ email: user.email, organizationId })
        .updateMany({ deleted_at: now });

      // Soft delete from organization database
      try {
        const orgDb = await getDatabase(locals, organizationId);
        await orgDb.users
          .where({ email: user.email })
          .updateMany({ deleted_at: now });
      } catch (err) {
        console.error(`[removeUserFromOrganization] Failed to remove from org database:`, err);
      }

      await getUsers().refresh();
      return { success: true };
    } catch (err) {
      console.error('[users.removeUserFromOrganization] error:', err);
      error(500, 'Failed to remove user from organization');
    }
  }
);

export const updateUserRole = guardedForm(
  v.object({
    userId: v.pipe(v.string(), v.nonEmpty()),
    organizationId: v.pipe(v.string(), v.nonEmpty()),
    roleId: v.pipe(v.string(), v.nonEmpty())
  }),
  async ({ userId, organizationId, roleId }) => {
    try {
      const { locals } = getRequestEvent();
      const db = await getDatabase(locals);

      // Get user
      const userResult = await db.users.where({ id: userId }).first();
      const user = userResult?.data;
      if (!user) error(404, 'User not found');

      // Get role name
      const roles = await locals.kuratchi?.roles?.getAllRoles?.(organizationId);
      const role = roles?.find((r: any) => r.id === roleId);
      if (!role) error(404, 'Role not found');

      // Update in organization database
      try {
        const orgDb = await getDatabase(locals, organizationId);
        await orgDb.users
          .where({ email: user.email })
          .update({ 
            role: role.name,
            updated_at: new Date().toISOString() 
          });
      } catch (err) {
        console.error(`[updateUserRole] Failed to update role in org database:`, err);
        error(500, 'Failed to update user role');
      }

      await getUsers().refresh();
      return { success: true };
    } catch (err) {
      console.error('[users.updateUserRole] error:', err);
      error(500, 'Failed to update user role');
    }
  }
);
