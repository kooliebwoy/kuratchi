<script lang="ts">
  import { Activity, CheckCircle, XCircle, User, Clock, Info, Shield, Building2, Trash2, Search, ChevronDown, ChevronRight } from 'lucide-svelte';
  import { getActivities, clearOldActivities } from '$lib/functions/activity.remote';
  import { Badge, Button, Card, Loading } from '@kuratchi/ui';

  let expandedActivities = $state<Set<string>>(new Set());

  function toggleExpanded(activityId: string) {
    const next = new Set(expandedActivities);
    if (next.has(activityId)) {
      next.delete(activityId);
    } else {
      next.add(activityId);
    }
    expandedActivities = next;
  }

  const activities = getActivities();
  const activitiesList = $derived(activities.current && Array.isArray(activities.current) ? activities.current : []);

  let searchQuery = $state('');
  let filterAction = $state('');
  let filterUser = $state('');
  let filterStatus = $state<'all' | 'success' | 'failed'>('all');
  let filterType = $state<'all' | 'admin' | 'user'>('all');

  const uniqueActions = $derived.by(() => {
    const actions: Record<string, boolean> = {};
    activitiesList.forEach((a: any) => {
      actions[a.action] = true;
    });
    return Object.keys(actions).sort();
  });

  const uniqueUsers = $derived.by(() => {
    const usersMap: Record<string, any> = {};
    activitiesList.forEach((a: any) => {
      if (a.userId && !usersMap[a.userId]) {
        usersMap[a.userId] = { id: a.userId, name: a.userName, email: a.userEmail };
      }
    });
    return Object.values(usersMap);
  });

  const filteredActivities = $derived.by(() => {
    let filtered = activitiesList;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((a: any) =>
        a.action?.toLowerCase().includes(q) ||
        a.userName?.toLowerCase().includes(q) ||
        a.userEmail?.toLowerCase().includes(q) ||
        a.ip?.toLowerCase().includes(q)
      );
    }

    if (filterAction) {
      filtered = filtered.filter((a: any) => a.action === filterAction);
    }

    if (filterUser) {
      filtered = filtered.filter((a: any) => a.userId === filterUser);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((a: any) => {
        const status = a.status ?? true;
        return filterStatus === 'success' ? status : !status;
      });
    }

    if (filterType !== 'all') {
      filtered = filtered.filter((a: any) => filterType === 'admin' ? a.isAdminAction : !a.isAdminAction);
    }

    return filtered;
  });

  function formatTimestamp(timestamp: string) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }

  function getActionVariant(action: string, isAdminAction: boolean) {
    if (isAdminAction) return 'primary';
    const actionLower = action.toLowerCase();
    if (actionLower.includes('create')) return 'success';
    if (actionLower.includes('delete')) return 'error';
    if (actionLower.includes('update') || actionLower.includes('edit')) return 'warning';
    if (actionLower.includes('login') || actionLower.includes('auth')) return 'info';
    return 'neutral';
  }

  function handleClearOld() {
    if (!confirm('Clear activities older than 90 days?')) return;
    const form = document.getElementById('clear-old-form') as HTMLFormElement;
    form?.requestSubmit();
  }
</script>

<svelte:head>
  <title>Activity Log - Kuratchi Dashboard</title>
</svelte:head>

<div class="kui-activity-page">
  <header class="kui-activity__header">
    <div class="kui-activity__title">
      <div class="kui-activity__icon">
        <Activity />
      </div>
      <div>
        <p class="kui-eyebrow">Audit</p>
        <h1>Activity Log</h1>
        <p class="kui-subtext">Monitor system and user activity</p>
      </div>
    </div>
    <Button variant="error" outline onclick={handleClearOld}>
      <Trash2 class="kui-icon" />
      Clear old
    </Button>
  </header>

  <Card class="kui-panel">
    <div class="kui-filters">
      <div class="kui-input-group">
        <Search class="kui-icon" />
        <input
          type="text"
          class="kui-input"
          placeholder="Search activities..."
          bind:value={searchQuery}
        />
      </div>

      <select class="kui-select" bind:value={filterAction}>
        <option value="">All actions</option>
        {#each uniqueActions as action}
          <option value={action}>{action}</option>
        {/each}
      </select>

      <select class="kui-select" bind:value={filterUser}>
        <option value="">All users</option>
        {#each uniqueUsers as user}
          <option value={user.id}>{user.name}</option>
        {/each}
      </select>

      <select class="kui-select" bind:value={filterStatus}>
        <option value="all">All status</option>
        <option value="success">Success only</option>
        <option value="failed">Failed only</option>
      </select>

      <select class="kui-select" bind:value={filterType}>
        <option value="all">All types</option>
        <option value="admin">Admin only</option>
        <option value="user">User only</option>
      </select>
    </div>

    {#if activities.loading}
      <div class="kui-center">
        <Loading size="lg" />
      </div>
    {:else if filteredActivities.length > 0}
      <div class="kui-activity__list">
        {#each filteredActivities as activity}
          <article class="kui-activity__item">
            <div class={`kui-activity__status ${(activity.status ?? true) ? 'success' : 'error'}`}>
              {#if activity.status ?? true}
                <CheckCircle />
              {:else}
                <XCircle />
              {/if}
            </div>

            <div class="kui-activity__body">
              <div class="kui-activity__row">
                <div class="kui-activity__chips">
                  <Badge variant={getActionVariant(activity.action, activity.isAdminAction)} size="xs">
                    {activity.action}
                  </Badge>
                  {#if activity.isAdminAction}
                    <Badge variant="ghost" size="xs">
                      <Shield class="kui-icon" />
                      Admin
                    </Badge>
                  {/if}
                  {#if activity.isHidden}
                    <Badge variant="ghost" size="xs">Hidden</Badge>
                  {/if}
                  {#if activity.userName}
                    <span class="kui-inline">
                      <User class="kui-icon" />
                      {activity.userName}
                    </span>
                  {/if}
                  {#if activity.organizationId}
                    <span class="kui-inline">
                      <Building2 class="kui-icon" />
                      {activity.organizationId.substring(0, 8)}
                    </span>
                  {/if}
                </div>

                <div class="kui-inline muted">
                  <Clock class="kui-icon" />
                  {formatTimestamp(activity.createdAt)}
                </div>
              </div>

              {#if activity.data && typeof activity.data === 'object' && Object.keys(activity.data).length > 0}
                <button class="kui-toggle" onclick={() => toggleExpanded(activity.id)}>
                  {#if expandedActivities.has(activity.id)}
                    <ChevronDown class="kui-icon" />
                    Hide details
                  {:else}
                    <ChevronRight class="kui-icon" />
                    Show details ({Object.keys(activity.data).length} {Object.keys(activity.data).length === 1 ? 'field' : 'fields'})
                  {/if}
                </button>

                {#if expandedActivities.has(activity.id)}
                  <div class="kui-json">
                    <pre>{JSON.stringify(activity.data, null, 2)}</pre>
                  </div>
                {/if}
              {/if}

              <div class="kui-meta">
                {#if activity.ip}
                  <span class="kui-inline">
                    <Info class="kui-icon" />
                    {activity.ip}
                  </span>
                {/if}
                {#if activity.userAgent}
                  <span class="kui-inline truncate" title={activity.userAgent}>
                    {activity.userAgent}
                  </span>
                {/if}
              </div>
            </div>
          </article>
        {/each}
      </div>
    {:else}
      <div class="kui-empty">
        <Activity class="kui-empty__icon" />
        <p class="kui-empty__title">No activity found</p>
        {#if searchQuery || filterAction || filterUser || filterStatus !== 'all' || filterType !== 'all'}
          <p class="kui-empty__subtitle">Try adjusting your filters</p>
        {:else}
          <p class="kui-empty__subtitle">Actions will appear here as they happen</p>
        {/if}
      </div>
    {/if}
  </Card>
</div>

<form {...clearOldActivities} id="clear-old-form" style="display: none;">
  <input type="hidden" name="daysOld" value="90" />
</form>

<style>
  .kui-activity-page {
    display: grid;
    gap: var(--kui-spacing-lg);
  }

  .kui-activity__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--kui-spacing-md);
  }

  .kui-activity__title {
    display: flex;
    align-items: center;
    gap: var(--kui-spacing-sm);
  }

  .kui-activity__icon {
    width: 3rem;
    height: 3rem;
    border-radius: var(--kui-radius-lg);
    display: grid;
    place-items: center;
    background: var(--kui-color-primary-weak);
    color: var(--kui-color-primary);
  }

  .kui-eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--kui-color-muted);
    font-weight: 700;
    margin: 0;
    font-size: 0.8rem;
  }

  .kui-subtext {
    margin: 0.2rem 0 0;
    color: var(--kui-color-muted);
  }

  h1 {
    margin: 0.1rem 0 0;
  }

  .kui-panel .kui-card__body {
    gap: var(--kui-spacing-md);
  }

  .kui-filters {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--kui-spacing-sm);
    align-items: center;
  }

  .kui-input-group {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    padding: 0.35rem 0.6rem;
    background: var(--kui-color-surface);
  }

  .kui-input-group .kui-icon {
    color: var(--kui-color-muted);
  }

  .kui-input {
    width: 100%;
    border: none;
    outline: none;
    background: transparent;
    color: var(--kui-color-text);
  }

  .kui-select {
    appearance: none;
    padding: 0.55rem 0.75rem;
    border-radius: var(--kui-radius-md);
    border: 1px solid var(--kui-color-border);
    background: var(--kui-color-surface);
    color: var(--kui-color-text);
  }

  .kui-icon {
    width: 1rem;
    height: 1rem;
  }

  .kui-center {
    display: grid;
    place-items: center;
    min-height: 220px;
  }

  .kui-activity__list {
    display: grid;
    gap: var(--kui-spacing-sm);
  }

  .kui-activity__item {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--kui-spacing-sm);
    padding: 0.85rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-lg);
    background: var(--kui-color-surface-muted);
    transition: border-color var(--kui-duration-base) ease, box-shadow var(--kui-duration-base) ease, transform var(--kui-duration-base) ease;
  }

  .kui-activity__item:hover {
    border-color: color-mix(in srgb, var(--kui-color-primary) 35%, var(--kui-color-border) 65%);
    box-shadow: var(--kui-shadow-xs);
    transform: translateY(-1px);
  }

  .kui-activity__status {
    width: 2.6rem;
    height: 2.6rem;
    border-radius: 50%;
    display: grid;
    place-items: center;
  }

  .kui-activity__status.success {
    background: rgba(22, 163, 74, 0.1);
    color: var(--kui-color-success);
  }

  .kui-activity__status.error {
    background: rgba(239, 68, 68, 0.1);
    color: var(--kui-color-error);
  }

  .kui-activity__body {
    display: grid;
    gap: 0.35rem;
  }

  .kui-activity__row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--kui-spacing-sm);
    flex-wrap: wrap;
  }

  .kui-activity__chips {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex-wrap: wrap;
  }

  .kui-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.9rem;
  }

  .kui-inline.muted {
    color: var(--kui-color-muted);
  }

  .kui-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--kui-color-muted);
    font-size: 0.9rem;
    border: none;
    background: transparent;
    padding: 0;
    cursor: pointer;
  }

  .kui-json {
    background: var(--kui-color-surface);
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    padding: 0.75rem;
    margin-top: 0.25rem;
    overflow-x: auto;
  }

  .kui-json pre {
    margin: 0;
    font-size: 0.85rem;
  }

  .kui-meta {
    display: flex;
    align-items: center;
    gap: var(--kui-spacing-sm);
    color: var(--kui-color-muted);
    flex-wrap: wrap;
  }

  .truncate {
    max-width: 240px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .kui-empty {
    display: grid;
    gap: 0.35rem;
    justify-items: center;
    text-align: center;
    padding: var(--kui-spacing-lg) var(--kui-spacing-md);
  }

  .kui-empty__icon {
    width: 3rem;
    height: 3rem;
    color: var(--kui-color-muted);
  }

  .kui-empty__title {
    margin: 0;
    font-weight: 700;
  }

  .kui-empty__subtitle {
    margin: 0;
    color: var(--kui-color-muted);
  }

  @media (max-width: 720px) {
    .kui-activity__item {
      grid-template-columns: 1fr;
    }

    .kui-activity__status {
      width: 2.2rem;
      height: 2.2rem;
    }
  }
</style>
