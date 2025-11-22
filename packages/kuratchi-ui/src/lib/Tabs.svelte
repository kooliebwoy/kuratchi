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
    activeSelection?: string;
    children: Snippet;
  }

  let { tabs, activeSelection, children }: Props = $props();

  function isActive(tabHref: string): boolean {
    if (!activeSelection) return false;
    // Exact match only - one tab should be active at a time
    return activeSelection === tabHref;
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
        role="tab"
        aria-selected={isActive(tab.href)}
      >
        {#if Icon}
          <Icon class="kui-tabs__icon" aria-hidden="true" />
        {/if}
        <span class="kui-tabs__label">{tab.label}</span>
        {#if tab.badge !== undefined}
          <span class="kui-tabs__badge">{tab.badge}</span>
        {/if}
      </a>
    {/each}
  </div>

  <div class="kui-tabs__content">
    {@render children()}
  </div>
</div>
