<script lang="ts">
  import type { PageData } from './$types';
  import { ArrowRight } from 'lucide-svelte';
  import { MetricCard, Card } from '@kuratchi/ui';
  import { getUsers } from '$lib/functions/users.remote';
  import { getSites } from '$lib/functions/sites.remote';

  let { data }: { data: PageData } = $props();

  // Load real data
  const users = getUsers();
  const sites = getSites();

  // Calculate metrics
  const userCount = $derived(users.current?.length || 0);
  const siteCount = $derived(sites.current?.length || 0);

  // Key metrics
  const metrics = $derived([
    { label: 'Sites', value: siteCount.toString(), href: '/sites' },
    { label: 'Users', value: userCount.toString(), href: '/users' }
  ]);

  // Recent activity
  const recentActivity = $derived.by(() => {
    const activities: any[] = [];

    if (users.current) {
      users.current.slice(0, 3).forEach((user: any) => {
        activities.push({
          title: `Created user ${user.email}`,
          time: new Date(user.created_at).toLocaleDateString(),
          type: 'user'
        });
      });
    }

    if (sites.current) {
      sites.current.slice(0, 2).forEach((site: any) => {
        activities.push({
          title: `Created site "${site.name}"`,
          time: new Date(site.created_at).toLocaleDateString(),
          type: 'site'
        });
      });
    }

    return activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5);
  });

  // Quick actions
  const actions = [
    { label: 'Create Site', href: '/sites' },
    { label: 'Add User', href: '/users' },
    { label: 'Send Email', href: '/emails' },
    { label: 'Settings', href: '/settings' }
  ];
</script>

<svelte:head>
  <title>Overview - Kuratchi</title>
</svelte:head>

<div class="kui-overview">
  <header class="kui-overview__header">
    <div>
      <p class="kui-overview__eyebrow">Dashboard</p>
      <h1 class="kui-overview__title">Overview</h1>
      <p class="kui-overview__description">Welcome back. Here's what's happening with your account.</p>
    </div>
  </header>

  <section class="kui-overview__metrics">
    {#each metrics as metric}
      <a class="kui-overview__metricCard" href={metric.href}>
        <div class="kui-overview__metricContent">
          <p class="kui-overview__metricLabel">{metric.label}</p>
          <p class="kui-overview__metricValue">{metric.value}</p>
        </div>
        <ArrowRight class="kui-overview__metricArrow" />
      </a>
    {/each}
  </section>

  <section class="kui-overview__grid">
    <div class="kui-overview__activityPanel">
      <div class="kui-overview__panelHeader">
        <h2 class="kui-overview__panelTitle">Recent Activity</h2>
      </div>
      {#if recentActivity.length > 0}
        <div class="kui-overview__activity">
          {#each recentActivity as activity}
            <div class="kui-overview__activityItem">
              <span class="kui-overview__activityDot" data-type={activity.type}></span>
              <div class="kui-overview__activityContent">
                <p class="kui-overview__activityTitle">{activity.title}</p>
                <p class="kui-overview__activityMeta">{activity.time}</p>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="kui-overview__emptyState">No recent activity</p>
      {/if}
    </div>

    <div class="kui-overview__actionsPanel">
      <div class="kui-overview__panelHeader">
        <h2 class="kui-overview__panelTitle">Quick Actions</h2>
      </div>
      <div class="kui-overview__actions">
        {#each actions as action}
          <a class="kui-overview__actionItem" href={action.href}>
            <span>{action.label}</span>
            <ArrowRight />
          </a>
        {/each}
      </div>
      <div class="kui-overview__actionFooter">
        <a class="kui-overview__primaryButton" href="/sites">
          Go to Sites
        </a>
      </div>
    </div>
  </section>
</div>

<style>
  .kui-overview {
    display: grid;
    gap: 2rem;
    padding: 2rem;
    max-width: 100%;
  }

  .kui-overview__header {
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 1.5rem;
  }

  .kui-overview__eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #6b7280;
    font-weight: 600;
    font-size: 0.75rem;
    margin: 0 0 0.5rem 0;
  }

  .kui-overview__title {
    margin: 0 0 0.5rem 0;
    font-size: 2rem;
    font-weight: 700;
    color: #111827;
  }

  .kui-overview__description {
    margin: 0;
    color: #6b7280;
    font-size: 0.95rem;
  }

  .kui-overview__metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1rem;
  }

  .kui-overview__metricCard {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    background: white;
    text-decoration: none;
    color: inherit;
    transition: all 150ms ease;
  }

  .kui-overview__metricCard:hover {
    border-color: #d1d5db;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  }

  .kui-overview__metricContent {
    flex: 1;
  }

  .kui-overview__metricLabel {
    margin: 0;
    font-size: 0.875rem;
    color: #6b7280;
    font-weight: 500;
  }

  .kui-overview__metricValue {
    margin: 0.5rem 0 0 0;
    font-size: 1.875rem;
    font-weight: 700;
    color: #111827;
  }

  .kui-overview__metricArrow {
    width: 1.25rem;
    height: 1.25rem;
    color: #d1d5db;
    margin-left: 1rem;
    flex-shrink: 0;
    transition: color 150ms ease;
  }

  .kui-overview__metricCard:hover .kui-overview__metricArrow {
    color: #9ca3af;
  }

  .kui-overview__grid {
    display: grid;
    gap: 1.5rem;
    grid-template-columns: 2fr 1fr;
  }

  .kui-overview__activityPanel,
  .kui-overview__actionsPanel {
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    background: white;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .kui-overview__panelHeader {
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .kui-overview__panelTitle {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
  }

  .kui-overview__activity {
    display: grid;
    gap: 0;
  }

  .kui-overview__activityItem {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #f3f4f6;
  }

  .kui-overview__activityItem:last-child {
    border-bottom: none;
  }

  .kui-overview__activityDot {
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 999px;
    background: #3b82f6;
    margin-top: 0.35rem;
    flex-shrink: 0;
  }

  .kui-overview__activityDot[data-type="site"] {
    background: #6366f1;
  }

  .kui-overview__activityDot[data-type="user"] {
    background: #8b5cf6;
  }

  .kui-overview__activityContent {
    min-width: 0;
  }

  .kui-overview__activityTitle {
    margin: 0;
    font-weight: 500;
    color: #111827;
    font-size: 0.9375rem;
  }

  .kui-overview__activityMeta {
    margin: 0.25rem 0 0 0;
    color: #9ca3af;
    font-size: 0.875rem;
  }

  .kui-overview__emptyState {
    color: #9ca3af;
    margin: 0;
    padding: 1.5rem;
    text-align: center;
    font-size: 0.875rem;
  }

  .kui-overview__actions {
    display: grid;
    gap: 0.5rem;
    padding: 1rem 1.5rem;
    flex: 1;
  }

  .kui-overview__actionItem {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    text-decoration: none;
    color: #111827;
    background: #f9fafb;
    transition: all 150ms ease;
    font-weight: 500;
    font-size: 0.9375rem;
  }

  .kui-overview__actionItem:hover {
    border-color: #d1d5db;
    background: white;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  }

  .kui-overview__actionItem svg {
    width: 1rem;
    height: 1rem;
    color: #d1d5db;
    margin-left: 0.5rem;
    flex-shrink: 0;
    transition: color 150ms ease;
  }

  .kui-overview__actionItem:hover svg {
    color: #9ca3af;
  }

  .kui-overview__actionFooter {
    padding: 1rem 1.5rem;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: flex-end;
  }

  .kui-overview__primaryButton {
    padding: 0.625rem 1rem;
    background: #111827;
    color: white;
    border: 1px solid #111827;
    border-radius: 0.375rem;
    text-decoration: none;
    font-weight: 500;
    font-size: 0.875rem;
    transition: all 150ms ease;
    display: inline-block;
  }

  .kui-overview__primaryButton:hover {
    background: #1f2937;
    border-color: #1f2937;
  }

  @media (max-width: 1024px) {
    .kui-overview__grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .kui-overview {
      padding: 1rem;
      gap: 1.5rem;
    }

    .kui-overview__metrics {
      grid-template-columns: 1fr;
    }

    .kui-overview__title {
      font-size: 1.5rem;
    }
  }
</style>
