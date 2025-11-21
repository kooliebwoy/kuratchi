<script lang="ts">
  import { goto } from '$app/navigation';
  import { Mail, Zap, Users, FileText, BarChart3, ArrowRight, Globe, CheckCircle, Circle, ChevronDown } from 'lucide-svelte';
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
  
  const activeCampaigns = $derived(campaigns.filter((c: any) => c.status === 'active').length);
  const totalContacts = $derived(segments.reduce((sum: number, seg: any) => sum + (seg.contactCount ?? 0), 0));
  const verifiedDomains = $derived(domains.filter(d => d.emailVerified));
  const hasVerifiedDomain = $derived(verifiedDomains.length > 0);
  const hasAnyDomain = $derived(domains.length > 0);

  // Domain context switching
  let selectedDomain = $state<any>(null);
  $effect(() => {
    if (verifiedDomains.length > 0 && !selectedDomain) {
      selectedDomain = verifiedDomains[0];
    }
  });

  // Setup progress tracking
  const setupSteps = $derived([
    { 
      id: 'domain', 
      title: 'Add & Verify Domain', 
      description: 'Set up your email domain',
      completed: hasVerifiedDomain,
      link: '/domains'
    },
    { 
      id: 'campaign', 
      title: 'Create First Campaign', 
      description: 'Build your first drip sequence',
      completed: campaigns.length > 0,
      link: '/emails/drip'
    },
    { 
      id: 'launch', 
      title: 'Launch Campaign', 
      description: 'Start sending emails',
      completed: activeCampaigns > 0,
      link: '/emails/drip'
    }
  ]);
  
  const setupComplete = $derived(setupSteps.every(step => step.completed));
  const completedSteps = $derived(setupSteps.filter(step => step.completed).length);
</script>

<svelte:head>
  <title>Email Dashboard - Kuratchi</title>
</svelte:head>

<div class="kui-email-dashboard">
  <!-- Getting Started Section (show if not complete) -->
  {#if !setupComplete}
    <div class="kui-email-dashboard__gettingStarted">
      <div class="kui-email-dashboard__gettingStarted__header">
        <div>
          <h2 class="kui-email-dashboard__title">Getting Started with Email</h2>
          <p class="kui-email-dashboard__subtitle">
            {completedSteps} of {setupSteps.length} steps completed
          </p>
        </div>
        <div class="kui-email-dashboard__progress" role="progressbar" aria-valuenow={completedSteps} aria-valuemin={0} aria-valuemax={setupSteps.length}>
          <div class="kui-email-dashboard__progressInner" style="--value: {(completedSteps / setupSteps.length) * 100}%">
            {completedSteps}/{setupSteps.length}
          </div>
        </div>
      </div>
      
      <div class="kui-email-dashboard__setupGrid">
        {#each setupSteps as step, index}
          <a 
            href={step.link}
            class="kui-email-dashboard__setupCard"
          >
            <div class="kui-email-dashboard__setupCard__content">
              <div class="kui-email-dashboard__setupCard__icon">
                {#if step.completed}
                  <CheckCircle class="kui-email-dashboard__checkmark" />
                {:else}
                  <span class="kui-email-dashboard__stepNumber">{index + 1}</span>
                {/if}
              </div>
              <div class="kui-email-dashboard__setupCard__text">
                <h3 class="kui-email-dashboard__setupCard__title">{step.title}</h3>
                <p class="kui-email-dashboard__setupCard__description">{step.description}</p>
                {#if !step.completed}
                  <div class="kui-email-dashboard__setupCard__cta">
                    <span>Get started →</span>
                  </div>
                {/if}
              </div>
            </div>
          </a>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Key Metrics -->
  <div class="kui-email-dashboard__metrics">
    <div class="kui-email-dashboard__metricCard">
      <div class="kui-email-dashboard__metricCard__content">
        <div>
          <p class="kui-email-dashboard__metricLabel">Emails Sent</p>
          <p class="kui-email-dashboard__metricValue">{statsData.sent.toLocaleString()}</p>
          <p class="kui-email-dashboard__metricChange kui-email-dashboard__metricChange--positive">+12% vs last month</p>
        </div>
        <div class="kui-email-dashboard__metricIcon kui-email-dashboard__metricIcon--success">
          <Mail />
        </div>
      </div>
    </div>

    <div class="kui-email-dashboard__metricCard">
      <div class="kui-email-dashboard__metricCard__content">
        <div>
          <p class="kui-email-dashboard__metricLabel">Active Campaigns</p>
          <p class="kui-email-dashboard__metricValue">{activeCampaigns}</p>
          <p class="kui-email-dashboard__metricChange">{campaigns.length} total</p>
        </div>
        <div class="kui-email-dashboard__metricIcon kui-email-dashboard__metricIcon--primary">
          <Zap />
        </div>
      </div>
    </div>

    <div class="kui-email-dashboard__metricCard">
      <div class="kui-email-dashboard__metricCard__content">
        <div>
          <p class="kui-email-dashboard__metricLabel">Total Contacts</p>
          <p class="kui-email-dashboard__metricValue">{totalContacts.toLocaleString()}</p>
          <p class="kui-email-dashboard__metricChange">{segments.length} segments</p>
        </div>
        <div class="kui-email-dashboard__metricIcon kui-email-dashboard__metricIcon--info">
          <Users />
        </div>
      </div>
    </div>

    <div class="kui-email-dashboard__metricCard">
      <div class="kui-email-dashboard__metricCard__content">
        <div>
          <p class="kui-email-dashboard__metricLabel">Failed</p>
          <p class="kui-email-dashboard__metricValue">{statsData.failed}</p>
          <p class="kui-email-dashboard__metricChange kui-email-dashboard__metricChange--error">-2% vs last month</p>
        </div>
        <div class="kui-email-dashboard__metricIcon kui-email-dashboard__metricIcon--error">
          <BarChart3 />
        </div>
      </div>
    </div>
  </div>

  <!-- Navigation Cards -->
  <div class="kui-email-dashboard__navGrid">
    <!-- Drip Campaigns -->
    <a href="/emails/drip" class="kui-email-dashboard__navCard kui-email-dashboard__navCard--drip">
      <div class="kui-email-dashboard__navCard__content">
        <div class="kui-email-dashboard__navCard__header">
          <div>
            <h3 class="kui-email-dashboard__navCard__title">
              <Zap /> Drip Campaigns
            </h3>
            <p class="kui-email-dashboard__navCard__description">Build automated email sequences and nurture your audience.</p>
          </div>
          <ArrowRight class="kui-email-dashboard__navCard__arrow" />
        </div>
        <div class="kui-email-dashboard__navCard__footer">
          <p class="kui-email-dashboard__navCard__meta">{activeCampaigns} active • {campaigns.length} total</p>
        </div>
      </div>
    </a>

    <!-- Broadcasts -->
    <a href="/emails/broadcast" class="kui-email-dashboard__navCard kui-email-dashboard__navCard--broadcast">
      <div class="kui-email-dashboard__navCard__content">
        <div class="kui-email-dashboard__navCard__header">
          <div>
            <h3 class="kui-email-dashboard__navCard__title">
              <Mail /> Broadcasts
            </h3>
            <p class="kui-email-dashboard__navCard__description">Send direct emails to your audiences instantly.</p>
          </div>
          <ArrowRight class="kui-email-dashboard__navCard__arrow" />
        </div>
        <div class="kui-email-dashboard__navCard__footer">
          <p class="kui-email-dashboard__navCard__meta">One-time campaigns</p>
        </div>
      </div>
    </a>

    <!-- Segments -->
    <a href="/emails/segments" class="kui-email-dashboard__navCard kui-email-dashboard__navCard--segments">
      <div class="kui-email-dashboard__navCard__content">
        <div class="kui-email-dashboard__navCard__header">
          <div>
            <h3 class="kui-email-dashboard__navCard__title">
              <Users /> Segments
            </h3>
            <p class="kui-email-dashboard__navCard__description">Organize and manage your contact lists and audiences.</p>
          </div>
          <ArrowRight class="kui-email-dashboard__navCard__arrow" />
        </div>
        <div class="kui-email-dashboard__navCard__footer">
          <p class="kui-email-dashboard__navCard__meta">{segments.length} segments • {totalContacts.toLocaleString()} contacts</p>
        </div>
      </div>
    </a>

    <!-- Templates -->
    <a href="/emails/templates" class="kui-email-dashboard__navCard kui-email-dashboard__navCard--templates">
      <div class="kui-email-dashboard__navCard__content">
        <div class="kui-email-dashboard__navCard__header">
          <div>
            <h3 class="kui-email-dashboard__navCard__title">
              <FileText /> Templates
            </h3>
            <p class="kui-email-dashboard__navCard__description">Create and manage reusable email templates.</p>
          </div>
          <ArrowRight class="kui-email-dashboard__navCard__arrow" />
        </div>
        <div class="kui-email-dashboard__navCard__footer">
          <p class="kui-email-dashboard__navCard__meta">Ready to use in campaigns</p>
        </div>
      </div>
    </a>

    <!-- Domains -->
    <a href="/domains" class="kui-email-dashboard__navCard kui-email-dashboard__navCard--domains">
      <div class="kui-email-dashboard__navCard__content">
        <div class="kui-email-dashboard__navCard__header">
          <div>
            <h3 class="kui-email-dashboard__navCard__title">
              <Globe /> Domains
            </h3>
            <p class="kui-email-dashboard__navCard__description">Verify domains for sending emails from your own domain.</p>
          </div>
          <ArrowRight class="kui-email-dashboard__navCard__arrow" />
        </div>
        <div class="kui-email-dashboard__navCard__footer">
          <p class="kui-email-dashboard__navCard__meta">DNS verification required</p>
        </div>
      </div>
    </a>
  </div>

  <!-- Quick Stats -->
  <div class="kui-email-dashboard__overview">
    <h3 class="kui-email-dashboard__overviewTitle">Performance Overview</h3>
    <div class="kui-email-dashboard__overviewGrid">
      <div class="kui-email-dashboard__overviewStat">
        <p class="kui-email-dashboard__overviewLabel">Total Emails</p>
        <p class="kui-email-dashboard__overviewValue">{statsData.total.toLocaleString()}</p>
      </div>
      <div class="kui-email-dashboard__overviewStat">
        <p class="kui-email-dashboard__overviewLabel">Last 24h</p>
        <p class="kui-email-dashboard__overviewValue">{statsData.last24h.toLocaleString()}</p>
      </div>
      <div class="kui-email-dashboard__overviewStat">
        <p class="kui-email-dashboard__overviewLabel">Success Rate</p>
        <p class="kui-email-dashboard__overviewValue">{statsData.total > 0 ? Math.round((statsData.sent / statsData.total) * 100) : 0}%</p>
      </div>
      <div class="kui-email-dashboard__overviewStat">
        <p class="kui-email-dashboard__overviewLabel">Pending</p>
        <p class="kui-email-dashboard__overviewValue">{statsData.pending.toLocaleString()}</p>
      </div>
    </div>
  </div>
</div>

<style>
  .kui-email-dashboard {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .kui-email-dashboard__gettingStarted {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 50%, rgba(236, 72, 153, 0.05) 100%);
    border: 2px solid rgba(99, 102, 241, 0.2);
    border-radius: 0.75rem;
    padding: 1.5rem;
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  }

  .kui-email-dashboard__gettingStarted__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .kui-email-dashboard__title {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
  }

  .kui-email-dashboard__subtitle {
    color: rgba(0, 0, 0, 0.7);
    margin-top: 0.25rem;
    margin: 0;
  }

  .kui-email-dashboard__progress {
    width: 5rem;
    height: 5rem;
    border-radius: 50%;
    background: conic-gradient(
      #6366f1 0deg,
      #6366f1 calc(var(--value) * 3.6deg),
      rgba(0, 0, 0, 0.1) calc(var(--value) * 3.6deg)
    );
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .kui-email-dashboard__progressInner {
    width: 4.5rem;
    height: 4.5rem;
    border-radius: 50%;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    color: #6366f1;
    font-size: 0.875rem;
  }

  .kui-email-dashboard__setupGrid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
  }

  .kui-email-dashboard__setupCard {
    background: white;
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 0.5rem;
    padding: 1rem;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    text-decoration: none;
    transition: all 150ms ease;
  }

  .kui-email-dashboard__setupCard:hover {
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    border-color: rgba(99, 102, 241, 0.4);
  }

  .kui-email-dashboard__setupCard__content {
    display: flex;
    gap: 0.75rem;
  }

  .kui-email-dashboard__setupCard__icon {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-weight: 600;
  }

  .kui-email-dashboard__setupCard__icon {
    background: rgba(0, 0, 0, 0.1);
    color: rgba(0, 0, 0, 0.7);
  }

  .kui-email-dashboard__setupCard.completed .kui-email-dashboard__setupCard__icon {
    background: #10b981;
    color: white;
  }

  .kui-email-dashboard__checkmark {
    width: 1.25rem;
    height: 1.25rem;
  }

  .kui-email-dashboard__stepNumber {
    font-size: 0.875rem;
  }

  .kui-email-dashboard__setupCard__text {
    flex: 1;
    min-width: 0;
  }

  .kui-email-dashboard__setupCard__title {
    font-weight: 600;
    font-size: 0.875rem;
    margin: 0 0 0.25rem 0;
  }

  .kui-email-dashboard__setupCard__description {
    font-size: 0.75rem;
    color: rgba(0, 0, 0, 0.6);
    margin: 0;
  }

  .kui-email-dashboard__setupCard__cta {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: #6366f1;
    font-weight: 500;
  }

  .kui-email-dashboard__metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
  }

  .kui-email-dashboard__metricCard {
    background: white;
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 0.5rem;
    padding: 1.5rem;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  }

  .kui-email-dashboard__metricCard__content {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .kui-email-dashboard__metricLabel {
    font-size: 0.75rem;
    color: rgba(0, 0, 0, 0.6);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
  }

  .kui-email-dashboard__metricValue {
    font-size: 1.875rem;
    font-weight: 700;
    margin-top: 0.5rem;
    margin: 0.5rem 0 0 0;
  }

  .kui-email-dashboard__metricChange {
    font-size: 0.75rem;
    color: rgba(0, 0, 0, 0.5);
    margin-top: 0.25rem;
    margin: 0.25rem 0 0 0;
  }

  .kui-email-dashboard__metricChange--positive {
    color: #10b981;
  }

  .kui-email-dashboard__metricChange--error {
    color: #ef4444;
  }

  .kui-email-dashboard__metricIcon {
    width: 3rem;
    height: 3rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .kui-email-dashboard__metricIcon :global(svg) {
    width: 1.5rem;
    height: 1.5rem;
  }

  .kui-email-dashboard__metricIcon--success {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
  }

  .kui-email-dashboard__metricIcon--primary {
    background: rgba(99, 102, 241, 0.1);
    color: #6366f1;
  }

  .kui-email-dashboard__metricIcon--info {
    background: rgba(59, 130, 246, 0.1);
    color: #3b82f6;
  }

  .kui-email-dashboard__metricIcon--error {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  .kui-email-dashboard__navGrid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.5rem;
  }

  @media (min-width: 1024px) {
    .kui-email-dashboard__navGrid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (min-width: 1280px) {
    .kui-email-dashboard__navGrid {
      grid-template-columns: repeat(5, 1fr);
    }
  }

  .kui-email-dashboard__navCard {
    background: white;
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 0.5rem;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    text-decoration: none;
    color: inherit;
    transition: all 150ms ease;
    display: flex;
    flex-direction: column;
  }

  .kui-email-dashboard__navCard:hover {
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    border-color: rgba(99, 102, 241, 0.4);
  }

  .kui-email-dashboard__navCard__content {
    display: flex;
    flex-direction: column;
    padding: 1.25rem;
    height: 100%;
  }

  .kui-email-dashboard__navCard__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .kui-email-dashboard__navCard__title {
    font-size: 1.125rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 0.5rem 0;
  }

  .kui-email-dashboard__navCard__title :global(svg) {
    width: 1.25rem;
    height: 1.25rem;
  }

  .kui-email-dashboard__navCard__description {
    font-size: 0.875rem;
    color: rgba(0, 0, 0, 0.7);
    margin: 0;
  }

  .kui-email-dashboard__navCard__arrow {
    width: 1.25rem;
    height: 1.25rem;
    color: rgba(0, 0, 0, 0.3);
    flex-shrink: 0;
    transition: color 150ms ease;
  }

  .kui-email-dashboard__navCard:hover .kui-email-dashboard__navCard__arrow {
    color: #6366f1;
  }

  .kui-email-dashboard__navCard__footer {
    margin-top: auto;
    padding-top: 1rem;
    border-top: 1px solid rgba(0, 0, 0, 0.1);
  }

  .kui-email-dashboard__navCard__meta {
    font-size: 0.75rem;
    color: rgba(0, 0, 0, 0.6);
    margin: 0;
  }

  .kui-email-dashboard__overview {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(99, 102, 241, 0.1) 100%);
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: 0.5rem;
    padding: 1.5rem;
  }

  .kui-email-dashboard__overviewTitle {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
  }

  .kui-email-dashboard__overviewGrid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
  }

  .kui-email-dashboard__overviewStat {
    padding: 0.5rem 0;
  }

  .kui-email-dashboard__overviewLabel {
    font-size: 0.75rem;
    color: rgba(0, 0, 0, 0.6);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
  }

  .kui-email-dashboard__overviewValue {
    font-size: 1.5rem;
    font-weight: 700;
    margin-top: 0.25rem;
    margin: 0.25rem 0 0 0;
  }
</style>
