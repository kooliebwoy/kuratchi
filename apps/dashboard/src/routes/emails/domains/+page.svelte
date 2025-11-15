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
    HelpCircle,
    Sparkles
  } from 'lucide-svelte';

  // Load domains
  const domains = getEmailDomains();

  // Modal state
  let showAddModal = $state(false);
  let showDeleteModal = $state(false);
  let selectedDomain = $state<any>(null);
  let newDomain = $state('');
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
        setToast('Domain verified! You can now send emails from this domain.');
        domains.refetch();
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
        domains.refetch();
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
    currentStep = 0;
  }


<svelte:head>
  <title>Email Domains - Kuratchi Dashboard</title>
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
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
          <Mail class="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 class="text-3xl font-bold">Email Domains</h1>
          <p class="text-sm text-base-content/70 mt-1">
            Send emails from your own domain using Resend
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
    <!-- Beautiful Empty State with Setup Guide -->
    <div class="grid gap-6">
      <!-- Main CTA Card -->
      <div class="card bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 border-2 border-dashed border-primary/20 shadow-lg">
        <div class="card-body items-center text-center py-16">
          <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-6 shadow-lg">
            <Sparkles class="h-10 w-10 text-white" />
          </div>
          <h2 class="card-title text-2xl mb-2">Ready to Send Emails?</h2>
          <p class="text-base-content/70 max-w-md mb-6">
            Add your domain and verify it to start sending professional emails from addresses like <code class="bg-base-200 px-2 py-1 rounded">you@yourdomain.com</code>
          </p>
          <button class="btn btn-primary btn-lg gap-2" onclick={() => showAddModal = true}>
            <Plus class="h-5 w-5" />
            Add Your First Domain
          </button>
        </div>
      </div>

      <!-- How It Works -->
      <div class="card bg-base-100 shadow-sm border border-base-200">
        <div class="card-body">
          <h3 class="card-title text-lg mb-4 flex items-center gap-2">
            <HelpCircle class="h-5 w-5 text-primary" />
            How It Works
          </h3>
          <div class="grid md:grid-cols-3 gap-6">
            <div class="space-y-3">
              <div class="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">1</div>
              <h4 class="font-semibold">Add Your Domain</h4>
              <p class="text-sm text-base-content/70">
                Enter your domain name (e.g., example.com). We'll create it in Resend and give you DNS records.
              </p>
            </div>
            <div class="space-y-3">
              <div class="w-10 h-10 rounded-full bg-secondary/10 text-secondary flex items-center justify-center font-bold">2</div>
              <h4 class="font-semibold">Add DNS Records</h4>
              <p class="text-sm text-base-content/70">
                Copy the provided DNS records and add them to your domain provider (like Cloudflare, Namecheap, etc.).
              </p>
            </div>
            <div class="space-y-3">
              <div class="w-10 h-10 rounded-full bg-success/10 text-success flex items-center justify-center font-bold">3</div>
              <h4 class="font-semibold">Verify & Send</h4>
              <p class="text-sm text-base-content/70">
                Once DNS records propagate, verify your domain and start sending emails from your own address!
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- FAQ -->
      <div class="card bg-base-100 shadow-sm border border-base-200">
        <div class="card-body">
          <h3 class="card-title text-lg mb-4">Common Questions</h3>
          <div class="space-y-4">
            <div class="collapse collapse-arrow bg-base-200/50">
              <input type="checkbox" />
              <div class="collapse-title font-medium">
                What domain should I use?
              </div>
              <div class="collapse-content">
                <p class="text-sm text-base-content/70">
                  Use your root domain (e.g., example.com) or a subdomain (e.g., mail.example.com). We recommend using your root domain for better deliverability.
                </p>
              </div>
            </div>
            <div class="collapse collapse-arrow bg-base-200/50">
              <input type="checkbox" />
              <div class="collapse-title font-medium">
                How long does DNS verification take?
              </div>
              <div class="collapse-content">
                <p class="text-sm text-base-content/70">
                  Usually a few minutes, but can take up to 48 hours. Once you add the DNS records, you can click "Verify DNS Records" to check if they've propagated.
                </p>
              </div>
            </div>
            <div class="collapse collapse-arrow bg-base-200/50">
              <input type="checkbox" />
              <div class="collapse-title font-medium">
                Do I need access to my domain's DNS settings?
              </div>
              <div class="collapse-content">
                <p class="text-sm text-base-content/70">
                  Yes, you'll need access to add TXT and MX records. Contact your domain provider (like Cloudflare, GoDaddy, Namecheap) if you're not sure how to access DNS settings.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  {:else}
    <!-- Domains List -->
    <div class="space-y-4">
      {#each domains.current as domain}
        {@const dnsRecords = parseDnsRecords(domain.emailDnsRecords || '[]')}
        <div class="card bg-base-100 shadow-sm border border-base-200 hover:shadow-md transition-shadow">
          <div class="card-body">
            <div class="flex items-start justify-between mb-4">
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-2">
                  <Mail class="h-6 w-6 text-primary" />
                  <h3 class="font-bold text-xl">{domain.name}</h3>
                  {#if domain.emailVerified}
                    <span class="badge badge-success gap-1 badge-lg">
                      <CheckCircle class="h-4 w-4" />
                      Verified
                    </span>
                  {:else}
                    <span class="badge badge-warning gap-1 badge-lg">
                      <AlertCircle class="h-4 w-4" />
                      Pending Verification
                    </span>
                  {/if}
                </div>
                <p class="text-sm text-base-content/60">
                  Resend ID: <code class="bg-base-200 px-2 py-0.5 rounded text-xs">{domain.resendDomainId}</code>
                </p>
              </div>

              <button
                class="btn btn-ghost btn-sm text-error"
                onclick={() => openDeleteModal(domain)}
                title="Delete domain"
              >
                <Trash2 class="h-4 w-4" />
              </button>
            </div>

            {#if !domain.emailVerified && dnsRecords.length > 0}
              <div class="divider my-2"></div>
              
              <!-- DNS Setup Guide -->
              <div class="space-y-4">
                <div class="alert alert-info">
                  <AlertCircle class="h-5 w-5 flex-shrink-0" />
                  <div class="text-sm">
                    <p class="font-semibold mb-2">DNS Configuration Required</p>
                    <p>Add these DNS records to your domain provider to verify and enable email sending.</p>
                  </div>
                </div>

                <!-- DNS Records with better styling -->
                <div class="space-y-3">
                  {#each dnsRecords as record, idx}
                    {@const recordId = `${domain.id}-${idx}`}
                    <div class="bg-base-200/50 rounded-lg p-4 border border-base-300">
                      <div class="flex items-start justify-between gap-4">
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2 mb-2">
                            <span class="badge badge-sm badge-primary">{record.type || record.record_type || 'TXT'}</span>
                            <span class="text-xs font-medium text-base-content/60">
                              Name: {record.name === '@' ? 'Root domain (@)' : record.name}
                            </span>
                          </div>
                          <div class="flex items-center gap-2">
                            <code class="text-xs font-mono break-all flex-1 bg-base-100 p-2 rounded border border-base-300">
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
                          {#if record.priority}
                            <p class="text-xs text-base-content/60 mt-2">Priority: {record.priority}</p>
                          {/if}
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>

                <!-- Actions -->
                <div class="flex flex-wrap gap-2 pt-2">
                  <button 
                    class="btn btn-primary gap-2"
                    onclick={() => handleVerifyDomain(domain.id)}
                  >
                    <RefreshCw class="h-4 w-4" />
                    Verify DNS Records
                  </button>
                  <a 
                    href="https://resend.com/domains"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn btn-ghost gap-2"
                  >
                    <ExternalLink class="h-4 w-4" />
                    View in Resend
                  </a>
                </div>
              </div>
            {:else if domain.emailVerified}
              <div class="alert alert-success">
                <CheckCircle class="h-5 w-5" />
                <span>This domain is verified and ready to send emails! 🎉</span>
              </div>
            {/if}
          </div>
        </div>
      {/each}
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
        Add Email Domain
      </h3>
      
      <div class="space-y-6">
        <!-- Step Indicator -->
        <div class="flex items-center justify-center gap-2 mb-6">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full {currentStep === 0 ? 'bg-primary text-white' : 'bg-success text-white'} flex items-center justify-center font-bold text-sm">
              {currentStep === 0 ? '1' : '✓'}
            </div>
            <span class="text-sm font-medium">Domain</span>
          </div>
          <div class="w-12 h-0.5 {currentStep === 1 ? 'bg-primary' : 'bg-base-300'}"></div>
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full {currentStep === 1 ? 'bg-primary text-white' : 'bg-base-300'} flex items-center justify-center font-bold text-sm">
              2
            </div>
            <span class="text-sm font-medium">DNS Setup</span>
          </div>
        </div>

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

            <div class="alert alert-info">
              <AlertCircle class="h-5 w-5 flex-shrink-0" />
              <div class="text-sm">
                <p class="font-semibold mb-1">What happens next:</p>
                <ol class="list-decimal list-inside space-y-1 text-base-content/70">
                  <li>We'll register your domain with Resend</li>
                  <li>You'll get DNS records to add to your domain provider</li>
                  <li>After adding DNS records, verify to start sending emails</li>
                </ol>
              </div>
            </div>

            <div class="bg-base-200/50 rounded-lg p-4">
              <h4 class="font-semibold text-sm mb-2">💡 Pro Tips</h4>
              <ul class="text-sm text-base-content/70 space-y-1">
                <li>• Use your root domain for best deliverability</li>
                <li>• Make sure you have access to your domain's DNS settings</li>
                <li>• DNS changes can take a few minutes to propagate</li>
              </ul>
            </div>
          </div>
        {:else}
          <!-- Step 2: Success / Next Steps -->
          <div class="space-y-4">
            <div class="alert alert-success">
              <CheckCircle class="h-6 w-6" />
              <div>
                <p class="font-semibold">Domain added successfully!</p>
                <p class="text-sm">Close this and configure the DNS records below.</p>
              </div>
            </div>

            <div class="bg-base-200/50 rounded-lg p-4">
              <h4 class="font-semibold mb-3">Next Steps:</h4>
              <ol class="text-sm space-y-2 list-decimal list-inside text-base-content/70">
                <li>Find your domain in the list below</li>
                <li>Copy each DNS record shown</li>
                <li>Add them to your domain provider (Cloudflare, Namecheap, etc.)</li>
                <li>Click "Verify DNS Records" once added</li>
                <li>Start sending emails from your domain! 🚀</li>
              </ol>
            </div>

            <div class="flex gap-2">
              <a 
                href="https://resend.com/docs/dashboard/domains/introduction"
                target="_blank"
                rel="noopener noreferrer"
                class="btn btn-sm btn-outline gap-2"
              >
                <ExternalLink class="h-4 w-4" />
                DNS Setup Guide
              </a>
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
</div>
