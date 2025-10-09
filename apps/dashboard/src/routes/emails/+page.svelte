<script lang="ts">
  import { Mail, CheckCircle, XCircle, AlertCircle, Clock, Search, Eye, X, ExternalLink } from 'lucide-svelte';
  import { getEmails, getEmailStats } from './emails.remote';

  // Data sources
  const emails = getEmails();
  const stats = getEmailStats();

  // Derived lists
  const emailsList = $derived(emails.current ? (Array.isArray(emails.current) ? emails.current : []) : []);
  const statsData = $derived(stats.current || { total: 0, delivered: 0, bounced: 0, complained: 0, last24h: 0 });

  // Filter state
  let searchQuery = $state('');
  let filterStatus = $state<'all' | 'delivered' | 'bounced' | 'complained' | 'opened'>('all');
  let selectedEmail = $state<any>(null);
  let showEmailModal = $state(false);

  // Filtered emails
  const filteredEmails = $derived.by(() => {
    let filtered = emailsList;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((e: any) =>
        e.to?.some((t: string) => t.toLowerCase().includes(q)) ||
        e.from?.toLowerCase().includes(q) ||
        e.subject?.toLowerCase().includes(q)
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((e: any) => e.last_event === filterStatus);
    }

    return filtered;
  });

  function formatDate(dateStr: string) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString();
  }

  function getTimeAgo(dateStr: string) {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'delivered':
        return { class: 'badge-success', label: 'Delivered' };
      case 'bounced':
        return { class: 'badge-error', label: 'Bounced' };
      case 'complained':
        return { class: 'badge-warning', label: 'Complained' };
      case 'opened':
        return { class: 'badge-info', label: 'Opened' };
      case 'clicked':
        return { class: 'badge-primary', label: 'Clicked' };
      default:
        return { class: 'badge-neutral', label: status || 'Sent' };
    }
  }

  function openEmailModal(email: any) {
    selectedEmail = email;
    showEmailModal = true;
  }

  function closeEmailModal() {
    showEmailModal = false;
    selectedEmail = null;
  }
</script>

<svelte:head>
  <title>Email Management - Kuratchi Dashboard</title>
</svelte:head>

<div class="p-8">
  <!-- Header -->
  <div class="mb-8 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
        <Mail class="h-6 w-6 text-primary" />
      </div>
      <div>
        <h1 class="text-2xl font-bold">Email Management</h1>
        <p class="text-sm text-base-content/70">View and manage sent emails via Resend</p>
      </div>
    </div>
  </div>

  <!-- Stats Cards -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    <div class="card bg-base-100 shadow-sm">
      <div class="card-body p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-base-content/60 uppercase font-semibold">Last 24 Hours</p>
            <p class="text-3xl font-bold text-primary">{statsData.last24h}</p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Clock class="h-6 w-6 text-primary" />
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-base-100 shadow-sm">
      <div class="card-body p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-base-content/60 uppercase font-semibold">Delivered</p>
            <p class="text-3xl font-bold text-success">{statsData.delivered}</p>
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
            <p class="text-xs text-base-content/60 uppercase font-semibold">Bounced</p>
            <p class="text-3xl font-bold text-error">{statsData.bounced}</p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-error/10 flex items-center justify-center">
            <XCircle class="h-6 w-6 text-error" />
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-base-100 shadow-sm">
      <div class="card-body p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-base-content/60 uppercase font-semibold">Total Emails</p>
            <p class="text-3xl font-bold text-info">{statsData.total}</p>
          </div>
          <div class="w-12 h-12 rounded-lg bg-info/10 flex items-center justify-center">
            <Mail class="h-6 w-6 text-info" />
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
          placeholder="Search emails..."
          class="input input-bordered input-sm w-64"
          bind:value={searchQuery}
        />
      </div>
    </div>

    <select class="select select-bordered select-sm w-48" bind:value={filterStatus}>
      <option value="all">All Status</option>
      <option value="delivered">Delivered</option>
      <option value="bounced">Bounced</option>
      <option value="complained">Complained</option>
      <option value="opened">Opened</option>
    </select>
  </div>

  <!-- Emails Table -->
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body">
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>To</th>
              <th>From</th>
              <th>Subject</th>
              <th>Sent</th>
              <th>Status</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#if emails.loading}
              <tr>
                <td colspan="6" class="text-center py-8">
                  <span class="loading loading-spinner loading-md"></span>
                </td>
              </tr>
            {:else if filteredEmails.length > 0}
              {#each filteredEmails as email}
                <tr class="hover">
                  <td>
                    <div class="flex flex-col gap-1">
                      {#if email.to && email.to.length > 0}
                        <span class="font-medium">{email.to[0]}</span>
                        {#if email.to.length > 1}
                          <span class="text-xs text-base-content/60">+{email.to.length - 1} more</span>
                        {/if}
                      {:else}
                        <span class="text-base-content/50">N/A</span>
                      {/if}
                    </div>
                  </td>
                  <td class="text-sm">{email.from || 'N/A'}</td>
                  <td>
                    <div class="max-w-xs truncate font-medium">{email.subject || 'No subject'}</div>
                  </td>
                  <td>
                    <div class="text-sm">{getTimeAgo(email.created_at)}</div>
                    <div class="text-xs text-base-content/60">{formatDate(email.created_at)}</div>
                  </td>
                  <td>
                    {#if email.last_event}
                      {@const badge = getStatusBadge(email.last_event)}
                      <span class="badge {badge.class} badge-sm">{badge.label}</span>
                    {:else}
                      <span class="badge badge-neutral badge-sm">Sent</span>
                    {/if}
                  </td>
                  <td class="text-right">
                    <button
                      class="btn btn-ghost btn-sm btn-square"
                      onclick={() => openEmailModal(email)}
                      title="View email"
                    >
                      <Eye class="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              {/each}
            {:else}
              <tr>
                <td colspan="6" class="text-center py-8">
                  <div class="flex flex-col items-center gap-2">
                    <Mail class="h-12 w-12 text-base-content/30" />
                    <p class="text-base-content/70">No emails found</p>
                    {#if searchQuery || filterStatus !== 'all'}
                      <p class="text-sm text-base-content/50">Try adjusting your filters</p>
                    {:else}
                      <p class="text-sm text-base-content/50">Send an email to see it here</p>
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

<!-- Email Detail Modal -->
{#if showEmailModal && selectedEmail}
  <div class="modal modal-open">
    <div class="modal-box max-w-3xl">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg">Email Details</h3>
        <button class="btn btn-ghost btn-sm btn-circle" onclick={closeEmailModal}>
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="space-y-4">
        <!-- Email Header Info -->
        <div class="bg-base-200 p-4 rounded-lg space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-base-content/70">To:</span>
            <span class="font-medium">{selectedEmail.to?.join(', ') || 'N/A'}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-base-content/70">From:</span>
            <span class="font-medium">{selectedEmail.from || 'N/A'}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-base-content/70">Subject:</span>
            <span class="font-medium">{selectedEmail.subject || 'No subject'}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-base-content/70">Sent:</span>
            <span class="font-medium">{formatDate(selectedEmail.created_at)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-base-content/70">Status:</span>
            <div>
              {#if selectedEmail.last_event}
                {@const badge = getStatusBadge(selectedEmail.last_event)}
                <span class="badge {badge.class} badge-sm">{badge.label}</span>
              {:else}
                <span class="badge badge-neutral badge-sm">Sent</span>
              {/if}
            </div>
          </div>
          {#if selectedEmail.cc && selectedEmail.cc.length > 0}
            <div class="flex justify-between">
              <span class="text-base-content/70">CC:</span>
              <span class="font-medium">{selectedEmail.cc.join(', ')}</span>
            </div>
          {/if}
          {#if selectedEmail.bcc && selectedEmail.bcc.length > 0}
            <div class="flex justify-between">
              <span class="text-base-content/70">BCC:</span>
              <span class="font-medium">{selectedEmail.bcc.join(', ')}</span>
            </div>
          {/if}
          {#if selectedEmail.reply_to && selectedEmail.reply_to.length > 0}
            <div class="flex justify-between">
              <span class="text-base-content/70">Reply To:</span>
              <span class="font-medium">{selectedEmail.reply_to.join(', ')}</span>
            </div>
          {/if}
        </div>

        <!-- Email Content Tabs -->
        <div class="tabs tabs-boxed">
          <button type="button" class="tab tab-active">HTML Preview</button>
          <button type="button" class="tab">Plain Text</button>
        </div>

        <!-- Email Content -->
        <div class="bg-base-200 p-4 rounded-lg max-h-96 overflow-y-auto">
          {#if selectedEmail.html}
            <div class="bg-white p-4 rounded">
              {@html selectedEmail.html}
            </div>
          {:else if selectedEmail.text}
            <pre class="text-sm whitespace-pre-wrap">{selectedEmail.text}</pre>
          {:else}
            <p class="text-base-content/50 text-center py-8">No content available</p>
          {/if}
        </div>

        <!-- Email ID for debugging -->
        <div class="flex items-center justify-between text-xs text-base-content/60">
          <span>Email ID: <code class="font-mono">{selectedEmail.id}</code></span>
          <a
            href="https://resend.com/emails/{selectedEmail.id}"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-ghost btn-xs"
          >
            <ExternalLink class="h-3 w-3 mr-1" />
            View in Resend
          </a>
        </div>
      </div>

      <div class="modal-action">
        <button class="btn" onclick={closeEmailModal}>Close</button>
      </div>
    </div>
    <button type="button" class="modal-backdrop" onclick={closeEmailModal} aria-label="Close modal"></button>
  </div>
{/if}
