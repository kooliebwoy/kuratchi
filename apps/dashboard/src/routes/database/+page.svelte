<script lang="ts">
  import { 
    logRouteActivity, 
    getDatabases, 
    createDatabase
  } from '$lib/api/database.remote';

  let createDialog: HTMLDialogElement;

  // Load data using remote functions
  logRouteActivity();
  const databases = getDatabases();

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
</script>

<svelte:head>
  <title>Databases - Kuratchi Dashboard</title>
</svelte:head>

<section class="space-y-8">
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold">Databases</h1>
      <p class="text-sm text-base-content/60">Manage your organization databases</p>
    </div>
    <div class="flex gap-2">
      <button class="btn btn-primary btn-sm text-primary-content" onclick={() => createDialog.showModal()}>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
        </svg>
        New Database
      </button>
    </div>
  </div>

  <div class="card border border-base-200 bg-base-200/30">
    <div class="card-body gap-6">
      <div class="overflow-hidden rounded-xl border border-base-200/60">
        <table class="table">
          <thead class="bg-base-200/50 text-xs uppercase tracking-widest text-base-content/40">
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Status</th>
              <th>Created</th>
              <th class="w-[100px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#if databases.loading}
              <tr>
                <td colspan="5" class="text-center py-8">
                  <span class="loading loading-spinner loading-md"></span>
                </td>
              </tr>
            {:else if databases.error}
              <tr>
                <td colspan="5" class="text-center py-8 text-error">
                  Error loading databases
                </td>
              </tr>
            {:else if databases.current && databases.current.length > 0}
              {#each databases.current as db}
                <tr class="text-sm hover:bg-base-200/50">
                  <td>
                    <a href="/database/{db.id}" class="font-semibold text-primary hover:underline">
                      {db.name}
                    </a>
                  </td>
                  <td class="text-base-content/70">{db.description || '-'}</td>
                  <td>
                    {#if db.status}
                      <span class="badge badge-success badge-sm">Active</span>
                    {:else}
                      <span class="badge badge-error badge-sm">Inactive</span>
                    {/if}
                  </td>
                  <td class="text-base-content/70">{formatDate(db.created_at)}</td>
                  <td>
                    <div class="dropdown dropdown-end">
                      <button tabindex="0" class="btn btn-ghost btn-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>
                      <ul tabindex="-1" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                        <li>
                          <a href="/database/{db.id}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                              <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
                            </svg>
                            View Details
                          </a>
                        </li>
                        <li>
                          <button class="text-error">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                            </svg>
                            Delete
                          </button>
                        </li>
                      </ul>
                    </div>
                  </td>
                </tr>
              {/each}
            {:else}
              <tr>
                <td colspan="5" class="text-center py-12">
                  <div class="flex flex-col items-center gap-4">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-base-content/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                    </svg>
                    <div class="text-center">
                      <p class="font-semibold text-base-content/60">No databases yet</p>
                      <p class="text-sm text-base-content/40">Create your first database to get started</p>
                    </div>
                    <button class="btn btn-primary btn-sm" onclick={() => createDialog.showModal()}>
                      Create Database
                    </button>
                  </div>
                </td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</section>

<!-- Create Database Dialog -->
<dialog bind:this={createDialog} class="modal">
  <div class="modal-box">
    <form method="dialog">
      <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
    </form>
    
    <h3 class="font-bold text-lg mb-4">Create New Database</h3>

    {#if createDatabase.result?.success}
      <div class="alert alert-success mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Database created successfully!</span>
      </div>
    {/if}

    {#if createDatabase.pending > 0}
      <div class="alert alert-info mb-4">
        <span class="loading loading-spinner loading-sm"></span>
        <div>
          <div class="font-semibold">Creating D1 database...</div>
          <div class="text-sm opacity-70">This may take 5-10 seconds as we deploy your dedicated worker</div>
        </div>
      </div>
    {/if}
    
    <form {...createDatabase} class="space-y-4" enctype="multipart/form-data">
      <div class="form-control">
        <label class="label" for="db-name">
          <span class="label-text">Database Name</span>
        </label>
        <input 
          id="db-name"
          type="text" 
          name="name"
          placeholder="my-database" 
          class="input input-bordered w-full" 
          pattern="[a-z0-9-]+"
          required
        />
        <div class="label">
          <span class="label-text-alt">Use lowercase letters, numbers, and hyphens only</span>
        </div>
      </div>

      <div class="form-control">
        <label class="label" for="db-description">
          <span class="label-text">Description</span>
        </label>
        <textarea 
          id="db-description"
          name="description"
          class="textarea textarea-bordered" 
          placeholder="Describe your database..."
          required
        ></textarea>
      </div>

      <div class="modal-action">
        <button type="button" class="btn" onclick={() => createDialog.close()}>Cancel</button>
        <button type="submit" class="btn btn-primary" disabled={createDatabase.pending > 0}>
          {#if createDatabase.pending > 0}
            <span class="loading loading-spinner loading-sm"></span>
            Creating...
          {:else}
            Create Database
          {/if}
        </button>
      </div>
    </form>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button>close</button>
  </form>
</dialog>

