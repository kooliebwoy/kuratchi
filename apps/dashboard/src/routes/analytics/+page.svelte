<script lang="ts">
  import { getSites } from '$lib/functions/sites.remote';
  import { getAnalyticsData } from '$lib/functions/analytics.remote';
  import { goto } from '$app/navigation';
  import { 
    BarChart3, 
    Globe, 
    Users, 
    Eye, 
    MousePointer,
    TrendingUp,
    MapPin,
    Monitor,
    Smartphone,
    ExternalLink,
    RefreshCw,
    Info
  } from '@lucide/svelte';
  import { Button, Card, Loading } from '@kuratchi/ui';

  // State
  let selectedSiteId = $state<string | null>(null);
  let selectedPeriod = $state<'1d' | '7d' | '30d' | '90d'>('7d');

  // Get sites using the existing sites query
  const sites = getSites();
  
  // Derived: selected site
  const selectedSite = $derived(
    sites.current?.find((s: any) => s.id === selectedSiteId) || null
  );

  // Derived: has sites
  const hasSites = $derived(sites.current && sites.current.length > 0);

  // Auto-select first site when sites load
  $effect(() => {
    const siteList = sites.current;
    if (!selectedSiteId && siteList && siteList.length > 0) {
      selectedSiteId = siteList[0].id;
    }
  });

  // Update URL when site/period changes to trigger the query
  $effect(() => {
    if (selectedSiteId && selectedPeriod) {
      goto(`/analytics?siteId=${selectedSiteId}&period=${selectedPeriod}`, { 
        replaceState: true, 
        noScroll: true,
        keepFocus: true
      });
    }
  });

  // Analytics query - reads from URL params
  const analytics = getAnalyticsData();
  
  // Derived states from query
  const isLoadingAnalytics = $derived(analytics.loading);
  const analyticsData = $derived.by(() => {
    const data = analytics.current;
    if (!data) return null;
    if ('error' in data || 'noToken' in data) return null;
    return data as any; // Cast to any to avoid TS union type issues in template
  });
  const analyticsError = $derived.by(() => {
    const data = analytics.current;
    if (!data) return null;
    if ('error' in data) return (data as any).error as string;
    if ('noToken' in data) return (data as any).message as string;
    return null;
  });

  function handleSiteChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    selectedSiteId = target.value;
  }

  function handlePeriodChange(period: '1d' | '7d' | '30d' | '90d') {
    selectedPeriod = period;
  }

  function handleRefresh() {
    analytics.refresh();
  }

  function formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  const periodLabels: Record<string, string> = {
    '1d': 'Last 24 hours',
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    '90d': 'Last 90 days'
  };
</script>

<svelte:head>
  <title>Analytics - Kuratchi Dashboard</title>
</svelte:head>

<div class="analytics-page">
  <header class="analytics-header">
    <div>
      <p class="eyebrow">Analytics</p>
      <h1>Website Analytics</h1>
      <p class="subtext">Track visitor activity across your sites with Cloudflare Web Analytics.</p>
    </div>
    <div class="controls">
      {#if hasSites}
        <select class="site-select" value={selectedSiteId} onchange={handleSiteChange}>
          {#each sites.current as site}
            <option value={site.id}>
              {site.name} ({site.subdomain}.kuratchi.site)
            </option>
          {/each}
        </select>
      {/if}
    </div>
  </header>

  {#if hasSites}
    <div class="toolbar">
      <div class="period-tabs">
        {#each (['1d', '7d', '30d', '90d'] as const) as period}
          <button 
            class="period-tab" 
            class:active={selectedPeriod === period}
            onclick={() => handlePeriodChange(period)}
          >
            {periodLabels[period]}
          </button>
        {/each}
      </div>
      <div class="actions">
        <Button variant="ghost" size="sm" onclick={handleRefresh} disabled={isLoadingAnalytics}>
          <RefreshCw class={isLoadingAnalytics ? 'icon spinning' : 'icon'} />
          Refresh
        </Button>
      </div>
    </div>
  {/if}

  {#if sites.loading}
    <Card>
      <div class="center-content">
        <Loading size="md" />
        <p class="subtext">Loading sites...</p>
      </div>
    </Card>
  {:else if !hasSites}
    <Card>
      <div class="center-content">
        <Globe class="empty-icon" />
        <h3>No Sites Found</h3>
        <p class="subtext">Create a site first to view analytics.</p>
        <Button variant="primary" size="sm" href="/sites">Go to Sites</Button>
      </div>
    </Card>
  {:else if isLoadingAnalytics}
    <Card>
      <div class="center-content">
        <Loading size="md" />
        <p class="subtext">Loading analytics for {selectedSite?.name}...</p>
      </div>
    </Card>
  {:else if analyticsError}
    <Card>
      <div class="callout info">
        <Info class="icon" />
        <div>
          <p class="strong">Analytics Configuration Required</p>
          <p class="subtext">{analyticsError}</p>
          <p class="subtext" style="margin-top: 0.5rem;">
            Make sure <code>CF_ANALYTICS_ZONE_TAG</code> is set in your environment variables.
          </p>
        </div>
      </div>
    </Card>
  {:else if analyticsData}
    <div class="stats-grid">
      <Card>
        <div class="stat-card">
          <div class="stat-icon"><Eye /></div>
          <div>
            <p class="stat-label">Page Views</p>
            <p class="stat-value">{formatNumber(analyticsData.pageviews || 0)}</p>
          </div>
        </div>
      </Card>
      <Card>
        <div class="stat-card">
          <div class="stat-icon"><MousePointer /></div>
          <div>
            <p class="stat-label">Visits</p>
            <p class="stat-value">{formatNumber(analyticsData.visits || 0)}</p>
          </div>
        </div>
      </Card>
      <Card>
        <div class="stat-card">
          <div class="stat-icon"><Users /></div>
          <div>
            <p class="stat-label">Unique Visitors</p>
            <p class="stat-value">{formatNumber(analyticsData.visitors || 0)}</p>
          </div>
        </div>
      </Card>
      <Card>
        <div class="stat-card">
          <div class="stat-icon"><TrendingUp /></div>
          <div>
            <p class="stat-label">Pages/Visit</p>
            <p class="stat-value">{analyticsData.visits > 0 ? (analyticsData.pageviews / analyticsData.visits).toFixed(1) : '0'}</p>
          </div>
        </div>
      </Card>
    </div>

    <div class="data-grid">
      <Card>
        <h3 class="panel-title">Top Pages</h3>
        {#if analyticsData.topPages?.length > 0}
          <div class="list">
            {#each analyticsData.topPages.slice(0, 10) as page}
              <div class="list-item">
                <span class="list-label">{page.path}</span>
                <span class="list-value">{formatNumber(page.views)}</span>
              </div>
            {/each}
          </div>
        {:else}
          <p class="subtext">No page data available</p>
        {/if}
      </Card>

      <Card>
        <h3 class="panel-title">Top Referrers</h3>
        {#if analyticsData.topReferrers?.length > 0}
          <div class="list">
            {#each analyticsData.topReferrers.slice(0, 10) as referrer}
              <div class="list-item">
                <span class="list-label"><ExternalLink class="icon-sm" /> {referrer.referrer || 'Direct'}</span>
                <span class="list-value">{formatNumber(referrer.visits)}</span>
              </div>
            {/each}
          </div>
        {:else}
          <p class="subtext">No referrer data available</p>
        {/if}
      </Card>

      <Card>
        <h3 class="panel-title">Top Countries</h3>
        {#if analyticsData.topCountries?.length > 0}
          <div class="list">
            {#each analyticsData.topCountries.slice(0, 10) as country}
              <div class="list-item">
                <span class="list-label"><MapPin class="icon-sm" /> {country.country || 'Unknown'}</span>
                <span class="list-value">{formatNumber(country.visits)}</span>
              </div>
            {/each}
          </div>
        {:else}
          <p class="subtext">No country data available</p>
        {/if}
      </Card>

      <Card>
        <h3 class="panel-title">Browsers & Devices</h3>
        <div class="split-list">
          <div>
            <h4 class="split-heading">Browsers</h4>
            {#if analyticsData.topBrowsers?.length > 0}
              <div class="list">
                {#each analyticsData.topBrowsers.slice(0, 5) as browser}
                  <div class="list-item">
                    <span class="list-label"><Monitor class="icon-sm" /> {browser.browser || 'Unknown'}</span>
                    <span class="list-value">{formatNumber(browser.visits)}</span>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="subtext">No browser data</p>
            {/if}
          </div>
          <div>
            <h4 class="split-heading">Devices</h4>
            {#if analyticsData.topDevices?.length > 0}
              <div class="list">
                {#each analyticsData.topDevices.slice(0, 5) as device}
                  <div class="list-item">
                    <span class="list-label"><Smartphone class="icon-sm" /> {device.device || 'Unknown'}</span>
                    <span class="list-value">{formatNumber(device.visits)}</span>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="subtext">No device data</p>
            {/if}
          </div>
        </div>
      </Card>
    </div>

    {#if analyticsData.timeseries?.length > 0}
      <Card>
        <h3 class="panel-title">Traffic Over Time</h3>
        <div class="timeseries">
          {#each analyticsData.timeseries as point}
            {@const maxViews = Math.max(...analyticsData.timeseries.map((p: any) => p.pageviews || 0))}
            {@const height = maxViews > 0 ? ((point.pageviews || 0) / maxViews) * 100 : 0}
            <div class="bar-container">
              <div class="bar" style="height: {height}%" title="{point.date}: {point.pageviews || 0} views"></div>
              <span class="bar-label">{point.date?.slice(5) || ''}</span>
            </div>
          {/each}
        </div>
      </Card>
    {/if}
  {:else}
    <Card>
      <div class="center-content">
        <BarChart3 class="empty-icon" />
        <p class="subtext">Select a site to view analytics.</p>
      </div>
    </Card>
  {/if}
</div>

<style>
  .analytics-page {
    display: grid;
    gap: var(--kui-spacing-md);
  }

  .analytics-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--kui-spacing-md);
    flex-wrap: wrap;
  }

  .controls {
    display: flex;
    gap: var(--kui-spacing-sm);
    align-items: center;
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--kui-spacing-md);
    flex-wrap: wrap;
  }

  .actions {
    display: flex;
    gap: var(--kui-spacing-xs);
  }

  h1 { margin: 0.1rem 0 0.2rem; font-size: 1.6rem; }
  h3 { margin: 0; }

  .eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--kui-color-muted);
    font-weight: 700;
    margin: 0;
    font-size: 0.8rem;
  }

  .subtext {
    color: var(--kui-color-muted);
    margin: 0;
  }

  .site-select {
    padding: 0.5rem 1rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    background: var(--kui-color-surface);
    color: var(--kui-color-text);
    font-size: 0.9rem;
    min-width: 200px;
  }

  .period-tabs {
    display: flex;
    gap: 0.25rem;
    background: var(--kui-color-surface-muted);
    padding: 0.25rem;
    border-radius: var(--kui-radius-md);
  }

  .period-tab {
    padding: 0.4rem 0.8rem;
    border: none;
    background: transparent;
    color: var(--kui-color-muted);
    font-size: 0.85rem;
    font-weight: 500;
    border-radius: var(--kui-radius-sm);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .period-tab:hover { color: var(--kui-color-text); }

  .period-tab.active {
    background: var(--kui-color-surface);
    color: var(--kui-color-primary);
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--kui-spacing-md);
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: var(--kui-spacing-md);
    padding: var(--kui-spacing-sm);
  }

  .stat-icon {
    width: 3rem;
    height: 3rem;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--kui-color-primary) 10%, transparent);
    color: var(--kui-color-primary);
    border-radius: var(--kui-radius-lg);
  }

  .stat-label {
    color: var(--kui-color-muted);
    font-size: 0.85rem;
    margin: 0;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
  }

  .data-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--kui-spacing-md);
  }

  .panel-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 var(--kui-spacing-sm);
  }

  .list { display: grid; gap: 0.5rem; }

  .list-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.4rem 0;
    border-bottom: 1px solid var(--kui-color-border);
  }

  .list-item:last-child { border-bottom: none; }

  .list-label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.9rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 70%;
  }

  .list-value {
    font-weight: 600;
    font-size: 0.9rem;
  }

  .icon { width: 1rem; height: 1rem; }
  .icon.spinning { animation: spin 1s linear infinite; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  .icon-sm { width: 0.85rem; height: 0.85rem; opacity: 0.6; }

  .split-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--kui-spacing-md);
  }

  .split-heading {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--kui-color-muted);
    margin: 0 0 0.5rem;
  }

  .timeseries {
    display: flex;
    align-items: flex-end;
    gap: 0.25rem;
    height: 150px;
    padding-top: var(--kui-spacing-sm);
  }

  .bar-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
  }

  .bar {
    width: 100%;
    max-width: 30px;
    background: var(--kui-color-primary);
    border-radius: var(--kui-radius-sm) var(--kui-radius-sm) 0 0;
    min-height: 2px;
    transition: height 0.3s ease;
    margin-top: auto;
  }

  .bar-label {
    font-size: 0.7rem;
    color: var(--kui-color-muted);
    margin-top: 0.25rem;
  }

  .center-content {
    display: grid;
    place-items: center;
    gap: 0.5rem;
    text-align: center;
    padding: var(--kui-spacing-xl);
  }

  .empty-icon {
    width: 3rem;
    height: 3rem;
    color: var(--kui-color-muted);
  }

  .callout {
    display: flex;
    align-items: flex-start;
    gap: var(--kui-spacing-sm);
    padding: var(--kui-spacing-md);
    border-radius: var(--kui-radius-lg);
    border: 1px solid var(--kui-color-border);
  }

  .callout.info {
    background: color-mix(in srgb, var(--kui-color-primary) 10%, var(--kui-color-surface));
    border-color: color-mix(in srgb, var(--kui-color-primary) 30%, var(--kui-color-border));
  }

  .strong { font-weight: 600; margin: 0; }

  code {
    background: var(--kui-color-surface-muted);
    padding: 0.1rem 0.3rem;
    border-radius: var(--kui-radius-sm);
    font-size: 0.85em;
  }

  @media (max-width: 768px) {
    .analytics-header { flex-direction: column; align-items: stretch; }
    .toolbar { flex-direction: column; align-items: stretch; }
    .period-tabs { overflow-x: auto; }
    .split-list { grid-template-columns: 1fr; }
    .stats-grid { grid-template-columns: 1fr 1fr; }
  }
</style>
