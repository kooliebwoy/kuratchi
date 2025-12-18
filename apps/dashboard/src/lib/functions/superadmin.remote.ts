import { getRequestEvent, query, form } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { getSuperadminDatabase, getDatabase, getAdminDatabase } from '$lib/server/db-context';
import { env } from '$env/dynamic/private';

// Helpers
const superadminQuery = <R>(fn: () => Promise<R>) => {
  return query(async () => {
    const { locals } = getRequestEvent();
    const isSuperadmin = locals.kuratchi?.superadmin?.isSuperadmin?.();
    
    if (!isSuperadmin) {
      error(403, 'Superadmin access required');
    }
    
    return fn();
  });
};

const superadminForm = <R>(
  schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
  fn: (data: any) => Promise<R>
) => {
  return form(schema as any, async (data: any) => {
    const { locals } = getRequestEvent();
    const isSuperadmin = locals.kuratchi?.superadmin?.isSuperadmin?.();
    
    if (!isSuperadmin) {
      error(403, 'Superadmin access required');
    }


    return fn(data);
  });
};

// ============================================================================
// ORGANIZATIONS MANAGEMENT
// ============================================================================

export const getAllOrganizations = superadminQuery(async () => {
  try {
    const { locals } = getRequestEvent();
    const db = await getSuperadminDatabase(locals); // Gets admin DB for superadmins

    const result = await db.organizations
      .where({ deleted_at: { isNullish: true } })
      .orderBy({ created_at: 'desc' })
      .many();

    const organizations = result?.data || [];

    // Get user counts for each org
    const orgsWithStats = await Promise.all(organizations.map(async (org: any) => {
      try {
        // Get org database to count users
        const orgDb = await getDatabase(locals, org.id);
        const usersResult = await orgDb.users
          .where({ deleted_at: { isNullish: true } })
          .many();
        
        return {
          ...org,
          userCount: usersResult?.data?.length || 0
        };
      } catch (err) {
        console.error(`[getAllOrganizations] Failed to get stats for org ${org.id}:`, err);
        return {
          ...org,
          userCount: 0
        };
      }
    }));

    return orgsWithStats;
  } catch (err) {
    console.error('[superadmin.getAllOrganizations] error:', err);
    return [];
  }
});

export const createOrganization = superadminForm(
  v.object({
    name: v.pipe(v.string(), v.nonEmpty()),
    slug: v.pipe(v.string(), v.nonEmpty()),
    description: v.optional(v.string())
  }),
  async ({ name, slug, description }) => {
    try {
      const { locals } = getRequestEvent();
      const db = await getSuperadminDatabase(locals);

      // Check if slug already exists
      const existingResult = await db.organizations
        .where({ slug })
        .first();
      
      if (existingResult?.data) {
        error(400, 'Organization with this slug already exists');
      }

      const now = new Date().toISOString();
      const orgId = crypto.randomUUID();

      await db.organizations.insert({
        id: orgId,
        name,
        slug,
        description: description || null,
        created_at: now,
        updated_at: now,
        deleted_at: null
      });

      await getAllOrganizations().refresh();
      return { success: true, organizationId: orgId };
    } catch (err: any) {
      console.error('[superadmin.createOrganization] error:', err);
      error(500, err.message || 'Failed to create organization');
    }
  }
);

// Lightweight search for organizations by name/slug (superadmin only)
export const searchOrganizations = superadminForm(
  v.object({
    term: v.pipe(v.string(), v.minLength(1))
  }),
  async ({ term }) => {
    try {
      const { locals } = getRequestEvent();
      const db = await getSuperadminDatabase(locals);
      const q = (term || '').trim().toLowerCase();
      
      console.log('[searchOrganizations] Searching for:', q);
      
      if (!q) return [];

      // Fetch recent orgs and filter in-memory (portable). Limit to 20 results.
      const result = await db.organizations
        .where({ deleted_at: { isNullish: true } })
        .orderBy({ created_at: 'desc' })
        .limit(200)
        .many();

      const orgs = (result?.data || []) as Array<any>;
      console.log('[searchOrganizations] Total orgs fetched:', orgs.length);
      console.log('[searchOrganizations] Sample org:', orgs[0]);
      
      const filtered = orgs
        .filter((o) => {
          // Try multiple field name variations
          const name = (o.name || o.organizationName || '').toLowerCase();
          const slug = (o.slug || o.organizationSlug || '').toLowerCase();
          const matches = name.includes(q) || slug.includes(q);
          return matches;
        })
        .slice(0, 20)
        .map((o) => ({ 
          id: o.id, 
          name: o.name || o.organizationName,
          slug: o.slug || o.organizationSlug 
        }));

      console.log('[searchOrganizations] Filtered results:', filtered.length);
      return filtered;
    } catch (err) {
      console.error('[searchOrganizations] error:', err);
      return [];
    }
  }
);


export const updateOrganization = superadminForm(
  v.object({
    id: v.pipe(v.string(), v.nonEmpty()),
    name: v.optional(v.pipe(v.string(), v.nonEmpty())),
    slug: v.optional(v.pipe(v.string(), v.nonEmpty())),
    description: v.optional(v.string())
  }),
  async ({ id, name, slug, description }) => {
    try {
      const { locals } = getRequestEvent();
      const db = await getSuperadminDatabase(locals);

      const updateData: any = { updated_at: new Date().toISOString() };
      if (name !== undefined) updateData.name = name;
      if (slug !== undefined) updateData.slug = slug;
      if (description !== undefined) updateData.description = description;

      await db.organizations
        .where({ id })
        .update(updateData);

      await getAllOrganizations().refresh();
      return { success: true };
    } catch (err) {
      console.error('[superadmin.updateOrganization] error:', err);
      error(500, 'Failed to update organization');
    }
  }
);

export const deleteOrganization = superadminForm(
  v.object({ id: v.pipe(v.string(), v.nonEmpty()) }),
  async ({ id }) => {
    try {
      const { locals } = getRequestEvent();
      const db = await getSuperadminDatabase(locals);

      const now = new Date().toISOString();

      // Soft delete organization
      await db.organizations
        .where({ id })
        .update({ deleted_at: now });

      // Soft delete all organization user mappings
      await db.organizationUsers
        .where({ organizationId: id })
        .updateMany({ deleted_at: now });

      await getAllOrganizations().refresh();
      return { success: true };
    } catch (err) {
      console.error('[superadmin.deleteOrganization] error:', err);
      error(500, 'Failed to delete organization');
    }
  }
);

// ============================================================================
// USERS MANAGEMENT (Platform-wide)
// ============================================================================

export const getAllUsers = superadminQuery(async () => {
  try {
    const { locals } = getRequestEvent();
    const db = await getSuperadminDatabase(locals);

    // Get all users from admin database
    const usersResult = await db.users
      .where({ deleted_at: { isNullish: true } })
      .orderBy({ created_at: 'desc' })
      .many();
    
    const users = usersResult?.data || [];

    // Get all organization users mappings
    const orgUsersResult = await db.organizationUsers
      .where({ deleted_at: { isNullish: true } })
      .many();
    
    const orgUsers = orgUsersResult?.data || [];

    // Get all organizations
    const orgsResult = await db.organizations
      .where({ deleted_at: { isNullish: true } })
      .many();
    
    const organizations = orgsResult?.data || [];

    // Create a map of email to organizations
    const emailToOrgs: Record<string, any[]> = {};
    for (const ou of orgUsers) {
      if (!emailToOrgs[ou.email]) {
        emailToOrgs[ou.email] = [];
      }
      const org = organizations.find((o: any) => o.id === ou.organizationId);
      if (org) {
        emailToOrgs[ou.email].push(org);
      }
    }

    // Get roles for each user in their organizations
    const usersWithDetails = await Promise.all(users.map(async (user: any) => {
      const userOrgs = emailToOrgs[user.email] || [];
      
      // For each org, get the user's role from the org database
      const orgDetails = await Promise.all(userOrgs.map(async (org: any) => {
        try {
          const orgDb = await getDatabase(locals, org.id);

          const orgUserResult = await orgDb.users
            .where({ email: user.email })
            .first();
          
          const orgUser = orgUserResult?.data;
          
          return {
            ...org,
            userRole: orgUser?.role || null,
            isOrgAdmin: orgUser?.role === 'owner' || orgUser?.role === 'admin'
          };
        } catch (err) {
          console.error(`[getAllUsers] Failed to get role for user ${user.email} in org ${org.id}:`, err);
          return { ...org, userRole: null, isOrgAdmin: false };
        }
      }));

      return {
        ...user,
        organizations: orgDetails,
        isSuperAdmin: user.role === 'superadmin'
      };
    }));

    return usersWithDetails;
  } catch (err) {
    console.error('[superadmin.getAllUsers] error:', err);
    return [];
  }
});

// ============================================================================
// DATABASE MANAGEMENT
// ============================================================================

export const getAllDatabases = superadminQuery(async () => {
  try {
    const { locals } = getRequestEvent();
    const db = await getSuperadminDatabase(locals);

    const result = await db.databases
      .where({ deleted_at: { isNullish: true } })
      .orderBy({ created_at: 'desc' })
      .many();

    return result?.data || [];
  } catch (err) {
    console.error('[superadmin.getAllDatabases] error:', err);
    return [];
  }
});

// ============================================================================
// ACTIVITY LOGS (Platform-wide)
// ============================================================================

export const getPlatformActivity = superadminQuery(async () => {
  try {
    const { locals } = getRequestEvent();
    const db = await getSuperadminDatabase(locals);

    // Get recent activity from admin database
    const result = await db.activity
      .orderBy({ timestamp: 'desc' })
      .limit(100)
      .many();

    return result?.data || [];
  } catch (err) {
    console.error('[superadmin.getPlatformActivity] error:', err);
    return [];
  }
});

// ============================================================================
// ORGANIZATION SWITCHING (for superadmins)
// ============================================================================

export const switchToOrganization = superadminForm(
  v.object({
    organizationId: v.pipe(v.string(), v.nonEmpty())
  }),
  async ({ organizationId }) => {
    try {
      const { locals } = getRequestEvent();
      
      // Verify organization exists
      const db = await getSuperadminDatabase(locals);
      const orgResult = await db.organizations
        .where({ id: organizationId, deleted_at: { isNullish: true } })
        .first();
      
      if (!orgResult?.data) {
        error(404, 'Organization not found');
      }

      // Set the active organization
      locals.kuratchi?.superadmin?.setOrganization?.(organizationId, true);

      return { success: true, organization: orgResult.data };
    } catch (err: any) {
      console.error('[superadmin.switchToOrganization] error:', err);
      error(500, err.message || 'Failed to switch organization');
    }
  }
);

export const clearOrganization = superadminForm(
  v.object({}),
  async () => {
    try {
      const { locals } = getRequestEvent();
      
      // Clear the active organization (back to admin mode)
      locals.kuratchi?.superadmin?.clearOrganization?.();

      return { success: true };
    } catch (err) {
      console.error('[superadmin.clearOrganization] error:', err);
      error(500, 'Failed to clear organization');
    }
  }
);

// Alias for clarity in UI code
export const setActiveOrganization = switchToOrganization;

/**
 * Create a new superadmin user with their own organization
 * This is unprotected for initial setup, but should be protected with superadmin guard later
 */
export const createSuperadminUser = form(
  v.object({
    email: v.pipe(v.string(), v.email()),
    password: v.pipe(v.string(), v.minLength(8)),
    name: v.pipe(v.string(), v.nonEmpty()),
    organizationName: v.optional(v.string())
  }),
  async ({ email, password, name, organizationName }) => {
    try {
      const { locals } = getRequestEvent();
      const kuratchi = locals.kuratchi as any; // Added type casting
      
      // Get admin database
      const adminDb = await getAdminDatabase(locals);
      
      // Check if user already exists
      const existingUser = await adminDb.users
        .where({ email })
        .first();
      
      if (existingUser?.data) {
        error(400, 'User with this email already exists');
      }
      

      // Create organization using SDK
      const orgResult = await kuratchi.auth.admin.createSuperadmin({
        name,
        organizationName,
        email,
        password
      });

      if (!orgResult.success) {
        error(orgResult.status || 500, orgResult.message || 'Failed to create organization');
      }

      
      // Refresh the users and organizations lists
      await getAllUsers().refresh();
      // await getAllOrganizations().refresh();
      
      return { success: true };
    } catch (err: any) {
      console.error('[createSuperadminUser] Error:', err);
      error(err.status || 500, err.message || 'Failed to create superadmin');
    }
  }
);

// ============================================================================
// DELETE SUPERADMIN (HARD DELETE)
// ============================================================================

export const deleteSuperadmin = superadminForm(
  v.object({ 
    email: v.pipe(v.string(), v.email())
  }),
  async ({ email }) => {
    try {
      const { locals } = getRequestEvent();
      const adminDb = await getAdminDatabase(locals);
      const kuratchi = locals.kuratchi as any; // Added type casting
      
      // 1. Find the superadmin user in admin DB
      const userResult = await adminDb.users
        .where({ email, role: 'superadmin' })
        .first();
      
      if (!userResult?.data) {
        error(404, 'Superadmin user not found');
      }
      
      const user = userResult.data;
      
      // 2. Find the user's organization(s)
      const orgUsersResult = await adminDb.organizationUsers
        .where({ email })
        .many();
      
      const orgUsers = orgUsersResult?.data || [];
      
      // 3. For each organization, delete it (which will cascade delete the database)
      for (const orgUser of orgUsers) {
        if (orgUser.organizationId) {
          try {
            // Use the admin plugin's deleteOrganization method
            await kuratchi.auth.admin.deleteOrganization(orgUser.organizationId);
            console.log(`[deleteSuperadmin] Deleted organization: ${orgUser.organizationId}`);
          } catch (err) {
            console.error(`[deleteSuperadmin] Failed to delete organization ${orgUser.organizationId}:`, err);
            // Continue with other organizations
          }
        }
      }
      
      // 4. Delete the user from admin DB (hard delete)
      await adminDb.users
        .delete({ email });
      
      console.log(`[deleteSuperadmin] Deleted superadmin user: ${email}`);
      
      // Refresh the lists
      await getAllUsers().refresh();
      await getAllOrganizations().refresh();
      
      return { success: true };
    } catch (err: any) {
      console.error('[deleteSuperadmin] Error:', err);
      error(err.status || 500, err.message || 'Failed to delete superadmin');
    }
  }
);

