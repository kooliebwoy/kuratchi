<script lang="ts">
  import { Alert, Badge, Button, Dialog, Loading, TableSimple, Toast } from '@kuratchi/ui';
  import { 
    getEmailDomains, 
    addEmailDomain, 
    verifyEmailDomain, 
    deleteEmailDomain 
  } from '$lib/functions/emailDomains.remote';
  import { getSites } from '$lib/functions/sites.remote';
  import { linkDomainToSite } from '$lib/functions/siteCustomDomains.remote';
  import { Mail, Plus, CheckCircle, AlertCircle, Copy, Trash2, RefreshCw, ExternalLink, Check, X, Globe, Sparkles, Database, Link, Loader2 } from 'lucide-svelte';

  // Load domains and sites
  const domains = getEmailDomains();
  const sites = getSites();

  // Modal state
  let showAddModal = $state(false);
  let showDeleteModal = $state(false);
  let showLinkSiteModal = $state(false);
  let selectedDomain = $state<any>(null);
  let selectedDomainForLinking = $state<any>(null);
  let newDomain = $state('');
  let domainPurpose = $state<'email' | 'site' | 'both'>('email');
  let isSubmitting = $state(false);
  let isLinking = $state(false);
  let copiedRecordId = $state<string | null>(null);
  let toastMessage = $state<string | null>(null);
  let currentStep = $state(0); // For add domain wizard: 0 = input, 1 = DNS setup

  const sitesList = $derived(Array.isArray(sites.current) ? sites.current : []);

  async function handleAddDomain() {
    if (!newDomain || isSubmitting) return;
    
    isSubmitting = true;
    try {
      const result = await addEmailDomain({ name: newDomain });
      
      if (result.success) {
        setToast('Domain added! Now configure DNS records.');
        currentStep = 1; // Move to DNS setup step
        domains.refresh();
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
      const result = await verifyEmailDomain({ domainId });
      
      if (result.success) {
        setToast('Domain verified! You can now send emails from this domain.');
        domains.refresh();
      } else {
        alert(result.error || 'Verification failed. Make sure DNS records are correctly configured and have propagated (can take up to 48 hours).');
      }
    } catch (err) {
      console.error('Error verifying domain:', err);
      alert('Verification failed');
    }
  }

  async function handleDeleteDomain() {
    if (!selectedDomain) return;
    
    try {
      const result = await deleteEmailDomain({ domainId: selectedDomain.id });
      
      if (result.success) {
        showDeleteModal = false;
        selectedDomain = null;
        setToast('Domain deleted successfully');
        domains.refresh();
      } else {
        alert(result.error || 'Failed to delete domain');
      }
    } catch (err) {
      console.error('Error deleting domain:', err);
      alert('Failed to delete domain');
    }
  }

  function copyToClipboard(text: string, recordId?: string) {
    navigator.clipboard.writeText(text);
    if (recordId) {
      copiedRecordId = recordId;
      setTimeout(() => {
        copiedRecordId = null;
      }, 2000);
    }
    setToast('Copied to clipboard!');
  }

  function openDeleteModal(domain: any) {
    selectedDomain = domain;
    showDeleteModal = true;
  }

  async function handleLinkDomainToSite(siteId: string) {
    if (!selectedDomainForLinking || isLinking) return;
    
    // Validate it's a subdomain before attempting
    const parts = selectedDomainForLinking.name.split('.');
    if (parts.length === 2) {
      alert('Apex domains cannot be linked. Please use a subdomain like www.' + selectedDomainForLinking.name);
      return;
    }
    
    isLinking = true;
    try {
      const result = await linkDomainToSite({ 
        domainId: selectedDomainForLinking.id, 
        siteId 
      });
      
      if (result.success) {
        showLinkSiteModal = false;
        selectedDomainForLinking = null;
        setToast('Domain linked to site! Configure DNS to activate.');
        domains.refresh();
      } else {
        alert(result.error || 'Failed to link domain to site');
      }
    } catch (err) {
      console.error('Error linking domain:', err);
      alert('Failed to link domain to site');
    } finally {
      isLinking = false;
    }
  }

  function parseDnsRecords(recordsJson: any) {
    // Handle if already parsed (database auto-parses JSON fields)
    if (Array.isArray(recordsJson)) {
      return recordsJson;
    }
    // Handle if it's a JSON string
    if (typeof recordsJson === 'string') {
      try {
        return JSON.parse(recordsJson);
      } catch {
        return [];
      }
    }
    return [];
  }

  function setToast(message: string) {
    toastMessage = message;
    setTimeout(() => {
      toastMessage = null;
    }, 3000);
  }

  function resetModal() {
    showAddModal = false;
    newDomain = '';
    domainPurpose = 'email';
    currentStep = 0;
  }
</script>

<svelte:head>
  <title>Domains - Kuratchi Dashboard</title>
</svelte:head>

<!-- Toast Notification -->
  {#if toastMessage}
    <Toast toasts={[{ id: 'domains-toast', type: 'success', message: toastMessage }]} />
  {/if}

<div class="p-8 max-w-6xl mx-auto">
  <!-- Header -->
  <div class="mb-8">
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-linear-to-br from-primary to-secondary flex items-center justify-center">
          <Globe class="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 class="text-3xl font-bold">Domains</h1>
          <p class="text-sm text-base-content/70 mt-1">
            Manage domains for email and sites
          </p>
        </div>
      </div>
      {#if domains.current && domains.current.length > 0}
        <Button variant="primary" onclick={() => showAddModal = true}>
          <Plus class="h-4 w-4" />
          Add Domain
        </Button>
      {/if}
    </div>
  </div>

  <!-- Domains List -->
  {#if domains.loading}
    <div class="card bg-base-100 shadow-sm border border-base-200">
      <div class="card-body">
        <div class="flex justify-center py-12">
          <Loading variant="primary" type="spinner" size="lg" />
        </div>
      </div>
    </div>
  {:else if domains.error}
    <Alert type="error">
      <div class="flex items-center gap-2">
        <AlertCircle class="h-5 w-5" />
        <span>Error loading domains. Please refresh the page.</span>
      </div>
    </Alert>
  {:else if !domains.current || domains.current.length === 0}
    <!-- Beautiful Empty State -->
    <div class="grid gap-6">
      <!-- Main CTA Card -->
      <div class="card bg-linear-to-br from-primary/5 via-secondary/5 to-accent/5 border-2 border-dashed border-primary/20 shadow-lg">
        <div class="card-body items-center text-center py-16">
          <div class="w-20 h-20 rounded-2xl bg-linear-to-br from-primary to-secondary flex items-center justify-center mb-6 shadow-lg">
            <Sparkles class="h-10 w-10 text-white" />
          </div>
          <h2 class="card-title text-2xl mb-2">Add Your First Domain</h2>
          <p class="text-base-content/70 max-w-md mb-6">
            Manage all your domains in one place. Use them for email sending or site hosting.
          </p>
          <Button variant="primary" class="gap-2" size="lg" onclick={() => showAddModal = true}>
            <Plus class="h-5 w-5" />
            Add Domain
          </Button>
        </div>
      </div>

      <!-- Use Cases -->
      <div class="grid md:grid-cols-2 gap-4">
        <div class="card bg-base-100 shadow-sm border border-base-200">
          <div class="card-body">
            <div class="flex items-center gap-3 mb-3">
              <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Mail class="h-5 w-5 text-primary" />
              </div>
              <h3 class="card-title text-lg">Email Sending</h3>
            </div>
            <p class="text-sm text-base-content/70">
              Send professional emails from your own domain using AWS SES. Perfect for newsletters, notifications, and drip campaigns.
            </p>
          </div>
        </div>

        <div class="card bg-base-100 shadow-sm border border-base-200">
          <div class="card-body">
            <div class="flex items-center gap-3 mb-3">
              <div class="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                <Database class="h-5 w-5 text-secondary" />
              </div>
              <h3 class="card-title text-lg">Site Hosting</h3>
            </div>
            <p class="text-sm text-base-content/70">
              Connect your domain to your Kuratchi sites for custom branded URLs and professional web presence.
            </p>
          </div>
        </div>
      </div>
    </div>
  {:else}
    <!-- Domains Table -->
    <div class="card bg-base-100 shadow-sm border border-base-200">
      <div class="card-body">
        <TableSimple>
          {#snippet head()}
            <tr>
              <th>Domain</th>
              <th>Used For</th>
              <th>Email Status</th>
              <th>Site Attached</th>
              <th class="text-right">Actions</th>
            </tr>
          {/snippet}
          {#snippet body()}
            {#each domains.current as domain}
              {@const dnsRecords = parseDnsRecords(domain.emailDnsRecords || '[]')}
              <tr>
                  <td>
                    <div class="flex items-center gap-2">
                      <Globe class="h-5 w-5 text-primary" />
                      <div>
                        <div class="font-semibold">{domain.name}</div>
                        <div class="text-xs text-base-content/50">
                          Added {new Date(domain.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                  <div class="flex gap-1">
                    {#if domain.emailEnabled}
                      <Badge variant="primary" size="sm" class="gap-1">
                        <Mail class="h-3 w-3" />
                        Email
                      </Badge>
                    {/if}
                    {#if domain.siteId}
                      <Badge variant="secondary" size="sm" class="gap-1">
                        <Database class="h-3 w-3" />
                        Site
                      </Badge>
                    {/if}
                    {#if !domain.emailEnabled && !domain.siteId}
                      <Badge variant="ghost" size="sm">Not configured</Badge>
                    {/if}
                  </div>
                  </td>
                  <td>
                    {#if domain.emailEnabled}
                      {#if domain.emailVerified}
                        <Badge variant="success" class="gap-1">
                          <CheckCircle class="h-3 w-3" />
                          Verified
                        </Badge>
                      {:else}
                        <Badge variant="warning" class="gap-1">
                          <AlertCircle class="h-3 w-3" />
                          Pending
                        </Badge>
                      {/if}
                    {:else}
                      <span class="text-base-content/40 text-sm">—</span>
                    {/if}
                  </td>
                  <td>
                    {#if domain.siteId}
                      <span class="text-sm">Site #{domain.siteId.slice(0, 8)}...</span>
                    {:else}
                      <span class="text-base-content/40 text-sm">None</span>
                    {/if}
                  </td>
                  <td class="text-right">
                  <div class="flex gap-1 justify-end">
                    {#if !domain.siteId}
                      <Button
                        variant="ghost"
                        size="sm"
                        class="gap-1"
                        onclick={() => { selectedDomainForLinking = domain; showLinkSiteModal = true; }}
                        title="Link domain to a site"
                      >
                        <Database class="h-4 w-4" />
                        Link to Site
                      </Button>
                    {/if}
                    {#if domain.emailEnabled && !domain.emailVerified}
                      <Button
                        variant="ghost"
                        size="sm"
                        class="gap-1"
                        onclick={() => handleVerifyDomain(domain.id)}
                        title="Verify email DNS"
                      >
                        <RefreshCw class="h-4 w-4" />
                        Verify
                      </Button>
                    {/if}
                    <Button
                      variant="ghost"
                      size="sm"
                      class="text-error"
                      onclick={() => openDeleteModal(domain)}
                      title="Delete domain"
                    >
                      <Trash2 class="h-4 w-4" />
                    </Button>
                  </div>
                  </td>
              </tr>
              {#if domain.emailEnabled && !domain.emailVerified && dnsRecords.length > 0}
                <tr>
                  <td colspan="5" class="bg-base-200/30">
                      <div class="p-4 space-y-4">
                        <div class="flex items-start gap-3">
                          <AlertCircle class="h-5 w-5 text-info shrink-0 mt-0.5" />
                          <div>
                            <p class="font-semibold text-sm mb-1">DNS Configuration Required</p>
                            <p class="text-xs text-base-content/70">
                              Add these CNAME records to your DNS provider (e.g., Cloudflare, GoDaddy, Namecheap). 
                              After adding, click "Verify" to check the configuration.
                            </p>
                          </div>
                        </div>
                        
                        <div class="grid gap-3">
                          {#each dnsRecords as record, idx}
                            {@const recordId = `${domain.id}-${idx}`}
                            {@const nameId = `${recordId}-name`}
                            <div class="bg-base-100 rounded-lg p-4 border border-base-300">
                              <div class="space-y-3">
                                <!-- Record Type & Description -->
                                <div class="flex items-center gap-2">
                                  <Badge variant="primary" size="xs">{record.type}</Badge>
                                  {#if record.type === 'TXT'}
                                    <Badge variant="ghost" size="xs">DMARC Policy</Badge>
                                  {:else}
                                    <Badge variant="ghost" size="xs">DKIM Authentication</Badge>
                                  {/if}
                                </div>
                                
                                <!-- Name Field -->
                                <div>
                                  <div class="flex items-center justify-between mb-1">
                                    <label class="text-xs font-semibold text-base-content/70">Name / Host</label>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      class={`dns-copy ${copiedRecordId === nameId ? 'dns-copy--success' : ''}`}
                                      onclick={() => copyToClipboard(record.name, nameId)}
                                      title="Copy name"
                                    >
                                      {#if copiedRecordId === nameId}
                                        <Check class="h-3 w-3" />
                                        Copied
                                      {:else}
                                        <Copy class="h-3 w-3" />
                                        Copy
                                      {/if}
                                    </Button>
                                  </div>
                                  <code class="block text-xs font-mono bg-base-200 p-2 rounded break-all">
                                    {record.name}
                                  </code>
                                </div>
                                
                                <!-- Value Field -->
                                <div>
                                  <div class="flex items-center justify-between mb-1">
                                    <label class="text-xs font-semibold text-base-content/70">Value / Points To</label>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      class={`dns-copy ${copiedRecordId === recordId ? 'dns-copy--success' : ''}`}
                                      onclick={() => copyToClipboard(record.value, recordId)}
                                      title="Copy value"
                                    >
                                      {#if copiedRecordId === recordId}
                                        <Check class="h-3 w-3" />
                                        Copied
                                      {:else}
                                        <Copy class="h-3 w-3" />
                                        Copy
                                      {/if}
                                    </Button>
                                  </div>
                                  <code class="block text-xs font-mono bg-base-200 p-2 rounded break-all">
                                    {record.value}
                                  </code>
                                </div>
                              </div>
                            </div>
                          {/each}
                        </div>
                        
                        <div class="alert alert-info">
                          <AlertCircle class="h-4 w-4" />
                          <div class="text-xs">
                            <p class="font-semibold">Next Steps:</p>
                            <ol class="list-decimal list-inside mt-1 space-y-0.5">
                              <li>Log in to your DNS provider (where you manage {domain.name})</li>
                              <li>Add each CNAME record above to your DNS settings</li>
                              <li>Wait 5-10 minutes for DNS propagation (can take up to 48 hours)</li>
                              <li>Click the "Verify" button to confirm your domain</li>
                            </ol>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                {/if}
              {/each}
            {/snippet}
        </TableSimple>
      </div>
    </div>
  {/if}
</div>

<Dialog bind:open={showAddModal} size="lg" onClose={resetModal}>
  {#snippet header()}
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
        <Plus class="h-5 w-5 text-primary" />
      </div>
      <div>
        <h3 class="kui-card__title">Add Domain</h3>
        <p class="kui-helper-text">Connect a domain for email sending or site hosting.</p>
      </div>
    </div>
  {/snippet}

  <div class="kui-stack">
    {#if currentStep === 0}
      <label class="kui-form-control" for="domain">
        <span class="kui-label">Domain Name</span>
        <input
          id="domain"
          type="text"
          placeholder="example.com"
          class="kui-input"
          bind:value={newDomain}
          onkeydown={(e) => e.key === 'Enter' && handleAddDomain()}
        />
        <span class="kui-helper-text">Enter your root domain (e.g., example.com) without http:// or www</span>
      </label>

      <div>
        <p class="kui-label">What will you use this domain for?</p>
        <div class="domain-purpose-grid">
          <Button
            type="button"
            variant={domainPurpose === 'email' ? 'primary' : 'ghost'}
            onclick={() => domainPurpose = 'email'}
          >
            <Mail class="h-4 w-4" />
            Email
          </Button>
          <Button
            type="button"
            variant={domainPurpose === 'site' ? 'primary' : 'ghost'}
            onclick={() => domainPurpose = 'site'}
          >
            <Database class="h-4 w-4" />
            Site
          </Button>
          <Button
            type="button"
            variant={domainPurpose === 'both' ? 'primary' : 'ghost'}
            onclick={() => domainPurpose = 'both'}
          >
            <Globe class="h-4 w-4" />
            Both
          </Button>
        </div>
      </div>

      <Alert type="info">
        <div class="text-sm">
          <p class="font-semibold mb-1">Next steps:</p>
          <ol class="list-decimal list-inside space-y-1 text-base-content/70">
            <li>We'll register your domain with AWS SES</li>
            <li>You'll get DNS records to add to your domain provider</li>
            <li>After adding DNS records, verify to start sending emails</li>
            <li>Each verified domain can send emails with your branding</li>
          </ol>
        </div>
      </Alert>
    {:else}
      <Alert type="success">
        <div>
          <p class="font-semibold">Domain added successfully!</p>
          <p class="text-sm">Configure DNS records in the table below.</p>
        </div>
      </Alert>

      <div class="dns-next-steps">
        <h4 class="font-semibold">Next Steps:</h4>
        <ol>
          <li>Find your domain in the table below</li>
          <li>Copy each DNS record shown</li>
          <li>Add them to your domain provider (Cloudflare, Namecheap, etc.)</li>
          <li>Click "Verify" once DNS records are added</li>
          <li>Start using your domain! 🚀</li>
        </ol>
      </div>
    {/if}
  </div>

  {#snippet actions(close)}
    <Button
      variant="ghost"
      type="button"
      onclick={() => {
        close();
        resetModal();
      }}
      disabled={isSubmitting}
    >
      {currentStep === 0 ? 'Cancel' : 'Close'}
    </Button>
    {#if currentStep === 0}
      <Button
        variant="primary"
        class="gap-2"
        onclick={handleAddDomain}
        disabled={!newDomain.trim() || isSubmitting}
      >
        {#if isSubmitting}
          <Loading size="sm" />
          Adding...
        {:else}
          <Plus class="h-4 w-4" />
          Add Domain
        {/if}
      </Button>
    {/if}
  {/snippet}
</Dialog>

<style>
  .dns-copy {
    gap: 0.25rem;
  }

  .dns-copy--success {
    background-color: rgba(34, 197, 94, 0.15);
    color: var(--kui-color-success, #16a34a);
  }

  .domain-purpose-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: 0.5rem;
  }

  .dns-next-steps {
    background: rgba(15, 23, 42, 0.05);
    border-radius: var(--kui-radius-lg);
    padding: var(--kui-spacing-md);
  }

  .dns-next-steps ol {
    margin: 0.5rem 0 0;
    padding-left: 1rem;
    color: var(--kui-color-muted);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
</style>

<Dialog bind:open={showDeleteModal} size="sm" onClose={() => { showDeleteModal = false; selectedDomain = null; }}>
  {#if selectedDomain}
    {#snippet header()}
      <div>
        <h3 class="kui-card__title text-error">Delete Domain</h3>
        <p class="kui-helper-text">This action cannot be undone.</p>
      </div>
    {/snippet}

    <Alert type="error">
      <div class="flex items-center gap-2">
        <AlertCircle class="h-5 w-5" />
        <span>Are you sure you want to delete <strong>{selectedDomain.name}</strong>?</span>
      </div>
    </Alert>

    <p class="text-sm text-base-content/60">
      This will remove the domain and you won't be able to send emails or use it for sites.
    </p>

    {#snippet actions(close)}
      <Button variant="ghost" type="button" onclick={() => { close(); selectedDomain = null; }}>
        Cancel
      </Button>
      <Button variant="error" type="button" onclick={handleDeleteDomain}>
        Delete Domain
      </Button>
    {/snippet}
  {/if}
</Dialog>

<!-- Link to Site Modal -->
{#if showLinkSiteModal && selectedDomainForLinking}
  <div class="modal modal-open">
    <div class="modal-box max-w-2xl">
      <h3 class="font-bold text-xl mb-2">Link Domain to Site</h3>
      <p class="text-sm text-base-content/60 mb-2">
        Select a site to link <strong>{selectedDomainForLinking.name}</strong> to. You'll need to configure DNS after linking.
      </p>
      <div class="alert alert-info mb-4">
        <AlertCircle class="h-5 w-5" />
        <div class="text-sm">
          <p class="font-semibold">Subdomain Required</p>
          <p>Only subdomains (like <code class="bg-base-300 px-1 rounded">www.example.com</code>) can be linked. Apex domains (<code class="bg-base-300 px-1 rounded">example.com</code>) are not supported on Cloudflare's standard plan.</p>
        </div>
      </div>
      
      {#if sites.loading}
        <div class="flex justify-center py-12">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
      {:else if sitesList.length > 0}
        <div class="space-y-3 max-h-96 overflow-y-auto">
          {#each sitesList as site}
            <button 
              class="w-full flex items-center justify-between p-4 bg-base-200/50 hover:bg-base-200 rounded-lg border border-base-300 hover:border-primary transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              onclick={() => handleLinkDomainToSite(site.id)}
              disabled={isLinking}
            >
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Globe class="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div class="font-semibold">{site.name || 'Untitled Site'}</div>
                  <div class="text-xs text-base-content/60 flex items-center gap-2">
                    {#if site.subdomain}
                      <span class="flex items-center gap-1">
                        <ExternalLink class="h-3 w-3" />
                        {site.subdomain}.kuratchi.site
                      </span>
                    {/if}
                    {#if site.status}
                      <span class="badge badge-xs badge-success">Active</span>
                    {:else}
                      <span class="badge badge-xs badge-ghost">Inactive</span>
                    {/if}
                  </div>
                </div>
              </div>
              {#if isLinking}
                <Loader2 class="h-5 w-5 text-primary animate-spin" />
              {:else}
                <Link class="h-5 w-5 text-base-content/40" />
              {/if}
            </button>
          {/each}
        </div>
      {:else}
            <div class="kui-empty">
              <div class="kui-icon-hero">
                <Globe />
              </div>
              <p class="kui-strong">No sites available</p>
              <p class="kui-subtext">Create a site first to link this domain.</p>
              <Button variant="primary" size="sm" href="/sites">
                <Plus class="h-4 w-4" />
                Create site
              </Button>
            </div>
      {/if}

      <div class="modal-action kui-modal-actions">
        <Button 
          variant="ghost"
          type="button" 
          onclick={() => { showLinkSiteModal = false; selectedDomainForLinking = null; }}
          disabled={isLinking}
        >
          Cancel
        </Button>
      </div>
    </div>
    <button 
      type="button" 
      class="modal-backdrop" 
      onclick={() => { showLinkSiteModal = false; selectedDomainForLinking = null; }}
      disabled={isLinking}
      aria-label="Close modal"
    ></button>
  </div>
{/if}
