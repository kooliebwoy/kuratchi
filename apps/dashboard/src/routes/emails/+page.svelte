<script lang="ts">
  import { Mail, Zap, Users, FileText, Globe, ArrowRight } from '@lucide/svelte';
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

  // Setup progress tracking
  const setupSteps = $derived([
    { 
      id: 'domain', 
      title: 'Add & Verify Domain', 
      completed: hasVerifiedDomain,
      link: '/domains'
    },
    { 
      id: 'campaign', 
      title: 'Create First Campaign', 
      completed: campaigns.length > 0,
      link: '/emails/drip'
    },
    { 
      id: 'launch', 
      title: 'Launch Campaign', 
      completed: activeCampaigns > 0,
      link: '/emails/drip'
    }
  ]);
  
  const setupComplete = $derived(setupSteps.every(step => step.completed));
  const completedSteps = $derived(setupSteps.filter(step => step.completed).length);
</script>

<svelte:head>
  <title>Email Overview - Kuratchi</title>
</svelte:head>

<div class="kui-email-overview">
  <!-- Getting Started Section (show if not complete) -->
  {#if !setupComplete}
    <section class="kui-section kui-section--setup">
      <div class="kui-section-header">
        <div>
          <h2>Get Started with Email</h2>
          <p class="kui-section-subtitle">{completedSteps} of {setupSteps.length} steps completed</p>
        </div>
        <div class="kui-progress-ring" role="progressbar" aria-valuenow={completedSteps} aria-valuemin={0} aria-valuemax={setupSteps.length} style="--progress: {(completedSteps / setupSteps.length) * 100}%">
          <span>{completedSteps}/{setupSteps.length}</span>
        </div>
      </div>

      <div class="kui-steps-grid">
        {#each setupSteps as step, index}
          <a href={step.link} class={`kui-step ${step.completed ? 'kui-step--completed' : ''}`}>
            <div class="kui-step-icon">
              {step.completed ? '✓' : index + 1}
            </div>
            <div class="kui-step-content">
              <h3>{step.title}</h3>
            </div>
            <ArrowRight class="kui-step-arrow" />
          </a>
        {/each}
      </div>
    </section>
  {/if}

  <!-- Quick Navigation -->
  <section>
    <h3 class="kui-section-title">Quick Access</h3>
    <div class="kui-nav-grid">
      <a href="/emails/drip" class="kui-nav-card">
        <div class="kui-nav-icon kui-nav-icon--drip">
          <Zap />
        </div>
        <div class="kui-nav-content">
          <h4>Drip Campaigns</h4>
          <p>Build automated sequences</p>
        </div>
        <ArrowRight class="kui-nav-arrow" />
      </a>

      <a href="/emails/broadcast" class="kui-nav-card">
        <div class="kui-nav-icon kui-nav-icon--broadcast">
          <Mail />
        </div>
        <div class="kui-nav-content">
          <h4>Broadcasts</h4>
          <p>Send direct emails</p>
        </div>
        <ArrowRight class="kui-nav-arrow" />
      </a>

      <a href="/emails/segments" class="kui-nav-card">
        <div class="kui-nav-icon kui-nav-icon--segments">
          <Users />
        </div>
        <div class="kui-nav-content">
          <h4>Segments</h4>
          <p>Organize contacts</p>
        </div>
        <ArrowRight class="kui-nav-arrow" />
      </a>

      <a href="/emails/templates" class="kui-nav-card">
        <div class="kui-nav-icon kui-nav-icon--templates">
          <FileText />
        </div>
        <div class="kui-nav-content">
          <h4>Templates</h4>
          <p>Manage templates</p>
        </div>
        <ArrowRight class="kui-nav-arrow" />
      </a>

      <a href="/domains" class="kui-nav-card">
        <div class="kui-nav-icon kui-nav-icon--domains">
          <Globe />
        </div>
        <div class="kui-nav-content">
          <h4>Domains</h4>
          <p>Verify domains</p>
        </div>
        <ArrowRight class="kui-nav-arrow" />
      </a>
    </div>
  </section>
</div>

<style>
  .kui-email-overview {
    display: grid;
    gap: 2rem;
  }

  .kui-section {
    background: var(--kui-color-surface);
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-lg);
    padding: 1.5rem;
  }

  .kui-section--setup {
    background: linear-gradient(135deg, rgba(88, 76, 217, 0.08) 0%, rgba(88, 76, 217, 0.04) 100%);
    border-color: rgba(88, 76, 217, 0.15);
  }

  .kui-section-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 2rem;
    margin-bottom: 1.5rem;
  }

  .kui-section-header h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--kui-color-text);
  }

  .kui-section-subtitle {
    margin: 0;
    font-size: 0.9rem;
    color: var(--kui-color-muted);
  }

  .kui-progress-ring {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 5rem;
    height: 5rem;
    border-radius: 50%;
    background: conic-gradient(
      var(--kui-color-primary) 0deg,
      var(--kui-color-primary) calc(var(--progress) * 3.6deg),
      rgba(88, 76, 217, 0.1) calc(var(--progress) * 3.6deg)
    );
    flex-shrink: 0;
  }

  .kui-progress-ring span {
    width: 4.5rem;
    height: 4.5rem;
    border-radius: 50%;
    background: var(--kui-color-surface);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--kui-color-primary);
  }

  .kui-steps-grid {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }

  .kui-step {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--kui-color-surface-muted);
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    text-decoration: none;
    color: inherit;
    transition: all var(--kui-duration-base) ease;
  }

  .kui-step:hover {
    background: var(--kui-color-surface);
    border-color: var(--kui-color-primary);
    box-shadow: var(--kui-shadow-xs);
  }

  .kui-step--completed .kui-step-icon {
    background: var(--kui-color-success);
    color: #fff;
  }

  .kui-step-icon {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(88, 76, 217, 0.1);
    color: var(--kui-color-primary);
    font-weight: 600;
    font-size: 0.875rem;
    flex-shrink: 0;
  }

  .kui-step-content h3 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--kui-color-text);
  }

  .kui-step-arrow {
    width: 1rem;
    height: 1rem;
    color: var(--kui-color-muted);
    margin-left: auto;
    transition: color var(--kui-duration-base) ease;
  }

  .kui-step:hover .kui-step-arrow {
    color: var(--kui-color-primary);
  }

  .kui-section-title {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--kui-color-text);
  }

  .kui-nav-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }

  .kui-nav-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem;
    background: var(--kui-color-surface);
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    text-decoration: none;
    color: inherit;
    transition: all var(--kui-duration-base) ease;
  }

  .kui-nav-card:hover {
    border-color: var(--kui-color-primary);
    box-shadow: var(--kui-shadow-sm);
  }

  .kui-nav-icon {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: var(--kui-radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .kui-nav-icon :global(svg) {
    width: 1.25rem;
    height: 1.25rem;
  }

  .kui-nav-icon--drip {
    background: rgba(168, 85, 247, 0.12);
    color: #a855f7;
  }

  .kui-nav-icon--broadcast {
    background: rgba(34, 197, 94, 0.12);
    color: #22c55e;
  }

  .kui-nav-icon--segments {
    background: rgba(59, 130, 246, 0.12);
    color: #3b82f6;
  }

  .kui-nav-icon--templates {
    background: rgba(245, 158, 11, 0.12);
    color: #f59e0b;
  }

  .kui-nav-icon--domains {
    background: rgba(236, 72, 153, 0.12);
    color: #ec4899;
  }

  .kui-nav-content {
    flex: 1;
  }

  .kui-nav-content h4 {
    margin: 0 0 0.25rem 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--kui-color-text);
  }

  .kui-nav-content p {
    margin: 0;
    font-size: 0.85rem;
    color: var(--kui-color-muted);
  }

  .kui-nav-arrow {
    width: 1.25rem;
    height: 1.25rem;
    color: var(--kui-color-muted);
    flex-shrink: 0;
    transition: color var(--kui-duration-base) ease;
  }

  .kui-nav-card:hover .kui-nav-arrow {
    color: var(--kui-color-primary);
  }

  @media (max-width: 768px) {
    .kui-section-header {
      flex-direction: column-reverse;
      gap: 1rem;
    }

    .kui-progress-ring {
      width: 4rem;
      height: 4rem;
    }

    .kui-progress-ring span {
      width: 3.5rem;
      height: 3.5rem;
      font-size: 0.75rem;
    }

    .kui-steps-grid {
      grid-template-columns: 1fr;
    }

    .kui-metrics-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .kui-nav-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
