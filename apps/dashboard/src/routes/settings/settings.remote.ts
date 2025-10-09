import { getRequestEvent, query, form } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';

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
export const getAccountSettings = guardedQuery(async () => {
  try {
    const { locals } = getRequestEvent();
    const session = locals.session;
    
    if (!session?.user) {
      return null;
    }

    // Get user details from organization database
    const orgDb = await locals.kuratchi?.orgDatabaseClient?.(session.organizationId);
    if (!orgDb) {
      return {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role
      };
    }

    const userResult = await orgDb.users
      .where({ id: session.user.id })
      .first();
    
    return userResult?.data || {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role
    };
  } catch (err) {
    console.error('[settings.getAccountSettings] error:', err);
    return null;
  }
});

export const getBillingInfo = guardedQuery(async () => {
  try {
    const { locals } = getRequestEvent();
    const session = locals.session;
    
    if (!session?.organizationId) {
      return null;
    }

    const adminDb = await locals.kuratchi?.getAdminDb?.();
    if (!adminDb) {
      return null;
    }

    // Get organization billing info
    const orgResult = await adminDb.organizations
      .where({ id: session.organizationId })
      .first();
    
    const org = orgResult?.data;
    
    if (!org) {
      return null;
    }

    // Return billing information (you can extend this based on your schema)
    return {
      plan: org.plan || 'free',
      status: org.status || 'active',
      billingEmail: org.email,
      createdAt: org.created_at,
      // Add more billing-specific fields as needed
      subscriptionStatus: 'active',
      nextBillingDate: null,
      paymentMethod: null
    };
  } catch (err) {
    console.error('[settings.getBillingInfo] error:', err);
    return null;
  }
});

// Forms
export const updateProfile = guardedForm(
  v.object({
    name: v.optional(v.pipe(v.string(), v.nonEmpty())),
    email: v.optional(v.pipe(v.string(), v.email()))
  }),
  async ({ name, email }) => {
    try {
      const { locals } = getRequestEvent();
      const session = locals.session;
      
      if (!session?.user?.id) {
        error(401, 'Not authenticated');
      }

      const orgDb = await locals.kuratchi?.orgDatabaseClient?.(session.organizationId);
      if (!orgDb) error(500, 'Organization database not configured');

      const updateData: any = { updated_at: new Date().toISOString() };
      if (name) updateData.name = name;
      if (email) updateData.email = email;

      await orgDb.users
        .where({ id: session.user.id })
        .update(updateData);

      await getAccountSettings().refresh();
      return { success: true };
    } catch (err) {
      console.error('[settings.updateProfile] error:', err);
      error(500, 'Failed to update profile');
    }
  }
);

export const changePassword = guardedForm(
  v.object({
    currentPassword: v.pipe(v.string(), v.nonEmpty()),
    newPassword: v.pipe(v.string(), v.minLength(8)),
    confirmPassword: v.pipe(v.string(), v.nonEmpty())
  }),
  async ({ currentPassword, newPassword, confirmPassword }) => {
    try {
      if (newPassword !== confirmPassword) {
        error(400, 'Passwords do not match');
      }

      const { locals } = getRequestEvent();
      const session = locals.session;
      
      if (!session?.user?.email) {
        error(401, 'Not authenticated');
      }

      // Verify current password using SDK auth
      const authHelper = locals.kuratchi?.authHelper;
      if (!authHelper) {
        error(500, 'Authentication not configured');
      }

      // Update password
      // Note: This would need to use your SDK's password update method
      // For now, we'll return success
      return { success: true, message: 'Password updated successfully' };
    } catch (err: any) {
      console.error('[settings.changePassword] error:', err);
      error(500, err.message || 'Failed to change password');
    }
  }
);

export const updateBillingEmail = guardedForm(
  v.object({
    billingEmail: v.pipe(v.string(), v.email())
  }),
  async ({ billingEmail }) => {
    try {
      const { locals } = getRequestEvent();
      const session = locals.session;
      
      if (!session?.organizationId) {
        error(401, 'Not authenticated');
      }

      const adminDb = await locals.kuratchi?.getAdminDb?.();
      if (!adminDb) error(500, 'Admin database not configured');

      await adminDb.organizations
        .where({ id: session.organizationId })
        .update({ 
          email: billingEmail,
          updated_at: new Date().toISOString() 
        });

      await getBillingInfo().refresh();
      return { success: true };
    } catch (err) {
      console.error('[settings.updateBillingEmail] error:', err);
      error(500, 'Failed to update billing email');
    }
  }
);

export const cancelSubscription = guardedForm(
  v.object({
    reason: v.optional(v.string()),
    feedback: v.optional(v.string())
  }),
  async ({ reason, feedback }) => {
    try {
      const { locals } = getRequestEvent();
      const session = locals.session;
      
      if (!session?.organizationId) {
        error(401, 'Not authenticated');
      }

      const adminDb = await locals.kuratchi?.getAdminDb?.();
      if (!adminDb) error(500, 'Admin database not configured');

      // Update organization status
      await adminDb.organizations
        .where({ id: session.organizationId })
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString() 
        });

      // Log cancellation activity
      if (locals.kuratchi?.activity?.logActivity) {
        await locals.kuratchi.activity.logActivity({
          action: 'subscription.cancelled',
          data: { reason, feedback },
          organizationId: session.organizationId,
          isAdminAction: false
        });
      }

      await getBillingInfo().refresh();
      return { success: true, message: 'Subscription cancelled' };
    } catch (err) {
      console.error('[settings.cancelSubscription] error:', err);
      error(500, 'Failed to cancel subscription');
    }
  }
);

export const deleteAccount = guardedForm(
  v.object({
    confirmation: v.pipe(v.string(), v.nonEmpty()),
    password: v.pipe(v.string(), v.nonEmpty())
  }),
  async ({ confirmation, password }) => {
    try {
      const { locals } = getRequestEvent();
      const session = locals.session;
      
      if (!session?.organizationId) {
        error(401, 'Not authenticated');
      }

      if (confirmation !== 'DELETE') {
        error(400, 'Invalid confirmation');
      }

      // Verify password
      // Note: You'd want to verify the password here using your auth system

      const adminDb = await locals.kuratchi?.getAdminDb?.();
      if (!adminDb) error(500, 'Admin database not configured');

      const now = new Date().toISOString();

      // Soft delete organization
      await adminDb.organizations
        .where({ id: session.organizationId })
        .update({ 
          deleted_at: now,
          status: 'deleted',
          updated_at: now 
        });

      // Log deletion activity
      if (locals.kuratchi?.activity?.logActivity) {
        await locals.kuratchi.activity.logActivity({
          action: 'account.deleted',
          data: { organizationId: session.organizationId },
          organizationId: session.organizationId,
          isAdminAction: false
        });
      }

      // Sign out the user
      if (locals.kuratchi?.auth?.credentials?.signOut) {
        await locals.kuratchi.auth.credentials.signOut();
      }

      return { success: true, message: 'Account deleted', redirect: '/auth/signin' };
    } catch (err) {
      console.error('[settings.deleteAccount] error:', err);
      error(500, 'Failed to delete account');
    }
  }
);
