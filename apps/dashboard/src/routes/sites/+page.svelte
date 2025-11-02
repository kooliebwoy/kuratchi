<script lang="ts">
  import { 
    logRouteActivity, 
    getSites, 
    createSite
  } from '$lib/api/sites.remote';
  import { Layout, Plus, ExternalLink, Settings, Trash2, Palette } from 'lucide-svelte';

  let createDialog: HTMLDialogElement;

  // Load data using remote functions
  logRouteActivity();
  const sites = getSites();

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

<section class="space-y-8">
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold">Sites</h1>
      <p class="text-sm text-base-content/60">Create and manage your Kuratchi websites</p>
    </div>
    <div class="flex gap-2">
      <button class="btn btn-primary btn-sm text-primary-content" onclick={() => createDialog.showModal()}>
        <Plus class="h-4 w-4" />
        New Site
      </button>
    </div>
  </div>

  <div class="card border border-base-200 bg-base-200/30">
    <div class="card-body gap-6">
      {#if sites.loading}
        <div class="flex justify-center py-12">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      {:else if sites.error}
        <div class="alert alert-error">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Error loading sites</span>
        </div>
      {:else if sites.current && sites.current.length > 0}
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {#each sites.current as site}
            <div class="card bg-base-100 border border-base-200 hover:shadow-lg transition-shadow">
              <div class="card-body">
                <div class="flex items-start justify-between">
                  <div class="flex items-center gap-3">
                    <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Layout class="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 class="font-semibold text-base">{site.name}</h3>
                      <p class="text-xs text-base-content/60">{site.subdomain}.kuratchi.com</p>
                    </div>
                  </div>
                  <div class="dropdown dropdown-end">
                    <button tabindex="0" class="btn btn-ghost btn-sm btn-circle">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                    <ul tabindex="-1" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                      <li>
                        <a href="/sites/{site.id}">
                          <Settings class="h-4 w-4" />
                          Edit Site
                        </a>
                      </li>
                      <li>
                        <a href="https://{site.subdomain}.kuratchi.com" target="_blank" rel="noopener noreferrer">
                          <ExternalLink class="h-4 w-4" />
                          Visit Site
                        </a>
                      </li>
                      <li>
                        <button class="text-error">
                          <Trash2 class="h-4 w-4" />
                          Delete
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
                
                {#if site.description}
                  <p class="text-sm text-base-content/70 mt-2">{site.description}</p>
                {/if}

                <div class="flex items-center justify-between mt-4 pt-4 border-t border-base-200">
                  <div class="flex items-center gap-2">
                    <Palette class="h-3 w-3 text-base-content/60" />
                    <span class="text-xs text-base-content/60">{site.theme || 'Default'}</span>
                  </div>
                  <span class="text-xs text-base-content/60">{formatDate(site.created_at)}</span>
                </div>

                <div class="card-actions mt-4">
                  <a href="/sites/{site.id}" class="btn btn-primary btn-sm btn-block">
                    Edit Site
                  </a>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="flex flex-col items-center gap-4 py-12">
          <div class="flex h-20 w-20 items-center justify-center rounded-full bg-base-200">
            <Layout class="h-10 w-10 text-base-content/40" />
          </div>
          <div class="text-center">
            <p class="font-semibold text-base-content/60">No sites yet</p>
            <p class="text-sm text-base-content/40">Create your first Kuratchi site to get started</p>
          </div>
          <button class="btn btn-primary btn-sm" onclick={() => createDialog.showModal()}>
            <Plus class="h-4 w-4" />
            Create Site
          </button>
        </div>
      {/if}
    </div>
  </div>
</section>

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
