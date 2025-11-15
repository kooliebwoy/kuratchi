<script lang="ts">
  import { 
    getEmailDomains, 
    addEmailDomain, 
    verifyEmailDomain, 
    deleteEmailDomain 
  } from '$lib/functions/emailDomains.remote';
  import { 
    Mail, 
    Plus, 
    CheckCircle, 
    AlertCircle, 
    Copy, 
    Trash2, 
    RefreshCw, 
    ExternalLink,
    Check,
    X,
    Globe,
    Sparkles,
    Database
  } from 'lucide-svelte';

  // Load domains
  const domains = getEmailDomains();

  // Modal state
  let showAddModal = $state(false);
  let showDeleteModal = $state(false);
  let selectedDomain = $state<any>(null);
  let newDomain = $state('');
  let domainPurpose = $state<'email' | 'site' | 'both'>('email');
  let isSubmitting = $state(false);
  let copiedRecordId = $state<string | null>(null);
  let toastMessage = $state<string | null>(null);
  let currentStep = $state(0); // For add domain wizard: 0 = input, 1 = DNS setup

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

  function parseDnsRecords(recordsJson: string) {
    try {
      return JSON.parse(recordsJson);
    } catch {
      return [];
    }
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
  <div class="toast toast-top toast-end z-50">
    <div class="alert alert-success shadow-lg">
      <CheckCircle class="h-5 w-5" />
      <span>{toastMessage}</span>
    </div>
  </div>
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
        <button class="btn btn-primary gap-2" onclick={() => showAddModal = true}>
          <Plus class="h-4 w-4" />
          Add Domain
        </button>
      {/if}
    </div>
  </div>

  <!-- Domains List -->
  {#if domains.loading}
    <div class="card bg-base-100 shadow-sm border border-base-200">
      <div class="card-body">
        <div class="flex justify-center py-12">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
      </div>
    </div>
  {:else if domains.error}
    <div class="alert alert-error shadow-sm">
      <AlertCircle class="h-5 w-5" />
      <span>Error loading domains. Please refresh the page.</span>
    </div>
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
          <button class="btn btn-primary btn-lg gap-2" onclick={() => showAddModal = true}>
            <Plus class="h-5 w-5" />
            Add Domain
          </button>
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
              Send professional emails from your own domain using Resend. Perfect for newsletters, notifications, and drip campaigns.
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
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Domain</th>
                <th>Used For</th>
                <th>Email Status</th>
                <th>Site Attached</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each domains.current as domain}
                {@const dnsRecords = parseDnsRecords(domain.emailDnsRecords || '[]')}
                <tr class="hover">
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
                        <span class="badge badge-primary badge-sm gap-1">
                          <Mail class="h-3 w-3" />
                          Email
                        </span>
                      {/if}
                      {#if domain.siteId}
                        <span class="badge badge-secondary badge-sm gap-1">
                          <Database class="h-3 w-3" />
                          Site
                        </span>
                      {/if}
                      {#if !domain.emailEnabled && !domain.siteId}
                        <span class="badge badge-ghost badge-sm">Not configured</span>
                      {/if}
                    </div>
                  </td>
                  <td>
                    {#if domain.emailEnabled}
                      {#if domain.emailVerified}
                        <span class="badge badge-success gap-1">
                          <CheckCircle class="h-3 w-3" />
                          Verified
                        </span>
                      {:else}
                        <span class="badge badge-warning gap-1">
                          <AlertCircle class="h-3 w-3" />
                          Pending
                        </span>
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
                      {#if domain.emailEnabled && !domain.emailVerified}
                        <button 
                          class="btn btn-ghost btn-sm gap-1"
                          onclick={() => handleVerifyDomain(domain.id)}
                          title="Verify email DNS"
                        >
                          <RefreshCw class="h-4 w-4" />
                          Verify
                        </button>
                      {/if}
                      <button
                        class="btn btn-ghost btn-sm text-error"
                        onclick={() => openDeleteModal(domain)}
                        title="Delete domain"
                      >
                        <Trash2 class="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                
                <!-- DNS Records Row (expandable) -->
                {#if domain.emailEnabled && !domain.emailVerified && dnsRecords.length > 0}
                  <tr>
                    <td colspan="5" class="bg-base-200/30">
                      <div class="p-4 space-y-3">
                        <div class="flex items-center gap-2 mb-3">
                          <AlertCircle class="h-5 w-5 text-info" />
                          <p class="font-semibold text-sm">DNS Configuration Required for Email</p>
                        </div>
                        
                        <div class="grid gap-2">
                          {#each dnsRecords as record, idx}
                            {@const recordId = `${domain.id}-${idx}`}
                            <div class="bg-base-100 rounded-lg p-3 border border-base-300">
                              <div class="flex items-start justify-between gap-4">
                                <div class="flex-1 min-w-0">
                                  <div class="flex items-center gap-2 mb-2">
                                    <span class="badge badge-sm badge-primary">{record.type || record.record_type || 'TXT'}</span>
                                    <span class="text-xs font-medium text-base-content/60">
                                      {record.name === '@' ? 'Root domain (@)' : record.name}
                                    </span>
                                  </div>
                                  <div class="flex items-center gap-2">
                                    <code class="text-xs font-mono break-all flex-1 bg-base-200 p-2 rounded">
                                      {record.value}
                                    </code>
                                    <button 
                                      class="btn btn-sm btn-square {copiedRecordId === recordId ? 'btn-success' : 'btn-ghost'}"
                                      onclick={() => copyToClipboard(record.value, recordId)}
                                      title="Copy value"
                                    >
                                      {#if copiedRecordId === recordId}
                                        <Check class="h-4 w-4" />
                                      {:else}
                                        <Copy class="h-4 w-4" />
                                      {/if}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          {/each}
                        </div>
                      </div>
                    </td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Add Domain Modal -->
{#if showAddModal}
  <div class="modal modal-open">
    <div class="modal-box max-w-2xl">
      <h3 class="font-bold text-xl mb-6 flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Plus class="h-5 w-5 text-primary" />
        </div>
        Add Domain
      </h3>
      
      <div class="space-y-6">
        {#if currentStep === 0}
          <!-- Step 1: Enter Domain -->
          <div class="space-y-4">
            <div class="form-control">
              <label class="label" for="domain">
                <span class="label-text font-semibold">Domain Name</span>
              </label>
              <input
                id="domain"
                type="text"
                placeholder="example.com"
                class="input input-bordered input-lg"
                bind:value={newDomain}
                onkeydown={(e) => e.key === 'Enter' && handleAddDomain()}
              />
              <label class="label">
                <span class="label-text-alt text-base-content/60">
                  Enter your root domain (e.g., example.com) without http:// or www
                </span>
              </label>
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text font-semibold">What will you use this domain for?</span>
              </label>
              <div class="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  class="btn {domainPurpose === 'email' ? 'btn-primary' : 'btn-outline'}"
                  onclick={() => domainPurpose = 'email'}
                >
                  <Mail class="h-4 w-4" />
                  Email
                </button>
                <button
                  type="button"
                  class="btn {domainPurpose === 'site' ? 'btn-primary' : 'btn-outline'}"
                  onclick={() => domainPurpose = 'site'}
                >
                  <Database class="h-4 w-4" />
                  Site
                </button>
                <button
                  type="button"
                  class="btn {domainPurpose === 'both' ? 'btn-primary' : 'btn-outline'}"
                  onclick={() => domainPurpose = 'both'}
                >
                  <Globe class="h-4 w-4" />
                  Both
                </button>
              </div>
            </div>

            <div class="alert alert-info">
              <AlertCircle class="h-5 w-5 shrink-0" />
              <div class="text-sm">
                <p class="font-semibold mb-1">Next steps:</p>
                <ol class="list-decimal list-inside space-y-1 text-base-content/70">
                  <li>We'll register your domain with Resend</li>
                  <li>You'll get DNS records to add to your domain provider</li>
                  <li>After adding DNS records, verify to start using</li>
                </ol>
              </div>
            </div>
          </div>
        {:else}
          <!-- Step 2: Success -->
          <div class="space-y-4">
            <div class="alert alert-success">
              <CheckCircle class="h-6 w-6" />
              <div>
                <p class="font-semibold">Domain added successfully!</p>
                <p class="text-sm">Configure DNS records in the table below.</p>
              </div>
            </div>

            <div class="bg-base-200/50 rounded-lg p-4">
              <h4 class="font-semibold mb-3">Next Steps:</h4>
              <ol class="text-sm space-y-2 list-decimal list-inside text-base-content/70">
                <li>Find your domain in the table below</li>
                <li>Copy each DNS record shown</li>
                <li>Add them to your domain provider (Cloudflare, Namecheap, etc.)</li>
                <li>Click "Verify" once DNS records are added</li>
                <li>Start using your domain! 🚀</li>
              </ol>
            </div>
          </div>
        {/if}
      </div>

      <div class="modal-action">
        <button 
          class="btn btn-ghost" 
          onclick={resetModal}
          disabled={isSubmitting}
        >
          {currentStep === 0 ? 'Cancel' : 'Close'}
        </button>
        {#if currentStep === 0}
          <button 
            class="btn btn-primary gap-2" 
            onclick={handleAddDomain}
            disabled={!newDomain.trim() || isSubmitting}
          >
            {#if isSubmitting}
              <span class="loading loading-spinner loading-sm"></span>
              Adding...
            {:else}
              <Plus class="h-4 w-4" />
              Add Domain
            {/if}
          </button>
        {/if}
      </div>
    </div>
    <button 
      type="button" 
      class="modal-backdrop" 
      onclick={resetModal}
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
          Are you sure you want to delete <strong>{selectedDomain.name}</strong>?
        </p>

        <p class="text-sm text-base-content/60">
          This will remove the domain and you won't be able to send emails or use it for sites.
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
