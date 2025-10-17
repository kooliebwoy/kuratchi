<script lang="ts">
  import { page } from '$app/stores';
  import type { Snippet } from 'svelte';

  interface Tab {
    label: string;
    href: string;
    icon?: any;
    badge?: string | number;
  }

  interface Props {
    tabs: Tab[];
    children?: Snippet;
  }

  let { tabs, children }: Props = $props();

  // Get current path for active tab detection
  const currentPath = $derived($page?.url?.pathname || '');

  function isActive(tabHref: string): boolean {
    // Exact match for root paths, or prefix match for nested paths
    if (currentPath === tabHref) return true;
    if (tabHref !== '/' && currentPath.startsWith(tabHref + '/')) return true;
    return false;
  }
</script>

<div class="w-full">
  <!-- Tabs Navigation -->
  <div class="tabs tabs-boxed mb-6 w-fit">
    {#each tabs as tab}
      {@const Icon = tab.icon}
      <a 
        href={tab.href} 
        class="tab gap-2 {isActive(tab.href) ? 'tab-active' : ''}"
      >
        {#if Icon}
          <Icon class="h-4 w-4" />
        {/if}
        {tab.label}
        {#if tab.badge !== undefined}
          <span class="badge badge-sm">{tab.badge}</span>
        {/if}
      </a>
    {/each}
  </div>

  <!-- Tab Content -->
  {#if children}
    <div class="tab-content">
      {@render children()}
    </div>
  {/if}
</div>
