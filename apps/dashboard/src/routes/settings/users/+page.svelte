<script lang="ts">
  import { Users, Pencil, Trash2, X, Shield, UserCheck, UserX, Search, Mail, Clock, Send } from '@lucide/svelte';
  import { Dialog, FormField, FormInput, FormSelect, Button, Card, Badge, Loading } from '@kuratchi/ui';
  import {
    getUsers,
    inviteUser,
    updateUser,
    suspendUser,
    activateUser,
    deleteUser,
    resendInvite
  } from '$lib/functions/users.remote';

  // Available roles for invite (owner cannot be assigned)
  const INVITABLE_ROLES = [
    { value: 'editor', label: 'Editor', description: 'Can create and edit content' },
    { value: 'member', label: 'Member', description: 'Basic team member access' },
    { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
    { value: 'moderator', label: 'Moderator', description: 'Content moderation' },
    { value: 'developer', label: 'Developer', description: 'Technical access' },
    { value: 'billing', label: 'Billing', description: 'Finance and billing access' }
  ];

  const users = getUsers();

  const usersList = $derived(users.current ? (Array.isArray(users.current) ? users.current : []) : []);

  let searchQuery = $state('');
  let filterStatus = $state<'all' | 'active' | 'suspended' | 'invited'>('all');

  // Helper to check if user is invited (has invite_token set)
  const isInvited = (u: any) => !!u.invite_token;

  const filteredUsers = $derived.by(() => {
    let filtered = usersList;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((u: any) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
    }
    if (filterStatus !== 'all') {
      filtered = filtered.filter((u: any) => {
        if (filterStatus === 'invited') return isInvited(u);
        if (filterStatus === 'suspended') return u.status === false;
        return u.status !== false && !isInvited(u);
      });
    }
    return filtered;
  });

  let showUserModal = $state(false);
  let showDeleteConfirm = $state(false);
  let modalMode = $state<'create' | 'edit'>('create');
  let editingUser = $state<any>(null);
  let deletingUser = $state<any>(null);

  function resetForm() {
    editingUser = null;
  }

  function openCreateModal() {
    resetForm();
    modalMode = 'create';
    showUserModal = true;
  }

  function openEditModal(user: any) {
    editingUser = user;
    modalMode = 'edit';
    showUserModal = true;
  }

  function openDeleteConfirm(user: any) {
    // Prevent deletion of owner users
    if (user.isOwner) {
      alert('Cannot delete the owner user. This user is essential for system operations.');
      return;
    }
    deletingUser = user;
    showDeleteConfirm = true;
  }

  function handleUserSubmit() {
    showUserModal = false;
    resetForm();
  }

  function handleSuspendToggle(user: any) {
    // Prevent suspension of owner users
    if (user.isOwner) {
      alert('Cannot suspend the owner user. This user is essential for system operations.');
      return;
    }
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
        <p class="kui-subtext">Manage users and access</p>
      </div>
    </div>
    <Button variant="primary" onclick={openCreateModal}>
      <Mail class="kui-icon" />
      Invite User
    </Button>
  </header>

  <Card class="kui-panel">
    <div class="kui-filters">
      <div class="kui-input-group">
        <Search class="kui-icon" />
        <input type="text" class="kui-input" placeholder="Search users..." bind:value={searchQuery} />
      </div>
      <select class="kui-select" bind:value={filterStatus}>
        <option value="all">All Status</option>
        <option value="active">Active</option>
        <option value="invited">Invited</option>
        <option value="suspended">Suspended</option>
      </select>
    </div>

    <div class="kui-table-scroll">
      <table class="kui-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#if users.loading}
            <tr><td colspan="5" class="kui-center"><Loading size="md" /></td></tr>
          {:else if filteredUsers.length > 0}
            {#each filteredUsers as user}
              <tr>
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
                  {#if user.isOwner}
                    <Badge variant="error" size="xs">
                      <Shield class="kui-icon" /> Owner
                    </Badge>
                  {:else if user.role === 'admin' || user.isAdmin}
                    <Badge variant="warning" size="xs">
                      <Shield class="kui-icon" /> Admin
                    </Badge>
                  {:else}
                    <Badge variant="neutral" size="xs">Member</Badge>
                  {/if}
                </td>
                <td>
                  {#if isInvited(user)}
                    <Badge variant="warning" size="xs">
                      <Clock class="kui-icon" /> Invited
                    </Badge>
                  {:else if user.status === false}
                    <Badge variant="error" size="xs">Suspended</Badge>
                  {:else}
                    <Badge variant="success" size="xs">Active</Badge>
                  {/if}
                </td>
                <td class="text-right">
                  <div class="kui-inline end">
                    {#if isInvited(user)}
                      <form {...resendInvite} style="display: contents;">
                        <input type="hidden" name="id" value={user.id} />
                        <Button type="submit" variant="ghost" size="xs" aria-label="Resend invite" title="Resend invitation email">
                          <Send class="kui-icon" />
                        </Button>
                      </form>
                    {/if}
                    <Button variant="ghost" size="xs" onclick={() => openEditModal(user)} aria-label="Edit user">
                      <Pencil class="kui-icon" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onclick={() => handleSuspendToggle(user)}
                      aria-label={user.status === false ? 'Activate' : 'Suspend'}
                      disabled={user.isOwner || isInvited(user)}
                      title={user.isOwner ? 'Cannot suspend owner user' : isInvited(user) ? 'Cannot suspend invited user' : (user.status === false ? 'Activate user' : 'Suspend user')}
                    >
                      {#if user.status === false}
                        <UserCheck class="kui-icon" />
                      {:else}
                        <UserX class="kui-icon" />
                      {/if}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="xs" 
                      onclick={() => openDeleteConfirm(user)} 
                      aria-label="Delete user"
                      disabled={user.isOwner}
                      title={user.isOwner ? 'Cannot delete owner user' : 'Delete user'}
                    >
                      <Trash2 class="kui-icon error" />
                    </Button>
                  </div>
                </td>
              </tr>
            {/each}
          {:else}
            <tr>
              <td colspan="5" class="kui-center">
                <div class="kui-stack center">
                  <Users class="kui-empty__icon" />
                  <p class="kui-subtext">No users found</p>
                  {#if !searchQuery && filterStatus === 'all'}
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
  {@const formRef = modalMode === 'create' ? inviteUser : updateUser}
  <Dialog bind:open={showUserModal} size="md" onClose={() => { showUserModal = false; resetForm(); }}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3>{modalMode === 'create' ? 'Invite User' : 'Edit User'}</h3>
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

        <FormField label="Email" issues={formRef.fields.email.issues()}>
          <FormInput field={formRef.fields.email} type="email" placeholder="user@example.com" disabled={modalMode === 'edit'} />
        </FormField>
        
        <FormField label="Name" issues={formRef.fields.name.issues()}>
          <FormInput field={formRef.fields.name} placeholder="John Doe" />
        </FormField>

        {#if modalMode === 'create'}
          <FormField label="Role" issues={inviteUser.fields.role.issues()}>
            <FormSelect field={inviteUser.fields.role}>
              {#each INVITABLE_ROLES as role}
                <option value={role.value}>{role.label} - {role.description}</option>
              {/each}
            </FormSelect>
          </FormField>
          
          <div class="kui-callout info">
            <Mail class="kui-icon" />
            <div>
              <p class="kui-strong">Invitation will be sent</p>
              <p class="kui-subtext">The user will receive an email with a link to join your organization. They can sign in with Google, GitHub, or set up a password.</p>
            </div>
          </div>
        {/if}

        <div class="kui-modal-actions">
          <Button variant="ghost" onclick={() => { showUserModal = false; resetForm(); }}>Cancel</Button>
          <Button type="submit" variant="primary">
            {#if modalMode === 'create'}
              <Send class="kui-icon" />
              Send Invitation
            {:else}
              Save Changes
            {/if}
          </Button>
        </div>
      </form>
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

  .kui-icon {
    width: 1rem;
    height: 1rem;
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

  .kui-callout {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: var(--kui-radius-md);
    background: var(--kui-color-surface-muted);
    border: 1px solid var(--kui-color-border);
  }

  .kui-callout.info {
    background: rgba(59, 130, 246, 0.08);
    border-color: rgba(59, 130, 246, 0.2);
  }

  .kui-callout .kui-icon {
    flex-shrink: 0;
    margin-top: 0.1rem;
    color: var(--kui-color-primary);
  }

  .kui-strong {
    font-weight: 600;
  }

  @media (max-width: 780px) {
    .kui-table th:nth-child(1),
    .kui-table td:nth-child(1) {
      width: 44px;
    }
  }
</style>
