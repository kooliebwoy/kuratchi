<script lang="ts">
  import { 
    getEmailDomains, 
    addEmailDomain, 
    verifyEmailDomain, 
    deleteEmailDomain 
  } from '$lib/functions/emailDomains.remote';
  import { Mail, Plus, CheckCircle, AlertCircle, Copy, Trash2, RefreshCw, ExternalLink } from 'lucide-svelte';

  // Load domains
  const domains = getEmailDomains();

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
      const result = await addEmailDomain({ name: newDomain });
      
      if (result.success) {
        showAddModal = false;
        newDomain = '';
        domains.refetch();
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
        domains.refetch();
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
      const result = await deleteEmailDomain({ domainId: selectedDomain.id });
      
      if (result.success) {
        showDeleteModal = false;
        selectedDomain = null;
        domains.refetch();
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

  function parseDnsRecords(recordsJson: string) {
    try {
      return JSON.parse(recordsJson);
    } catch {
      return [];
    }
  }
</script>

<svelte:head>
  <title>Email Domains - Kuratchi Dashboard</title>
</svelte:head>

<div class="p-8">
  <!-- Header -->
  <div class="mb-8 flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold">Email Domains</h1>
      <p class="text-sm text-base-content/70 mt-1">
        Verify domains for sending emails via Resend
      </p>
    </div>
    <button class="btn btn-primary" onclick={() => showAddModal = true}>
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
        <div class="space-y-6">
          {#each domains.current as domain}
            {@const dnsRecords = parseDnsRecords(domain.emailDnsRecords || '[]')}
            <div class="border border-base-300 rounded-lg p-6">
              <div class="flex items-start justify-between mb-4">
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <Mail class="h-5 w-5 text-base-content/60" />
                    <h3 class="font-semibold text-lg">{domain.name}</h3>
                    {#if domain.emailVerified}
                      <span class="badge badge-success badge-sm gap-1">
                        <CheckCircle class="h-3 w-3" />
                        Verified
                      </span>
                    {:else}
                      <span class="badge badge-warning badge-sm gap-1">
                        <AlertCircle class="h-3 w-3" />
                        Pending Verification
                      </span>
                    {/if}
                  </div>
                  <p class="text-sm text-base-content/60 mt-1">
                    Resend Domain ID: {domain.resendDomainId}
                  </p>
                </div>

                <button
                  class="btn btn-ghost btn-sm btn-square text-error"
                  onclick={() => openDeleteModal(domain)}
                  title="Delete domain"
                >
                  <Trash2 class="h-4 w-4" />
                </button>
              </div>

              {#if !domain.emailVerified && dnsRecords.length > 0}
                <div class="space-y-4">
                  <div class="alert alert-info">
                    <AlertCircle class="h-5 w-5" />
                    <div class="text-sm">
                      <p class="font-semibold mb-1">DNS Configuration Required:</p>
                      <p>Add the following DNS records to your domain provider to verify and enable email sending:</p>
                    </div>
                  </div>

                  <div class="space-y-3">
                    {#each dnsRecords as record}
                      <div class="bg-base-200 p-4 rounded">
                        <div class="flex items-center justify-between mb-2">
                          <span class="badge badge-sm">{record.type || record.record_type || 'TXT'}</span>
                          <span class="text-xs text-base-content/60">
                            {record.name === '@' ? 'Root domain' : record.name}
                          </span>
                        </div>
                        <div class="flex items-center gap-2">
                          <code class="text-xs font-mono flex-1 break-all">
                            {record.value}
                          </code>
                          <button 
                            class="btn btn-ghost btn-xs btn-square"
                            onclick={() => copyToClipboard(record.value)}
                            title="Copy value"
                          >
                            <Copy class="h-3 w-3" />
                          </button>
                        </div>
                        {#if record.priority}
                          <p class="text-xs text-base-content/60 mt-1">Priority: {record.priority}</p>
                        {/if}
                      </div>
                    {/each}
                  </div>

                  <div class="flex gap-2">
                    <button 
                      class="btn btn-sm btn-primary"
                      onclick={() => handleVerifyDomain(domain.id)}
                    >
                      <RefreshCw class="h-4 w-4" />
                      Verify DNS Records
                    </button>
                    <a 
                      href="https://resend.com/domains"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="btn btn-sm btn-outline"
                    >
                      <ExternalLink class="h-4 w-4" />
                      View in Resend
                    </a>
                  </div>
                </div>
              {:else if domain.emailVerified}
                <div class="alert alert-success">
                  <CheckCircle class="h-5 w-5" />
                  <span>Domain is verified and ready to send emails</span>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <div class="text-center py-12">
          <Mail class="h-12 w-12 text-base-content/30 mx-auto mb-3" />
          <p class="text-base-content/70 mb-4">No email domains configured</p>
          <p class="text-sm text-base-content/50 mb-4">
            Add a domain to send emails from your own domain using Resend
          </p>
          <button class="btn btn-primary btn-sm" onclick={() => showAddModal = true}>
            <Plus class="h-4 w-4" />
            Add Your First Domain
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- Info Card -->
  <div class="card bg-base-200 mt-6">
    <div class="card-body">
      <h3 class="font-semibold mb-2">About Email Domains</h3>
      <ul class="text-sm text-base-content/70 space-y-1 list-disc list-inside">
        <li>Email domains allow you to send emails from your own domain (e.g., noreply@yourdomain.com)</li>
        <li>You'll need access to your domain's DNS settings to add verification records</li>
        <li>Verification typically takes a few minutes after DNS records are added</li>
        <li>Verified domains can be used for newsletters, broadcasts, and drip campaigns</li>
      </ul>
    </div>
  </div>
</div>

<!-- Add Domain Modal -->
{#if showAddModal}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">Add Email Domain</h3>
      
      <div class="space-y-4">
        <div class="form-control">
          <label class="label" for="domain">
            <span class="label-text">Domain Name</span>
          </label>
          <input
            id="domain"
            type="text"
            placeholder="example.com"
            class="input input-bordered"
            bind:value={newDomain}
          />
          <label class="label">
            <span class="label-text-alt">Enter your root domain (e.g., example.com)</span>
          </label>
        </div>

        <div class="alert alert-info">
          <AlertCircle class="h-5 w-5" />
          <div class="text-sm">
            <p class="font-semibold mb-1">What happens next:</p>
            <ol class="list-decimal list-inside space-y-1">
              <li>We'll create the domain in Resend</li>
              <li>You'll receive DNS records to add to your domain</li>
              <li>After adding records, click "Verify DNS Records"</li>
              <li>Once verified, you can send emails from this domain</li>
            </ol>
          </div>
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
      <h3 class="font-bold text-lg text-error mb-4">Delete Email Domain</h3>
      
      <div class="space-y-4">
        <div class="alert alert-error">
          <AlertCircle class="h-5 w-5" />
          <span>This action cannot be undone!</span>
        </div>

        <p class="text-base-content/70">
          Are you sure you want to delete <strong>{selectedDomain.name}</strong>?
        </p>

        <p class="text-sm text-base-content/60">
          This will remove the domain from both Kuratchi and Resend. You won't be able to send emails from this domain.
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
