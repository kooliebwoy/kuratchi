<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Tab {
    label: string;
    href: string;
    icon?: any;
    badge?: string | number;
  }

  interface Props {
    tabs: Tab[];
    children: Snippet;
  }

  let { tabs, children }: Props = $props();

  let currentPath = $state(typeof window !== 'undefined' ? window.location.pathname : '');
  
  $effect(() => {
    if (typeof window === 'undefined') return;
    const updatePath = () => {
      currentPath = window.location.pathname;
    };
    window.addEventListener('popstate', updatePath);
    return () => {
      window.removeEventListener('popstate', updatePath);
    };
  });

  function isActive(tabHref: string): boolean {
    // Exact match for root paths, or prefix match for nested paths
    if (currentPath === tabHref) return true;
    if (tabHref !== '/' && currentPath.startsWith(tabHref + '/')) return true;
    return false;
  }
</script>

<div class="kui-tabs-container">
  <div class="kui-tabs" role="tablist">
    {#each tabs as tab}
      {@const Icon = tab.icon}
      <a 
        href={tab.href} 
        class={`kui-tabs__item ${isActive(tab.href) ? 'kui-tabs__item--active' : ''}`.trim()}
        aria-current={isActive(tab.href) ? 'page' : undefined}
      >
        {#if Icon}
          <Icon class="kui-tabs__icon" />
        {/if}
        {tab.label}
        {#if tab.badge !== undefined}
          <span class="kui-badge kui-badge--size-sm">{tab.badge}</span>
        {/if}
      </a>
    {/each}
  </div>

  <div class="kui-tabs__content">
    {@render children()}
  </div>
</div>
