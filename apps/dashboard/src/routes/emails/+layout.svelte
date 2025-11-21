<script lang="ts">
  import { page } from '$app/state';
  import { Mail, List, Send, Zap, Users, FileText, Globe } from 'lucide-svelte';
  import { Tabs } from '@kuratchi/ui';
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  const tabs = $derived([
    { label: 'Overview', href: '/emails', icon: Mail, active: page.url.pathname === '/emails' },
    { label: 'Email Log', href: '/emails/log', icon: List, active: page.url.pathname === '/emails/log' },
    { label: 'Broadcasts', href: '/emails/broadcast', icon: Send, active: page.url.pathname === '/emails/broadcast' },
    { label: 'Drip Campaigns', href: '/emails/drip', icon: Zap, active: page.url.pathname === '/emails/drip' },
    { label: 'Segments', href: '/emails/segments', icon: Users, active: page.url.pathname === '/emails/segments' },
    { label: 'Templates', href: '/emails/templates', icon: FileText, active: page.url.pathname === '/emails/templates' },
    { label: 'Domains', href: '/domains', icon: Globe, active: page.url.pathname === '/domains' }
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
