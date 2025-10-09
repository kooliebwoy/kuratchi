<script lang="ts">
  import { Globe, Plus, Search, CheckCircle, XCircle, AlertCircle, Shield, Clock, Settings, Eye, Trash2, Copy, ExternalLink } from 'lucide-svelte';

  // Mock data - will be replaced with real data from Cloudflare API
  let domains = $state([
    {
      id: '1',
      name: 'example.com',
      status: 'active',
      nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
      ssl: 'full',
      dnssec: true,
      plan: 'free',
      createdAt: '2024-01-15T10:00:00Z',
      verified: true
    },
    {
      id: '2',
      name: 'app.example.com',
      status: 'pending',
      nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
      ssl: 'flexible',
      dnssec: false,
      plan: 'pro',
      createdAt: '2024-03-20T15:30:00Z',
      verified: false
    }
  ]);

  // Filter state
  let searchQuery = $state('');
  let filterStatus = $state<'all' | 'active' | 'pending' | 'error'>('all');
  let selectedDomain = $state<any>(null);
  
  // Modal state
  let showAddDomainModal = $state(false);
  let showDomainDetailsModal = $state(false);
  let showDeleteModal = $state(false);
  
  // Form state
  let newDomainName = $state('');

  // Stats
  const stats = $derived({
    total: domains.length,
    active: domains.filter(d => d.status === 'active').length,
    pending: domains.filter(d => d.status === 'pending').length,
    sslEnabled: domains.filter(d => d.ssl !== 'off').length
  });

  // Filtered domains
  const filteredDomains = $derived.by(() => {
    let filtered = domains;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(d => d.name.toLowerCase().includes(q));
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(d => d.status === filterStatus);
    }

    return filtered;
  });

  function getStatusBadge(status: string) {
    switch (status) {
      case 'active':
        return { class: 'badge-success', icon: CheckCircle, label: 'Active' };
      case 'pending':
        return { class: 'badge-warning', icon: Clock, label: 'Pending' };
      case 'error':
        return { class: 'badge-error', icon: XCircle, label: 'Error' };
      default:
        return { class: 'badge-neutral', icon: AlertCircle, label: status };
    }
  }

  function getSSLBadge(ssl: string) {
    switch (ssl) {
      case 'full':
        return { class: 'badge-success', label: 'Full' };
      case 'flexible':
        return { class: 'badge-warning', label: 'Flexible' };
      case 'strict':
        return { class: 'badge-success', label: 'Strict' };
      default:
        return { class: 'badge-neutral', label: 'Off' };
    }
  }

  function openDomainDetails(domain: any) {
    selectedDomain = domain;
    showDomainDetailsModal = true;
  }

  function openDeleteModal(domain: any) {
    selectedDomain = domain;
    showDeleteModal = true;
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  function handleAddDomain() {
    if (!newDomainName) return;
    
    // Will be replaced with actual API call
    console.log('Adding domain:', newDomainName);
    
    showAddDomainModal = false;
    newDomainName = '';
  }

  function handleDeleteDomain() {
    if (!selectedDomain) return;
    
    // Will be replaced with actual API call
    console.log('Deleting domain:', selectedDomain.name);
    
    showDeleteModal = false;
    selectedDomain = null;
  }
</script>

<svelte:head>
  <title>Domain Management - Kuratchi Dashboard</title>
</svelte:head>

<div class="p-8">
  <!-- Header -->
  <div class="mb-8 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
        <Globe class="h-6 w-6 text-primary" />
      </div>
      <div>
        <h1 class="text-2xl font-bold">Domain Management</h1>
        <p class="text-sm text-base-content/70">Manage domains and DNS via Cloudflare</p>
      </div>
    </div>
    <button class="btn btn-primary" onclick={() => showAddDomainModal = true}>
      <Plus class="h-4 w-4 mr-2" />
      Add Domain
    </button>
  </div>

  <!-- Stats Cards -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    <div class="card bg-base-100 shadow-sm">
      <div class="card-body p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-base-content/60 uppercase font-semibold">Total Domains</p>
            <p class="text-3xl font-bold text-primary">{stats.total}</p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Globe class="h-6 w-6 text-primary" />
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-base-100 shadow-sm">
      <div class="card-body p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-base-content/60 uppercase font-semibold">Active</p>
            <p class="text-3xl font-bold text-success">{stats.active}</p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
            <CheckCircle class="h-6 w-6 text-success" />
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-base-100 shadow-sm">
      <div class="card-body p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-base-content/60 uppercase font-semibold">Pending</p>
            <p class="text-3xl font-bold text-warning">{stats.pending}</p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
            <Clock class="h-6 w-6 text-warning" />
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-base-100 shadow-sm">
      <div class="card-body p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-base-content/60 uppercase font-semibold">SSL Enabled</p>
            <p class="text-3xl font-bold text-info">{stats.sslEnabled}</p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-info/10 flex items-center justify-center">
            <Shield class="h-6 w-6 text-info" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Filters -->
  <div class="mb-6 flex flex-wrap items-center gap-3">
    <div class="form-control">
      <div class="input-group">
        <span class="bg-base-200 flex items-center justify-center px-3">
          <Search class="h-4 w-4" />
        </span>
        <input
          type="text"
          placeholder="Search domains..."
          class="input input-bordered input-sm w-64"
          bind:value={searchQuery}
        />
      </div>
    </div>

    <select class="select select-bordered select-sm w-40" bind:value={filterStatus}>
      <option value="all">All Status</option>
      <option value="active">Active</option>
      <option value="pending">Pending</option>
      <option value="error">Error</option>
    </select>
  </div>

  <!-- Domains Table -->
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body">
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Domain</th>
              <th>Status</th>
              <th>SSL/TLS</th>
              <th>DNSSEC</th>
              <th>Plan</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#if filteredDomains.length > 0}
              {#each filteredDomains as domain}
                {@const statusBadge = getStatusBadge(domain.status)}
                {@const sslBadge = getSSLBadge(domain.ssl)}
                <tr class="hover">
                  <td>
                    <div class="flex items-center gap-2">
                      <Globe class="h-4 w-4 text-base-content/60" />
                      <div>
                        <div class="font-medium">{domain.name}</div>
                        {#if !domain.verified}
                          <span class="text-xs text-warning">Verification required</span>
                        {/if}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="badge {statusBadge.class} badge-sm gap-1">
                      <statusBadge.icon class="h-3 w-3" />
                      {statusBadge.label}
                    </span>
                  </td>
                  <td>
                    <span class="badge {sslBadge.class} badge-sm">{sslBadge.label}</span>
                  </td>
                  <td>
                    {#if domain.dnssec}
                      <span class="badge badge-success badge-sm gap-1">
                        <Shield class="h-3 w-3" />
                        Enabled
                      </span>
                    {:else}
                      <span class="badge badge-neutral badge-sm">Disabled</span>
                    {/if}
                  </td>
                  <td>
                    <span class="badge badge-outline badge-sm capitalize">{domain.plan}</span>
                  </td>
                  <td class="text-right">
                    <div class="flex gap-1 justify-end">
                      <button
                        class="btn btn-ghost btn-sm btn-square"
                        onclick={() => openDomainDetails(domain)}
                        title="View details"
                      >
                        <Eye class="h-4 w-4" />
                      </button>
                      <button
                        class="btn btn-ghost btn-sm btn-square"
                        title="Settings"
                      >
                        <Settings class="h-4 w-4" />
                      </button>
                      <button
                        class="btn btn-ghost btn-sm btn-square text-error"
                        onclick={() => openDeleteModal(domain)}
                        title="Delete domain"
                      >
                        <Trash2 class="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            {:else}
              <tr>
                <td colspan="6" class="text-center py-8">
                  <div class="flex flex-col items-center gap-2">
                    <Globe class="h-12 w-12 text-base-content/30" />
                    <p class="text-base-content/70">No domains found</p>
                    {#if searchQuery || filterStatus !== 'all'}
                      <p class="text-sm text-base-content/50">Try adjusting your filters</p>
                    {:else}
                      <button class="btn btn-primary btn-sm mt-2" onclick={() => showAddDomainModal = true}>
                        <Plus class="h-4 w-4 mr-2" />
                        Add Your First Domain
                      </button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<!-- Add Domain Modal -->
{#if showAddDomainModal}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">Add Domain</h3>
      
      <div class="space-y-4">
        <div class="form-control">
          <label class="label" for="domain-name">
            <span class="label-text">Domain Name</span>
          </label>
          <input
            id="domain-name"
            type="text"
            placeholder="example.com"
            class="input input-bordered"
            bind:value={newDomainName}
          />
          <label class="label">
            <span class="label-text-alt">Enter your domain without www or http://</span>
          </label>
        </div>

        <div class="alert alert-info">
          <AlertCircle class="h-5 w-5" />
          <span class="text-sm">You'll need to update your nameservers to Cloudflare after adding the domain.</span>
        </div>
      </div>

      <div class="modal-action">
        <button class="btn" onclick={() => { showAddDomainModal = false; newDomainName = ''; }}>
          Cancel
        </button>
        <button class="btn btn-primary" onclick={handleAddDomain} disabled={!newDomainName}>
          Add Domain
        </button>
      </div>
    </div>
    <button type="button" class="modal-backdrop" onclick={() => { showAddDomainModal = false; newDomainName = ''; }} aria-label="Close modal"></button>
  </div>
{/if}

<!-- Domain Details Modal -->
{#if showDomainDetailsModal && selectedDomain}
  <div class="modal modal-open">
    <div class="modal-box max-w-2xl">
      <h3 class="font-bold text-lg mb-4">{selectedDomain.name}</h3>
      
      {#if selectedDomain}
        {@const statusBadge = getStatusBadge(selectedDomain.status)}
        {@const sslBadge = getSSLBadge(selectedDomain.ssl)}
        
        <div class="space-y-6">
          <!-- Status Overview -->
          <div class="grid grid-cols-2 gap-4">
            <div class="bg-base-200 p-4 rounded-lg">
              <p class="text-xs text-base-content/60 mb-1">Status</p>
              <span class="badge {statusBadge.class} gap-1">
                <statusBadge.icon class="h-3 w-3" />
                {statusBadge.label}
              </span>
            </div>
            <div class="bg-base-200 p-4 rounded-lg">
              <p class="text-xs text-base-content/60 mb-1">SSL/TLS</p>
              <span class="badge {sslBadge.class}">{sslBadge.label}</span>
            </div>
          </div>

        <!-- Nameservers -->
        <div>
          <h4 class="font-semibold mb-2">Nameservers</h4>
          <div class="space-y-2">
            {#each selectedDomain.nameservers as ns}
              <div class="flex items-center justify-between bg-base-200 p-3 rounded">
                <code class="text-sm">{ns}</code>
                <button class="btn btn-ghost btn-xs" onclick={() => copyToClipboard(ns)}>
                  <Copy class="h-3 w-3" />
                </button>
              </div>
            {/each}
          </div>
        </div>

        <!-- DNSSEC -->
        <div class="flex items-center justify-between bg-base-200 p-4 rounded-lg">
          <div>
            <p class="font-semibold">DNSSEC</p>
            <p class="text-xs text-base-content/60">Adds extra layer of security</p>
          </div>
          {#if selectedDomain.dnssec}
            <span class="badge badge-success gap-1">
              <Shield class="h-3 w-3" />
              Enabled
            </span>
          {:else}
            <button class="btn btn-sm">Enable DNSSEC</button>
          {/if}
        </div>

        <!-- Quick Actions -->
        <div class="grid grid-cols-2 gap-3">
          <button class="btn btn-outline">
            <Settings class="h-4 w-4 mr-2" />
            DNS Settings
          </button>
          <button class="btn btn-outline">
            <Shield class="h-4 w-4 mr-2" />
            SSL/TLS Settings
          </button>
        </div>

        <!-- External Link -->
        <a
          href="https://dash.cloudflare.com"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-ghost btn-sm w-full"
        >
          <ExternalLink class="h-4 w-4 mr-2" />
          Open in Cloudflare Dashboard
        </a>
      </div>
      {/if}

      <div class="modal-action">
        <button class="btn" onclick={() => { showDomainDetailsModal = false; selectedDomain = null; }}>
          Close
        </button>
      </div>
    </div>
    <button type="button" class="modal-backdrop" onclick={() => { showDomainDetailsModal = false; selectedDomain = null; }} aria-label="Close modal"></button>
  </div>
{/if}

<!-- Delete Domain Modal -->
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
          This will remove all DNS records, SSL certificates, and settings for this domain.
        </p>
      </div>

      <div class="modal-action">
        <button class="btn" onclick={() => { showDeleteModal = false; selectedDomain = null; }}>
          Cancel
        </button>
        <button class="btn btn-error" onclick={handleDeleteDomain}>
          Delete Domain
        </button>
      </div>
    </div>
    <button type="button" class="modal-backdrop" onclick={() => { showDeleteModal = false; selectedDomain = null; }} aria-label="Close modal"></button>
  </div>
{/if}
