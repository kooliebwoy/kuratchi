<script lang="ts">
  import { Mail, Zap, Users, TrendingUp, Clock, AlertCircle, CheckCircle2, Send } from '@lucide/svelte';
  import { getEmails, getEmailStats } from '$lib/functions/emails.remote';
  import { listDripCampaigns, listSegments } from '$lib/functions/newsletter.remote';
  import { getEmailDomains } from '$lib/functions/emailDomains.remote';

  const emails = getEmails();
  const stats = getEmailStats();
  const dripResource = listDripCampaigns();
  const segmentsResource = listSegments();
  const domainsResource = getEmailDomains();

  const statsData = $derived(stats.current || { total: 0, sent: 0, failed: 0, pending: 0, last24h: 0 });
  const campaigns = $derived(Array.isArray(dripResource.current) ? dripResource.current : []);
  const segments = $derived(Array.isArray(segmentsResource.current) ? segmentsResource.current : []);
  const domains = $derived(Array.isArray(domainsResource.current) ? domainsResource.current : []);
  const emailList = $derived(Array.isArray(emails.current) ? emails.current : []);
  
  const activeCampaigns = $derived(campaigns.filter((c: any) => c.status === 'active'));
  const totalContacts = $derived(segments.reduce((sum: number, seg: any) => sum + (seg.contactCount ?? 0), 0));
  const verifiedDomains = $derived(domains.filter(d => d.emailVerified));
  const hasVerifiedDomain = $derived(verifiedDomains.length > 0);

  // Recent emails (last 5)
  const recentEmails = $derived(emailList.slice(0, 5));

  // Calculate success rate
  const successRate = $derived(
    statsData.total > 0 
      ? Math.round((statsData.sent / statsData.total) * 100) 
      : 0
  );

  // Check for issues that need attention
  const needsAttention = $derived([
    !hasVerifiedDomain && { type: 'warning', message: 'No verified domain', link: '/domains' },
    statsData.failed > 0 && { type: 'error', message: `${statsData.failed} failed emails`, link: '/emails/broadcast' },
    statsData.pending > 10 && { type: 'info', message: `${statsData.pending} emails pending`, link: '/emails/broadcast' },
  ].filter(Boolean));
</script>

<svelte:head>
  <title>Email Overview - Kuratchi</title>
</svelte:head>

<div class="kui-email-overview">
  <!-- Alerts Section (only show if there are issues) -->
  {#if needsAttention.length > 0}
    <section class="kui-alerts">
      {#each needsAttention as alert}
        <a href={alert.link} class="kui-alert kui-alert--{alert.type}">
          <AlertCircle />
          <span>{alert.message}</span>
        </a>
      {/each}
    </section>
  {/if}

  <!-- Key Metrics -->
  <section class="kui-metrics">
    <div class="kui-metric">
      <div class="kui-metric-icon kui-metric-icon--sent">
        <Send />
      </div>
      <div class="kui-metric-data">
        <span class="kui-metric-value">{statsData.sent.toLocaleString()}</span>
        <span class="kui-metric-label">Emails Sent</span>
      </div>
    </div>

    <div class="kui-metric">
      <div class="kui-metric-icon kui-metric-icon--rate">
        <TrendingUp />
      </div>
      <div class="kui-metric-data">
        <span class="kui-metric-value">{successRate}%</span>
        <span class="kui-metric-label">Delivery Rate</span>
      </div>
    </div>

    <div class="kui-metric">
      <div class="kui-metric-icon kui-metric-icon--contacts">
        <Users />
      </div>
      <div class="kui-metric-data">
        <span class="kui-metric-value">{totalContacts.toLocaleString()}</span>
        <span class="kui-metric-label">Total Contacts</span>
      </div>
    </div>

    <div class="kui-metric">
      <div class="kui-metric-icon kui-metric-icon--active">
        <Zap />
      </div>
      <div class="kui-metric-data">
        <span class="kui-metric-value">{activeCampaigns.length}</span>
        <span class="kui-metric-label">Active Campaigns</span>
      </div>
    </div>
  </section>

  <div class="kui-two-col">
    <!-- Active Campaigns -->
    <section class="kui-card">
      <h3>Active Campaigns</h3>
      {#if activeCampaigns.length === 0}
        <div class="kui-empty">
          <Zap />
          <p>No active campaigns</p>
          <a href="/emails/drip" class="kui-link">Create a campaign →</a>
        </div>
      {:else}
        <ul class="kui-campaign-list">
          {#each activeCampaigns.slice(0, 4) as campaign}
            <li class="kui-campaign-item">
              <div class="kui-campaign-status"></div>
              <div class="kui-campaign-info">
                <span class="kui-campaign-name">{campaign.name}</span>
                <span class="kui-campaign-meta">{campaign.steps?.length || 0} emails in sequence</span>
              </div>
            </li>
          {/each}
        </ul>
        {#if activeCampaigns.length > 4}
          <a href="/emails/drip" class="kui-link">View all {activeCampaigns.length} campaigns →</a>
        {/if}
      {/if}
    </section>

    <!-- Recent Activity -->
    <section class="kui-card">
      <h3>Recent Emails</h3>
      {#if recentEmails.length === 0}
        <div class="kui-empty">
          <Mail />
          <p>No emails sent yet</p>
          <a href="/emails/broadcast" class="kui-link">Send your first email →</a>
        </div>
      {:else}
        <ul class="kui-activity-list">
          {#each recentEmails as email}
            <li class="kui-activity-item">
              <div class="kui-activity-icon" class:kui-activity-icon--success={email.status === 'sent'} class:kui-activity-icon--error={email.status === 'failed'}>
                {#if email.status === 'sent'}
                  <CheckCircle2 />
                {:else if email.status === 'failed'}
                  <AlertCircle />
                {:else}
                  <Clock />
                {/if}
              </div>
              <div class="kui-activity-info">
                <span class="kui-activity-subject">{email.subject || 'No subject'}</span>
                <span class="kui-activity-to">{email.recipient || ''}</span>
              </div>
            </li>
          {/each}
        </ul>
        <a href="/emails/broadcast" class="kui-link">View all emails →</a>
      {/if}
    </section>
  </div>
</div>

<style>
  .kui-email-overview {
    display: grid;
    gap: 1.5rem;
  }

  /* Alerts */
  .kui-alerts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .kui-alert {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    border-radius: var(--kui-radius-md);
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    transition: opacity 150ms ease;
  }

  .kui-alert:hover {
    opacity: 0.85;
  }

  .kui-alert :global(svg) {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }

  .kui-alert--warning {
    background: rgba(245, 158, 11, 0.12);
    color: #d97706;
  }

  .kui-alert--error {
    background: rgba(239, 68, 68, 0.12);
    color: #dc2626;
  }

  .kui-alert--info {
    background: rgba(59, 130, 246, 0.12);
    color: #2563eb;
  }

  /* Metrics */
  .kui-metrics {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }

  .kui-metric {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem;
    background: var(--kui-color-surface);
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
  }

  .kui-metric-icon {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: var(--kui-radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .kui-metric-icon :global(svg) {
    width: 1.25rem;
    height: 1.25rem;
  }

  .kui-metric-icon--sent {
    background: rgba(34, 197, 94, 0.12);
    color: #22c55e;
  }

  .kui-metric-icon--rate {
    background: rgba(59, 130, 246, 0.12);
    color: #3b82f6;
  }

  .kui-metric-icon--contacts {
    background: rgba(168, 85, 247, 0.12);
    color: #a855f7;
  }

  .kui-metric-icon--active {
    background: rgba(245, 158, 11, 0.12);
    color: #f59e0b;
  }

  .kui-metric-data {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .kui-metric-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--kui-color-text);
    line-height: 1.2;
  }

  .kui-metric-label {
    font-size: 0.8rem;
    color: var(--kui-color-muted);
  }

  /* Two Column Layout */
  .kui-two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }

  /* Cards */
  .kui-card {
    background: var(--kui-color-surface);
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-lg);
    padding: 1.25rem;
  }

  .kui-card h3 {
    margin: 0 0 1rem 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--kui-color-text);
  }

  /* Empty State */
  .kui-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    text-align: center;
    color: var(--kui-color-muted);
  }

  .kui-empty :global(svg) {
    width: 2rem;
    height: 2rem;
    margin-bottom: 0.75rem;
    opacity: 0.5;
  }

  .kui-empty p {
    margin: 0 0 0.75rem 0;
    font-size: 0.9rem;
  }

  .kui-link {
    font-size: 0.85rem;
    color: var(--kui-color-primary);
    text-decoration: none;
  }

  .kui-link:hover {
    text-decoration: underline;
  }

  /* Campaign List */
  .kui-campaign-list {
    list-style: none;
    margin: 0 0 1rem 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .kui-campaign-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .kui-campaign-status {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: #22c55e;
    flex-shrink: 0;
  }

  .kui-campaign-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
  }

  .kui-campaign-name {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--kui-color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .kui-campaign-meta {
    font-size: 0.8rem;
    color: var(--kui-color-muted);
  }

  /* Activity List */
  .kui-activity-list {
    list-style: none;
    margin: 0 0 1rem 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .kui-activity-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .kui-activity-icon {
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--kui-color-muted);
    flex-shrink: 0;
  }

  .kui-activity-icon :global(svg) {
    width: 1rem;
    height: 1rem;
  }

  .kui-activity-icon--success {
    color: #22c55e;
  }

  .kui-activity-icon--error {
    color: #ef4444;
  }

  .kui-activity-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
  }

  .kui-activity-subject {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--kui-color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .kui-activity-to {
    font-size: 0.8rem;
    color: var(--kui-color-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (max-width: 1024px) {
    .kui-metrics {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 768px) {
    .kui-metrics {
      grid-template-columns: 1fr;
    }

    .kui-two-col {
      grid-template-columns: 1fr;
    }
  }
</style>
