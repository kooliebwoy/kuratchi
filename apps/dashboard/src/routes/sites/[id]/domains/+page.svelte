<script lang="ts">
  import { page } from '$app/stores';
  import { getEmailDomains } from '$lib/functions/emailDomains.remote';
  import { 
    getSiteCustomDomains, 
    deleteSiteCustomDomain 
  } from '$lib/functions/siteCustomDomains.remote';
  import { Globe, Link, Unlink, AlertCircle, CheckCircle, ExternalLink, Plus } from 'lucide-svelte';

  const siteId = $page.params.id;
  
  // Load all available domains and attached domains
  const allDomainsResource = getEmailDomains();
  const attachedDomainsResource = getSiteCustomDomains();
  
  const allDomains = $derived(Array.isArray(allDomainsResource.current) ? allDomainsResource.current : []);
  const attachedDomains = $derived(Array.isArray(attachedDomainsResource.current) ? attachedDomainsResource.current : []);
  
  $effect(() => {
    if (siteId) {
      attachedDomainsResource.refresh();
    }
  });

  // State
  let showAttachModal = $state(false);
  let selectedDomainToAttach = $state<any>(null);
  let isAttaching = $state(false);

  // Get available domains (not already attached)
  const availableDomains = $derived(
    allDomains.filter(d => 
      !attachedDomains.some(ad => ad.domain === d.name || ad.domainId === d.id)
    )
  );

  async function handleAttachDomain(domain: any) {
    // This would call an attach API
    console.log('Attach domain:', domain);
    // TODO: Implement attach logic
    showAttachModal = false;
  }

  async function handleDetachDomain(attachedDomain: any) {
    if (!confirm(`Detach ${attachedDomain.domain} from this site?`)) return;
    
    try {
      const result = await deleteSiteCustomDomain({ domainId: attachedDomain.id });
      
      if (result.success) {
        attachedDomainsResource.refresh();
      } else {
        alert(result.error || 'Failed to detach domain');
      }
    } catch (err) {
      console.error('Error detaching domain:', err);
      alert('Failed to detach domain');
    }
  }
</script>

<svelte:head>
  <title>Domains - Site Settings</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-2xl font-bold">Site Domains</h2>
      <p class="text-sm text-base-content/70 mt-1">
        Attach domains to this site for custom URLs
      </p>
    </div>
    <div class="flex gap-2">
      <a href="/domains" class="btn btn-ghost btn-sm gap-2">
        <ExternalLink class="h-4 w-4" />
        Manage Domains
      </a>
      {#if availableDomains.length > 0}
        <button class="btn btn-primary btn-sm gap-2" onclick={() => showAttachModal = true}>
          <Link class="h-4 w-4" />
          Attach Domain
        </button>
      {/if}
    </div>
  </div>

  <!-- Info Alert -->
  {#if allDomains.length === 0}
    <div class="alert alert-info">
      <AlertCircle class="h-5 w-5" />
      <div class="flex-1">
        <p class="font-semibold">No domains available</p>
        <p class="text-sm">Add and verify domains in the Domains page first, then attach them to this site.</p>
      </div>
      <a href="/domains" class="btn btn-sm btn-primary">
        <Plus class="h-4 w-4" />
        Add Domain
      </a>
    </div>
  {/if}

  <!-- Attached Domains -->
  <div class="card bg-base-100 shadow-sm border border-base-200">
    <div class="card-body">
      <h3 class="card-title text-lg mb-4">Attached Domains</h3>
      
      {#if attachedDomainsResource.loading}
        <div class="flex justify-center py-12">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
      {:else if attachedDomains.length > 0}
        <div class="space-y-3">
          {#each attachedDomains as domain}
            <div class="flex items-center justify-between p-4 bg-base-200/50 rounded-lg border border-base-300">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Globe class="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div class="font-semibold">{domain.domain}</div>
                  <div class="text-xs text-base-content/60">
                    {#if domain.verified}
                      <span class="flex items-center gap-1 text-success">
                        <CheckCircle class="h-3 w-3" />
                        Verified & Active
                      </span>
                    {:else}
                      <span class="flex items-center gap-1 text-warning">
                        <AlertCircle class="h-3 w-3" />
                        Pending DNS configuration
                      </span>
                    {/if}
                  </div>
                </div>
              </div>
              
              <button 
                class="btn btn-ghost btn-sm text-error gap-2"
                onclick={() => handleDetachDomain(domain)}
              >
                <Unlink class="h-4 w-4" />
                Detach
              </button>
            </div>
          {/each}
        </div>
      {:else}
        <div class="text-center py-12">
          <div class="w-16 h-16 rounded-2xl bg-base-200 flex items-center justify-center mx-auto mb-4">
            <Globe class="h-8 w-8 text-base-content/40" />
          </div>
          <p class="font-semibold mb-2">No domains attached</p>
          <p class="text-sm text-base-content/60 mb-4">
            Attach a domain from your domains list to use custom URLs for this site.
          </p>
          {#if availableDomains.length > 0}
            <button class="btn btn-primary btn-sm" onclick={() => showAttachModal = true}>
              <Link class="h-4 w-4" />
              Attach Domain
            </button>
          {:else}
            <a href="/domains" class="btn btn-primary btn-sm">
              <Plus class="h-4 w-4" />
              Add Domain First
            </a>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- Available Domains (for reference) -->
  {#if availableDomains.length > 0 && !showAttachModal}
    <div class="card bg-base-100 shadow-sm border border-base-200">
      <div class="card-body">
        <div class="flex items-center justify-between mb-4">
          <h3 class="card-title text-lg">Available Domains</h3>
          <span class="badge badge-ghost">{availableDomains.length} available</span>
        </div>
        
        <div class="grid md:grid-cols-2 gap-3">
          {#each availableDomains.slice(0, 4) as domain}
            <div class="flex items-center justify-between p-3 bg-base-200/30 rounded-lg border border-base-200">
              <div class="flex items-center gap-2">
                <Globe class="h-4 w-4 text-base-content/60" />
                <span class="text-sm font-medium">{domain.name}</span>
                {#if domain.emailVerified}
                  <CheckCircle class="h-3 w-3 text-success" />
                {/if}
              </div>
              <button 
                class="btn btn-ghost btn-xs"
                onclick={() => { selectedDomainToAttach = domain; showAttachModal = true; }}
              >
                Attach
              </button>
            </div>
          {/each}
        </div>
        
        {#if availableDomains.length > 4}
          <button class="btn btn-ghost btn-sm mt-2" onclick={() => showAttachModal = true}>
            View all {availableDomains.length} domains
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<!-- Attach Domain Modal -->
{#if showAttachModal}
  <div class="modal modal-open">
    <div class="modal-box max-w-2xl">
      <h3 class="font-bold text-xl mb-4">Attach Domain to Site</h3>
      
      {#if availableDomains.length > 0}
        <div class="space-y-3 max-h-96 overflow-y-auto">
          {#each availableDomains as domain}
            <button 
              class="w-full flex items-center justify-between p-4 bg-base-200/50 hover:bg-base-200 rounded-lg border border-base-300 hover:border-primary transition-all text-left"
              onclick={() => handleAttachDomain(domain)}
            >
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Globe class="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div class="font-semibold">{domain.name}</div>
                  <div class="text-xs text-base-content/60 flex items-center gap-2">
                    {#if domain.emailVerified}
                      <span class="flex items-center gap-1 text-success">
                        <CheckCircle class="h-3 w-3" />
                        Verified
                      </span>
                    {/if}
                    {#if domain.emailEnabled}
                      <span class="badge badge-xs badge-primary">Email</span>
                    {/if}
                  </div>
                </div>
              </div>
              <Link class="h-5 w-5 text-base-content/40" />
            </button>
          {/each}
        </div>
      {:else}
        <div class="text-center py-8">
          <p class="text-base-content/70 mb-4">No available domains to attach.</p>
          <a href="/domains" class="btn btn-primary btn-sm">
            <Plus class="h-4 w-4" />
            Add New Domain
          </a>
        </div>
      {/if}

      <div class="modal-action">
        <button class="btn" onclick={() => { showAttachModal = false; selectedDomainToAttach = null; }}>
          Close
        </button>
      </div>
    </div>
    <button 
      type="button" 
      class="modal-backdrop" 
      onclick={() => { showAttachModal = false; selectedDomainToAttach = null; }}
      aria-label="Close modal"
    ></button>
  </div>
{/if}
