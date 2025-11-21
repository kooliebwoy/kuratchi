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
      <h1>Overview</h1>
      <p class="kui-overview__lede">Welcome back. Here's what's happening with your account.</p>
    </div>
  </header>

  <section class="kui-overview__metrics">
    {#each metrics as metric, idx}
      <a class="kui-overview__metric" href={metric.href}>
        <MetricCard
          label={metric.label}
          value={metric.value}
          variant={idx === 0 ? 'primary' : 'secondary'}
          class="kui-overview__metric-card"
        />
        <ArrowRight class="kui-overview__metric-icon" />
      </a>
    {/each}
  </section>

  <section class="kui-overview__grid">
    <Card class="kui-panel kui-panel--wide" title="Recent Activity">
      {#if recentActivity.length > 0}
        <div class="kui-activity">
          {#each recentActivity as activity}
            <div class="kui-activity__item">
              <span class="kui-activity__dot" data-type={activity.type}></span>
              <div class="kui-activity__body">
                <p class="kui-activity__title">{activity.title}</p>
                <p class="kui-activity__meta">{activity.time}</p>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="kui-empty">No recent activity</p>
      {/if}
    </Card>

    <Card class="kui-panel" title="Actions">
      <div class="kui-actions">
        {#each actions as action}
          <a class="kui-action" href={action.href}>
            <span>{action.label}</span>
            <ArrowRight />
          </a>
        {/each}
      </div>
      <div class="kui-actions__footer">
        <a class="kui-button kui-button--primary kui-button--size-sm" href="/sites">
          Go to Sites
        </a>
      </div>
    </Card>
  </section>
</div>

<style>
  .kui-overview {
    display: grid;
    gap: var(--kui-spacing-lg);
  }

  .kui-overview__header h1 {
    margin: 0.15rem 0 0.25rem;
    font-size: 1.6rem;
    font-weight: 700;
  }

  .kui-overview__eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--kui-color-muted);
    font-weight: 700;
    font-size: 0.8rem;
    margin: 0;
  }

  .kui-overview__lede {
    margin: 0;
    color: var(--kui-color-muted);
  }

  .kui-overview__metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--kui-spacing-md);
  }

  .kui-overview__metric {
    position: relative;
    display: block;
    text-decoration: none;
    color: inherit;
    transition: transform var(--kui-duration-base) ease, box-shadow var(--kui-duration-base) ease;
  }

  .kui-overview__metric:hover {
    transform: translateY(-2px);
  }

  .kui-overview__metric-card {
    padding-right: calc(var(--kui-spacing-md) * 1.5);
  }

  .kui-overview__metric-icon {
    position: absolute;
    right: var(--kui-spacing-md);
    top: 50%;
    transform: translateY(-50%);
    color: var(--kui-color-muted);
    width: 1.1rem;
    height: 1.1rem;
  }

  .kui-overview__grid {
    display: grid;
    gap: var(--kui-spacing-md);
    grid-template-columns: 2fr 1fr;
  }

  .kui-panel {
    height: 100%;
  }

  .kui-panel .kui-card__body {
    gap: var(--kui-spacing-md);
  }

  .kui-panel--wide .kui-card__body {
    gap: var(--kui-spacing-md);
  }

  .kui-activity {
    display: grid;
    gap: var(--kui-spacing-sm);
  }

  .kui-activity__item {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--kui-spacing-sm);
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--kui-color-border);
  }

  .kui-activity__item:last-child {
    border-bottom: none;
  }

  .kui-activity__dot {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 999px;
    background: var(--kui-color-primary);
    margin-top: 0.4rem;
  }

  .kui-activity__dot[data-type="site"] {
    background: var(--kui-color-accent);
  }

  .kui-activity__dot[data-type="user"] {
    background: var(--kui-color-secondary);
  }

  .kui-activity__title {
    margin: 0;
    font-weight: 700;
  }

  .kui-activity__meta {
    margin: 0.2rem 0 0;
    color: var(--kui-color-muted);
    font-size: 0.9rem;
  }

  .kui-empty {
    color: var(--kui-color-muted);
    margin: 0;
  }

  .kui-actions {
    display: grid;
    gap: 0.5rem;
  }

  .kui-action {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.65rem 0.75rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    text-decoration: none;
    color: inherit;
    background: var(--kui-color-surface-muted);
    transition: border-color var(--kui-duration-base) ease, box-shadow var(--kui-duration-base) ease, transform var(--kui-duration-base) ease;
    font-weight: 600;
  }

  .kui-action:hover {
    border-color: color-mix(in srgb, var(--kui-color-primary) 35%, var(--kui-color-border) 65%);
    box-shadow: var(--kui-shadow-xs);
    transform: translateY(-1px);
  }

  .kui-action svg {
    width: 1rem;
    height: 1rem;
    color: var(--kui-color-muted);
  }

  .kui-actions__footer {
    margin-top: var(--kui-spacing-md);
    display: flex;
    justify-content: flex-end;
  }

  @media (max-width: 960px) {
    .kui-overview__grid {
      grid-template-columns: 1fr;
    }
  }
</style>
