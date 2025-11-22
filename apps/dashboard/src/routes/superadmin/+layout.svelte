<script lang="ts">
  import { Shield, Building2, Users, Activity } from '@lucide/svelte';
  import { Tabs } from '@kuratchi/ui';
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  const tabs = [
    { label: 'Overview', href: '/superadmin', icon: Shield },
    { label: 'Organizations', href: '/superadmin/organizations', icon: Building2 },
    { label: 'Users', href: '/superadmin/users', icon: Users },
    { label: 'Activity', href: '/superadmin/activity', icon: Activity }
  ];
</script>

<div class="p-8">
  <!-- Header -->
  <div class="mb-8 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
        <Shield class="h-6 w-6 text-primary" />
      </div>
      <div>
        <h1 class="text-2xl font-bold">Superadmin Dashboard</h1>
        <p class="text-sm text-base-content/70">Platform-wide management and monitoring</p>
      </div>
    </div>
  </div>

  <!-- Tabs Navigation -->
  <Tabs {tabs}>
    {@render children()}
  </Tabs>
</div>
