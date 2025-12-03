import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (locals?.session && locals.session.user) {
    // User is already signed in, redirect to dashboard
    redirect(302, '/');
  }

  const turnstile = (locals.kuratchi as any)?.security?.turnstile || null;
  
  // Check for invite token
  const inviteToken = url.searchParams.get('invite');
  const inviteOrgId = url.searchParams.get('org');
  
  let invite = null;
  if (inviteToken && inviteOrgId) {
    try {
      // Validate invite token
      const orgDb = await (locals.kuratchi as any)?.orgDatabaseClient?.(inviteOrgId);
      if (orgDb) {
        const { data: invitedUser } = await orgDb.users
          .where({ invite_token: inviteToken })
          .first();
        
        if (invitedUser) {
          // Check if invite is expired
          const isExpired = invitedUser.invite_expires_at && invitedUser.invite_expires_at < Date.now();
          
          // Get organization name
          const adminDb = await (locals.kuratchi as any)?.getAdminDb?.();
          const { data: org } = await adminDb?.organizations
            ?.where({ id: inviteOrgId })
            .first() || {};
          
          invite = {
            valid: !isExpired,
            expired: isExpired,
            token: inviteToken,
            organizationId: inviteOrgId,
            organizationName: org?.organizationName || org?.name || 'Organization',
            email: invitedUser.email,
            name: invitedUser.name,
            role: invitedUser.role
          };
        } else {
          invite = { valid: false, error: 'invalid_token' };
        }
      }
    } catch (err) {
      console.error('[SignIn] Failed to validate invite:', err);
      invite = { valid: false, error: 'validation_failed' };
    }
  }
  
  return { turnstile, invite };
};

// Action to check user organizations (for multi-org login)
export const actions: Actions = {
  checkOrganizations: async ({ request, locals }) => {
    const formData = await request.formData();
    const email = formData.get('email')?.toString();
    
    if (!email) {
      return fail(400, { error: 'Email required' });
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
        return { organizations: [], hasMultiple: false };
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
      
      const validOrgs = organizations.filter(Boolean);
      
      return {
        organizations: validOrgs,
        hasMultiple: validOrgs.length > 1
      };
    } catch (err) {
      console.error('[checkOrganizations] Error:', err);
      return { organizations: [], error: 'Failed to check organizations' };
    }
  }
};
