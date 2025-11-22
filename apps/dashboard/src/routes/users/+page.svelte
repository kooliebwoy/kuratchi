<script lang="ts">
  import { Users, Plus, Pencil, Trash2, X, Shield, Building2, UserCheck, UserX, ChevronDown, Search } from '@lucide/svelte';
  import { Dialog, FormField, FormInput, FormSelect, FormCheckbox, Button, Card, Badge, Loading } from '@kuratchi/ui';
  import {
    getUsers,
    getAvailableOrganizations,
    createUser,
    updateUser,
    suspendUser,
    activateUser,
    deleteUser,
    addUserToOrganization,
    removeUserFromOrganization
  } from '$lib/functions/users.remote';

  const users = getUsers();
  const organizations = getAvailableOrganizations();

  const usersList = $derived(users.current ? (Array.isArray(users.current) ? users.current : []) : []);
  const orgsList = $derived(organizations.current ? (Array.isArray(organizations.current) ? organizations.current : []) : []);

  let searchQuery = $state('');
  let filterOrg = $state('');
  let filterStatus = $state<'all' | 'active' | 'suspended'>('all');
  let expandedUserId = $state<string | null>(null);

  const filteredUsers = $derived.by(() => {
    let filtered = usersList;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((u: any) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
    }
    if (filterOrg) {
      filtered = filtered.filter((u: any) => u.organizations?.some((o: any) => o.id === filterOrg));
    }
    if (filterStatus !== 'all') {
      filtered = filtered.filter((u: any) => {
        const isActive = u.status !== false;
        return filterStatus === 'active' ? isActive : !isActive;
      });
    }
    return filtered;
  });

  let showUserModal = $state(false);
  let showDeleteConfirm = $state(false);
  let showOrgModal = $state(false);
  let modalMode = $state<'create' | 'edit'>('create');
  let editingUser = $state<any>(null);
  let deletingUser = $state<any>(null);
  let selectedUser = $state<any>(null);

  let formData = $state({
    email: '',
    name: '',
    password: '',
    isSuperAdmin: false,
    selectedOrgs: new Set<string>()
  });

  let orgFormData = $state({
    organizationId: ''
  });

  function resetForm() {
    formData = { email: '', name: '', password: '', isSuperAdmin: false, selectedOrgs: new Set() };
    editingUser = null;
  }

  function resetOrgForm() {
    orgFormData = { organizationId: '' };
  }

  function openCreateModal() {
    resetForm();
    modalMode = 'create';
    showUserModal = true;
  }

  function openEditModal(user: any) {
    editingUser = user;
    formData = {
      email: user.email || '',
      name: user.name || '',
      password: '',
      isSuperAdmin: user.isSuperAdmin || false,
      selectedOrgs: new Set(user.organizations?.map((o: any) => o.id) || [])
    };
    modalMode = 'edit';
    showUserModal = true;
  }

  function openDeleteConfirm(user: any) {
    deletingUser = user;
    showDeleteConfirm = true;
  }

  function openOrgModal(user: any) {
    selectedUser = user;
    resetOrgForm();
    showOrgModal = true;
  }

  function toggleOrganization(orgId: string) {
    if (formData.selectedOrgs.has(orgId)) {
      formData.selectedOrgs.delete(orgId);
    } else {
      formData.selectedOrgs.add(orgId);
    }
  }

  function toggleExpansion(userId: string) {
    expandedUserId = expandedUserId === userId ? null : userId;
  }

  function handleUserSubmit() {
    showUserModal = false;
    resetForm();
  }

  function handleSuspendToggle(user: any) {
    const formEl = document.getElementById(
      user.status === false ? `activate-form-${user.id}` : `suspend-form-${user.id}`
    ) as HTMLFormElement;
    formEl?.requestSubmit();
  }
</script>

<svelte:head>
  <title>Users Management - Kuratchi Dashboard</title>
</svelte:head>

<div class="kui-users-page">
  <header class="kui-users__header">
    <div class="kui-inline">
      <div class="kui-icon-box">
        <Users />
      </div>
      <div>
        <p class="kui-eyebrow">Team</p>
        <h1>Users Management</h1>
        <p class="kui-subtext">Manage users, roles, and organization assignments</p>
      </div>
    </div>
    <Button variant="primary" onclick={openCreateModal}>
      <Plus class="kui-icon" />
      Add User
    </Button>
  </header>

  <Card class="kui-panel">
    <div class="kui-filters">
      <div class="kui-input-group">
        <Search class="kui-icon" />
        <input type="text" class="kui-input" placeholder="Search users..." bind:value={searchQuery} />
      </div>
      <select class="kui-select" bind:value={filterOrg}>
        <option value="">All Organizations</option>
        {#each orgsList as org}
          <option value={org.id}>{org.organizationName || org.name}</option>
        {/each}
      </select>
      <select class="kui-select" bind:value={filterStatus}>
        <option value="all">All Status</option>
        <option value="active">Active</option>
        <option value="suspended">Suspended</option>
      </select>
    </div>

    <div class="kui-table-scroll">
      <table class="kui-table">
        <thead>
          <tr>
            <th></th>
            <th>User</th>
            <th>Email</th>
            <th>Organizations</th>
            <th>Type</th>
            <th>Status</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#if users.loading}
            <tr><td colspan="7" class="kui-center"><Loading size="md" /></td></tr>
          {:else if filteredUsers.length > 0}
            {#each filteredUsers as user}
              <tr>
                <td>
                  <Button variant="ghost" size="xs" onclick={() => toggleExpansion(user.id)} aria-label="Toggle details">
                    <ChevronDown class={`kui-icon ${expandedUserId === user.id ? 'rotated' : ''}`} />
                  </Button>
                </td>
                <td>
                  <div class="kui-inline">
                    <div class="kui-avatar">
                      {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <div class="kui-strong">{user.name || 'Unnamed'}</div>
                      {#if user.emailVerified}
                        <span class="kui-pill success">
                          <UserCheck class="kui-icon" /> Verified
                        </span>
                      {/if}
                    </div>
                  </div>
                </td>
                <td class="kui-subtext">{user.email}</td>
                <td>
                  <div class="kui-chip-group">
                    {#if user.organizations?.length > 0}
                      {#each user.organizations.slice(0, 2) as org}
                        <Badge variant="ghost" size="xs">{org.organizationName || org.name}</Badge>
                      {/each}
                      {#if user.organizations.length > 2}
                        <Badge variant="neutral" size="xs">+{user.organizations.length - 2}</Badge>
                      {/if}
                    {:else}
                      <span class="kui-subtext">None</span>
                    {/if}
                  </div>
                </td>
                <td>
                  {#if user.isSuperAdmin}
                    <Badge variant="warning" size="xs">
                      <Shield class="kui-icon" /> Super Admin
                    </Badge>
                  {:else if user.organizations?.some((o: any) => o.isOrgAdmin)}
                    <Badge variant="primary" size="xs">Org Admin</Badge>
                  {:else}
                    <Badge variant="neutral" size="xs">Member</Badge>
                  {/if}
                </td>
                <td>
                  <Badge variant={user.status === false ? 'error' : 'success'} size="xs">
                    {user.status === false ? 'Suspended' : 'Active'}
                  </Badge>
                </td>
                <td class="text-right">
                  <div class="kui-inline end">
                    <Button variant="ghost" size="xs" onclick={() => openOrgModal(user)} aria-label="Manage orgs">
                      <Building2 class="kui-icon" />
                    </Button>
                    <Button variant="ghost" size="xs" onclick={() => openEditModal(user)} aria-label="Edit user">
                      <Pencil class="kui-icon" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onclick={() => handleSuspendToggle(user)}
                      aria-label={user.status === false ? 'Activate' : 'Suspend'}
                    >
                      {#if user.status === false}
                        <UserCheck class="kui-icon" />
                      {:else}
                        <UserX class="kui-icon" />
                      {/if}
                    </Button>
                    <Button variant="ghost" size="xs" onclick={() => openDeleteConfirm(user)} aria-label="Delete user">
                      <Trash2 class="kui-icon error" />
                    </Button>
                  </div>
                </td>
              </tr>
              {#if expandedUserId === user.id}
                <tr class="kui-expand">
                  <td colspan="7">
                    <div class="kui-expand__body">
                      <h4>Organization Memberships</h4>
                      {#if user.organizations?.length > 0}
                        <div class="kui-org-grid">
                          {#each user.organizations as org}
                            <Card class="kui-panel">
                              <div class="kui-stack">
                                <p class="kui-strong">{org.organizationName || org.name}</p>
                                <div class="kui-inline">
                                  <span class="kui-subtext">Role:</span>
                                  <Badge variant="primary" size="xs">{org.userRole || 'member'}</Badge>
                                  {#if org.isOrgAdmin}
                                    <Badge variant="warning" size="xs">Admin</Badge>
                                  {/if}
                                </div>
                              </div>
                            </Card>
                          {/each}
                        </div>
                      {:else}
                        <p class="kui-subtext">Not assigned to any organizations</p>
                      {/if}
                    </div>
                  </td>
                </tr>
              {/if}
            {/each}
          {:else}
            <tr>
              <td colspan="7" class="kui-center">
                <div class="kui-stack center">
                  <Users class="kui-empty__icon" />
                  <p class="kui-subtext">No users found</p>
                  {#if !searchQuery && !filterOrg && filterStatus === 'all'}
                    <Button variant="primary" size="sm" onclick={openCreateModal}>Add your first user</Button>
                  {/if}
                </div>
              </td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  </Card>
</div>

{#if showUserModal}
  {@const formRef = modalMode === 'create' ? createUser : updateUser}
  <Dialog bind:open={showUserModal} size="lg" onClose={() => { showUserModal = false; resetForm(); }}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3>{modalMode === 'create' ? 'Add New User' : 'Edit User'}</h3>
        <Button variant="ghost" size="xs" onclick={() => { showUserModal = false; resetForm(); }}>
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <form {...formRef} onsubmit={handleUserSubmit} class="kui-stack">
        {#if modalMode === 'edit'}
          <input type="hidden" name="id" value={editingUser?.id} />
        {/if}

        <div class="kui-grid">
          <FormField label="Email" issues={formRef.fields.email.issues()}>
            <FormInput field={formRef.fields.email} type="email" placeholder="user@example.com" disabled={modalMode === 'edit'} />
          </FormField>
          <FormField label="Name" issues={formRef.fields.name.issues()}>
            <FormInput field={formRef.fields.name} placeholder="John Doe" />
          </FormField>
        </div>

        {#if modalMode === 'create'}
          <FormField label="Password (Optional)" issues={formRef.fields.password.issues()} hint="Leave empty to let user set via email">
            <FormInput field={formRef.fields.password} type="password" placeholder="••••••••" />
          </FormField>
        {/if}

        <FormCheckbox field={{ name: 'isSuperAdmin', bind: { checked: formData.isSuperAdmin } }}>
          <span class="kui-strong">Super Admin</span>
          <span class="kui-subtext">Full system access across all organizations</span>
        </FormCheckbox>

        {#if modalMode === 'create'}
          <div class="kui-stack">
            <p class="kui-strong">Assign to Organizations</p>
            <div class="kui-org-list">
              {#if orgsList.length > 0}
                {#each orgsList as org}
                  <label class="kui-org-row">
                    <input
                      type="checkbox"
                      class="kui-checkbox"
                      checked={formData.selectedOrgs.has(org.id)}
                      onchange={() => toggleOrganization(org.id)}
                    />
                    <div>
                      <p class="kui-strong">{org.organizationName || org.name}</p>
                      {#if org.organizationSlug}
                        <p class="kui-subtext">{org.organizationSlug}</p>
                      {/if}
                    </div>
                  </label>
                {/each}
              {:else}
                <p class="kui-subtext">No organizations available</p>
              {/if}
            </div>
            <input type="hidden" name="organizations" value={JSON.stringify(Array.from(formData.selectedOrgs))} />
            <input type="hidden" name="roles" value={JSON.stringify({})} />
          </div>
        {/if}

        <div class="kui-modal-actions">
          <Button variant="ghost" onclick={() => { showUserModal = false; resetForm(); }}>Cancel</Button>
          <Button type="submit" variant="primary">{modalMode === 'create' ? 'Add User' : 'Save Changes'}</Button>
        </div>
      </form>
    {/snippet}
  </Dialog>
{/if}

{#if showOrgModal && selectedUser}
  <Dialog bind:open={showOrgModal} size="md" onClose={() => { showOrgModal = false; resetOrgForm(); }}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3>Manage Organizations</h3>
        <Button variant="ghost" size="xs" onclick={() => { showOrgModal = false; resetOrgForm(); }}>
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="kui-stack">
        <p class="kui-subtext">Managing organizations for <strong>{selectedUser.name || selectedUser.email}</strong></p>

        {#if selectedUser.organizations?.length > 0}
          <div class="kui-org-list">
            {#each selectedUser.organizations as org}
              <div class="kui-org-row between">
                <div>
                  <p class="kui-strong">{org.organizationName || org.name}</p>
                  <p class="kui-subtext">Role: {org.userRole || 'member'}</p>
                </div>
                <form {...removeUserFromOrganization} onsubmit={() => { showOrgModal = false; }}>
                  <input type="hidden" name="userId" value={selectedUser.id} />
                  <input type="hidden" name="organizationId" value={org.id} />
                  <Button type="submit" variant="error" size="xs">Remove</Button>
                </form>
              </div>
            {/each}
          </div>
        {/if}

        <div class="kui-divider">Add to Organization</div>

        <form {...addUserToOrganization} onsubmit={() => { showOrgModal = false; resetOrgForm(); }} class="kui-stack">
          <input type="hidden" name="userId" value={selectedUser.id} />
          <FormField label="Organization" issues={addUserToOrganization.fields.organizationId.issues()}>
            <FormSelect field={addUserToOrganization.fields.organizationId}>
              <option value="">Select organization...</option>
              {#each orgsList as org}
                {#if !selectedUser.organizations?.some((o: any) => o.id === org.id)}
                  <option value={org.id}>{org.organizationName || org.name}</option>
                {/if}
              {/each}
            </FormSelect>
          </FormField>
          <div class="kui-modal-actions">
            <Button type="button" variant="ghost" onclick={() => { showOrgModal = false; resetOrgForm(); }}>Cancel</Button>
            <Button type="submit" variant="primary" aria-busy={!!addUserToOrganization.pending} disabled={!!addUserToOrganization.pending}>
              Add to Organization
            </Button>
          </div>
        </form>
      </div>
    {/snippet}
  </Dialog>
{/if}

{#if showDeleteConfirm && deletingUser}
  <Dialog bind:open={showDeleteConfirm} size="sm" onClose={() => { showDeleteConfirm = false; deletingUser = null; }}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3 class="text-error">Confirm Delete</h3>
        <Button variant="ghost" size="xs" onclick={() => { showDeleteConfirm = false; deletingUser = null; }}>
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="kui-stack">
        <p class="kui-subtext">Are you sure you want to delete <strong>{deletingUser.name || deletingUser.email}</strong>?</p>
        <p class="kui-subtext text-error">This action cannot be undone.</p>
        <div class="kui-modal-actions">
          <Button variant="ghost" onclick={() => { showDeleteConfirm = false; deletingUser = null; }}>Cancel</Button>
          <form {...deleteUser} onsubmit={() => { showDeleteConfirm = false; deletingUser = null; }}>
            <input type="hidden" name="id" value={deletingUser.id} />
            <Button type="submit" variant="error">Delete User</Button>
          </form>
        </div>
      </div>
    {/snippet}
  </Dialog>
{/if}

{#each usersList as user}
  <form {...suspendUser} id="suspend-form-{user.id}" style="display: none;">
    <input type="hidden" name="id" value={user.id} />
  </form>
  <form {...activateUser} id="activate-form-{user.id}" style="display: none;">
    <input type="hidden" name="id" value={user.id} />
  </form>
{/each}

<style>
  .kui-users-page {
    display: grid;
    gap: var(--kui-spacing-md);
  }

  .kui-users__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--kui-spacing-md);
    flex-wrap: wrap;
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

  .kui-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  .kui-inline.end {
    justify-content: flex-end;
  }

  h1 {
    margin: 0.1rem 0 0.2rem;
    font-size: 1.6rem;
  }

  .kui-subtext {
    color: var(--kui-color-muted);
    margin: 0;
  }

  .kui-filters {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--kui-spacing-sm);
    align-items: center;
  }

  .kui-input-group {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    padding: 0.45rem 0.6rem;
    background: var(--kui-color-surface);
  }

  .kui-input {
    border: none;
    outline: none;
    width: 100%;
    background: transparent;
    font-size: 0.95rem;
  }

  .kui-select {
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    padding: 0.55rem 0.75rem;
    background: var(--kui-color-surface);
    color: var(--kui-color-text);
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
    min-width: 100%;
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

  .kui-avatar {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    background: var(--kui-color-primary-weak);
    color: var(--kui-color-primary);
    display: grid;
    place-items: center;
    font-weight: 700;
  }

  .kui-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    border-radius: 999px;
    padding: 0.15rem 0.55rem;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .kui-pill.success {
    background: rgba(22, 163, 74, 0.12);
    color: var(--kui-color-success);
  }

  .kui-chip-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .kui-icon {
    width: 1rem;
    height: 1rem;
  }

  .kui-icon.rotated {
    transform: rotate(180deg);
    transition: transform var(--kui-duration-base) ease;
  }

  .kui-center {
    text-align: center;
    padding: var(--kui-spacing-md);
  }

  .kui-empty__icon {
    width: 3rem;
    height: 3rem;
    color: var(--kui-color-muted);
  }

  .text-right {
    text-align: right;
  }

  .kui-expand__body {
    padding: var(--kui-spacing-md);
    background: var(--kui-color-surface-muted);
    border-radius: var(--kui-radius-md);
    border: 1px solid var(--kui-color-border);
  }

  .kui-org-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--kui-spacing-sm);
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

  .kui-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--kui-spacing-sm);
  }

  .kui-org-list {
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    padding: var(--kui-spacing-sm);
    display: grid;
    gap: 0.5rem;
    max-height: 240px;
    overflow-y: auto;
    background: var(--kui-color-surface);
  }

  .kui-org-row {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.4rem;
    border-radius: var(--kui-radius-md);
  }

  .kui-org-row.between {
    justify-content: space-between;
    align-items: center;
  }

  .kui-checkbox {
    width: 1rem;
    height: 1rem;
    border: 1px solid var(--kui-color-border);
  }

  .kui-divider {
    text-align: center;
    font-weight: 700;
    color: var(--kui-color-muted);
    padding: 0.5rem 0;
  }

  @media (max-width: 780px) {
    .kui-table th:nth-child(1),
    .kui-table td:nth-child(1) {
      width: 44px;
    }
  }
</style>
