<script lang="ts">
  import { page } from '$app/state';
  import { Home, Database, Shield, Settings, Activity, Globe, Clock, Mail, Folder, Package, Layout } from 'lucide-svelte';

  let { isSuperadmin }: { isSuperadmin: boolean } = $props();

  const menu = [
    { label: 'Overview', icon: Home, href: '/' },
    { label: 'Sites', icon: Layout, href: '/sites' },
    { label: 'Emails', icon: Mail, href: '/emails' },
    { label: 'Database', icon: Database, href: '/database' },
    { label: 'Domains', icon: Globe, href: '/domains' },
    // { label: 'Products', icon: Package, href: '/products' },
    // { label: 'Sessions', icon: Clock, href: '/sessions' },
    { label: 'Storage', icon: Folder, href: '/storage' },
    { label: 'Activity', icon: Activity, href: '/activity' },
    { label: 'Settings', icon: Settings, href: '/settings' },
    { label: 'Super Admin', icon: Shield, href: '/superadmin', requireSuperadmin: true }
  ];

  // Filter menu items based on permissions
  const visibleMenu = $derived(menu.filter(item => {
    if (item.requireSuperadmin) {
      return isSuperadmin;
    }
    return true;
  }));

  const isActive = (href: string) => {
    return page.url.pathname === href;
  };
</script>

<aside class="flex h-screen min-w-[260px] flex-col gap-6 border-r border-base-200 bg-base-200/30 px-6 py-6">
  <div class="flex items-center gap-3">
    <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
      <Globe class="h-5 w-5" />
    </div>
    <div>
      <p class="text-sm uppercase tracking-widest text-primary/70">Kuratchi</p>
      <h1 class="text-lg font-semibold text-base-content">Dashboard</h1>
    </div>
  </div>
  <nav class="flex flex-1 flex-col gap-1">
    {#each visibleMenu as item}
      {#if isActive(item.href)}
        <a
          href={item.href}
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-primary shadow-soft-xl transition hover:bg-primary/15 hover:text-primary"
        >
          <item.icon class="h-4 w-4" />
          <span>{item.label}</span>
        </a>
      {:else}
        <a
          href={item.href}
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-base-content/80 transition hover:bg-primary/10 hover:text-primary"
        >
          <item.icon class="h-4 w-4" />
          <span>{item.label}</span>
        </a>
      {/if}
    {/each}
  </nav>
</aside>
