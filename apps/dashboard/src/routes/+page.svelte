<script lang="ts">
  import type { PageData } from './$types';
  import { MoreVertical, ChevronRight } from 'lucide-svelte';
  import { getUsers } from '$lib/api/users.remote';
  import { getSites } from '$lib/api/sites.remote';

  let { data }: { data: PageData } = $props();

  // Load real data
  const users = getUsers();
  const sites = getSites();

  // Calculate metrics
  const userCount = $derived(users.current?.length || 0);
  const siteCount = $derived(sites.current?.length || 0);

  // Top metrics with badges
  const topMetrics = $derived([
    { title: 'Sites', value: siteCount.toString(), badge: 'View All', badgeColor: 'bg-purple-100 text-purple-700' },
    { title: 'Users', value: userCount.toString(), badge: 'View All', badgeColor: 'bg-red-100 text-red-700' },
    { title: 'Email Campaigns', value: '0', badge: 'View All', badgeColor: 'bg-purple-100 text-purple-700' },
    { title: 'System Health', value: '99.8%', badge: 'Operational', badgeColor: 'bg-orange-100 text-orange-700' }
  ]);

  // Recent activity - combine user and site creation
  const recentActivity = $derived.by(() => {
    const activities: any[] = [];
    
    // Add recent users
    if (users.current) {
      users.current.slice(0, 3).forEach((user: any) => {
        activities.push({
          action: `User ${user.email} created`,
          time: new Date(user.created_at).toLocaleDateString(),
          status: 'success'
        });
      });
    }

    // Add recent sites
    if (sites.current) {
      sites.current.slice(0, 2).forEach((site: any) => {
        activities.push({
          action: `Site "${site.name}" created`,
          time: new Date(site.created_at).toLocaleDateString(),
          status: 'success'
        });
      });
    }

    return activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 4);
  });

  // User stats data
  const userStats = [
    { month: 'Jan', value: 65 },
    { month: 'Feb', value: 78 },
    { month: 'Mar', value: 90 },
    { month: 'Apr', value: 81 },
    { month: 'May', value: 56 },
    { month: 'Jun', value: 95 },
    { month: 'Jul', value: 72 },
    { month: 'Aug', value: 61 },
    { month: 'Sep', value: 88 },
    { month: 'Oct', value: 74 },
    { month: 'Nov', value: 92 },
    { month: 'Dec', value: 68 }
  ];

  // Statistics data
  const statistics = [
    { label: 'Visitors', value: '1013', percentage: 99, color: 'from-cyan-400 to-blue-500' },
    { label: 'Subscriber', value: '820', percentage: 80, color: 'from-yellow-400 to-orange-500' },
    { label: 'Contributor', value: '510', percentage: 50, color: 'from-blue-400 to-cyan-500' },
    { label: 'Author', value: '31', percentage: 30, color: 'from-green-400 to-emerald-500' }
  ];

  // Latest events
  const latestEvents = [
    { title: 'About Page Company', time: '19:32', tags: ['New Page', 'Site Pollis'] },
    { title: 'Category<Templates>', time: '19:32', tags: ['New Page', 'Site Pollis'] },
    { title: 'About Page Company', time: '19:32', tags: ['New Page', 'Site Pollis'] },
    { title: 'New User Alberta Colon', time: '19:32', tags: ['New Page', 'Site Pollis'] },
    { title: 'Add New Post<Second Post>', time: '19:32', tags: ['New Page', 'Site Pollis'] },
    { title: 'About Page Company', time: '19:32', tags: ['New Page', 'Site Pollis'] },
    { title: 'About Page Company', time: '19:32', tags: ['New Page', 'Site Pollis'] }
  ];
</script>

<svelte:head>
  <title>Dashboard - Kuratchi</title>
</svelte:head>

<div class="space-y-8">
  <!-- Top Metrics -->
  <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
    {#each topMetrics as metric}
      <div class="rounded-lg border border-base-200 bg-white p-5">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-xs font-medium text-base-content/50 uppercase tracking-wide">{metric.title}</p>
            <p class="mt-3 text-3xl font-bold text-base-content">{metric.value}</p>
          </div>
          <button class="text-base-content/30 hover:text-base-content/50 transition">
            <MoreVertical class="h-4 w-4" />
          </button>
        </div>
        <div class="mt-4">
          <span class={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${metric.badgeColor}`}>
            {metric.badge}
          </span>
        </div>
      </div>
    {/each}
  </div>

  <!-- Main Grid -->
  <div class="grid gap-6 lg:grid-cols-3">
    <!-- User Stats Chart -->
    <div class="lg:col-span-2 rounded-lg border border-base-200 bg-white p-6">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-base font-semibold text-base-content">User Stats</h2>
        <div class="flex gap-3">
          <button class="text-xs font-medium text-base-content/50 hover:text-base-content/80 transition">Month</button>
          <button class="text-xs font-medium text-base-content/50 hover:text-base-content/80 transition">6 Month</button>
          <button class="text-xs font-medium text-base-content/50 hover:text-base-content/80 transition">Year</button>
        </div>
      </div>
      
      <!-- Simple bar chart representation -->
      <div class="flex items-end justify-between gap-1.5 h-40">
        {#each userStats as stat}
          <div class="flex-1 flex flex-col items-center gap-2">
            <div class="w-full bg-gradient-to-t from-primary to-primary/60 rounded-sm" style={`height: ${stat.value}%`}></div>
            <span class="text-xs text-base-content/40">{stat.month}</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- Latest Events -->
    <div class="rounded-lg border border-base-200 bg-white p-6">
      <h2 class="text-base font-semibold text-base-content mb-4">Latest Activity</h2>
      <div class="space-y-2 max-h-80 overflow-y-auto">
        {#if recentActivity.length > 0}
          {#each recentActivity as event}
            <div class="flex items-start gap-3 pb-2 border-b border-base-200/50 last:border-0">
              <div class="h-7 w-7 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex-shrink-0 mt-0.5"></div>
              <div class="flex-1 min-w-0">
                <p class="text-xs font-medium text-base-content truncate">{event.action}</p>
                <p class="text-xs text-base-content/40 mt-0.5">{event.time}</p>
              </div>
            </div>
          {/each}
        {:else}
          <p class="text-xs text-base-content/50 text-center py-4">No recent activity</p>
        {/if}
      </div>
    </div>
  </div>

  <!-- Statistics -->
  <div class="rounded-lg border border-base-200 bg-white p-6">
    <div class="flex items-center justify-between mb-5">
      <h2 class="text-base font-semibold text-base-content">Statistics</h2>
      <div class="flex gap-3">
        <button class="text-xs font-medium text-base-content/50 hover:text-base-content/80 transition">Now</button>
        <button class="text-xs font-medium text-base-content/50 hover:text-base-content/80 transition">Today</button>
        <button class="text-xs font-medium text-base-content/50 hover:text-base-content/80 transition">Month</button>
      </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      {#each statistics as stat}
        <div class="flex flex-col items-center p-3 rounded-lg border border-base-200/50 hover:border-base-300 hover:bg-base-200/30 transition">
          <div class="relative h-12 w-12 flex-shrink-0 mb-2">
            <svg class="h-full w-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="7" class="text-base-200" />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="url(#grad)"
                stroke-width="7"
                stroke-dasharray={`${stat.percentage * 2.83} 283`}
                class="transition-all"
              />
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={`stop-color: rgb(${stat.color === 'from-cyan-400 to-blue-500' ? '34, 211, 238' : stat.color === 'from-yellow-400 to-orange-500' ? '250, 204, 21' : stat.color === 'from-blue-400 to-cyan-500' ? '96, 165, 250' : '74, 222, 128'}); stop-opacity: 1`} />
                </linearGradient>
              </defs>
            </svg>
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="text-xs font-bold text-base-content">{stat.percentage}%</span>
            </div>
          </div>
          <div class="text-center">
            <p class="text-xs text-base-content/50">{stat.label}</p>
            <p class="text-sm font-semibold text-base-content">{stat.value}</p>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Quick Actions -->
  <div class="rounded-lg border border-base-200 bg-white p-6">
    <h2 class="text-base font-semibold text-base-content mb-4">Quick Actions</h2>
    <div class="grid grid-cols-2 gap-3">
      <a href="/sites" class="flex flex-col items-start p-3 rounded-lg border border-base-200/50 hover:border-base-300 hover:bg-base-200/30 transition">
        <span class="text-sm font-medium text-base-content">Create New Site</span>
        <span class="text-xs text-base-content/50 mt-1">Build a new website</span>
      </a>
      <a href="/emails" class="flex flex-col items-start p-3 rounded-lg border border-base-200/50 hover:border-base-300 hover:bg-base-200/30 transition">
        <span class="text-sm font-medium text-base-content">Send Email Campaign</span>
        <span class="text-xs text-base-content/50 mt-1">Email marketing</span>
      </a>
      <a href="/database" class="flex flex-col items-start p-3 rounded-lg border border-base-200/50 hover:border-base-300 hover:bg-base-200/30 transition">
        <span class="text-sm font-medium text-base-content">Manage Database</span>
        <span class="text-xs text-base-content/50 mt-1">Data management</span>
      </a>
      <a href="/domains" class="flex flex-col items-start p-3 rounded-lg border border-base-200/50 hover:border-base-300 hover:bg-base-200/30 transition">
        <span class="text-sm font-medium text-base-content">Configure Domains</span>
        <span class="text-xs text-base-content/50 mt-1">Domain settings</span>
      </a>
    </div>
  </div>
</div>
