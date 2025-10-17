<script lang="ts">
  import { UserPlus, X } from 'lucide-svelte';
  import { Dialog, FormField, FormInput, StatsCard } from '@kuratchi/ui';
  import { getAllOrganizations, getAllUsers, createSuperadminUser } from '$lib/api/superadmin.remote';

  const organizationsQuery = getAllOrganizations();
  const usersQuery = getAllUsers();

  // Modal state
  let showCreateDialog = $state(false);

  function openCreateDialog() {
    showCreateDialog = true;
  }

  function closeCreateDialog() {
    showCreateDialog = false;
  }</script>

<!-- Quick Stats -->
<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
  {#if organizationsQuery.loading || usersQuery.loading}
    <div class="card bg-base-100 shadow-sm animate-pulse">
      <div class="card-body">
        <div class="h-4 bg-base-200 rounded w-32 mb-2"></div>
        <div class="h-8 bg-base-200 rounded w-16"></div>
      </div>
    </div>
    <div class="card bg-base-100 shadow-sm animate-pulse">
      <div class="card-body">
        <div class="h-4 bg-base-200 rounded w-24 mb-2"></div>
        <div class="h-8 bg-base-200 rounded w-16"></div>
      </div>
    </div>
    <div class="card bg-base-100 shadow-sm animate-pulse">
      <div class="card-body">
        <div class="h-4 bg-base-200 rounded w-32 mb-2"></div>
        <div class="h-8 bg-base-200 rounded w-16"></div>
      </div>
    </div>
  {:else if organizationsQuery.error || usersQuery.error}
    <div class="col-span-3">
      <div class="alert alert-error">
        <span>Failed to load dashboard data</span>
      </div>
    </div>
  {:else}
    <div class="card bg-base-100 shadow-sm">
      <div class="card-body">
        <div class="text-sm text-base-content/70 mb-1">Total Organizations</div>
        <div class="text-3xl font-bold">{organizationsQuery.current?.length || 0}</div>
      </div>
    </div>
    <div class="card bg-base-100 shadow-sm">
      <div class="card-body">
        <div class="text-sm text-base-content/70 mb-1">Total Users</div>
        <div class="text-3xl font-bold">{usersQuery.current?.length || 0}</div>
      </div>
    </div>
    <div class="card bg-base-100 shadow-sm">
      <div class="card-body">
        <div class="text-sm text-base-content/70 mb-1">Active Superadmins</div>
        <div class="text-3xl font-bold">
          {usersQuery.current?.filter((u) => u.isSuperAdmin).length || 0}
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Action Card -->
<div class="card bg-base-100 shadow-sm">
  <div class="card-body">
    <h2 class="card-title">Quick Actions</h2>
    <p class="text-base-content/70">Manage your platform with these common actions</p>
    <div class="card-actions justify-end mt-4">
      <a href="/superadmin/organizations" class="btn btn-outline">View Organizations</a>
      <a href="/superadmin/users" class="btn btn-outline">View Users</a>
      <button class="btn btn-primary" onclick={openCreateDialog}>
        <UserPlus class="h-4 w-4" />
        Create Superadmin
      </button>
    </div>
  </div>
</div>

<!-- Create Superadmin Dialog -->
{#if showCreateDialog}
  <Dialog bind:open={showCreateDialog} size="md" onClose={closeCreateDialog} class="rounded-2xl border border-base-200 shadow-xl" backdropClass="bg-black/40 backdrop-blur-sm">
    {#snippet header()}
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-lg">Create Superadmin</h3>
        <button
          class="btn btn-ghost btn-sm btn-circle"
          type="button"
          onclick={closeCreateDialog}
          aria-label="Close"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    {/snippet}
    {#snippet children()}
      <form {...createSuperadminUser} class="space-y-4">
        <FormField 
          label="Full Name" 
          issues={createSuperadminUser.fields.name.issues()}
        >
          <FormInput 
            field={createSuperadminUser.fields.name} 
            placeholder="John Doe"
          />
        </FormField>

        <FormField 
          label="Email" 
          issues={createSuperadminUser.fields.email.issues()}
        >
          <FormInput 
            field={createSuperadminUser.fields.email} 
            type="email"
            placeholder="admin@example.com"
          />
        </FormField>

        <FormField 
          label="Password" 
          issues={createSuperadminUser.fields.password.issues()}
          hint="Minimum 8 characters"
        >
          <FormInput 
            field={createSuperadminUser.fields.password} 
            type="password"
            placeholder="••••••••"
          />
        </FormField>

        <FormField 
          label="Organization Name (Optional)" 
          issues={createSuperadminUser.fields.organizationName.issues()}
          hint="Defaults to [Name]'s Workspace"
        >
          <FormInput 
            field={createSuperadminUser.fields.organizationName} 
            placeholder="Admin Workspace"
          />
        </FormField>

        <div class="modal-action">
          <button
            type="button"
            class="btn"
            onclick={closeCreateDialog}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            class="btn btn-primary" 
            aria-busy={!!createSuperadminUser.pending} 
            disabled={!!createSuperadminUser.pending}
          >
            {createSuperadminUser.pending ? 'Creating...' : 'Create Superadmin'}
          </button>
        </div>
      </form>
    {/snippet}
  </Dialog>
{/if}
