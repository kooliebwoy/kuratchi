/**
 * Platform Roles & Permissions API
 * 
 * Manage roles and permissions at the platform level.
 * These are global resources that can be assigned to organizations.
 */

import type { PlatformClient, ApiResponse } from './platform.js';

// ==================== Types ====================

export interface Permission {
  id: string;
  value: string;
  label: string | null;
  description: string | null;
  category: string | null;
  isArchived: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: any[]; // JSON array of permission objects
  isArchived: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RoleWithPermissions extends Role {
  permissionObjects?: Permission[];
}

export interface RoleWithOrganizations extends Role {
  organizations?: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
}

export interface CreatePermissionRequest {
  value: string;
  label?: string;
  description?: string;
  category?: string;
}

export interface UpdatePermissionRequest {
  value?: string;
  label?: string;
  description?: string;
  category?: string;
}

export interface CreateRoleRequest {
  name: string;
  description?: string;
  permissions?: any[];
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  permissions?: any[];
}

export interface ListPermissionsOptions {
  category?: string;
  includeArchived?: boolean;
}

export interface ListRolesOptions {
  includeArchived?: boolean;
  organizationId?: string;
}

export interface GetRoleOptions {
  includePermissions?: boolean;
  includeOrganizations?: boolean;
}

// ==================== Permissions API ====================

/**
 * Permissions Registry API
 * 
 * Manage the global registry of permissions available on the platform.
 * Permissions define individual capabilities that can be assigned to roles.
 * 
 * @example
 * ```typescript
 * const platform = cloud.createPlatform({ apiKey: 'key' });
 * 
 * // List all permissions
 * const perms = await platform.permissions.list();
 * 
 * // Create permission
 * await platform.permissions.create({
 *   value: 'posts.create',
 *   label: 'Create Posts',
 *   description: 'Ability to create new posts',
 *   category: 'content'
 * });
 * 
 * // Update permission
 * await platform.permissions.update('perm-id', {
 *   label: 'Create Blog Posts'
 * });
 * ```
 */
export class PermissionsAPI {
  constructor(private platform: PlatformClient) {}

  /**
   * List all permissions
   * 
   * @example
   * ```typescript
   * const result = await platform.permissions.list({
   *   category: 'content',
   *   includeArchived: false
   * });
   * 
   * if (result.success) {
   *   console.log('Permissions:', result.data);
   * }
   * ```
   */
  async list(options?: ListPermissionsOptions): Promise<ApiResponse<Permission[]>> {
    const params = new URLSearchParams();
    if (options?.category) params.set('category', options.category);
    if (options?.includeArchived) params.set('includeArchived', 'true');

    const query = params.toString();
    const endpoint = `/api/v1/platform/permissions${query ? `?${query}` : ''}`;
    
    return this.platform.request<Permission[]>(endpoint);
  }

  /**
   * Get a single permission by ID
   * 
   * @example
   * ```typescript
   * const result = await platform.permissions.get('perm-id');
   * 
   * if (result.success) {
   *   console.log('Permission:', result.data);
   * }
   * ```
   */
  async get(id: string): Promise<ApiResponse<Permission>> {
    return this.platform.request<Permission>(`/api/v1/platform/permissions/${id}`);
  }

  /**
   * Create a new permission
   * 
   * @example
   * ```typescript
   * const result = await platform.permissions.create({
   *   value: 'posts.create',
   *   label: 'Create Posts',
   *   description: 'Ability to create new posts',
   *   category: 'content'
   * });
   * 
   * if (result.success) {
   *   console.log('Permission created:', result.data);
   * }
   * ```
   */
  async create(request: CreatePermissionRequest): Promise<ApiResponse<Permission>> {
    return this.platform.request<Permission>('/api/v1/platform/permissions', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  /**
   * Update an existing permission
   * 
   * @example
   * ```typescript
   * const result = await platform.permissions.update('perm-id', {
   *   label: 'Create Blog Posts',
   *   description: 'Updated description'
   * });
   * 
   * if (result.success) {
   *   console.log('Permission updated');
   * }
   * ```
   */
  async update(id: string, updates: UpdatePermissionRequest): Promise<ApiResponse<Permission>> {
    return this.platform.request<Permission>(`/api/v1/platform/permissions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  /**
   * Delete (soft delete) a permission
   * 
   * @example
   * ```typescript
   * await platform.permissions.delete('perm-id');
   * ```
   */
  async delete(id: string): Promise<ApiResponse<void>> {
    return this.platform.request<void>(`/api/v1/platform/permissions/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Archive a permission (soft archive, not deleted)
   * 
   * @example
   * ```typescript
   * await platform.permissions.archive('perm-id');
   * ```
   */
  async archive(id: string): Promise<ApiResponse<void>> {
    return this.platform.request<void>(`/api/v1/platform/permissions/${id}/archive`, {
      method: 'POST'
    });
  }

  /**
   * Unarchive a permission
   * 
   * @example
   * ```typescript
   * await platform.permissions.unarchive('perm-id');
   * ```
   */
  async unarchive(id: string): Promise<ApiResponse<void>> {
    return this.platform.request<void>(`/api/v1/platform/permissions/${id}/unarchive`, {
      method: 'POST'
    });
  }
}

// ==================== Roles API ====================

/**
 * Roles Management API
 * 
 * Manage roles at the platform level. Roles are collections of permissions
 * that can be assigned to organizations and users.
 * 
 * @example
 * ```typescript
 * const platform = cloud.createPlatform({ apiKey: 'key' });
 * 
 * // List all roles
 * const roles = await platform.roles.list();
 * 
 * // Create role
 * await platform.roles.create({
 *   name: 'editor',
 *   description: 'Content editor role',
 *   permissions: [
 *     { value: 'posts.create', label: 'Create Posts' },
 *     { value: 'posts.edit', label: 'Edit Posts' }
 *   ]
 * });
 * 
 * // Attach role to organization
 * await platform.roles.attachToOrganization('role-id', 'org-id');
 * ```
 */
export class RolesAPI {
  constructor(private platform: PlatformClient) {}

  /**
   * List all roles
   * 
   * @example
   * ```typescript
   * const result = await platform.roles.list({
   *   includeArchived: false,
   *   organizationId: 'org-123' // Filter by organization
   * });
   * 
   * if (result.success) {
   *   console.log('Roles:', result.data);
   * }
   * ```
   */
  async list(options?: ListRolesOptions): Promise<ApiResponse<Role[]>> {
    const params = new URLSearchParams();
    if (options?.includeArchived) params.set('includeArchived', 'true');
    if (options?.organizationId) params.set('organizationId', options.organizationId);

    const query = params.toString();
    const endpoint = `/api/v1/platform/roles${query ? `?${query}` : ''}`;
    
    return this.platform.request<Role[]>(endpoint);
  }

  /**
   * Get a single role by ID
   * 
   * @example
   * ```typescript
   * const result = await platform.roles.get('role-id', {
   *   includePermissions: true,
   *   includeOrganizations: true
   * });
   * 
   * if (result.success) {
   *   console.log('Role:', result.data);
   *   console.log('Permissions:', result.data.permissionObjects);
   *   console.log('Organizations:', result.data.organizations);
   * }
   * ```
   */
  async get(id: string, options?: GetRoleOptions): Promise<ApiResponse<RoleWithPermissions & RoleWithOrganizations>> {
    const params = new URLSearchParams();
    if (options?.includePermissions) params.set('includePermissions', 'true');
    if (options?.includeOrganizations) params.set('includeOrganizations', 'true');

    const query = params.toString();
    const endpoint = `/api/v1/platform/roles/${id}${query ? `?${query}` : ''}`;
    
    return this.platform.request<RoleWithPermissions & RoleWithOrganizations>(endpoint);
  }

  /**
   * Get role by name
   * 
   * @example
   * ```typescript
   * const result = await platform.roles.getByName('editor');
   * 
   * if (result.success) {
   *   console.log('Editor role:', result.data);
   * }
   * ```
   */
  async getByName(name: string, options?: GetRoleOptions): Promise<ApiResponse<RoleWithPermissions & RoleWithOrganizations>> {
    const params = new URLSearchParams();
    params.set('name', name);
    if (options?.includePermissions) params.set('includePermissions', 'true');
    if (options?.includeOrganizations) params.set('includeOrganizations', 'true');

    const query = params.toString();
    const endpoint = `/api/v1/platform/roles/by-name${query ? `?${query}` : ''}`;
    
    return this.platform.request<RoleWithPermissions & RoleWithOrganizations>(endpoint);
  }

  /**
   * Create a new role
   * 
   * @example
   * ```typescript
   * const result = await platform.roles.create({
   *   name: 'editor',
   *   description: 'Content editor role',
   *   permissions: [
   *     { value: 'posts.create', label: 'Create Posts' },
   *     { value: 'posts.edit', label: 'Edit Posts' }
   *   ]
   * });
   * 
   * if (result.success) {
   *   console.log('Role created:', result.data);
   * }
   * ```
   */
  async create(request: CreateRoleRequest): Promise<ApiResponse<Role>> {
    return this.platform.request<Role>('/api/v1/platform/roles', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  /**
   * Update an existing role
   * 
   * @example
   * ```typescript
   * const result = await platform.roles.update('role-id', {
   *   permissions: [
   *     { value: 'posts.*', label: 'All Post Permissions' },
   *     { value: 'media.upload', label: 'Upload Media' }
   *   ]
   * });
   * 
   * if (result.success) {
   *   console.log('Role updated');
   * }
   * ```
   */
  async update(id: string, updates: UpdateRoleRequest): Promise<ApiResponse<Role>> {
    return this.platform.request<Role>(`/api/v1/platform/roles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  /**
   * Delete (soft delete) a role
   * 
   * @example
   * ```typescript
   * await platform.roles.delete('role-id');
   * ```
   */
  async delete(id: string): Promise<ApiResponse<void>> {
    return this.platform.request<void>(`/api/v1/platform/roles/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Archive a role
   * 
   * @example
   * ```typescript
   * await platform.roles.archive('role-id');
   * ```
   */
  async archive(id: string): Promise<ApiResponse<void>> {
    return this.platform.request<void>(`/api/v1/platform/roles/${id}/archive`, {
      method: 'POST'
    });
  }

  /**
   * Unarchive a role
   * 
   * @example
   * ```typescript
   * await platform.roles.unarchive('role-id');
   * ```
   */
  async unarchive(id: string): Promise<ApiResponse<void>> {
    return this.platform.request<void>(`/api/v1/platform/roles/${id}/unarchive`, {
      method: 'POST'
    });
  }

  // ==================== Permission Associations ====================

  /**
   * Attach a permission to a role
   * 
   * @example
   * ```typescript
   * await platform.roles.attachPermission('role-id', 'perm-id');
   * ```
   */
  async attachPermission(roleId: string, permissionId: string): Promise<ApiResponse<void>> {
    return this.platform.request<void>(`/api/v1/platform/roles/${roleId}/permissions/${permissionId}`, {
      method: 'POST'
    });
  }

  /**
   * Detach a permission from a role
   * 
   * @example
   * ```typescript
   * await platform.roles.detachPermission('role-id', 'perm-id');
   * ```
   */
  async detachPermission(roleId: string, permissionId: string): Promise<ApiResponse<void>> {
    return this.platform.request<void>(`/api/v1/platform/roles/${roleId}/permissions/${permissionId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get all permissions for a role (from registry)
   * 
   * @example
   * ```typescript
   * const result = await platform.roles.getPermissions('role-id');
   * 
   * if (result.success) {
   *   console.log('Role permissions:', result.data);
   * }
   * ```
   */
  async getPermissions(roleId: string): Promise<ApiResponse<Permission[]>> {
    return this.platform.request<Permission[]>(`/api/v1/platform/roles/${roleId}/permissions`);
  }

  // ==================== Organization Assignments ====================

  /**
   * Attach a role to an organization
   * 
   * @example
   * ```typescript
   * await platform.roles.attachToOrganization('role-id', 'org-id');
   * ```
   */
  async attachToOrganization(roleId: string, organizationId: string): Promise<ApiResponse<void>> {
    return this.platform.request<void>(`/api/v1/platform/roles/${roleId}/organizations/${organizationId}`, {
      method: 'POST'
    });
  }

  /**
   * Detach a role from an organization
   * 
   * @example
   * ```typescript
   * await platform.roles.detachFromOrganization('role-id', 'org-id');
   * ```
   */
  async detachFromOrganization(roleId: string, organizationId: string): Promise<ApiResponse<void>> {
    return this.platform.request<void>(`/api/v1/platform/roles/${roleId}/organizations/${organizationId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Get all organizations assigned to a role
   * 
   * @example
   * ```typescript
   * const result = await platform.roles.getOrganizations('role-id');
   * 
   * if (result.success) {
   *   console.log('Organizations:', result.data);
   * }
   * ```
   */
  async getOrganizations(roleId: string): Promise<ApiResponse<Array<{ id: string; name: string; slug: string }>>> {
    return this.platform.request<Array<{ id: string; name: string; slug: string }>>(
      `/api/v1/platform/roles/${roleId}/organizations`
    );
  }

  /**
   * List all roles for a specific organization
   * 
   * @example
   * ```typescript
   * const result = await platform.roles.listByOrganization('org-id');
   * 
   * if (result.success) {
   *   console.log('Organization roles:', result.data);
   * }
   * ```
   */
  async listByOrganization(organizationId: string): Promise<ApiResponse<Role[]>> {
    return this.platform.request<Role[]>(
      `/api/v1/platform/organizations/${organizationId}/roles`
    );
  }
}
