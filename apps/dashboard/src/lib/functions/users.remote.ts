import { getRequestEvent, query, form } from '$app/server';
import * as v from 'valibot';
import { error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db-context';

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

// Forms
export const createUser = guardedForm(
  v.object({
    email: v.pipe(v.string(), v.email()),
    name: v.pipe(v.string(), v.nonEmpty()),
    password: v.optional(v.pipe(v.string(), v.minLength(8))),
    organizations: v.optional(v.string()), // JSON string of org IDs
    roles: v.optional(v.string()), // JSON string of role assignments
    isSuperAdmin: v.optional(v.boolean())
  }),
  async ({ email, name, password, organizations, roles, isSuperAdmin }) => {
    try {
      const { locals } = getRequestEvent();
      const db = await getDatabase(locals);

      // Check if user already exists
      const existingResult = await db.users
        .where({ email })
        .first();
      
      if (existingResult?.data) {
        error(400, 'User with this email already exists');
      }

      // Create user in admin database
      const userId = crypto.randomUUID();
      const now = new Date().toISOString();
      
      let password_hash: string | undefined;
      if (password) {
        const authHelper = locals.kuratchi?.authHelper;
        if (authHelper) {
          const hashedUser = await authHelper.createUser({ 
            id: userId,
            email, 
            name,
            password,
            role: isSuperAdmin ? 'superadmin' : 'user',
            created_at: now,
            updated_at: now
          }, false);
          password_hash = hashedUser?.password_hash;
        }
      }

      await db.users.insert({
        id: userId,
        email,
        name,
        password_hash,
        role: isSuperAdmin ? 'superadmin' : 'user',
        status: true,
        emailVerified: null,
        created_at: now,
        updated_at: now,
        deleted_at: null
      });

      // Parse organizations and roles
      const orgIds = organizations ? JSON.parse(organizations) : [];
      const roleAssignments = roles ? JSON.parse(roles) : {};

      // Add user to organizations
      for (const orgId of orgIds) {
        // Add to organizationUsers mapping
        await db.organizationUsers.insert({
          id: crypto.randomUUID(),
          organizationId: orgId,
          email,
          created_at: now,
          updated_at: now,
          deleted_at: null
        });

        // Add to organization database with role
        try {
          const orgDb = await getDatabase(locals, orgId);
          const role = roleAssignments[orgId] || 'member';
          await orgDb.users.insert({
            id: crypto.randomUUID(),
            email,
            name,
            password_hash,
            role,
            created_at: now,
            updated_at: now,
            deleted_at: null
          });
        } catch (err) {
          console.error(`[createUser] Failed to add user to org ${orgId}:`, err);
        }
      }

      await getUsers().refresh();
      return { success: true, userId };
    } catch (err: any) {
      console.error('[users.createUser] error:', err);
      error(500, err.message || 'Failed to create user');
    }
  }
);

export const updateUser = guardedForm(
  v.object({
    id: v.pipe(v.string(), v.nonEmpty()),
    email: v.optional(v.pipe(v.string(), v.email())),
    name: v.optional(v.pipe(v.string(), v.nonEmpty())),
    isSuperAdmin: v.optional(v.boolean()),
    status: v.optional(v.boolean())
  }),
  async ({ id, email, name, isSuperAdmin, status }) => {
    try {
      const { locals } = getRequestEvent();
      const db = await getDatabase(locals);

      const updateData: any = { updated_at: new Date().toISOString() };
      if (email !== undefined) updateData.email = email;
      if (name !== undefined) updateData.name = name;
      if (isSuperAdmin !== undefined) updateData.role = isSuperAdmin ? 'superadmin' : 'user';
      if (status !== undefined) updateData.status = status;

      await db.users
        .where({ id })
        .update(updateData);

      // If email changed, update organizationUsers mappings
      if (email) {
        const oldUserResult = await db.users.where({ id }).first();
        const oldEmail = oldUserResult?.data?.email;
        
        if (oldEmail && oldEmail !== email) {
          await db.organizationUsers
            .where({ email: oldEmail })
            .updateMany({ email });
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
      const db = await getDatabase(locals);

      await db.users
        .where({ id })
        .update({ 
          status: false,
          updated_at: new Date().toISOString() 
        });

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
      const db = await getDatabase(locals);

      await db.users
        .where({ id })
        .update({ 
          status: true,
          updated_at: new Date().toISOString() 
        });

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
      const db = await getDatabase(locals);

      const now = new Date().toISOString();

      // Get user email first
      const userResult = await db.users.where({ id }).first();
      const email = userResult?.data?.email;

      // Soft delete user
      await db.users
        .where({ id })
        .update({ deleted_at: now });

      // Soft delete organization mappings
      if (email) {
        await db.organizationUsers
          .where({ email })
          .updateMany({ deleted_at: now });

        // Also remove from organization databases
        const orgUsersResult = await db.organizationUsers
          .where({ email })
          .many();
        
        const orgUsers = orgUsersResult?.data || [];
        
        for (const ou of orgUsers) {
          try {
            const orgDb = await getDatabase(locals, ou.organizationId);
            await orgDb.users
                .where({ email })
                .update({ deleted_at: now });
          } catch (err) {
            console.error(`[deleteUser] Failed to remove user from org ${ou.organizationId}:`, err);
          }
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
