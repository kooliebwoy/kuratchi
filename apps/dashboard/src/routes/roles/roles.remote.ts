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

// Normalization for permissions submitted from UI:
// Accepts strings or objects { value, label?, description? }
function normalizePermissions(input: any): { value: string; label?: string; description?: string }[] {
  let arr: any[] = [];
  if (typeof input === 'string') {
    try { arr = JSON.parse(input); } catch { arr = []; }
  } else if (Array.isArray(input)) {
    arr = input;
  } else if (typeof input === 'object' && input) {
    arr = [input];
  }

  return arr
    .map((p) => (typeof p === 'string' ? { value: p } : { value: p.value, label: p.label, description: p.description }))
    .filter((p) => typeof p.value === 'string' && p.value.length > 0);
}

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

// Permissions registry
export const getPermissions = guardedQuery(async () => {
  try {
    const { locals } = getRequestEvent();
    const orm = await locals.kuratchi?.getAdminDb?.();
    const res = await orm.permissions
      .where({ deleted_at: { is: null }, isArchived: { eq: false } })
      .many();
    return ((res as any)?.data ?? res) as any[] || [];
  } catch (err) {
    console.error('[roles.getPermissions] error:', err);
    return [];
  }
});

export const getRolePermissions = guardedQuery(async () => {
  try {
    const { locals } = getRequestEvent();
    const orm = await locals.kuratchi?.getAdminDb?.();
    
    // Fetch permissions
    const permsRes = await orm.permissions
      .where({ deleted_at: { is: null }, isArchived: { eq: false } })
      .many();
    const perms = Array.isArray((permsRes as any)?.data) ? (permsRes as any).data : (Array.isArray(permsRes) ? permsRes : []);
    
    // Fetch rolePermissions with included permission data
    const rpRes = await orm.rolePermissions
      .where({ deleted_at: { is: null } })
      .include({ permissions: true })
      .many();
    const links = Array.isArray((rpRes as any)?.data) ? (rpRes as any).data : (Array.isArray(rpRes) ? rpRes : []);
    
    // Group by roleId
    const byRole: Record<string, any[]> = {};
    for (const link of links) {
      if (!link.permission) continue;
      if (!byRole[link.roleId]) byRole[link.roleId] = [];
      byRole[link.roleId].push(link.permission);
    }
    
    return { permissions: perms, byRole };
  } catch (err) {
    console.error('[roles.getRolePermissions] error:', err);
    return { permissions: [], byRole: {} };
  }
});

export const createPermission = guardedForm(
  v.object({
    value: v.pipe(v.string(), v.nonEmpty()),
    label: v.optional(v.string()),
    description: v.optional(v.string())
  }),
  async ({ value, label, description }) => {
    try {
      const { locals } = getRequestEvent();
    const orm = await locals.kuratchi?.getAdminDb?.();
      const now = new Date().toISOString();
      const result = await orm.permissions.insert({
        id: crypto.randomUUID(),
        value,
        label: label ?? null,
        description: description ?? null,
        isArchived: false,
        created_at: now,
        updated_at: now,
        deleted_at: null
      });
      if (!result.success) error(500, `Failed to create permission: ${result.error}`);
      await getPermissions().refresh();
      return { success: true };
    } catch (err) {
      console.error('[roles.createPermission] error:', err);
      error(500, 'Failed to create permission');
    }
  }
);

export const updatePermission = guardedForm(
  v.object({
    id: v.pipe(v.string(), v.nonEmpty()),
    value: v.optional(v.pipe(v.string(), v.nonEmpty())),
    label: v.optional(v.string()),
    description: v.optional(v.string())
  }),
  async ({ id, value, label, description }) => {
    try {
      const { locals } = getRequestEvent();
    const orm = await locals.kuratchi?.getAdminDb?.();
      const now = new Date().toISOString();
      const update: any = { updated_at: now };
      if (value !== undefined) update.value = value;
      if (label !== undefined) update.label = label;
      if (description !== undefined) update.description = description;
      const result = await orm.permissions.where({ id }).update(update);
      if (!result.success) error(500, `Failed to update permission: ${result.error}`);
      await getPermissions().refresh();
      return { success: true };
    } catch (err) {
      console.error('[roles.updatePermission] error:', err);
      error(500, 'Failed to update permission');
    }
  }
);

export const archivePermission = guardedForm(
  v.object({ id: v.pipe(v.string(), v.nonEmpty()) }),
  async ({ id }) => {
    try {
      const { locals } = getRequestEvent();
    const orm = await locals.kuratchi?.getAdminDb?.();
      const now = new Date().toISOString();
      const result = await orm.permissions.where({ id }).update({ isArchived: true, updated_at: now });
      if (!result.success) error(500, `Failed to archive permission: ${result.error}`);
      await getPermissions().refresh();
      return { success: true };
    } catch (err) {
      console.error('[roles.archivePermission] error:', err);
      error(500, 'Failed to archive permission');
    }
  }
);

export const attachPermissionToRole = guardedForm(
  v.object({ roleId: v.pipe(v.string(), v.nonEmpty()), permissionId: v.pipe(v.string(), v.nonEmpty()) }),
  async ({ roleId, permissionId }) => {
    try {
      const { locals } = getRequestEvent();
    const orm = await locals.kuratchi?.getAdminDb?.();
      const now = new Date().toISOString();
      const exists = await orm.rolePermissions
        .where({ roleId, permissionId, deleted_at: { is: null } })
        .many();
      const arr = (((exists as any)?.data ?? exists) as any[]) || [];
      if (!arr[0]) {
        const result = await orm.rolePermissions.insert({
          id: crypto.randomUUID(),
          roleId,
          permissionId,
          created_at: now,
          updated_at: now,
          deleted_at: null
        });
        if (!result.success) error(500, `Failed to attach permission: ${result.error}`);
      }
      await getRolePermissions().refresh();
      return { success: true };
    } catch (err) {
      console.error('[roles.attachPermissionToRole] error:', err);
      error(500, 'Failed to attach permission to role');
    }
  }
);

export const detachPermissionFromRole = guardedForm(
  v.object({ roleId: v.pipe(v.string(), v.nonEmpty()), permissionId: v.pipe(v.string(), v.nonEmpty()) }),
  async ({ roleId, permissionId }) => {
    try {
      const { locals } = getRequestEvent();
    const orm = await locals.kuratchi?.getAdminDb?.();
      const now = new Date().toISOString();
      const result = await orm.rolePermissions
        .where({ roleId, permissionId, deleted_at: { is: null } })
        .update({ deleted_at: now, updated_at: now });
      if (!result.success) error(500, `Failed to detach permission: ${result.error}`);
      await getRolePermissions().refresh();
      return { success: true };
    } catch (err) {
      console.error('[roles.detachPermissionFromRole] error:', err);
      error(500, 'Failed to detach permission from role');
    }
  }
);
// Queries
export const getRoles = guardedQuery(async () => {
  try {
    const { locals } = getRequestEvent();
    const orm = await locals.kuratchi?.getAdminDb?.();
    const result = await orm.roles
      .where({ deleted_at: { is: null }, isArchived: { eq: false } })
      .many();
    return result?.data ?? result ?? [];
  } catch (err) {
    console.error('[roles.getRoles] error:', err);
    return [];
  }
});

export const getRoleAttachments = guardedQuery(async () => {
  try {
    const { locals } = getRequestEvent();
    const orm = await locals.kuratchi?.getAdminDb?.();
    
    const [rolesRes, orgsRes, attachesRes] = await Promise.all([
      orm.roles.where({ deleted_at: { is: null }, isArchived: { eq: false } }).many(),
      orm.organizations.where({ deleted_at: { is: null } }).many(),
      orm.organizationRoles
        .where({ deleted_at: { is: null } })
        .include({ organizations: true })
        .many(),
    ]);

    const roles = Array.isArray((rolesRes as any)?.data) ? (rolesRes as any).data : (Array.isArray(rolesRes) ? rolesRes : []);
    const orgs = Array.isArray((orgsRes as any)?.data) ? (orgsRes as any).data : (Array.isArray(orgsRes) ? orgsRes : []);
    const links = Array.isArray((attachesRes as any)?.data) ? (attachesRes as any).data : (Array.isArray(attachesRes) ? attachesRes : []);

    const byRole: Record<string, any[]> = {};
    for (const link of links) {
      if (!byRole[link.roleId]) byRole[link.roleId] = [];
      if (link.organization) {
        byRole[link.roleId].push({ 
          id: link.organization.id, 
          name: link.organization.organizationName, 
          slug: link.organization.organizationSlug 
        });
      }
    }

    return { roles, organizations: orgs, attachments: byRole };
  } catch (err) {
    console.error('[roles.getRoleAttachments] error:', err);
    return { roles: [], organizations: [], attachments: {} };
  }
});

// Forms
export const createRole = guardedForm(
  v.object({
    name: v.pipe(v.string(), v.nonEmpty()),
    description: v.optional(v.string()),
    permissions: v.optional(v.any()) // JSON string or array
  }),
  async ({ name, description, permissions }) => {
    try {
      const { locals } = getRequestEvent();
    const orm = await locals.kuratchi?.getAdminDb?.();
      const now = new Date().toISOString();
      const id = crypto.randomUUID();

      const perms = normalizePermissions(permissions ?? '[]');

      const result = await orm.roles.insert({
        id,
        name,
        description: description ?? null,
        permissions: perms,
        isArchived: false,
        created_at: now,
        updated_at: now,
        deleted_at: null
      });

      if (!result.success) error(500, `Failed to create role: ${result.error}`);

      await getRoles().refresh();
      return { success: true, id };
    } catch (err) {
      console.error('[roles.createRole] error:', err);
      error(500, 'Failed to create role');
    }
  }
);

export const updateRole = guardedForm(
  v.object({
    id: v.pipe(v.string(), v.nonEmpty()),
    name: v.optional(v.pipe(v.string(), v.nonEmpty())),
    description: v.optional(v.string()),
    permissions: v.optional(v.any())
  }),
  async ({ id, name, description, permissions }) => {
    try {
      const { locals } = getRequestEvent();
    const orm = await locals.kuratchi?.getAdminDb?.();
      const now = new Date().toISOString();

      const update: any = { updated_at: now };
      if (name !== undefined) update.name = name;
      if (description !== undefined) update.description = description;
      if (permissions !== undefined) update.permissions = normalizePermissions(permissions);

      const result = await orm.roles.where({ id }).update(update);
      if (!result.success) error(500, `Failed to update role: ${result.error}`);

      await getRoles().refresh();
      return { success: true };
    } catch (err) {
      console.error('[roles.updateRole] error:', err);
      error(500, 'Failed to update role');
    }
  }
);

export const archiveRole = guardedForm(
  v.object({ id: v.pipe(v.string(), v.nonEmpty()) }),
  async ({ id }) => {
    try {
      const { locals } = getRequestEvent();
    const orm = await locals.kuratchi?.getAdminDb?.();
      const now = new Date().toISOString();
      const result = await orm.roles.where({ id }).update({ isArchived: true, updated_at: now });
      if (!result.success) error(500, `Failed to archive role: ${result.error}`);
      await getRoles().refresh();
      return { success: true };
    } catch (err) {
      console.error('[roles.archiveRole] error:', err);
      error(500, 'Failed to archive role');
    }
  }
);

export const attachRoleToOrganization = guardedForm(
  v.object({ roleId: v.pipe(v.string(), v.nonEmpty()), organizationId: v.pipe(v.string(), v.nonEmpty()) }),
  async ({ roleId, organizationId }) => {
    try {
      const { locals } = getRequestEvent();
    const orm = await locals.kuratchi?.getAdminDb?.();
      const now = new Date().toISOString();
      const exists = await orm.organizationRoles.where({ roleId, organizationId, deleted_at: { is: null } }).many();
      const arr = ((exists as any)?.data ?? exists) as any[];
      const present = arr[0];
      if (!present) {
        const result = await orm.organizationRoles.insert({
          id: crypto.randomUUID(),
          roleId,
          organizationId,
          created_at: now,
          updated_at: now,
          deleted_at: null
        });
        if (!result.success) error(500, `Failed to attach role: ${result.error}`);
      }
      await getRoleAttachments().refresh();
      return { success: true };
    } catch (err) {
      console.error('[roles.attachRoleToOrganization] error:', err);
      error(500, 'Failed to attach role to organization');
    }
  }
);

export const detachRoleFromOrganization = guardedForm(
  v.object({ roleId: v.pipe(v.string(), v.nonEmpty()), organizationId: v.pipe(v.string(), v.nonEmpty()) }),
  async ({ roleId, organizationId }) => {
    try {
      const { locals } = getRequestEvent();
    const orm = await locals.kuratchi?.getAdminDb?.();
      const now = new Date().toISOString();
      const result = await orm.organizationRoles
        .where({ roleId, organizationId, deleted_at: { is: null } })
        .update({ deleted_at: now, updated_at: now });
      if (!result.success) error(500, `Failed to detach role: ${result.error}`);
      await getRoleAttachments().refresh();
      return { success: true };
    } catch (err) {
      console.error('[roles.detachRoleFromOrganization] error:', err);
      error(500, 'Failed to detach role from organization');
    }
  }
);
