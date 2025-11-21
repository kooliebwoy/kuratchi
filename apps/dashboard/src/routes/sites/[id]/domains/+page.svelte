<script lang="ts">
  import { page } from '$app/stores';
  import { getEmailDomains } from '$lib/functions/emailDomains.remote';
  import { 
    getSiteCustomDomains, 
    deleteSiteCustomDomain,
    linkDomainToSite
  } from '$lib/functions/siteCustomDomains.remote';
  import { Globe, Link, Unlink, AlertCircle, ExternalLink, Plus, Loader2, X } from 'lucide-svelte';
  import { Button, Card, Dialog, Badge, Loading } from '@kuratchi/ui';

  const siteId = $page.params.id;
  
  const allDomainsResource = getEmailDomains();
  const attachedDomainsResource = getSiteCustomDomains();
  
  const allDomains = $derived(Array.isArray(allDomainsResource.current) ? allDomainsResource.current : []);
  const attachedDomains = $derived(Array.isArray(attachedDomainsResource.current) ? attachedDomainsResource.current : []);
  
  $effect(() => {
    if (siteId) {
      attachedDomainsResource.refresh();
    }
  });

  let showAttachModal = $state(false);
  let selectedDomainToAttach = $state<any>(null);
  let isAttaching = $state(false);

  const availableDomains = $derived(
    allDomains.filter(d => {
      const isAttached = attachedDomains.some(ad => ad.domain === d.name || ad.domainId === d.id);
      if (isAttached) return false;
      const parts = d.name.split('.');
      return parts.length > 2;
    })
  );

  async function handleAttachDomain(domain: any) {
    if (isAttaching) return;
    isAttaching = true;
    try {
      const result = await linkDomainToSite({ 
        domainId: domain.id, 
        siteId 
      });
      if (result.success) {
        showAttachModal = false;
        selectedDomainToAttach = null;
        attachedDomainsResource.refresh();
        allDomainsResource.refresh();
      } else {
        alert(result.error || 'Failed to attach domain');
      }
    } catch (err) {
      alert('Failed to attach domain');
    } finally {
      isAttaching = false;
    }
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
      alert('Failed to detach domain');
    }
  }
</script>

<svelte:head>
  <title>Domains - Site Settings</title>
</svelte:head>

<div class="kui-site-domains">
  <header class="kui-site-domains__header">
    <div>
      <p class="kui-eyebrow">Sites</p>
      <h1>Site Domains</h1>
      <p class="kui-subtext">Attach domains to this site for custom URLs</p>
    </div>
    <div class="kui-inline end">
      <Button variant="ghost" size="sm" href="/domains">
        <ExternalLink class="kui-icon" /> Manage Domains
      </Button>
      {#if availableDomains.length > 0}
        <Button variant="primary" size="sm" onclick={() => showAttachModal = true}>
          <Link class="kui-icon" /> Attach Domain
        </Button>
      {/if}
    </div>
  </header>

  {#if allDomains.length === 0}
    <Card class="kui-panel center">
      <AlertCircle class="kui-empty__icon" />
      <p class="kui-strong">No domains available</p>
      <p class="kui-subtext">Add a domain in the Domains page before attaching.</p>
    </Card>
  {:else}
    <Card class="kui-panel">
      <div class="kui-list">
        {#if attachedDomainsResource.loading}
          <div class="kui-center"><Loading /></div>
        {:else if attachedDomains.length === 0}
          <div class="kui-center">
            <Globe class="kui-empty__icon" />
            <p class="kui-subtext">No domains attached to this site yet.</p>
          </div>
        {:else}
          {#each attachedDomains as domain}
            <Card class="kui-panel">
              <div class="kui-domain">
                <div>
                  <h3>{domain.domain}</h3>
                  <p class="kui-subtext">{domain.status || 'Unknown status'}</p>
                </div>
                <div class="kui-inline end">
                  <Badge variant="ghost" size="xs">{domain.type || 'Custom'}</Badge>
                  <Button variant="ghost" size="sm" onclick={() => handleDetachDomain(domain)}>
                    <Unlink class="kui-icon error" /> Detach
                  </Button>
                </div>
              </div>
            </Card>
          {/each}
        {/if}
      </div>
    </Card>
  {/if}
</div>

{#if showAttachModal}
  <Dialog bind:open={showAttachModal} size="md" onClose={() => { showAttachModal = false; selectedDomainToAttach = null; }}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3>Attach Domain</h3>
        <Button variant="ghost" size="xs" onclick={() => { showAttachModal = false; selectedDomainToAttach = null; }}>
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="kui-stack">
        {#if availableDomains.length === 0}
          <p class="kui-subtext">No available subdomains to attach.</p>
        {:else}
          <div class="kui-list">
            {#each availableDomains as domain}
              <Card class="kui-panel">
                <div class="kui-domain">
                  <div>
                    <h4>{domain.name}</h4>
                    <p class="kui-subtext">Verified: {domain.emailVerified ? 'Yes' : 'No'}</p>
                  </div>
                  <Button variant="primary" size="sm" onclick={() => handleAttachDomain(domain)} disabled={isAttaching && selectedDomainToAttach?.id === domain.id}>
                    {#if isAttaching && selectedDomainToAttach?.id === domain.id}
                      <Loader2 class="kui-icon spinning" /> Attaching...
                    {:else}
                      Attach
                    {/if}
                  </Button>
                </div>
              </Card>
            {/each}
          </div>
        {/if}
      </div>
    {/snippet}
  </Dialog>
{/if}

<style>
  .kui-site-domains {
    display: grid;
    gap: var(--kui-spacing-md);
  }

  .kui-site-domains__header {
    display: flex;
    justify-content: space-between;
    gap: var(--kui-spacing-md);
    flex-wrap: wrap;
    align-items: center;
  }

  h1 {
    margin: 0.1rem 0 0.2rem;
    font-size: 1.6rem;
  }

  .kui-eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--kui-color-muted);
    font-weight: 700;
    margin: 0;
    font-size: 0.8rem;
  }

  .kui-subtext {
    color: var(--kui-color-muted);
    margin: 0;
  }

  .kui-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .kui-inline.end {
    justify-content: flex-end;
  }

  .kui-icon {
    width: 1rem;
    height: 1rem;
  }

  .kui-icon.spinning {
    animation: spin 1s linear infinite;
  }

  .kui-panel .kui-card__body {
    gap: var(--kui-spacing-md);
  }

  .kui-list {
    display: grid;
    gap: var(--kui-spacing-sm);
  }

  .kui-domain {
    display: flex;
    justify-content: space-between;
    gap: var(--kui-spacing-md);
    align-items: center;
  }

  .kui-empty__icon {
    width: 3rem;
    height: 3rem;
    color: var(--kui-color-muted);
  }

  .kui-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--kui-spacing-sm);
  }

  .kui-stack {
    display: grid;
    gap: var(--kui-spacing-sm);
  }

  .center {
    text-align: center;
    padding: var(--kui-spacing-md);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
