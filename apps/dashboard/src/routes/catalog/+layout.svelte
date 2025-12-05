<script lang="ts">
  import { page } from '$app/state';
  import { Bike, Building2, FileText, Tag } from '@lucide/svelte';
  import { Tabs } from '@kuratchi/ui';
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  const activeSelection = $derived(page.url.pathname);

  const tabs = [
    { label: 'Vehicles', href: '/catalog', icon: Bike },
    { label: 'Categories', href: '/catalog/categories', icon: Tag },
    { label: 'OEMs', href: '/catalog/oems', icon: Building2 },
    { label: 'Import', href: '/catalog/import', icon: FileText }
  ];
</script>

<div class="p-8">
  <!-- Tabs Navigation -->
  <Tabs {tabs} {activeSelection}>
    {@render children()}
  </Tabs>
</div>
