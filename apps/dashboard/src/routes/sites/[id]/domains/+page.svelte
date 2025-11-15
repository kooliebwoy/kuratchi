<script lang="ts">
  import { page } from '$app/stores';
  import { 
    getSiteCustomDomains, 
    addSiteCustomDomain, 
    verifySiteCustomDomain, 
    deleteSiteCustomDomain 
  } from '$lib/functions/siteCustomDomains.remote';
  import { Globe, Plus, CheckCircle, XCircle, AlertCircle, Copy, Trash2, RefreshCw } from 'lucide-svelte';

  const siteId = $page.params.id;
  
  // Load domains
  const domains = getSiteCustomDomains();
  $effect(() => {
    if (siteId) {
      domains.refetch({ siteId });
    }
  });

  // Modal state
  let showAddModal = $state(false);
  let showDeleteModal = $state(false);
  let selectedDomain = $state<any>(null);
  let newDomain = $state('');
  let isSubmitting = $state(false);

  async function handleAddDomain() {
    if (!newDomain || isSubmitting) return;
    
    isSubmitting = true;
    try {
      const result = await addSiteCustomDomain({ siteId, domain: newDomain });
      
      if (result.success) {
        showAddModal = false;
        newDomain = '';
        domains.refetch({ siteId });
      } else {
        alert(result.error || 'Failed to add domain');
      }
    } catch (err) {
      console.error('Error adding domain:', err);
      alert('Failed to add domain');
    } finally {
      isSubmitting = false;
    }
  }

  async function handleVerifyDomain(domainId: string) {
    try {
      const result = await verifySiteCustomDomain({ domainId });
      
      if (result.success) {
        domains.refetch({ siteId });
      } else {
        alert(result.error || 'Verification failed');
      }
    } catch (err) {
      console.error('Error verifying domain:', err);
      alert('Verification failed');
    }
  }

  async function handleDeleteDomain() {
    if (!selectedDomain) return;
    
    try {
      const result = await deleteSiteCustomDomain({ domainId: selectedDomain.id });
      
      if (result.success) {
        showDeleteModal = false;
        selectedDomain = null;
        domains.refetch({ siteId });
      } else {
        alert(result.error || 'Failed to delete domain');
      }
    } catch (err) {
      console.error('Error deleting domain:', err);
      alert('Failed to delete domain');
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  function openDeleteModal(domain: any) {
    selectedDomain = domain;
    showDeleteModal = true;
  }
</script>

<svelte:head>
  <title>Custom Domains - Site Settings</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-2xl font-bold">Custom Domains</h2>
      <p class="text-sm text-base-content/70 mt-1">
        Connect your own domain to this site using CNAME records
      </p>
    </div>
    <button class="btn btn-primary btn-sm" onclick={() => showAddModal = true}>
      <Plus class="h-4 w-4" />
      Add Domain
    </button>
  </div>

  <!-- Domains List -->
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body">
      {#if domains.loading}
        <div class="flex justify-center py-12">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      {:else if domains.error}
        <div class="alert alert-error">
          <AlertCircle class="h-5 w-5" />
          <span>Error loading domains. Please try again.</span>
        </div>
      {:else if domains.current && domains.current.length > 0}
        <div class="space-y-4">
          {#each domains.current as domain}
            <div class="border border-base-300 rounded-lg p-4">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <Globe class="h-5 w-5 text-base-content/60" />
                    <h3 class="font-semibold text-lg">{domain.domain}</h3>
                    {#if domain.verified}
                      <span class="badge badge-success badge-sm gap-1">
                        <CheckCircle class="h-3 w-3" />
                        Verified
                      </span>
                    {:else}
                      <span class="badge badge-warning badge-sm gap-1">
                        <AlertCircle class="h-3 w-3" />
                        Pending
                      </span>
                    {/if}
                  </div>

                  {#if !domain.verified}
                    <div class="mt-4 space-y-3">
                      <div class="alert alert-info">
                        <AlertCircle class="h-5 w-5" />
                        <div class="text-sm">
                          <p class="font-semibold mb-1">Setup Instructions:</p>
                          <p>Add the following CNAME record to your DNS provider:</p>
                        </div>
                      </div>

                      <div class="bg-base-200 p-3 rounded">
                        <div class="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <p class="text-base-content/60 text-xs mb-1">Type</p>
                            <code class="font-mono">CNAME</code>
                          </div>
                          <div>
                            <p class="text-base-content/60 text-xs mb-1">Name</p>
                            <div class="flex items-center gap-2">
                              <code class="font-mono">{domain.domain.includes('.') ? domain.domain.split('.')[0] : '@'}</code>
                              <button 
                                class="btn btn-ghost btn-xs btn-square"
                                onclick={() => copyToClipboard(domain.domain.includes('.') ? domain.domain.split('.')[0] : '@')}
                                title="Copy"
                              >
                                <Copy class="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          <div>
                            <p class="text-base-content/60 text-xs mb-1">Value</p>
                            <div class="flex items-center gap-2">
                              <code class="font-mono text-xs">{domain.cnameTarget}</code>
                              <button 
                                class="btn btn-ghost btn-xs btn-square"
                                onclick={() => copyToClipboard(domain.cnameTarget)}
                                title="Copy"
                              >
                                <Copy class="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <button 
                        class="btn btn-sm btn-outline"
                        onclick={() => handleVerifyDomain(domain.id)}
                      >
                        <RefreshCw class="h-4 w-4" />
                        Verify DNS
                      </button>
                    </div>
                  {:else}
                    <div class="mt-2 text-sm text-base-content/70">
                      <p>✓ SSL: {domain.sslStatus || 'Active'}</p>
                      <p>✓ Status: {domain.cloudflareStatus || 'Active'}</p>
                    </div>
                  {/if}
                </div>

                <button
                  class="btn btn-ghost btn-sm btn-square text-error"
                  onclick={() => openDeleteModal(domain)}
                  title="Delete domain"
                >
                  <Trash2 class="h-4 w-4" />
                </button>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="text-center py-12">
          <Globe class="h-12 w-12 text-base-content/30 mx-auto mb-3" />
          <p class="text-base-content/70 mb-4">No custom domains configured</p>
          <button class="btn btn-primary btn-sm" onclick={() => showAddModal = true}>
            <Plus class="h-4 w-4" />
            Add Your First Domain
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Add Domain Modal -->
{#if showAddModal}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">Add Custom Domain</h3>
      
      <div class="space-y-4">
        <div class="form-control">
          <label class="label" for="domain">
            <span class="label-text">Domain Name</span>
          </label>
          <input
            id="domain"
            type="text"
            placeholder="www.example.com or example.com"
            class="input input-bordered"
            bind:value={newDomain}
          />
          <label class="label">
            <span class="label-text-alt">Enter your domain without http:// or https://</span>
          </label>
        </div>

        <div class="alert alert-info">
          <AlertCircle class="h-5 w-5" />
          <span class="text-sm">
            After adding, you'll need to configure a CNAME record with your DNS provider.
          </span>
        </div>
      </div>

      <div class="modal-action">
        <button 
          class="btn" 
          onclick={() => { showAddModal = false; newDomain = ''; }}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button 
          class="btn btn-primary" 
          onclick={handleAddDomain}
          disabled={!newDomain || isSubmitting}
        >
          {isSubmitting ? 'Adding...' : 'Add Domain'}
        </button>
      </div>
    </div>
    <button 
      type="button" 
      class="modal-backdrop" 
      onclick={() => { showAddModal = false; newDomain = ''; }}
      aria-label="Close modal"
    ></button>
  </div>
{/if}

<!-- Delete Modal -->
{#if showDeleteModal && selectedDomain}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg text-error mb-4">Delete Domain</h3>
      
      <div class="space-y-4">
        <div class="alert alert-error">
          <AlertCircle class="h-5 w-5" />
          <span>This action cannot be undone!</span>
        </div>

        <p class="text-base-content/70">
          Are you sure you want to delete <strong>{selectedDomain.domain}</strong>?
        </p>
      </div>

      <div class="modal-action">
        <button 
          class="btn" 
          onclick={() => { showDeleteModal = false; selectedDomain = null; }}
        >
          Cancel
        </button>
        <button class="btn btn-error" onclick={handleDeleteDomain}>
          Delete Domain
        </button>
      </div>
    </div>
    <button 
      type="button" 
      class="modal-backdrop" 
      onclick={() => { showDeleteModal = false; selectedDomain = null; }}
      aria-label="Close modal"
    ></button>
  </div>
{/if}
