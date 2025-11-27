<script lang="ts">
  import type { Snippet } from 'svelte';
  import AppHeader from './AppHeader.svelte';
  import AppSidebar from './AppSidebar.svelte';
  import type { AppNavItem, AppUser } from './types';
  import { Home, Layout, Mail, Database, GlobeLock, Folder, Activity, Settings, Shield } from '@lucide/svelte';

  interface Props {
    workspace: string;
    user: AppUser;
    isSuperadmin?: boolean;
    menu?: AppNavItem[];
    children: Snippet;
  }

  const defaultMenu: AppNavItem[] = [
    { label: 'Overview', icon: Home, href: '/' },
    { label: 'Sites', icon: Layout, href: '/sites' },
    { label: 'Emails', icon: Mail, href: '/emails' },
    { label: 'Forms', icon: Database, href: '/forms' },
    { label: 'Domains', icon: GlobeLock, href: '/domains' },
    { label: 'Storage', icon: Folder, href: '/storage' },
    { label: 'Activity', icon: Activity, href: '/activity' },
    { label: 'Settings', icon: Settings, href: '/settings' },
    { label: 'Super Admin', icon: Shield, href: '/superadmin', requireSuperadmin: true }
  ];

  let {
    workspace,
    user,
    isSuperadmin = false,
    menu = defaultMenu,
    children
  }: Props = $props();
</script>

<div class="kui-app-shell">
  <AppSidebar {menu} {isSuperadmin} />
  <div class="kui-app-shell__body">
    <AppHeader {workspace} {user} {isSuperadmin} />
    <main class="kui-app-shell__main">
      {@render children()}
    </main>
  </div>
</div>

<style>
  :global(body) {
    background: var(--kui-color-surface-muted);
    color: var(--kui-color-text);
  }

  .kui-app-shell {
    display: grid;
    grid-template-columns: 260px 1fr;
    min-height: 100vh;
    background: var(--kui-color-surface-muted);
  }

  .kui-app-shell__body {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .kui-app-shell__main {
    flex: 1;
    padding: var(--kui-spacing-lg);
    padding-bottom: calc(var(--kui-spacing-xl) * 1.2);
  }

  @media (max-width: 960px) {
    .kui-app-shell {
      grid-template-columns: 220px 1fr;
    }
  }

  @media (max-width: 768px) {
    .kui-app-shell {
      grid-template-columns: 1fr;
    }

    .kui-app-shell__body {
      min-height: auto;
    }
  }
</style>
