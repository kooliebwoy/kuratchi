<script lang="ts">
  import { Users, Plus, Pencil, Trash2, X, Shield, Building2, UserCheck, UserX, ChevronDown, Search } from 'lucide-svelte';
  import { Dialog, FormField, FormInput, FormSelect, FormCheckbox } from '@kuratchi/ui';
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
  } from '$lib/api/users.remote';

  // Data sources
  const users = getUsers();
  const organizations = getAvailableOrganizations();

  // Derived lists
  const usersList = $derived(users.current ? (Array.isArray(users.current) ? users.current : []) : []);
  const orgsList = $derived(organizations.current ? (Array.isArray(organizations.current) ? organizations.current : []) : []);

  // Filter state
  let searchQuery = $state('');
  let filterOrg = $state('');
  let filterStatus = $state<'all' | 'active' | 'suspended'>('all');
  let expandedUserId = $state<string | null>(null);

  // Filtered users
  const filteredUsers = $derived.by(() => {
    let filtered = usersList;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((u: any) => 
        u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
      );
    }
    if (filterOrg) {
      filtered = filtered.filter((u: any) => 
        u.organizations?.some((o: any) => o.id === filterOrg)
      );
    }
    if (filterStatus !== 'all') {
      filtered = filtered.filter((u: any) => {
        const isActive = u.status !== false;
        return filterStatus === 'active' ? isActive : !isActive;
      });
    }
    return filtered;
  });

  // Modal state
  let showUserModal = $state(false);
  let showDeleteConfirm = $state(false);
  let showOrgModal = $state(false);
  let modalMode = $state<'create' | 'edit'>('create');
  let editingUser = $state<any>(null);
  let deletingUser = $state<any>(null);
  let selectedUser = $state<any>(null);

  // Form state
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

<div class="p-8">
  <!-- Header -->
  <div class="mb-8 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
        <Users class="h-6 w-6 text-primary" />
      </div>
      <div>
        <h1 class="text-2xl font-bold">Users Management</h1>
        <p class="text-sm text-base-content/70">Manage users, roles, and organization assignments</p>
      </div>
    </div>
    <button class="btn btn-primary" onclick={openCreateModal}>
      <Plus class="h-4 w-4" />
      Add User
    </button>
  </div>

  <!-- Filters -->
  <div class="mb-6 flex flex-wrap gap-4">
    <div class="form-control">
      <div class="input-group">
        <span class="bg-base-200">
          <Search class="h-4 w-4" />
        </span>
        <input type="text" placeholder="Search users..." class="input input-bordered input-sm" bind:value={searchQuery} />
      </div>
    </div>
    
    <select class="select select-bordered select-sm" bind:value={filterOrg}>
      <option value="">All Organizations</option>
      {#each orgsList as org}
        <option value={org.id}>{org.organizationName || org.name}</option>
      {/each}
    </select>
    
    <select class="select select-bordered select-sm" bind:value={filterStatus}>
      <option value="all">All Status</option>
      <option value="active">Active</option>
      <option value="suspended">Suspended</option>
    </select>
  </div>

  <!-- Users Table -->
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body">
      <div class="overflow-x-auto">
        <table class="table">
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
              <tr><td colspan="7" class="text-center py-8"><span class="loading loading-spinner loading-md"></span></td></tr>
            {:else if filteredUsers.length > 0}
              {#each filteredUsers as user}
                <tr class="hover">
                  <td>
                    <button class="btn btn-ghost btn-xs btn-square" onclick={() => toggleExpansion(user.id)}>
                      <ChevronDown class="h-4 w-4 transition-transform {expandedUserId === user.id ? 'rotate-180' : ''}" />
                    </button>
                  </td>
                  <td>
                    <div class="flex items-center gap-3">
                      <div class="avatar placeholder">
                        <div class="bg-primary/10 text-primary rounded-full w-10">
                          <span class="text-lg font-semibold">
                            {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div class="font-medium">{user.name || 'Unnamed'}</div>
                        {#if user.emailVerified}
                          <div class="text-xs text-success flex items-center gap-1">
                            <UserCheck class="h-3 w-3" /> Verified
                          </div>
                        {/if}
                      </div>
                    </div>
                  </td>
                  <td class="text-sm">{user.email}</td>
                  <td>
                    <div class="flex flex-wrap gap-1">
                      {#if user.organizations?.length > 0}
                        {#each user.organizations.slice(0, 2) as org}
                          <span class="badge badge-sm badge-outline">{org.organizationName || org.name}</span>
                        {/each}
                        {#if user.organizations.length > 2}
                          <span class="badge badge-sm badge-ghost">+{user.organizations.length - 2}</span>
                        {/if}
                      {:else}
                        <span class="text-base-content/50 text-xs">None</span>
                      {/if}
                    </div>
                  </td>
                  <td>
                    {#if user.isSuperAdmin}
                      <span class="badge badge-warning badge-sm flex items-center gap-1 w-fit">
                        <Shield class="h-3 w-3" /> Super Admin
                      </span>
                    {:else if user.organizations?.some((o: any) => o.isOrgAdmin)}
                      <span class="badge badge-primary badge-sm">Org Admin</span>
                    {:else}
                      <span class="badge badge-neutral badge-sm">Member</span>
                    {/if}
                  </td>
                  <td>
                    <span class="badge {user.status === false ? 'badge-error' : 'badge-success'} badge-sm">
                      {user.status === false ? 'Suspended' : 'Active'}
                    </span>
                  </td>
                  <td class="text-right">
                    <div class="flex justify-end gap-2">
                      <button class="btn btn-ghost btn-sm btn-square" onclick={() => openOrgModal(user)} title="Manage organizations">
                        <Building2 class="h-4 w-4" />
                      </button>
                      <button class="btn btn-ghost btn-sm btn-square" onclick={() => openEditModal(user)} title="Edit user">
                        <Pencil class="h-4 w-4" />
                      </button>
                      <button 
                        class="btn btn-ghost btn-sm btn-square {user.status === false ? 'text-success' : 'text-warning'}" 
                        onclick={() => handleSuspendToggle(user)}
                        title={user.status === false ? 'Activate' : 'Suspend'}
                      >
                        {#if user.status === false}
                          <UserCheck class="h-4 w-4" />
                        {:else}
                          <UserX class="h-4 w-4" />
                        {/if}
                      </button>
                      <button class="btn btn-ghost btn-sm btn-square text-error" onclick={() => openDeleteConfirm(user)} title="Delete user">
                        <Trash2 class="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                
                {#if expandedUserId === user.id}
                  <tr>
                    <td colspan="7" class="bg-base-200/30">
                      <div class="p-4">
                        <h4 class="font-semibold mb-3">Organization Memberships</h4>
                        {#if user.organizations?.length > 0}
                          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {#each user.organizations as org}
                              <div class="card bg-base-100 border border-base-300">
                                <div class="card-body p-4">
                                  <h5 class="font-medium">{org.organizationName || org.name}</h5>
                                  <div class="flex items-center gap-2 mt-2">
                                    <span class="text-sm text-base-content/70">Role:</span>
                                    <span class="badge badge-sm badge-primary">{org.userRole || 'member'}</span>
                                    {#if org.isOrgAdmin}
                                      <span class="badge badge-sm badge-warning">Admin</span>
                                    {/if}
                                  </div>
                                </div>
                              </div>
                            {/each}
                          </div>
                        {:else}
                          <p class="text-base-content/50">Not assigned to any organizations</p>
                        {/if}
                      </div>
                    </td>
                  </tr>
                {/if}
              {/each}
            {:else}
              <tr>
                <td colspan="7" class="text-center py-8">
                  <div class="flex flex-col items-center gap-2">
                    <Users class="h-12 w-12 text-base-content/30" />
                    <p class="text-base-content/70">No users found</p>
                    {#if !searchQuery && !filterOrg && filterStatus === 'all'}
                      <button class="btn btn-sm btn-primary" onclick={openCreateModal}>Add your first user</button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<!-- Create/Edit User Modal -->
{#if showUserModal}
  {@const formRef = modalMode === 'create' ? createUser : updateUser}
  <div class="modal modal-open">
    <div class="modal-box max-w-2xl">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg">{modalMode === 'create' ? 'Add New User' : 'Edit User'}</h3>
        <button class="btn btn-ghost btn-sm btn-circle" onclick={() => { showUserModal = false; resetForm(); }}>
          <X class="h-4 w-4" />
        </button>
      </div>

      <form {...formRef} onsubmit={handleUserSubmit} class="space-y-4">
        {#if modalMode === 'edit'}
          <input type="hidden" name="id" value={editingUser?.id} />
        {/if}
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField 
            label="Email" 
            issues={formRef.fields.email.issues()}
          >
            <FormInput 
              field={formRef.fields.email} 
              type="email"
              placeholder="user@example.com"
              disabled={modalMode === 'edit'}
            />
          </FormField>
          
          <FormField 
            label="Name" 
            issues={formRef.fields.name.issues()}
          >
            <FormInput 
              field={formRef.fields.name} 
              placeholder="John Doe"
            />
          </FormField>
        </div>
        
        {#if modalMode === 'create'}
          <FormField 
            label="Password (Optional)" 
            issues={formRef.fields.password.issues()}
            hint="Leave empty to let user set via email"
          >
            <FormInput 
              field={formRef.fields.password} 
              type="password"
              placeholder="••••••••"
            />
          </FormField>
        {/if}
        
        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-3">
            <input type="checkbox" name="isSuperAdmin" class="checkbox checkbox-warning" bind:checked={formData.isSuperAdmin} />
            <div>
              <span class="label-text font-medium">Super Admin</span>
              <p class="text-xs text-base-content/60">Full system access across all organizations</p>
            </div>
          </label>
        </div>
        
        {#if modalMode === 'create'}
          <div class="form-control">
            <label class="label"><span class="label-text font-semibold">Assign to Organizations</span></label>
            <div class="border border-base-300 rounded-lg p-4 max-h-48 overflow-y-auto space-y-2">
              {#if orgsList.length > 0}
                {#each orgsList as org}
                  <label class="flex items-center gap-3 cursor-pointer hover:bg-base-200 p-2 rounded">
                    <input
                      type="checkbox" class="checkbox checkbox-sm"
                      checked={formData.selectedOrgs.has(org.id)}
                      onchange={() => toggleOrganization(org.id)}
                    />
                    <div class="flex-1">
                      <div class="font-medium text-sm">{org.organizationName || org.name}</div>
                      {#if org.organizationSlug}
                        <div class="text-xs text-base-content/60">{org.organizationSlug}</div>
                      {/if}
                    </div>
                  </label>
                {/each}
              {:else}
                <div class="text-center text-sm text-base-content/60 py-4">No organizations available</div>
              {/if}
            </div>
          </div>
          
          <input type="hidden" name="organizations" value={JSON.stringify(Array.from(formData.selectedOrgs))} />
          <input type="hidden" name="roles" value={JSON.stringify({})} />
        {/if}
        
        <div class="modal-action">
          <button type="button" class="btn" onclick={() => { showUserModal = false; resetForm(); }}>Cancel</button>
          <button type="submit" class="btn btn-primary">{modalMode === 'create' ? 'Add User' : 'Save Changes'}</button>
        </div>
      </form>
    </div>
    <button type="button" class="modal-backdrop" onclick={() => { showUserModal = false; resetForm(); }} aria-label="Close modal"></button>
  </div>
{/if}

<!-- Organization Management Modal -->
{#if showOrgModal && selectedUser}
  <div class="modal modal-open">
    <div class="modal-box">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg">Manage Organizations</h3>
        <button class="btn btn-ghost btn-sm btn-circle" onclick={() => { showOrgModal = false; resetOrgForm(); }}>
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="space-y-4">
        <div class="text-sm text-base-content/70">
          Managing organizations for <strong>{selectedUser.name || selectedUser.email}</strong>
        </div>
        
        {#if selectedUser.organizations?.length > 0}
          <div>
            <h4 class="font-medium mb-2">Current Organizations</h4>
            <div class="space-y-2">
              {#each selectedUser.organizations as org}
                <div class="flex items-center justify-between p-3 bg-base-200/50 rounded-lg">
                  <div>
                    <div class="font-medium">{org.organizationName || org.name}</div>
                    <div class="text-sm text-base-content/60">Role: {org.userRole || 'member'}</div>
                  </div>
                  <form {...removeUserFromOrganization} onsubmit={() => { showOrgModal = false; }}>
                    <input type="hidden" name="userId" value={selectedUser.id} />
                    <input type="hidden" name="organizationId" value={org.id} />
                    <button type="submit" class="btn btn-error btn-sm">Remove</button>
                  </form>
                </div>
              {/each}
            </div>
          </div>
        {/if}
        
        <div class="divider">Add to Organization</div>
        
        <form {...addUserToOrganization} onsubmit={() => { showOrgModal = false; resetOrgForm(); }} class="space-y-3">
          <input type="hidden" name="userId" value={selectedUser.id} />
          
          <FormField 
            label="Organization" 
            issues={addUserToOrganization.fields.organizationId.issues()}
          >
            <FormSelect field={addUserToOrganization.fields.organizationId}>
              <option value="">Select organization...</option>
              {#each orgsList as org}
                {#if !selectedUser.organizations?.some((o: any) => o.id === org.id)}
                  <option value={org.id}>{org.organizationName || org.name}</option>
                {/if}
              {/each}
            </FormSelect>
          </FormField>
          
          <div class="modal-action">
            <button type="button" class="btn" onclick={() => { showOrgModal = false; resetOrgForm(); }}>Cancel</button>
            <button type="submit" class="btn btn-primary" aria-busy={!!addUserToOrganization.pending} disabled={!!addUserToOrganization.pending}>
              Add to Organization
            </button>
          </div>
        </form>
      </div>
    </div>
    <button type="button" class="modal-backdrop" onclick={() => { showOrgModal = false; resetOrgForm(); }} aria-label="Close modal"></button>
  </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm && deletingUser}
  <div class="modal modal-open">
    <div class="modal-box">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg text-error">Confirm Delete</h3>
        <button class="btn btn-ghost btn-sm btn-circle" onclick={() => { showDeleteConfirm = false; deletingUser = null; }}>
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="space-y-4">
        <p class="text-base-content/70">
          Are you sure you want to delete <strong>{deletingUser.name || deletingUser.email}</strong>?
        </p>
        <p class="text-sm text-error">This action cannot be undone.</p>
        
        <div class="flex gap-2 justify-end">
          <button type="button" class="btn btn-outline" onclick={() => { showDeleteConfirm = false; deletingUser = null; }}>
            Cancel
          </button>
          <form {...deleteUser} onsubmit={() => { showDeleteConfirm = false; deletingUser = null; }}>
            <input type="hidden" name="id" value={deletingUser.id} />
            <button type="submit" class="btn btn-error">Delete User</button>
          </form>
        </div>
      </div>
    </div>
    <button type="button" class="modal-backdrop" onclick={() => { showDeleteConfirm = false; deletingUser = null; }} aria-label="Close modal"></button>
  </div>
{/if}

<!-- Hidden forms for suspend/activate -->
{#each usersList as user}
  <form {...suspendUser} id="suspend-form-{user.id}" style="display: none;">
    <input type="hidden" name="id" value={user.id} />
  </form>
  <form {...activateUser} id="activate-form-{user.id}" style="display: none;">
    <input type="hidden" name="id" value={user.id} />
  </form>
{/each}
