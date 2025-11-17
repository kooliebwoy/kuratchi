<script lang="ts">
  import type { PageData } from './$types';
  import { Plus, ArrowRight } from 'lucide-svelte';
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

<div class="min-h-screen bg-white">
  <!-- Header -->
  <div class="border-b border-gray-200 bg-white px-8 py-8">
    <h1 class="text-3xl font-semibold text-gray-900">Overview</h1>
    <p class="mt-2 text-sm text-gray-600">Welcome back. Here's what's happening with your account.</p>
  </div>

  <!-- Main Content -->
  <div class="px-8 py-8">
    <!-- Metrics Grid -->
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2 mb-8">
      {#each metrics as metric}
        <a
          href={metric.href}
          class="group block rounded-lg border border-gray-200 bg-white p-8 hover:border-gray-300 hover:shadow-sm transition"
        >
          <p class="text-sm font-medium text-gray-600 uppercase tracking-wide">{metric.label}</p>
          <div class="mt-4 flex items-end justify-between">
            <p class="text-5xl font-semibold text-gray-900">{metric.value}</p>
            <ArrowRight class="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition" />
          </div>
        </a>
      {/each}
    </div>

    <!-- Content Grid -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Recent Activity -->
      <div class="lg:col-span-2 rounded-lg border border-gray-200 bg-white p-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-6">Recent Activity</h2>

        {#if recentActivity.length > 0}
          <div class="space-y-5">
            {#each recentActivity as activity}
              <div class="flex items-start gap-4 pb-5 border-b border-gray-100 last:pb-0 last:border-0">
                <div class="h-2 w-2 rounded-full bg-gray-300 mt-2 flex-shrink-0"></div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-gray-900 leading-snug">{activity.title}</p>
                  <p class="mt-2 text-xs text-gray-500">{activity.time}</p>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-sm text-gray-500 text-center py-8">No recent activity</p>
        {/if}
      </div>

      <!-- Quick Actions -->
      <div class="rounded-lg border border-gray-200 bg-white p-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-6">Actions</h2>
        <div class="space-y-3">
          {#each actions as action}
            <a
              href={action.href}
              class="flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition"
            >
              <span>{action.label}</span>
              <ArrowRight class="h-4 w-4 text-gray-400" />
            </a>
          {/each}
        </div>
      </div>
    </div>
  </div>
</div>
