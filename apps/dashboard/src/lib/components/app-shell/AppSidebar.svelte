<script lang="ts">
  import { page } from '$app/state';
  import { Globe } from 'lucide-svelte';
  import type { AppNavItem } from './types';

  interface Props {
    menu: AppNavItem[];
    isSuperadmin?: boolean;
  }

  let { menu, isSuperadmin = false }: Props = $props();

  const visibleMenu = $derived(menu.filter(item => !item.requireSuperadmin || isSuperadmin));

  const isActive = (href: string) => {
    const current = page.url.pathname;
    return current === href || (href !== '/' && current.startsWith(href));
  };
</script>

<aside class="kui-app-sidebar">
  <div class="kui-app-sidebar__brand">
    <div class="kui-app-sidebar__logo">
      <Globe />
    </div>
    <div>
      <p class="kui-app-sidebar__eyebrow">Kuratchi</p>
      <h1 class="kui-app-sidebar__title">Dashboard</h1>
    </div>
  </div>

  <nav class="kui-app-sidebar__nav">
    {#each visibleMenu as item}
      <a class={`kui-app-sidebar__link ${isActive(item.href) ? 'is-active' : ''}`} href={item.href}>
        <item.icon class="kui-app-sidebar__icon" />
        <span>{item.label}</span>
      </a>
    {/each}
  </nav>
</aside>

<style>
  .kui-app-sidebar {
    display: flex;
    flex-direction: column;
    gap: var(--kui-spacing-lg);
    padding: var(--kui-spacing-lg);
    border-right: 1px solid var(--kui-color-border);
    background: linear-gradient(180deg, rgba(88, 76, 217, 0.08), rgba(88, 76, 217, 0)) var(--kui-color-surface);
    min-height: 100vh;
    position: sticky;
    top: 0;
  }

  .kui-app-sidebar__brand {
    display: flex;
    align-items: center;
    gap: var(--kui-spacing-sm);
  }

  .kui-app-sidebar__logo {
    width: 2.75rem;
    height: 2.75rem;
    border-radius: var(--kui-radius-lg);
    background: var(--kui-color-primary-weak);
    color: var(--kui-color-primary);
    display: grid;
    place-items: center;
    box-shadow: var(--kui-shadow-xs);
  }

  .kui-app-sidebar__eyebrow {
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--kui-color-primary) 70%, var(--kui-color-text) 30%);
    margin: 0 0 0.15rem;
  }

  .kui-app-sidebar__title {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 700;
  }

  .kui-app-sidebar__nav {
    display: grid;
    gap: 0.4rem;
  }

  .kui-app-sidebar__link {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.65rem 0.85rem;
    border-radius: var(--kui-radius-md);
    color: var(--kui-color-muted);
    text-decoration: none;
    font-weight: 600;
    transition: background var(--kui-duration-base) ease, color var(--kui-duration-base) ease, transform var(--kui-duration-base) ease;
  }

  .kui-app-sidebar__link:hover {
    background: var(--kui-color-primary-weak);
    color: var(--kui-color-primary);
    transform: translateX(2px);
  }

  .kui-app-sidebar__link.is-active {
    color: var(--kui-color-primary);
    background: rgba(88, 76, 217, 0.12);
    box-shadow: var(--kui-shadow-xs);
  }

  .kui-app-sidebar__icon {
    width: 1.05rem;
    height: 1.05rem;
  }

  @media (max-width: 768px) {
    .kui-app-sidebar {
      position: relative;
      min-height: auto;
      border-right: none;
      border-bottom: 1px solid var(--kui-color-border);
    }

    .kui-app-sidebar__nav {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    }
  }
</style>
