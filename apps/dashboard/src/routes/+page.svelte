<script lang="ts">
  import type { PageData } from './$types';
  import { StatsCard, InfoCard, Badge, Button } from '@kuratchi/ui';
  import { Building2, Users, Database, Activity, Shield, Mail, Globe, Clock } from 'lucide-svelte';

  let { data }: { data: PageData } = $props();

  // Quick stats based on actual menu items
  const quickStats = [
    { title: 'Organizations', value: '3', icon: Building2, href: '/organizations', color: 'primary' as const },
    { title: 'Active Users', value: '142', icon: Users, href: '/users', color: 'success' as const },
    { title: 'Database Tables', value: '12', icon: Database, href: '/databases', color: 'info' as const },
    { title: 'Active Sessions', value: '89', icon: Clock, href: '/sessions', color: 'warning' as const }
  ];
</script>

<svelte:head>
  <title>Dashboard - Kuratchi</title>
</svelte:head>

<section class="space-y-6">
  <!-- Header -->
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold">Dashboard Overview</h1>
      <p class="text-sm text-base-content/60">Welcome back! Here's what's happening with your platform.</p>
    </div>
  </div>

  <!-- Quick Stats Grid -->
  <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    {#each quickStats as stat}
      <a href={stat.href} class="group">
        <StatsCard
          title={stat.title}
          value={stat.value}
          variant={stat.color}
          class="transition-all hover:shadow-md group-hover:border-primary"
        >
          {#snippet icon()}
            <stat.icon class="h-5 w-5" />
          {/snippet}
        </StatsCard>
      </a>
    {/each}
  </div>

  <!-- Main Content Grid -->
  <div class="grid gap-6 lg:grid-cols-3">
    <!-- Recent Activity -->
    <InfoCard title="Recent Activity" class="lg:col-span-2">
      <div class="space-y-3">
        <!-- {#each activity.slice(0, 5) as item}
          <div class="flex items-center justify-between p-3 rounded-lg bg-base-200/30">
            <div>
              <p class="text-sm font-medium">{item.action}</p>
              <p class="text-xs text-base-content/60">{item.time}</p>
            </div>
            <Badge variant="primary" size="sm">{item.status}</Badge>
          </div>
        {/each} -->
      </div>
      {#snippet footer()}
        <a href="/activity" class="btn btn-ghost btn-sm">View All Activity</a>
      {/snippet}
    </InfoCard>

    <!-- Quick Actions -->
    <InfoCard title="Quick Actions">
      <div class="space-y-2">
        <a href="/organizations" class="btn btn-outline btn-block justify-start">
          <Building2 class="h-4 w-4" />
          Manage Organizations
        </a>
        <a href="/users" class="btn btn-outline btn-block justify-start">
          <Users class="h-4 w-4" />
          Manage Users
        </a>
        <a href="/roles" class="btn btn-outline btn-block justify-start">
          <Shield class="h-4 w-4" />
          Configure Roles
        </a>
        <a href="/emails" class="btn btn-outline btn-block justify-start">
          <Mail class="h-4 w-4" />
          View Emails
        </a>
        <a href="/domains" class="btn btn-outline btn-block justify-start">
          <Globe class="h-4 w-4" />
          Manage Domains
        </a>
      </div>
    </InfoCard>
  </div>

  <!-- Secondary Grid -->
  <div class="grid gap-6 lg:grid-cols-2">
    <!-- Database Overview -->
    <InfoCard title="Database Status">
      <div class="space-y-3">
        <!-- {#each tables.slice(0, 3) as table}
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium text-sm">{table.name}</p>
              <p class="text-xs text-base-content/60">{table.rows} rows</p>
            </div>
            <Badge variant={table.status === 'Online' ? 'success' : 'warning'} size="sm">
              {table.status}
            </Badge>
          </div>
        {/each} -->
      </div>
      {#snippet footer()}
        <a href="/database" class="btn btn-ghost btn-sm">View All Tables</a>
      {/snippet}
    </InfoCard>

    <!-- Authentication Providers -->
    <InfoCard title="Auth Providers">
      <div class="space-y-3">
        <!-- {#each providers as provider}
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <provider.icon class="h-4 w-4 text-primary" />
              <span class="text-sm">{provider.name}</span>
            </div>
            <Badge variant="success" size="xs">{provider.success}</Badge>
          </div>
        {/each} -->
      </div>
      {#snippet footer()}
        <a href="/settings" class="btn btn-ghost btn-sm">Configure Auth</a>
      {/snippet}
    </InfoCard>
  </div>

</section>
