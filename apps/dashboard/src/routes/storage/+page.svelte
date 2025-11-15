<script lang="ts">
  import { 
    getAllBuckets, 
    enableBucketPublicDomain, 
    addBucketCustomDomain 
  } from '$lib/functions/storage.remote';
  import { Database, HardDrive, Globe, ExternalLink, Settings, CheckCircle, XCircle, AlertCircle, X } from 'lucide-svelte';

  // Load buckets
  let bucketsQuery = getAllBuckets(undefined);
  let data = $derived(bucketsQuery.current);
  
  let buckets = $derived<any[]>(data?.buckets ?? []);
  let orgBuckets = $derived<any[]>(data?.orgBuckets ?? []);
  let siteBuckets = $derived<any[]>(data?.siteBuckets ?? []);
  
  // State for modals
  let customDomainDialog: HTMLDialogElement;
  let selectedBucket = $state<any>(null);
  
  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  function handleAddCustomDomain(bucket: any) {
    selectedBucket = bucket;
    customDomainDialog.showModal();
  }
  let stats = $derived(data?.stats ?? { total: 0, managed: 0, unmanaged: 0, orgLevel: 0, siteLevel: 0 });
  
  // State
  let selectedTab = $state<'all' | 'org' | 'sites'>('all');
  
  // Computed
  let displayedBuckets = $derived(() => {
    if (selectedTab === 'org') return orgBuckets;
    if (selectedTab === 'sites') return siteBuckets;
    return buckets;
  });
</script>

<svelte:head>
  <title>Storage - Kuratchi Dashboard</title>
</svelte:head>

<div class="p-8">
  <!-- Header -->
  <div class="mb-8">
    <h1 class="text-2xl font-bold">Storage Buckets</h1>
    <p class="text-sm text-base-content/70">Manage R2 storage buckets and domains</p>
  </div>

  <!-- Buckets Table -->
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body">
      <div class="overflow-x-auto">
        {#if bucketsQuery.loading}
          <div class="flex justify-center py-12">
            <span class="loading loading-spinner loading-lg"></span>
          </div>
        {:else if bucketsQuery.error}
          <div class="alert alert-error">
            <span>Error loading buckets. Please try again.</span>
          </div>
        {:else if siteBuckets.length > 0}
          <table class="table">
            <thead>
              <tr>
                <th>Bucket / Site</th>
                <th>Type</th>
                <th>Public Domain</th>
                <th>Custom Domain</th>
                <th>Created</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each siteBuckets as bucket}
                <tr class="hover">
                  <td>
                    <div class="flex items-center gap-2">
                      <HardDrive class="h-4 w-4 text-base-content/60" />
                      <div>
                        <div class="font-medium">{bucket.name}</div>
                        {#if bucket.metadata?.name}
                          <div class="text-xs text-base-content/50">
                            {bucket.metadata.name}
                            {#if bucket.metadata.subdomain}
                              · {bucket.metadata.subdomain}.kuratchi.com
                            {/if}
                          </div>
                        {/if}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="badge badge-outline badge-sm">
                      {bucket.metadata?.type === 'site' ? 'Site Storage' : 'Storage'}
                    </span>
                  </td>
                  <td>
                    {#if bucket.publicDomain?.enabled}
                      <div class="flex items-center gap-1 text-success">
                        <CheckCircle class="h-4 w-4" />
                        <span class="text-xs">Enabled</span>
                      </div>
                    {:else}
                      <div class="flex items-center gap-1 text-base-content/40">
                        <XCircle class="h-4 w-4" />
                        <span class="text-xs">Disabled</span>
                      </div>
                    {/if}
                  </td>
                  <td>
                    {#if bucket.customDomain}
                      <code class="text-xs">{bucket.customDomain}</code>
                    {:else}
                      <div class="flex items-center gap-1 text-warning">
                        <AlertCircle class="h-4 w-4" />
                        <span class="text-xs">Not configured</span>
                      </div>
                    {/if}
                  </td>
                  <td>
                    <span class="text-sm">{formatDate(bucket.creation_date)}</span>
                  </td>
                  <td class="text-right">
                    <div class="flex gap-1 justify-end">
                      <a
                        href="/storage/{bucket.name}"
                        class="btn btn-ghost btn-sm btn-square"
                        title="View files"
                      >
                        <HardDrive class="h-4 w-4" />
                      </a>
                      
                      {#if !bucket.publicDomain?.enabled}
                        <form {...enableBucketPublicDomain}>
                          <input type="hidden" name="bucketName" value={bucket.name} />
                          <button
                            type="submit"
                            class="btn btn-ghost btn-sm"
                            title="Enable public domain"
                            disabled={enableBucketPublicDomain.pending > 0}
                          >
                            {#if enableBucketPublicDomain.pending > 0}
                              <span class="loading loading-spinner loading-xs"></span>
                            {:else}
                              <Globe class="h-4 w-4" />
                            {/if}
                            Enable R2.dev
                          </button>
                        </form>
                      {/if}
                      
                      {#if !bucket.customDomain && bucket.metadata?.subdomain}
                        <button
                          class="btn btn-ghost btn-sm"
                          title="Add custom domain"
                          onclick={() => handleAddCustomDomain(bucket)}
                        >
                          <ExternalLink class="h-4 w-4" />
                          Add Domain
                        </button>
                      {/if}
                      
                      <button
                        class="btn btn-ghost btn-sm btn-square"
                        title="Settings"
                      >
                        <Settings class="h-4 w-4" />
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
              <HardDrive class="h-12 w-12 text-base-content/30" />
              <p class="text-base-content/70">No storage buckets found</p>
              <p class="text-sm text-base-content/50">Buckets are created automatically when you create a site</p>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<!-- Add Custom Domain Dialog -->
<dialog bind:this={customDomainDialog} class="modal">
  <div class="modal-box">
    <form method="dialog">
      <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
        <X class="h-4 w-4" />
      </button>
    </form>
    
    <h3 class="font-bold text-lg mb-4">Add Custom Domain</h3>

    {#if selectedBucket}
      <div class="alert alert-info mb-4">
        <div class="text-sm">
          <p class="font-semibold mb-1">Suggested Domain:</p>
          <code class="text-xs">{selectedBucket.suggestedCustomDomain}</code>
        </div>
      </div>

      {#if addBucketCustomDomain.result?.success}
        <div class="alert alert-success mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Custom domain added successfully!</span>
        </div>
      {/if}

      {#if addBucketCustomDomain.pending > 0}
        <div class="alert alert-info mb-4">
          <span class="loading loading-spinner loading-sm"></span>
          <div>
            <div class="font-semibold">Adding custom domain...</div>
            <div class="text-sm opacity-70">This may take a moment</div>
          </div>
        </div>
      {/if}
      
      <form {...addBucketCustomDomain} class="space-y-4" onsubmit={() => setTimeout(() => customDomainDialog.close(), 1000)}>
        <input type="hidden" name="bucketName" value={selectedBucket.name} />
        
        <div class="form-control">
          <label class="label" for="custom-domain">
            <span class="label-text">Custom Domain</span>
          </label>
          <input 
            id="custom-domain"
            type="text" 
            name="customDomain"
            value={selectedBucket.suggestedCustomDomain}
            class="input input-bordered w-full" 
            required
          />
          <div class="label">
            <span class="label-text-alt">This will be your public storage URL</span>
          </div>
        </div>

        <div class="alert alert-warning">
          <AlertCircle class="h-4 w-4" />
          <div class="text-xs">
            <p class="font-semibold">DNS Configuration Required</p>
            <p>After adding, you'll need to add a CNAME record pointing to your R2 bucket</p>
          </div>
        </div>

        <div class="modal-action">
          <button type="button" class="btn" onclick={() => customDomainDialog.close()}>Cancel</button>
          <button type="submit" class="btn btn-primary" disabled={addBucketCustomDomain.pending > 0}>
            {#if addBucketCustomDomain.pending > 0}
              <span class="loading loading-spinner loading-sm"></span>
              Adding...
            {:else}
              Add Domain
            {/if}
          </button>
        </div>
      </form>
    {/if}
  </div>
  <form method="dialog" class="modal-backdrop">
    <button>close</button>
  </form>
</dialog>
