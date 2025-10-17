<script lang="ts">
  import { Users, Trash2, X } from 'lucide-svelte';
  import { Dialog } from '@kuratchi/ui';
  import { getAllUsers, deleteSuperadmin } from '$lib/api/superadmin.remote';

  const usersQuery = getAllUsers();

  // Delete confirmation state
  let deleteConfirmEmail = $state<string | null>(null);

  function confirmDelete(email: string) {
    deleteConfirmEmail = email;
  }

  function cancelDelete() {
    deleteConfirmEmail = null;
  }
</script>

<!-- Users Table -->
<div class="card bg-base-100 shadow-sm">
  <div class="overflow-x-auto">
    <table class="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Organizations</th>
          <th>Status</th>
          <th class="text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#if usersQuery.loading}
          <tr>
            <td colspan="6" class="text-center py-8">
              <span class="loading loading-spinner loading-md"></span>
            </td>
          </tr>
        {:else if usersQuery.current && usersQuery.current.length > 0}
          {#each usersQuery.current as user}
            <tr class="hover">
              <td class="font-medium">{user.name}</td>
              <td class="text-sm">{user.email}</td>
              <td>
                {#if user.isSuperAdmin}
                  <span class="badge badge-primary badge-sm">Superadmin</span>
                {:else}
                  <span class="badge badge-ghost badge-sm">User</span>
                {/if}
              </td>
              <td class="text-sm">
                {#if user.organizations && user.organizations.length > 0}
                  <div class="flex flex-wrap gap-1">
                    {#each user.organizations as org}
                      <span class="badge badge-sm badge-outline">
                        {org.name || org.organizationName}
                      </span>
                    {/each}
                  </div>
                {:else}
                  <span class="text-base-content/50">No organizations</span>
                {/if}
              </td>
              <td>
                {#if user.status}
                  <span class="badge badge-success badge-sm">Active</span>
                {:else}
                  <span class="badge badge-error badge-sm">Suspended</span>
                {/if}
              </td>
              <td class="text-right">
                <button
                  type="button"
                  class="btn btn-ghost btn-sm btn-square text-error"
                  onclick={() => confirmDelete(user.email)}
                  title="Delete superadmin"
                >
                  <Trash2 class="h-4 w-4" />
                </button>
              </td>
            </tr>
          {/each}
        {:else}
          <tr>
            <td colspan="6" class="text-center py-8">
              <div class="flex flex-col items-center gap-2">
                <Users class="h-12 w-12 text-base-content/30" />
                <p class="text-base-content/70">No users found</p>
              </div>
            </td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
</div>

<!-- Delete Confirmation Dialog -->
{#if deleteConfirmEmail}
  {@const isDeleteDialogOpen = !!deleteConfirmEmail}
  <Dialog open={isDeleteDialogOpen} size="sm" onClose={cancelDelete} class="rounded-2xl border border-base-200 shadow-xl" backdropClass="bg-black/40 backdrop-blur-sm">
    {#snippet header()}
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-lg text-error">Delete Superadmin</h3>
        <button
          class="btn btn-ghost btn-sm btn-circle"
          type="button"
          onclick={cancelDelete}
          aria-label="Close"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    {/snippet}
    {#snippet children()}
      <form {...deleteSuperadmin} class="space-y-4" onsubmit={() => { deleteConfirmEmail = null; }}>
        <input type="hidden" name="email" value={deleteConfirmEmail} />
        
        <div class="alert alert-warning">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span class="text-sm">This action cannot be undone!</span>
        </div>
        
        <p class="text-sm">
          Are you sure you want to permanently delete the superadmin account for <strong>{deleteConfirmEmail}</strong>?
        </p>
        
        <p class="text-sm text-warning">
          This will:
        </p>
        <ul class="list-disc list-inside text-sm text-warning space-y-1 ml-2">
          <li>Delete the user from the admin database</li>
          <li>Delete their organization and all associated data</li>
          <li>Delete their organization's database and worker</li>
        </ul>

        <div class="modal-action">
          <button
            type="button"
            class="btn"
            onclick={cancelDelete}
          >
            Cancel
          </button>
          <button 
            type="submit"
            class="btn btn-error" 
            aria-busy={!!deleteSuperadmin.pending} 
            disabled={!!deleteSuperadmin.pending}
          >
            {deleteSuperadmin.pending ? 'Deleting...' : 'Delete Permanently'}
          </button>
        </div>
      </form>
    {/snippet}
  </Dialog>
{/if}
