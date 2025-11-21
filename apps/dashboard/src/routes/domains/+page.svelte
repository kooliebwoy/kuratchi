<script lang="ts">
  import { Alert, Badge, Button, Dialog, Loading, TableSimple, Toast } from '@kuratchi/ui';
  import { 
    getEmailDomains, 
    addEmailDomain, 
    verifyEmailDomain, 
    deleteEmailDomain 
  } from '$lib/functions/emailDomains.remote';
  import { getSites } from '$lib/functions/sites.remote';
  import { linkDomainToSite, getDomainLinkInstructions } from '$lib/functions/siteCustomDomains.remote';
  import { Mail, Plus, CheckCircle, AlertCircle, Copy, Trash2, RefreshCw, ExternalLink, Check, X, Globe, Sparkles, Database, Link, Loader2 } from 'lucide-svelte';

  // Load domains and sites
  const domains = getEmailDomains();
  const sites = getSites();

  // Modal state
  let showAddModal = $state(false);
  let showDeleteModal = $state(false);
  let showLinkSiteModal = $state(false);
  let showInstructionsModal = $state(false);
  let selectedDomain = $state<any>(null);
  let selectedDomainForLinking = $state<any>(null);
  let instructionsDomain = $state<any>(null);
  let newDomain = $state('');
  let domainPurpose = $state<'email' | 'site' | 'both'>('email');
  let isSubmitting = $state(false);
  let isLinking = $state(false);
  let copiedRecordId = $state<string | null>(null);
  let toastMessage = $state<string | null>(null);
  let currentStep = $state(0); // For add domain wizard: 0 = input, 1 = DNS setup
  let selectedSiteId = $state('');
  let siteLinkInstructions = $state<{
    verification?: {
      type: string;
      name: string;
      value: string;
      description?: string;
    };
    cname?: {
      name: string;
      target: string;
      description?: string;
    };
  } | null>(null);
  let lastSubmittedPurpose = $state<'email' | 'site' | 'both'>('email');
  let submittedSiteName = $state('');
  let submittedDomainName = $state('');
  let instructionsLoading = $state(false);
  let domainInstructions = $state<{
    verification?: { type: string; name: string; value: string; description?: string } | null;
    cname?: { name: string; target: string; description?: string } | null;
    status?: string;
  } | null>(null);

  const sitesList = $derived(Array.isArray(sites.current) ? sites.current : []);
  const requiresSiteSelection = $derived(domainPurpose !== 'email');
  const submittedIncludesSite = $derived(lastSubmittedPurpose !== 'email');
  const submittedIncludesEmail = $derived(lastSubmittedPurpose !== 'site');

  async function handleAddDomain() {
    if (!newDomain || isSubmitting) return;
    const cleanedDomain = newDomain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');

    const normalizedDomain = domainPurpose === 'email'
      ? cleanedDomain.replace(/^www\./, '')
      : cleanedDomain;

    if (requiresSiteSelection) {
      if (!selectedSiteId) {
        alert('Select a site to link this domain to.');
        return;
      }

      const parts = cleanedDomain.split('.').filter(Boolean);
      if (parts.length < 3) {
        alert('Please enter a subdomain like www.example.com when linking to a site.');
        return;
      }
    }

    isSubmitting = true;
    siteLinkInstructions = null;
    submittedSiteName = '';
    submittedDomainName = normalizedDomain;
    lastSubmittedPurpose = domainPurpose;
    try {
      const result = await addEmailDomain({ name: normalizedDomain, purpose: domainPurpose });
      
      if (result.success) {
        setToast('Domain added! Next, configure DNS.');
        await domains.refresh();

        let domainId = result.domain?.id ?? result.domain?.[0]?.id;
        if (!domainId) {
          const refreshed = Array.isArray(domains.current) ? domains.current : [];
          domainId = refreshed.find((domain: any) => domain.name === normalizedDomain)?.id;
        }

        if (requiresSiteSelection && domainId && selectedSiteId) {
          const siteMatch = sitesList.find((site) => site.id === selectedSiteId);
          submittedSiteName = siteMatch?.name || siteMatch?.subdomain || 'Selected site';

          const linkResult = await linkDomainToSite({
            domainId,
            siteId: selectedSiteId
          });

          if (linkResult.success) {
            siteLinkInstructions = linkResult.instructions || null;
            setToast('Domain linked! Add the CNAME record below.');
            domains.refresh();
          } else {
            alert(linkResult.error || 'Domain added, but linking failed.');
          }
        }

        currentStep = 1; // Move to DNS setup step
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

  async function openInstructions(domain: any) {
    instructionsDomain = domain;
    domainInstructions = null;
    instructionsLoading = true;
    showInstructionsModal = true;
    try {
      const result = await getDomainLinkInstructions({ domainId: domain.id });
      if (result.success) {
        domainInstructions = {
          verification: result.instructions?.verification || null,
          cname: result.instructions?.cname || null,
          status: result.status || 'pending'
        };
      } else {
        domainInstructions = null;
        alert(result.error || 'Failed to load DNS instructions');
      }
    } catch (err) {
      console.error('Error loading instructions', err);
      alert('Failed to load DNS instructions');
    } finally {
      instructionsLoading = false;
    }
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
    selectedSiteId = '';
    siteLinkInstructions = null;
    lastSubmittedPurpose = 'email';
    submittedSiteName = '';
    submittedDomainName = '';
  }
</script>

<svelte:head>
  <title>Domains - Kuratchi Dashboard</title>
</svelte:head>

<!-- Toast Notification -->
  {#if toastMessage}
    <Toast toasts={[{ id: 'domains-toast', type: 'success', message: toastMessage }]} />
  {/if}

<div class="kui-domains">
  <!-- Header -->
  <div class="kui-domains__header">
    <div class="kui-domains__headerTop">
      <div class="kui-domains__headerContent">
        <div class="kui-domains__headerIcon">
          <Globe />
        </div>
        <div>
          <h1 class="kui-domains__title">Domains</h1>
          <p class="kui-domains__subtitle">
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
    <div class="kui-domains__card">
      <div class="kui-domains__cardLoading">
        <Loading variant="primary" type="spinner" size="lg" />
      </div>
    </div>
  {:else if domains.error}
    <Alert type="error">
      <div class="kui-domains__alertContent">
        <AlertCircle class="h-5 w-5" />
        <span>Error loading domains. Please refresh the page.</span>
      </div>
    </Alert>
  {:else if !domains.current || domains.current.length === 0}
    <!-- Beautiful Empty State -->
    <div class="kui-domains__emptyGrid">
      <!-- Main CTA Card -->
      <div class="kui-domains__emptyCard kui-domains__emptyCard--main">
        <div class="kui-domains__emptyCardContent">
          <div class="kui-domains__emptyIcon">
            <Sparkles />
          </div>
          <h2 class="kui-domains__emptyTitle">Add Your First Domain</h2>
          <p class="kui-domains__emptyDescription">
            Manage all your domains in one place. Use them for email sending or site hosting.
          </p>
          <Button variant="primary" size="lg" onclick={() => showAddModal = true}>
            <Plus class="h-5 w-5" />
            Add Domain
          </Button>
        </div>
      </div>

      <!-- Use Cases -->
      <div class="kui-domains__usecasesGrid">
        <div class="kui-domains__usecaseCard">
          <div class="kui-domains__usecaseIcon kui-domains__usecaseIcon--email">
            <Mail />
          </div>
          <h3 class="kui-domains__usecaseTitle">Email Sending</h3>
          <p class="kui-domains__usecaseDesc">
            Send professional emails from your own domain using AWS SES. Perfect for newsletters, notifications, and drip campaigns.
          </p>
        </div>

        <div class="kui-domains__usecaseCard">
          <div class="kui-domains__usecaseIcon kui-domains__usecaseIcon--site">
            <Database />
          </div>
          <h3 class="kui-domains__usecaseTitle">Site Hosting</h3>
          <p class="kui-domains__usecaseDesc">
            Connect your domain to your Kuratchi sites for custom branded URLs and professional web presence.
          </p>
        </div>
      </div>
    </div>
  {:else}
    <!-- Domains Table -->
    <div class="kui-domains__card">
      <TableSimple>
        {#snippet head()}
          <tr>
            <th>Domain</th>
            <th>Used For</th>
            <th>Email Status</th>
            <th>Site Status</th>
            <th class="kui-domains__actionsHeader">Actions</th>
          </tr>
        {/snippet}
        {#snippet body()}
          {#each domains.current as domain}
            {@const dnsRecords = parseDnsRecords(domain.emailDnsRecords || '[]')}
            <tr>
                <td>
                  <div class="kui-domains__domainInfo">
                    <Globe class="h-5 w-5" />
                    <div>
                      <div class="kui-domains__domainName">{domain.name}</div>
                      <div class="kui-domains__domainDate">
                        Added {new Date(domain.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                <div class="kui-domains__badgeGroup">
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
                    <span class="kui-domains__placeholder">—</span>
                  {/if}
                </td>
                <td>
                  {#if domain.siteId}
                    {#if domain.cloudflareHostnameStatus === 'active'}
                      <Badge variant="success" class="gap-1">
                        <CheckCircle class="h-3 w-3" />
                        Active
                      </Badge>
                    {:else if domain.cloudflareHostnameStatus === 'pending'}
                      <Badge variant="warning" class="gap-1">
                        <AlertCircle class="h-3 w-3" />
                        Pending
                      </Badge>
                    {:else}
                      <Badge variant="ghost" size="sm">{domain.cloudflareHostnameStatus || 'Unknown'}</Badge>
                    {/if}
                  {:else}
                    <span class="kui-domains__placeholder">—</span>
                  {/if}
                </td>
                <td class="kui-domains__actionsCell">
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
                    {:else}
                      <Button
                        variant="ghost"
                        size="sm"
                        class="gap-1"
                        onclick={() => openInstructions(domain)}
                        title="View DNS instructions"
                      >
                        <Globe class="h-4 w-4" />
                        DNS Instructions
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
              <tr class="kui-domains__dnsRow">
                <td colspan="5">
                    <div class="kui-domains__dnsContainer">
                      <div class="kui-domains__dnsAlert">
                        <AlertCircle class="h-5 w-5" />
                        <div>
                          <p class="kui-domains__dnsAlertTitle">DNS Configuration Required</p>
                          <p class="kui-domains__dnsAlertText">
                            Add these CNAME records to your DNS provider (e.g., Cloudflare, GoDaddy, Namecheap). 
                            After adding, click "Verify" to check the configuration.
                          </p>
                        </div>
                      </div>
                      
                      <div class="kui-domains__dnsRecords">
                        {#each dnsRecords as record, idx}
                          {@const recordId = `${domain.id}-${idx}`}
                          {@const nameId = `${recordId}-name`}
                          <div class="kui-domains__dnsRecord">
                            <div class="kui-domains__dnsRecordContent">
                              <!-- Record Type & Description -->
                              <div class="kui-domains__dnsRecordType">
                                <Badge variant="primary" size="xs">{record.type}</Badge>
                                {#if record.type === 'TXT'}
                                  <Badge variant="ghost" size="xs">DMARC Policy</Badge>
                                {:else}
                                  <Badge variant="ghost" size="xs">DKIM Authentication</Badge>
                                {/if}
                              </div>
                              
                              <!-- Name Field -->
                              <div>
                                <div class="kui-domains__dnsFieldHeader">
                                  <label class="kui-domains__dnsFieldLabel">Name / Host</label>
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
                                <code class="kui-domains__dnsCode">
                                  {record.name}
                                </code>
                              </div>
                              
                              <!-- Value Field -->
                              <div>
                                <div class="kui-domains__dnsFieldHeader">
                                  <label class="kui-domains__dnsFieldLabel">Value / Points To</label>
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
                                <code class="kui-domains__dnsCode">
                                  {record.value}
                                </code>
                              </div>
                            </div>
                          </div>
                        {/each}
                      </div>
                      
                      <Alert type="info" class="kui-domains__dnsSteps">
                        <div class="kui-domains__dnsStepsContent">
                          <p class="kui-domains__dnsStepsTitle">Next Steps:</p>
                          <ol class="kui-domains__dnsStepsList">
                            <li>Log in to your DNS provider (where you manage {domain.name})</li>
                            <li>Add each CNAME record above to your DNS settings</li>
                            <li>Wait 5-10 minutes for DNS propagation (can take up to 48 hours)</li>
                            <li>Click the "Verify" button to confirm your domain</li>
                          </ol>
                        </div>
                      </Alert>
                    </div>
                  </td>
                </tr>
              {/if}
            {/each}
          {/snippet}
      </TableSimple>
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

      {#if requiresSiteSelection}
        <div class="kui-stack">
          <p class="kui-label">Link to a site</p>
          {#if sites.loading}
            <div class="kui-inline">
              <Loading size="sm" />
              <span class="kui-subtext">Loading your sites...</span>
            </div>
          {:else if sitesList.length === 0}
            <Alert type="warning">
              <div class="kui-stack">
                <p>No sites available yet.</p>
                <Button href="/sites" variant="primary" size="sm">
                  <Plus class="h-4 w-4" /> Create a site
                </Button>
              </div>
            </Alert>
          {:else}
            <label class="kui-form-control">
              <span class="kui-label">Choose a site for this domain</span>
              <select class="kui-select" bind:value={selectedSiteId}>
                <option value="">Select a site...</option>
                {#each sitesList as site}
                  <option value={site.id}>{site.name || site.subdomain || 'Untitled Site'}</option>
                {/each}
              </select>
              <span class="kui-helper-text">
                We'll generate the correct CNAME target for the selected site.
              </span>
            </label>
          {/if}
        </div>
      {/if}

      <Alert type="info">
        <div class="text-sm">
          {#if domainPurpose === 'email'}
            <p class="font-semibold mb-1">Email sending setup</p>
            <ol class="list-decimal list-inside space-y-1 text-base-content/70">
              <li>We'll register your domain with AWS SES</li>
              <li>You'll get DNS records to add to your domain provider</li>
              <li>After adding DNS records, verify to start sending emails</li>
              <li>Each verified domain can send emails with your branding</li>
            </ol>
          {:else if domainPurpose === 'site'}
            <p class="font-semibold mb-1">Site linking setup</p>
            <ol class="list-decimal list-inside space-y-1 text-base-content/70">
              <li>Choose the Kuratchi site you want to connect this domain to</li>
              <li>We'll generate the DNS records that point your domain to that site</li>
              <li>Add the provided CNAME records with your DNS provider</li>
              <li>Once DNS propagates, your site will be live on the custom domain</li>
            </ol>
          {:else}
            <p class="font-semibold mb-1">Email + Site setup</p>
            <ol class="list-decimal list-inside space-y-1 text-base-content/70">
              <li>We'll register the domain with AWS SES for email sending</li>
              <li>Pick a Kuratchi site to connect for custom hosting</li>
              <li>You'll receive DKIM/TXT records for email plus CNAMEs for site routing</li>
              <li>Add them to your DNS provider, then verify to unlock both flows</li>
            </ol>
          {/if}
        </div>
      </Alert>
    {:else}
      <div class="kui-stack">
        {#if submittedIncludesEmail}
          <Alert type="success">
            <div>
              <p class="font-semibold">Domain added successfully!</p>
              <p class="text-sm">Configure the email DNS records listed in the Domains table.</p>
            </div>
          </Alert>

          <div class="dns-next-steps">
            <h4 class="font-semibold">Email DNS Steps:</h4>
            <ol>
              <li>Find your domain in the table below</li>
              <li>Copy each DKIM / DMARC record shown</li>
              <li>Add them to your domain provider (Cloudflare, Namecheap, etc.)</li>
              <li>Click "Verify" once DNS records are added</li>
              <li>Start sending on-brand emails 🚀</li>
            </ol>
          </div>
        {/if}

        {#if submittedIncludesSite}
          <div class="dns-instructions-container">
            <!-- Status Badge -->
            <div class="dns-status-section">
              <div class="dns-status-badge pending">
                <div class="dns-status-indicator"></div>
                <div>
                  <p class="dns-status-label">Current Status</p>
                  <p class="dns-status-value">⏳ Pending Verification</p>
                </div>
              </div>
            </div>

            <!-- Single Step: CNAME -->
            {#if siteLinkInstructions?.cname}
              <div class="dns-instruction-step">
                <div class="dns-step-header">
                  <div class="dns-step-number">1</div>
                  <div>
                    <h4 class="dns-step-title">Point Your Domain</h4>
                    <p class="dns-step-description">Add this CNAME record to activate your custom domain</p>
                  </div>
                </div>
                
                <div class="dns-record-box">
                  <div class="dns-record-row">
                    <div class="dns-record-label">Record Type</div>
                    <div class="dns-record-value-wrapper">
                      <code class="dns-record-code">CNAME</code>
                    </div>
                  </div>
                  
                  <div class="dns-record-row">
                    <div class="dns-record-label">Name / Host</div>
                    <div class="dns-record-value-wrapper">
                      <code class="dns-record-code">{siteLinkInstructions.cname.name}</code>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        class="dns-copy-btn"
                        onclick={() => copyToClipboard(siteLinkInstructions.cname?.name || '')}
                        title="Copy to clipboard"
                      >
                        <Copy class="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div class="dns-record-row">
                    <div class="dns-record-label">Target / Value</div>
                    <div class="dns-record-value-wrapper">
                      <code class="dns-record-code">{siteLinkInstructions.cname.target}</code>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        class="dns-copy-btn"
                        onclick={() => copyToClipboard(siteLinkInstructions.cname?.target || '')}
                        title="Copy to clipboard"
                      >
                        <Copy class="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div class="dns-step-note">
                  <p>✨ <strong>Automatic Verification:</strong> Once you add this CNAME record, Cloudflare will automatically verify ownership and issue an SSL certificate. This usually takes a few minutes.</p>
                  <p class="mt-2">ℹ️ DNS changes can take up to 30 minutes to propagate. Your site will be live once verification completes.</p>
                </div>
              </div>
            {:else}
              <Alert type="warning">
                No DNS instructions available. Try refreshing the page.
              </Alert>
            {/if}

            <!-- Refresh Button -->
            <div class="dns-refresh-section">
              <Button 
                variant="ghost" 
                class="w-full"
                onclick={() => domains.refresh()}
              >
                <RefreshCw class="h-4 w-4" />
                Refresh Status
              </Button>
            </div>
          </div>
        {/if}
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
        disabled={!newDomain.trim() || isSubmitting || (requiresSiteSelection && !selectedSiteId)}
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

{#if showInstructionsModal && instructionsDomain}
  <Dialog bind:open={showInstructionsModal} size="lg" onClose={() => { showInstructionsModal = false; instructionsDomain = null; }}>
    {#snippet header()}
      <div class="dns-instructions-header">
        <h3 class="dns-instructions-title">DNS Setup for {instructionsDomain.name}</h3>
        <p class="dns-instructions-subtitle">Follow these steps to verify and activate your domain</p>
      </div>
    {/snippet}
    {#snippet children()}
      {#if instructionsLoading}
        <div class="kui-center">
          <Loading />
        </div>
      {:else if domainInstructions}
        <div class="dns-instructions-container">
          <!-- Status Badge -->
          <div class="dns-status-section">
            <div class="dns-status-badge" class:active={domainInstructions.status === 'active'} class:pending={domainInstructions.status === 'pending'}>
              <div class="dns-status-indicator"></div>
              <div>
                <p class="dns-status-label">Current Status</p>
                <p class="dns-status-value">{domainInstructions.status === 'active' ? '✓ Active' : '⏳ Pending'}</p>
              </div>
            </div>
          </div>

          <!-- Step 1: Verification -->
          {#if domainInstructions.verification}
            <div class="dns-instruction-step">
              <div class="dns-step-header">
                <div class="dns-step-number">1</div>
                <div>
                  <h4 class="dns-step-title">Verify Ownership</h4>
                  <p class="dns-step-description">Add this TXT record to prove you own the domain</p>
                </div>
              </div>
              
              <div class="dns-record-box">
                <div class="dns-record-row">
                  <div class="dns-record-label">Record Type</div>
                  <div class="dns-record-value-wrapper">
                    <code class="dns-record-code">{domainInstructions.verification.type}</code>
                  </div>
                </div>
                
                <div class="dns-record-row">
                  <div class="dns-record-label">Name / Host</div>
                  <div class="dns-record-value-wrapper">
                    <code class="dns-record-code">{domainInstructions.verification.name}</code>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      class="dns-copy-btn"
                      onclick={() => copyToClipboard(domainInstructions.verification?.name || '')}
                      title="Copy to clipboard"
                    >
                      <Copy class="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div class="dns-record-row">
                  <div class="dns-record-label">Value</div>
                  <div class="dns-record-value-wrapper">
                    <code class="dns-record-code dns-record-code--long">{domainInstructions.verification.value}</code>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      class="dns-copy-btn"
                      onclick={() => copyToClipboard(domainInstructions.verification?.value || '')}
                      title="Copy to clipboard"
                    >
                      <Copy class="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              <div class="dns-step-note">
                <p>ℹ️ After adding this record, Cloudflare will automatically verify ownership and issue an SSL certificate. This usually takes a few minutes.</p>
              </div>
            </div>
          {/if}

          <!-- Step 2: CNAME -->
          {#if domainInstructions.cname}
            <div class="dns-instruction-step">
              <div class="dns-step-header">
                <div class="dns-step-number" class:disabled={domainInstructions.status !== 'active'}>2</div>
                <div>
                  <h4 class="dns-step-title">Point Your Domain</h4>
                  <p class="dns-step-description">
                    {#if domainInstructions.status === 'active'}
                      Add this CNAME record to route traffic to Kuratchi
                    {:else}
                      Add this CNAME record after verification completes
                    {/if}
                  </p>
                </div>
              </div>
              
              <div class="dns-record-box" class:disabled={domainInstructions.status !== 'active'}>
                <div class="dns-record-row">
                  <div class="dns-record-label">Name / Host</div>
                  <div class="dns-record-value-wrapper">
                    <code class="dns-record-code">{domainInstructions.cname.name}</code>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      class="dns-copy-btn"
                      onclick={() => copyToClipboard(domainInstructions.cname?.name || '')}
                      title="Copy to clipboard"
                    >
                      <Copy class="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div class="dns-record-row">
                  <div class="dns-record-label">Target / Value</div>
                  <div class="dns-record-value-wrapper">
                    <code class="dns-record-code">{domainInstructions.cname.target}</code>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      class="dns-copy-btn"
                      onclick={() => copyToClipboard(domainInstructions.cname?.target || '')}
                      title="Copy to clipboard"
                    >
                      <Copy class="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              <div class="dns-step-note">
                <p>ℹ️ DNS changes can take up to 30 minutes to propagate. Once updated, your site will be live on this domain.</p>
              </div>
            </div>
          {/if}

          <!-- Refresh Button -->
          <div class="dns-refresh-section">
            <Button 
              variant="outline" 
              class="w-full"
              onclick={() => domains.refresh()}
            >
              <RefreshCw class="h-4 w-4" />
              Refresh Status
            </Button>
          </div>
        </div>
      {:else}
        <Alert type="warning">No DNS instructions available yet. Try refreshing after Cloudflare processes the hostname.</Alert>
      {/if}
    {/snippet}
    {#snippet actions(close)}
      <Button variant="ghost" type="button" onclick={() => { close(); showInstructionsModal = false; instructionsDomain = null; }}>Close</Button>
    {/snippet}
  </Dialog>
{/if}

<style>
  .kui-domains {
    padding: 2rem;
    max-width: 96rem;
    margin: 0 auto;
  }

  .kui-domains__header {
    margin-bottom: 2rem;
  }

  .kui-domains__headerTop {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .kui-domains__headerContent {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .kui-domains__headerIcon {
    width: 3rem;
    height: 3rem;
    border-radius: 0.75rem;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }

  .kui-domains__headerIcon :global(svg) {
    width: 1.5rem;
    height: 1.5rem;
  }

  .kui-domains__title {
    font-size: 1.875rem;
    font-weight: 700;
    margin: 0;
  }

  .kui-domains__subtitle {
    font-size: 0.875rem;
    color: rgba(0, 0, 0, 0.7);
    margin-top: 0.25rem;
  }

  .kui-domains__card {
    background: white;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 0.5rem;
  }

  .kui-domains__cardLoading {
    display: flex;
    justify-content: center;
    padding: 3rem 0;
  }

  .kui-domains__alertContent {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .kui-domains__emptyGrid {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .kui-domains__emptyCard {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 50%, rgba(236, 72, 153, 0.05) 100%);
    border: 2px dashed rgba(99, 102, 241, 0.2);
    border-radius: 0.75rem;
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
    padding: 4rem 1.5rem;
  }

  .kui-domains__emptyCard--main {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .kui-domains__emptyCardContent {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .kui-domains__emptyIcon {
    width: 5rem;
    height: 5rem;
    border-radius: 1rem;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.5rem;
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
    color: white;
  }

  .kui-domains__emptyIcon :global(svg) {
    width: 2.5rem;
    height: 2.5rem;
  }

  .kui-domains__emptyTitle {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
  }

  .kui-domains__emptyDescription {
    color: rgba(0, 0, 0, 0.7);
    max-width: 28rem;
    margin-bottom: 1.5rem;
  }

  .kui-domains__usecasesGrid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
  }

  .kui-domains__usecaseCard {
    background: white;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 0.5rem;
    padding: 1.5rem;
  }

  .kui-domains__usecaseIcon {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.75rem;
  }

  .kui-domains__usecaseIcon--email {
    background: rgba(99, 102, 241, 0.1);
    color: #6366f1;
  }

  .kui-domains__usecaseIcon--site {
    background: rgba(139, 92, 246, 0.1);
    color: #8b5cf6;
  }

  .kui-domains__usecaseIcon :global(svg) {
    width: 1.25rem;
    height: 1.25rem;
  }

  .kui-domains__usecaseTitle {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
  }

  .kui-domains__usecaseDesc {
    font-size: 0.875rem;
    color: rgba(0, 0, 0, 0.7);
    margin: 0;
  }

  .kui-domains__actionsHeader {
    text-align: right;
  }

  .kui-domains__domainInfo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .kui-domains__domainInfo :global(svg) {
    color: #6366f1;
    flex-shrink: 0;
  }

  .kui-domains__domainName {
    font-weight: 600;
  }

  .kui-domains__domainDate {
    font-size: 0.75rem;
    color: rgba(0, 0, 0, 0.5);
  }

  .kui-domains__badgeGroup {
    display: flex;
    gap: 0.25rem;
  }

  .kui-domains__placeholder {
    color: rgba(0, 0, 0, 0.4);
    font-size: 0.875rem;
  }

  .kui-domains__siteId {
    font-size: 0.875rem;
  }

  .kui-domains__actionsCell {
    text-align: right;
  }

  .kui-domains__actionButtons {
    display: flex;
    gap: 0.25rem;
    justify-content: flex-end;
  }

  .kui-domains__dnsRow {
    background: rgba(0, 0, 0, 0.03);
  }

  .kui-domains__dnsContainer {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .kui-domains__dnsAlert {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .kui-domains__dnsAlert :global(svg) {
    color: #3b82f6;
    flex-shrink: 0;
    margin-top: 0.125rem;
  }

  .kui-domains__dnsAlertTitle {
    font-weight: 600;
    font-size: 0.875rem;
    margin-bottom: 0.25rem;
  }

  .kui-domains__dnsAlertText {
    font-size: 0.75rem;
    color: rgba(0, 0, 0, 0.7);
  }

  .kui-domains__dnsRecords {
    display: grid;
    gap: 0.75rem;
  }

  .kui-domains__dnsRecord {
    background: white;
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 0.5rem;
    padding: 1rem;
  }

  .kui-domains__dnsRecordContent {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .kui-domains__dnsRecordType {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .kui-domains__dnsFieldHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.25rem;
  }

  .kui-domains__dnsFieldLabel {
    font-size: 0.75rem;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.7);
  }

  .kui-domains__dnsCode {
    display: block;
    font-size: 0.75rem;
    font-family: monospace;
    background: rgba(0, 0, 0, 0.05);
    padding: 0.5rem;
    border-radius: 0.375rem;
    word-break: break-all;
  }

  .kui-domains__dnsSteps {
    padding: 1rem;
    border-radius: 0.5rem;
    background: rgba(3, 102, 214, 0.05);
    border: 1px solid rgba(3, 102, 214, 0.2);
  }

  .kui-domains__dnsStepsContent {
    font-size: 0.875rem;
  }

  .kui-domains__dnsStepsTitle {
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .kui-domains__dnsStepsList {
    margin: 0;
    padding-left: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    font-size: 0.75rem;
    color: rgba(0, 0, 0, 0.7);
  }

  .dns-copy {
    gap: 0.25rem;
  }

  .dns-copy--success {
    background-color: rgba(34, 197, 94, 0.15);
    color: #22c55e;
  }

  .kui-select {
    padding: 0.55rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(0, 0, 0, 0.2);
    background: white;
    font: inherit;
  }

  .domain-purpose-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: 0.5rem;
  }

  .dns-next-steps {
    background: rgba(15, 23, 42, 0.05);
    border-radius: 0.75rem;
    padding: 1rem;
    display: grid;
    gap: 0.5rem;
  }

  .dns-next-steps ol {
    margin: 0.5rem 0 0;
    padding-left: 1rem;
    color: rgba(0, 0, 0, 0.7);
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    font-size: 0.875rem;
  }

  .kui-domains__modal {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
  }

  .kui-domains__modalBox {
    background: white;
    border-radius: 0.5rem;
    max-width: 32rem;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    padding: 1.5rem;
    box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1);
    position: relative;
    z-index: 51;
  }

  .kui-domains__modalTitle {
    font-weight: 700;
    font-size: 1.25rem;
    margin-bottom: 0.5rem;
    margin: 0;
  }

  .kui-domains__modalSubtitle {
    font-size: 0.875rem;
    color: rgba(0, 0, 0, 0.6);
    margin-bottom: 0.5rem;
  }

  .kui-domains__modalAlert {
    margin-bottom: 1rem;
  }

  .kui-domains__modalAlertTitle {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .kui-domains__modalAlertText {
    font-size: 0.875rem;
  }

  .kui-domains__inlineCode {
    background: rgba(0, 0, 0, 0.05);
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-family: monospace;
    font-size: 0.875em;
  }

  .kui-domains__modalLoading {
    display: flex;
    justify-content: center;
    padding: 3rem 0;
  }

  .kui-domains__sitesList {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-height: 24rem;
    overflow-y: auto;
    margin-bottom: 1rem;
  }

  .kui-domains__siteButton {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 150ms ease;
    text-align: left;
    width: 100%;
  }

  .kui-domains__siteButton:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.08);
    border-color: rgba(99, 102, 241, 0.4);
  }

  .kui-domains__siteButton:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .kui-domains__siteButtonContent {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
  }

  .kui-domains__siteButtonIcon {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.5rem;
    background: rgba(99, 102, 241, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6366f1;
    flex-shrink: 0;
  }

  .kui-domains__siteButtonIcon :global(svg) {
    width: 1.25rem;
    height: 1.25rem;
  }

  .kui-domains__siteButtonText {
    flex: 1;
    min-width: 0;
  }

  .kui-domains__siteButtonName {
    font-weight: 600;
    font-size: 0.875rem;
  }

  .kui-domains__siteButtonMeta {
    font-size: 0.75rem;
    color: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  .kui-domains__siteButtonSubdomain {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .kui-domains__siteButtonSubdomain :global(svg) {
    width: 0.75rem;
    height: 0.75rem;
  }

  .kui-domains__siteButtonBadge {
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    background: rgba(0, 0, 0, 0.1);
    color: rgba(0, 0, 0, 0.6);
  }

  .kui-domains__siteButtonBadge--active {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
  }

  .kui-domains__siteButton :global(svg) {
    width: 1.25rem;
    height: 1.25rem;
    color: rgba(0, 0, 0, 0.4);
    flex-shrink: 0;
  }

  .kui-domains__emptyState {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 3rem 1rem;
    gap: 1rem;
  }

  .kui-domains__emptyState :global(svg) {
    color: #6366f1;
  }

  .kui-domains__emptyStateTitle {
    font-weight: 600;
    font-size: 1.125rem;
    margin: 0;
  }

  .kui-domains__emptyStateDesc {
    color: rgba(0, 0, 0, 0.6);
    font-size: 0.875rem;
    margin: 0;
  }

  .kui-domains__modalActions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(0, 0, 0, 0.1);
  }

  .kui-domains__modalBackdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    border: none;
    cursor: pointer;
    z-index: 40;
  }

  /* DNS Instructions Modal Styles */
  .dns-instructions-header {
    margin-bottom: 0.5rem;
  }

  .dns-instructions-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0 0 0.25rem 0;
    color: #1f2937;
  }

  .dns-instructions-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
  }

  .dns-instructions-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* Status Section */
  .dns-status-section {
    margin-bottom: 0.5rem;
  }

  .dns-status-badge {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    border-radius: 0.75rem;
    border: 2px solid #e5e7eb;
    background: #f9fafb;
    transition: all 0.2s ease;
  }

  .dns-status-badge.pending {
    border-color: #fbbf24;
    background: #fffbeb;
  }

  .dns-status-badge.active {
    border-color: #10b981;
    background: #ecfdf5;
  }

  .dns-status-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #d1d5db;
    flex-shrink: 0;
  }

  .dns-status-badge.pending .dns-status-indicator {
    background: #fbbf24;
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  .dns-status-badge.active .dns-status-indicator {
    background: #10b981;
  }

  .dns-status-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
  }

  .dns-status-value {
    font-size: 1rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0;
  }

  .dns-status-badge.pending .dns-status-value {
    color: #92400e;
  }

  .dns-status-badge.active .dns-status-value {
    color: #065f46;
  }

  /* Step Styling */
  .dns-instruction-step {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
  }

  .dns-step-header {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
  }

  .dns-step-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    background: #6366f1;
    color: white;
    font-weight: 700;
    font-size: 1.125rem;
    flex-shrink: 0;
    transition: all 0.2s ease;
  }

  .dns-step-number.disabled {
    background: #d1d5db;
    color: #9ca3af;
  }

  .dns-step-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 0.25rem 0;
  }

  .dns-step-description {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
  }

  /* DNS Record Box */
  .dns-record-box {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    transition: opacity 0.2s ease;
  }

  .dns-record-box.disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  .dns-record-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .dns-record-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .dns-record-value-wrapper {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: #f3f4f6;
    border-radius: 0.375rem;
    border: 1px solid #e5e7eb;
  }

  .dns-record-code {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.875rem;
    color: #1f2937;
    word-break: break-all;
    flex: 1;
    margin: 0;
  }

  .dns-record-code--long {
    font-size: 0.8125rem;
  }

  .dns-copy-btn {
    flex-shrink: 0;
    padding: 0.5rem;
    color: #6b7280;
    transition: all 0.2s ease;
  }

  .dns-copy-btn:hover {
    color: #1f2937;
    background: #e5e7eb;
  }

  /* Step Note */
  .dns-step-note {
    padding: 0.75rem;
    background: #eff6ff;
    border-left: 3px solid #3b82f6;
    border-radius: 0.375rem;
  }

  .dns-step-note p {
    font-size: 0.875rem;
    color: #1e40af;
    margin: 0;
    line-height: 1.5;
  }

  /* Refresh Section */
  .dns-refresh-section {
    display: flex;
    gap: 0.5rem;
  }

  .dns-refresh-section :global(button) {
    flex: 1;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

@media (max-width: 768px) {
    .kui-domains {
      padding: 1rem;
    }

    .kui-domains__headerTop {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .kui-domains__actionButtons {
      flex-direction: column;
    }
  }
</style>

<Dialog bind:open={showDeleteModal} size="md" onClose={() => { showDeleteModal = false; selectedDomain = null; }}>
  {#if selectedDomain}
    {#snippet header()}
      <div>
        <h3 class="kui-card__title text-error">Delete Domain</h3>
        <p class="kui-helper-text">This action cannot be undone.</p>
      </div>
    {/snippet}

    <div class="space-y-4">
      <Alert type="error">
        <div class="flex items-center gap-2">
          <AlertCircle class="h-5 w-5" />
          <span>Are you sure you want to delete <strong>{selectedDomain.name}</strong>?</span>
        </div>
      </Alert>

      <p class="text-sm text-base-content/60">
        This will remove the domain and you won't be able to send emails or use it for sites.
      </p>
    </div>
  {/if}

  {#snippet actions(close)}
    <Button variant="ghost" type="button" onclick={() => { close(); selectedDomain = null; }}>
      Cancel
    </Button>
    <Button variant="error" type="button" onclick={handleDeleteDomain}>
      Delete Domain
    </Button>
  {/snippet}
</Dialog>

<!-- Link to Site Modal -->
{#if showLinkSiteModal && selectedDomainForLinking}
  <div class="kui-domains__modal">
    <div class="kui-domains__modalBox">
      <h3 class="kui-domains__modalTitle">Link Domain to Site</h3>
      <p class="kui-domains__modalSubtitle">
        Select a site to link <strong>{selectedDomainForLinking.name}</strong> to. You'll need to configure DNS after linking.
      </p>
      <Alert type="info" class="kui-domains__modalAlert">
        <AlertCircle class="h-5 w-5" />
        <div>
          <p class="kui-domains__modalAlertTitle">Subdomain Required</p>
          <p class="kui-domains__modalAlertText">
            Only subdomains (like <code class="kui-domains__inlineCode">www.example.com</code>) can be linked. Apex domains (<code class="kui-domains__inlineCode">example.com</code>) are not supported on Cloudflare's standard plan.
          </p>
        </div>
      </Alert>
      
      {#if sites.loading}
        <div class="kui-domains__modalLoading">
          <Loading variant="primary" type="spinner" size="lg" />
        </div>
      {:else if sitesList.length > 0}
        <div class="kui-domains__sitesList">
          {#each sitesList as site}
            <button 
              class="kui-domains__siteButton"
              onclick={() => handleLinkDomainToSite(site.id)}
              disabled={isLinking}
            >
              <div class="kui-domains__siteButtonContent">
                <div class="kui-domains__siteButtonIcon">
                  <Globe />
                </div>
                <div class="kui-domains__siteButtonText">
                  <div class="kui-domains__siteButtonName">{site.name || 'Untitled Site'}</div>
                  <div class="kui-domains__siteButtonMeta">
                    {#if site.subdomain}
                      <span class="kui-domains__siteButtonSubdomain">
                        <ExternalLink class="h-3 w-3" />
                        {site.subdomain}.kuratchi.site
                      </span>
                    {/if}
                    {#if site.status}
                      <span class="kui-domains__siteButtonBadge kui-domains__siteButtonBadge--active">Active</span>
                    {:else}
                      <span class="kui-domains__siteButtonBadge">Inactive</span>
                    {/if}
                  </div>
                </div>
              </div>
              {#if isLinking}
                <Loader2 class="h-5 w-5 animate-spin" />
              {:else}
                <Link class="h-5 w-5" />
              {/if}
            </button>
          {/each}
        </div>
      {:else}
        <div class="kui-domains__emptyState">
          <Globe class="h-12 w-12" />
          <p class="kui-domains__emptyStateTitle">No sites available</p>
          <p class="kui-domains__emptyStateDesc">Create a site first to link this domain.</p>
          <Button variant="primary" size="sm" href="/sites">
            <Plus class="h-4 w-4" />
            Create site
          </Button>
        </div>
      {/if}

      <div class="kui-domains__modalActions">
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
      class="kui-domains__modalBackdrop" 
      onclick={() => { showLinkSiteModal = false; selectedDomainForLinking = null; }}
      disabled={isLinking}
      aria-label="Close modal"
    ></button>
  </div>
{/if}
