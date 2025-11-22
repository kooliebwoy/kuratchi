<script lang="ts">
  import { Shield, Plus, Pencil, Trash2, X } from '@lucide/svelte';
  import { Dialog, Button, Card, Badge, Loading, FormField, FormInput, FormTextarea } from '@kuratchi/ui';
  import {
    getRoles,
    getPermissions,
    getRolePermissions,
    createRole,
    updateRole,
    archiveRole,
    createPermission,
    updatePermission,
    archivePermission,
    attachPermissionToRole,
    detachPermissionFromRole
  } from '$lib/functions/roles.remote';

  const roles = getRoles();
  const permissions = getPermissions();
  const rolePerms = getRolePermissions();

  const rolesList = $derived(
    roles.current
      ? (Array.isArray(roles.current) ? (roles.current as any[]) : (((roles.current as any).data ?? []) as any[]))
      : ([] as any[])
  );
  const permissionsList = $derived(
    permissions.current
      ? (Array.isArray(permissions.current) ? (permissions.current as any[]) : (((permissions.current as any).data ?? []) as any[]))
      : ([] as any[])
  );
  const permsByRole = $derived(rolePerms.current?.byRole || {});

  let showRoleModal = $state(false);
  let showPermModal = $state(false);
  let showDeleteConfirm = $state(false);
  let modalMode = $state<'create' | 'edit'>('create');
  let permModalMode = $state<'create' | 'edit'>('create');
  let editingRole = $state<any>(null);
  let editingPerm = $state<any>(null);
  let deletingRole = $state<any>(null);
  let selectedPermissions = $state<Set<string>>(new Set());
  let activeTab = $state<'roles' | 'permissions'>('roles');

  let formData = $state({
    name: '',
    description: ''
  });

  let permFormData = $state({
    value: '',
    label: '',
    description: ''
  });

  function resetForm() {
    formData = { name: '', description: '' };
    editingRole = null;
    selectedPermissions = new Set();
  }

  function resetPermForm() {
    permFormData = { value: '', label: '', description: '' };
    editingPerm = null;
  }

  function openCreateModal() {
    resetForm();
    modalMode = 'create';
    showRoleModal = true;
  }

  function openEditModal(role: any) {
    editingRole = role;
    formData = {
      name: role.name || '',
      description: role.description || ''
    };
    const rolePermissions = permsByRole[role.id] || [];
    selectedPermissions = new Set(rolePermissions.map((p: any) => p.id));
    modalMode = 'edit';
    showRoleModal = true;
  }

  function openCreatePermModal() {
    resetPermForm();
    permModalMode = 'create';
    showPermModal = true;
  }

  function openEditPermModal(perm: any) {
    editingPerm = perm;
    permFormData = {
      value: perm.value || '',
      label: perm.label || '',
      description: perm.description || ''
    };
    permModalMode = 'edit';
    showPermModal = true;
  }

  function openDeleteConfirm(roleOrPerm: any) {
    deletingRole = roleOrPerm;
    showDeleteConfirm = true;
  }

  function handleRoleSubmit() {
    showRoleModal = false;

    if (editingRole) {
      const roleId = editingRole.id;
      const permsToSync = new Set(selectedPermissions);

      setTimeout(async () => {
        const currentPerms = new Set((permsByRole[roleId] || []).map((p: any) => p.id));
        const toAttach = Array.from(permsToSync).filter((id) => !currentPerms.has(id));
        const toDetach = Array.from(currentPerms).filter((id) => !permsToSync.has(id));

        for (const permId of toAttach) {
          document.getElementById(`attach-perm-${roleId}-${permId}`)?.requestSubmit();
          await new Promise((resolve) => setTimeout(resolve, 80));
        }

        for (const permId of toDetach) {
          document.getElementById(`detach-perm-${roleId}-${permId}`)?.requestSubmit();
          await new Promise((resolve) => setTimeout(resolve, 80));
        }

        await rolePerms.refresh();
      }, 400);
    }

    resetForm();
  }

  function togglePermission(permId: string) {
    if (selectedPermissions.has(permId)) {
      selectedPermissions.delete(permId);
    } else {
      selectedPermissions.add(permId);
    }
    selectedPermissions = new Set(selectedPermissions);
  }

  function getRolePermissionCount(roleId: string) {
    return (permsByRole[roleId] || []).length;
  }
</script>

<div class="kui-roles-page">
  <header class="kui-roles__header">
    <div class="kui-inline">
      <div class="kui-icon-box">
        <Shield />
      </div>
      <div>
        <p class="kui-eyebrow">Access Control</p>
        <h1>Roles & Permissions</h1>
        <p class="kui-subtext">Manage roles, permissions, and assignments</p>
      </div>
    </div>
    <div class="kui-inline end">
      <Button variant="outline" onclick={openCreatePermModal}>
        <Plus class="kui-icon" /> New Permission
      </Button>
      <Button variant="primary" onclick={openCreateModal}>
        <Plus class="kui-icon" /> New Role
      </Button>
    </div>
  </header>

  <div class="kui-tabs">
    <button class:selected={activeTab === 'roles'} onclick={() => activeTab = 'roles'}>Roles</button>
    <button class:selected={activeTab === 'permissions'} onclick={() => activeTab = 'permissions'}>Permissions</button>
  </div>

  {#if activeTab === 'roles'}
    <Card class="kui-panel">
      <div class="kui-table-scroll">
        <table class="kui-table">
          <thead>
            <tr>
              <th>Role Name</th>
              <th>Description</th>
              <th>Permissions</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#if roles.loading}
              <tr><td colspan="4" class="kui-center"><Loading size="md" /></td></tr>
            {:else if rolesList.length > 0}
              {#each rolesList as role}
                <tr>
                  <td class="kui-strong">{role.name}</td>
                  <td class="kui-subtext">{role.description || '-'}</td>
                  <td><Badge variant="primary" size="xs">{getRolePermissionCount(role.id)} perms</Badge></td>
                  <td class="text-right">
                    <div class="kui-inline end">
                      <Button variant="ghost" size="xs" onclick={() => openEditModal(role)} aria-label="Edit role">
                        <Pencil class="kui-icon" />
                      </Button>
                      <Button variant="ghost" size="xs" onclick={() => openDeleteConfirm(role)} aria-label="Delete role">
                        <Trash2 class="kui-icon error" />
                      </Button>
                    </div>
                  </td>
                </tr>
              {/each}
            {:else}
              <tr><td colspan="4" class="kui-center">No roles yet. Create one to get started.</td></tr>
            {/if}
          </tbody>
        </table>
      </div>
    </Card>
  {:else}
    <Card class="kui-panel">
      <div class="kui-table-scroll">
        <table class="kui-table">
          <thead>
            <tr>
              <th>Value</th>
              <th>Label</th>
              <th>Description</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#if permissions.loading}
              <tr><td colspan="4" class="kui-center"><Loading size="md" /></td></tr>
            {:else if permissionsList.length > 0}
              {#each permissionsList as perm}
                <tr>
                  <td><span class="kui-code">{perm.value}</span></td>
                  <td class="kui-strong">{perm.label || '-'}</td>
                  <td class="kui-subtext">{perm.description || '-'}</td>
                  <td class="text-right">
                    <div class="kui-inline end">
                      <Button variant="ghost" size="xs" onclick={() => openEditPermModal(perm)} aria-label="Edit permission">
                        <Pencil class="kui-icon" />
                      </Button>
                      <Button variant="ghost" size="xs" onclick={() => openDeleteConfirm(perm)} aria-label="Delete permission">
                        <Trash2 class="kui-icon error" />
                      </Button>
                    </div>
                  </td>
                </tr>
              {/each}
            {:else}
              <tr><td colspan="4" class="kui-center">No permissions yet. Create one to get started.</td></tr>
            {/if}
          </tbody>
        </table>
      </div>
    </Card>
  {/if}
</div>

<!-- Create/Edit Role Modal -->
<Dialog bind:open={showRoleModal} size="lg">
  {#snippet header()}
    <div class="kui-modal-header">
      <h3>{modalMode === 'create' ? 'Create Role' : 'Edit Role'}</h3>
      <Button variant="ghost" size="xs" onclick={() => { showRoleModal = false; resetForm(); }}>
        <X class="kui-icon" />
      </Button>
    </div>
  {/snippet}
  {#snippet children()}
    {#if modalMode === 'create'}
      <form {...createRole} onsubmit={handleRoleSubmit} class="kui-stack">
        <FormField label="Role Name" issues={createRole.fields.name.issues()}>
          <FormInput field={createRole.fields.name} placeholder="editor" />
        </FormField>
        <FormField label="Description" issues={createRole.fields.description.issues()}>
          <FormTextarea field={createRole.fields.description} placeholder="Can edit posts and upload media" rows={2} />
        </FormField>
        <div class="kui-modal-actions">
          <Button variant="ghost" type="button" onclick={() => { showRoleModal = false; resetForm(); }}>Cancel</Button>
          <Button type="submit" variant="primary">Create Role</Button>
        </div>
      </form>
    {:else}
      <form {...updateRole} onsubmit={handleRoleSubmit} class="kui-stack">
        <input type="hidden" name="id" value={editingRole?.id} />
        <FormField label="Role Name" issues={updateRole.fields.name.issues()}>
          <FormInput field={updateRole.fields.name} placeholder="editor" value={formData.name} />
        </FormField>
        <FormField label="Description" issues={updateRole.fields.description.issues()}>
          <FormTextarea field={updateRole.fields.description} placeholder="Can edit posts and upload media" rows={2} value={formData.description} />
        </FormField>

        <div class="kui-stack">
          <p class="kui-strong">Permissions</p>
          <div class="kui-perm-list">
            {#if permissionsList.length > 0}
              {#each permissionsList as perm}
                <label class="kui-perm-row">
                  <input
                    type="checkbox"
                    class="kui-checkbox"
                    checked={selectedPermissions.has(perm.id)}
                    onchange={() => togglePermission(perm.id)}
                  />
                  <div>
                    <p class="kui-strong">{perm.label || perm.value}</p>
                    {#if perm.description}
                      <p class="kui-subtext">{perm.description}</p>
                    {/if}
                  </div>
                </label>
              {/each}
            {:else}
              <p class="kui-subtext">No permissions available</p>
            {/if}
          </div>
        </div>

        <div class="kui-modal-actions">
          <Button variant="ghost" type="button" onclick={() => { showRoleModal = false; resetForm(); }}>Cancel</Button>
          <Button type="submit" variant="primary">Save Changes</Button>
        </div>
      </form>
    {/if}
  {/snippet}
</Dialog>

<!-- Create/Edit Permission Modal -->
<Dialog bind:open={showPermModal} size="md">
  {#snippet header()}
    <div class="kui-modal-header">
      <h3>{permModalMode === 'create' ? 'New Permission' : 'Edit Permission'}</h3>
      <Button variant="ghost" size="xs" onclick={() => { showPermModal = false; resetPermForm(); }}>
        <X class="kui-icon" />
      </Button>
    </div>
  {/snippet}
  {#snippet children()}
    {#if permModalMode === 'create'}
      <form {...createPermission} onsubmit={() => { showPermModal = false; resetPermForm(); }} class="kui-stack">
        <FormField label="Value">
          <input id="perm-value" type="text" name="value" class="kui-input" placeholder="posts.create" required />
          <span class="kui-subtext">Unique identifier (e.g., posts.create, users.delete)</span>
        </FormField>
        <FormField label="Label">
          <input id="perm-label" type="text" name="label" class="kui-input" placeholder="Create Posts" />
        </FormField>
        <FormField label="Description">
          <textarea id="perm-desc" name="description" class="kui-textarea" placeholder="Allows creating new posts" rows="2"></textarea>
        </FormField>
        <div class="kui-modal-actions">
          <Button type="button" variant="ghost" onclick={() => { showPermModal = false; resetPermForm(); }}>Cancel</Button>
          <Button type="submit" variant="primary">Create Permission</Button>
        </div>
      </form>
    {:else}
      <form {...updatePermission} onsubmit={() => { showPermModal = false; resetPermForm(); }} class="kui-stack">
        <input type="hidden" name="id" value={editingPerm?.id} />
        <FormField label="Value">
          <FormInput field={updatePermission.fields.value} placeholder="posts.create" value={permFormData.value} />
          <span class="kui-subtext">Unique identifier (e.g., posts.create, users.delete)</span>
        </FormField>
        <FormField label="Label">
          <FormInput field={updatePermission.fields.label} placeholder="Create Posts" value={permFormData.label} />
        </FormField>
        <FormField label="Description">
          <FormTextarea field={updatePermission.fields.description} placeholder="Allows creating new posts" rows={2} value={permFormData.description} />
        </FormField>
        <div class="kui-modal-actions">
          <Button type="button" variant="ghost" onclick={() => { showPermModal = false; resetPermForm(); }}>Cancel</Button>
          <Button type="submit" variant="primary">Update Permission</Button>
        </div>
      </form>
    {/if}
  {/snippet}
</Dialog>

<!-- Delete Confirmation Dialog -->
<Dialog bind:open={showDeleteConfirm} size="sm">
  {#snippet header()}
    <div class="kui-modal-header">
      <h3 class="text-error">Confirm Delete</h3>
      <Button variant="ghost" size="xs" onclick={() => { showDeleteConfirm = false; deletingRole = null; }}>
        <X class="kui-icon" />
      </Button>
    </div>
  {/snippet}
  {#snippet children()}
    <div class="kui-stack">
      <p class="kui-subtext">Are you sure you want to delete <strong>{deletingRole?.name || deletingRole?.value}</strong>?</p>
      <p class="kui-subtext text-error">This action cannot be undone.</p>
      <div class="kui-modal-actions">
        <Button variant="ghost" onclick={() => { showDeleteConfirm = false; deletingRole = null; }}>Cancel</Button>
        {#if deletingRole?.value}
          <form {...archivePermission} onsubmit={() => { showDeleteConfirm = false; deletingRole = null; }}>
            <input type="hidden" name="id" value={deletingRole?.id} />
            <Button type="submit" variant="error">Delete Permission</Button>
          </form>
        {:else}
          <form {...archiveRole} onsubmit={() => { showDeleteConfirm = false; deletingRole = null; }}>
            <input type="hidden" name="id" value={deletingRole?.id} />
            <Button type="submit" variant="error">Delete Role</Button>
          </form>
        {/if}
      </div>
    </div>
  {/snippet}
</Dialog>

{#each rolesList as role}
  {#each permissionsList as perm}
    <form {...attachPermissionToRole} id="attach-perm-{role.id}-{perm.id}" style="display: none;">
      <input type="hidden" name="roleId" value={role.id} />
      <input type="hidden" name="permissionId" value={perm.id} />
    </form>
    <form {...detachPermissionFromRole} id="detach-perm-{role.id}-{perm.id}" style="display: none;">
      <input type="hidden" name="roleId" value={role.id} />
      <input type="hidden" name="permissionId" value={perm.id} />
    </form>
  {/each}
{/each}

<style>
  .kui-roles-page {
    display: grid;
    gap: var(--kui-spacing-md);
  }

  .kui-roles__header {
    display: flex;
    justify-content: space-between;
    gap: var(--kui-spacing-md);
    flex-wrap: wrap;
    align-items: center;
  }

  .kui-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .kui-inline.end {
    justify-content: flex-end;
  }

  .kui-icon-box {
    width: 3rem;
    height: 3rem;
    border-radius: var(--kui-radius-lg);
    background: var(--kui-color-primary-weak);
    color: var(--kui-color-primary);
    display: grid;
    place-items: center;
  }

  .kui-eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--kui-color-muted);
    font-weight: 700;
    margin: 0;
    font-size: 0.8rem;
  }

  h1 {
    margin: 0.1rem 0 0.2rem;
    font-size: 1.6rem;
  }

  .kui-subtext {
    color: var(--kui-color-muted);
    margin: 0;
  }

  .kui-tabs {
    display: inline-flex;
    gap: 0.25rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-lg);
    overflow: hidden;
  }

  .kui-tabs button {
    padding: 0.55rem 1rem;
    background: transparent;
    border: none;
    cursor: pointer;
    font-weight: 600;
    color: var(--kui-color-muted);
  }

  .kui-tabs button.selected {
    background: var(--kui-color-primary-weak);
    color: var(--kui-color-primary);
  }

  .kui-panel {
    height: 100%;
  }

  .kui-table-scroll {
    overflow: auto;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-lg);
    background: var(--kui-color-surface);
  }

  .kui-table {
    width: 100%;
    border-collapse: collapse;
  }

  .kui-table th,
  .kui-table td {
    padding: 0.65rem;
    border-bottom: 1px solid var(--kui-color-border);
    text-align: left;
    vertical-align: top;
  }

  .kui-table thead th {
    background: var(--kui-color-surface-muted);
    font-weight: 700;
    font-size: 0.9rem;
  }

  .kui-strong {
    font-weight: 700;
  }

  .kui-code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.9rem;
  }

  .kui-center {
    text-align: center;
    padding: var(--kui-spacing-md);
  }

  .kui-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--kui-spacing-sm);
  }

  .kui-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--kui-spacing-sm);
  }

  .kui-stack {
    display: grid;
    gap: var(--kui-spacing-sm);
  }

  .kui-perm-list {
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    padding: var(--kui-spacing-sm);
    max-height: 260px;
    overflow-y: auto;
    background: var(--kui-color-surface);
    display: grid;
    gap: 0.35rem;
  }

  .kui-perm-row {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.4rem;
    border-radius: var(--kui-radius-md);
  }

  .kui-checkbox {
    width: 1rem;
    height: 1rem;
    border: 1px solid var(--kui-color-border);
  }

  .text-right {
    text-align: right;
  }
</style>
