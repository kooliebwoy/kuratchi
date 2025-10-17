<script lang="ts">
  import { Settings, Shield, AlertTriangle, Key, CreditCard, Lock } from 'lucide-svelte';
  import { Tabs } from '@kuratchi/ui';
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  const tabs = [
    { label: 'Account', href: '/settings', icon: Settings },
    { label: 'Billing', href: '/settings/billing', icon: CreditCard },
    { label: 'Security', href: '/settings/security', icon: Lock },
    { label: 'API Keys', href: '/settings/api-keys', icon: Key },
    { label: 'Roles & Permissions', href: '/settings/roles', icon: Shield },
    { label: 'Danger Zone', href: '/settings/danger', icon: AlertTriangle }
  ];
</script>

<div class="p-8">
  <!-- Header -->
  <div class="mb-8 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
        <Settings class="h-6 w-6 text-primary" />
      </div>
      <div>
        <h1 class="text-2xl font-bold">Settings</h1>
        <p class="text-sm text-base-content/70">Manage your organization settings and preferences</p>
      </div>
    </div>
  </div>

  <!-- Tabs Navigation -->
  <Tabs {tabs}>
    {@render children()}
  </Tabs>
</div>
