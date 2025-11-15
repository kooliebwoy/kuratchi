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
    const kur = (locals.kuratchi as any);
    return await kur?.roles?.getAllPermissions?.('admin') ?? [];
  } catch (err) {
    console.error('[roles.getPermissions] error:', err);
    return [];
  }
});

export const getRolePermissions = guardedQuery(async () => {
  try {
    const { locals } = getRequestEvent();
    const kur = (locals.kuratchi as any);
    return await kur?.roles?.getRolePermissions?.('admin') ?? { roles: [], permissions: [], byRole: {} };
  } catch (err) {
    console.error('[roles.getRolePermissions] error:', err);
    return { roles: [], permissions: [], byRole: {} };
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
  const kur = (locals.kuratchi as any);
  await kur?.roles?.createPermission?.({ value, label, description }, 'admin');
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
  const kur = (locals.kuratchi as any);
  await kur?.roles?.updatePermission?.(id, { value, label, description }, 'admin');
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
  const kur = (locals.kuratchi as any);
  await kur?.roles?.archivePermission?.(id, 'admin');
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
  const kur = (locals.kuratchi as any);
  await kur?.roles?.attachPermissionToRole?.(roleId, permissionId, 'admin');
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
  const kur = (locals.kuratchi as any);
  await kur?.roles?.detachPermissionFromRole?.(roleId, permissionId, 'admin');
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
    const kur = (locals.kuratchi as any);
    return await kur?.roles?.getAllRoles?.('admin') ?? [];
  } catch (err) {
    console.error('[roles.getRoles] error:', err);
    return [];
  }
});

export const getRoleAttachments = guardedQuery(async () => {
  try {
    const { locals } = getRequestEvent();
    const kur = (locals.kuratchi as any);
    return await kur?.roles?.getRoleAttachments?.('admin') ?? { roles: [], organizations: [], attachments: {} };
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
  const kur = (locals.kuratchi as any);
  const perms = normalizePermissions(permissions ?? '[]');
  const result = await kur?.roles?.createRole?.({ name, description, permissions: perms }, 'admin');
      await getRoles().refresh();
      return { success: true, id: result?.id };
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
  const kur = (locals.kuratchi as any);
  const data: any = {};
      if (name !== undefined) data.name = name;
      if (description !== undefined) data.description = description;
      if (permissions !== undefined) data.permissions = normalizePermissions(permissions);
      
  await kur?.roles?.updateRole?.(id, data, 'admin');
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
  const kur = (locals.kuratchi as any);
  await kur?.roles?.archiveRole?.(id, 'admin');
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
  const kur = (locals.kuratchi as any);
  await kur?.roles?.attachRoleToOrganization?.(roleId, organizationId, 'admin');
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
  const kur = (locals.kuratchi as any);
  await kur?.roles?.detachRoleFromOrganization?.(roleId, organizationId, 'admin');
      await getRoleAttachments().refresh();
      return { success: true };
    } catch (err) {
      console.error('[roles.detachRoleFromOrganization] error:', err);
      error(500, 'Failed to detach role from organization');
    }
  }
);
