<script lang="ts">
  import { Mail, List, Send, Zap, Users, FileText, Globe } from 'lucide-svelte';
  import { Tabs } from '@kuratchi/ui';
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  const tabs = $state([
    { label: 'Overview', href: '/emails', icon: Mail },
    { label: 'Email Log', href: '/emails/log', icon: List },
    { label: 'Broadcasts', href: '/emails/broadcast', icon: Send },
    { label: 'Drip Campaigns', href: '/emails/drip', icon: Zap },
    { label: 'Segments', href: '/emails/segments', icon: Users },
    { label: 'Templates', href: '/emails/templates', icon: FileText },
    { label: 'Domains', href: '/domains', icon: Globe }
  ]);
</script>

<div class="p-8">
  <!-- Header -->
  <div class="mb-8 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
        <Mail class="h-6 w-6 text-primary" />
      </div>
      <div>
        <h1 class="text-2xl font-bold">Email Marketing</h1>
        <p class="text-sm text-base-content/70">Manage campaigns, segments, and email delivery</p>
      </div>
    </div>
  </div>

  <!-- Tabs Navigation -->
  <Tabs {tabs}>
    {@render children()}
  </Tabs>
</div>
