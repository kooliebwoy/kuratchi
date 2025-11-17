<script lang="ts">
  import { 
    logRouteActivity, 
    getSites, 
    createSite,
    deleteSite
  } from '$lib/functions/sites.remote';
  import { Layout, Plus, ExternalLink, Settings, Trash2, Palette, X } from 'lucide-svelte';

  let createDialog: HTMLDialogElement;
  let showDeleteConfirm = $state(false);
  let deletingSite = $state<any>(null);

  // Load data using remote functions
  logRouteActivity();
  const sites = getSites();

  function handleDeleteClick(site: any) {
    deletingSite = site;
    showDeleteConfirm = true;
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
</script>

<svelte:head>
  <title>Sites - Kuratchi Dashboard</title>
</svelte:head>

<div class="p-8">
  <!-- Header -->
  <div class="mb-8 flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold">Sites</h1>
      <p class="text-sm text-base-content/70">Create and manage your Kuratchi websites</p>
    </div>
    <button class="btn btn-primary" onclick={() => createDialog.showModal()}>
      <Plus class="h-4 w-4" />
      New Site
    </button>
  </div>

  <!-- Sites Table -->
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body">
      <div class="overflow-x-auto">
        {#if sites.loading}
          <div class="flex justify-center py-12">
            <span class="loading loading-spinner loading-lg"></span>
          </div>
        {:else if sites.error}
          <div class="alert alert-error">
            <span>Error loading sites. Please try again.</span>
          </div>
        {:else if sites.current && sites.current.length > 0}
          <table class="table">
            <thead>
              <tr>
                <th>Site Name</th>
                <th>Subdomain</th>
                <th>Theme</th>
                <th>Created</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each sites.current as site}
                <tr class="hover">
                  <td>
                    <div class="flex items-center gap-2">
                      <Layout class="h-4 w-4 text-base-content/60" />
                      <div>
                        <div class="font-medium">{site.name}</div>
                        {#if site.description}
                          <div class="text-xs text-base-content/50">{site.description}</div>
                        {/if}
                      </div>
                    </div>
                  </td>
                  <td>
                    <code class="text-sm">{site.subdomain}.kuratchi.com</code>
                  </td>
                  <td>
                    <span class="badge badge-outline badge-sm">{site.theme || 'Default'}</span>
                  </td>
                  <td>
                    <span class="text-sm">{formatDate(site.created_at)}</span>
                  </td>
                  <td class="text-right">
                    <div class="flex gap-1 justify-end">
                      <a
                        href="/sites/{site.id}"
                        class="btn btn-ghost btn-sm btn-square"
                        title="Edit site"
                      >
                        <Settings class="h-4 w-4" />
                      </a>
                      <a
                        href="https://{site.subdomain}.kuratchi.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="btn btn-ghost btn-sm btn-square"
                        title="Visit site"
                      >
                        <ExternalLink class="h-4 w-4" />
                      </a>
                      <button
                        class="btn btn-ghost btn-sm btn-square text-error"
                        onclick={() => handleDeleteClick(site)}
                        title="Delete site"
                      >
                        <Trash2 class="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <div class="text-center py-12">
            <div class="flex flex-col items-center gap-2">
              <Layout class="h-12 w-12 text-base-content/30" />
              <p class="text-base-content/70">No sites found</p>
              <button class="btn btn-primary btn-sm mt-2" onclick={() => createDialog.showModal()}>
                <Plus class="h-4 w-4" />
                Create Your First Site
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<!-- Create Site Dialog -->
<dialog bind:this={createDialog} class="modal">
  <div class="modal-box max-w-2xl">
    <form method="dialog">
      <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
    </form>
    
    <h3 class="font-bold text-lg mb-4">Create New Site</h3>

    {#if createSite.result?.success}
      <div class="alert alert-success mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Site created successfully!</span>
      </div>
    {/if}

    {#if createSite.pending > 0}
      <div class="alert alert-info mb-4">
        <span class="loading loading-spinner loading-sm"></span>
        <div>
          <div class="font-semibold">Creating your site...</div>
          <div class="text-sm opacity-70">Setting up your Kuratchi website</div>
        </div>
      </div>
    {/if}
    
    <form {...createSite} class="space-y-4" enctype="multipart/form-data">
      <div class="form-control">
        <label class="label" for="site-name">
          <span class="label-text">Site Name</span>
        </label>
        <input 
          id="site-name"
          type="text" 
          name="name"
          placeholder="My Awesome Site" 
          class="input input-bordered w-full" 
          required
        />
        <div class="label">
          <span class="label-text-alt">A friendly name for your site</span>
        </div>
      </div>

      <div class="form-control">
        <label class="label" for="site-subdomain">
          <span class="label-text">Subdomain</span>
        </label>
        <div class="join w-full">
          <input 
            id="site-subdomain"
            type="text" 
            name="subdomain"
            placeholder="my-site" 
            class="input input-bordered join-item flex-1" 
            pattern="[a-z0-9-]+"
            required
          />
          <span class="btn btn-ghost join-item no-animation">.kuratchi.com</span>
        </div>
        <div class="label">
          <span class="label-text-alt">Use lowercase letters, numbers, and hyphens only</span>
        </div>
      </div>

      <div class="form-control">
        <label class="label" for="site-description">
          <span class="label-text">Description (Optional)</span>
        </label>
        <textarea 
          id="site-description"
          name="description"
          class="textarea textarea-bordered" 
          placeholder="Describe your site..."
          rows="3"
        ></textarea>
      </div>

      <div class="modal-action">
        <button type="button" class="btn" onclick={() => createDialog.close()}>Cancel</button>
        <button type="submit" class="btn btn-primary" disabled={createSite.pending > 0}>
          {#if createSite.pending > 0}
            <span class="loading loading-spinner loading-sm"></span>
            Creating...
          {:else}
            Create Site
          {/if}
        </button>
      </div>
    </form>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button>close</button>
  </form>
</dialog>

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm && deletingSite}
  <div class="modal modal-open">
    <div class="modal-box">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg text-error">Confirm Delete</h3>
        <button class="btn btn-ghost btn-sm btn-circle" onclick={() => { showDeleteConfirm = false; deletingSite = null; }}>
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="space-y-4">
        <p class="text-base-content/70">
          Are you sure you want to delete <strong>{deletingSite.name}</strong>?
        </p>
        <p class="text-sm text-base-content/60">
          This will permanently delete:
        </p>
        <ul class="list-disc list-inside text-sm text-base-content/60 space-y-1 ml-2">
          <li>The site and all its pages</li>
          <li>The site's database from Cloudflare</li>
          <li>All associated data and content</li>
        </ul>
        <p class="text-sm text-error font-semibold">This action cannot be undone.</p>
        
        <div class="flex gap-2 justify-end">
          <button type="button" class="btn btn-outline" onclick={() => { showDeleteConfirm = false; deletingSite = null; }}>
            Cancel
          </button>
          <form {...deleteSite} onsubmit={() => { showDeleteConfirm = false; deletingSite = null; }}>
            <input type="hidden" name="id" value={deletingSite.id} />
            <button type="submit" class="btn btn-error">
              <Trash2 class="h-4 w-4" />
              Delete Site
            </button>
          </form>
        </div>
      </div>
    </div>
    <button type="button" class="modal-backdrop" onclick={() => { showDeleteConfirm = false; deletingSite = null; }} aria-label="Close modal"></button>
  </div>
{/if}
