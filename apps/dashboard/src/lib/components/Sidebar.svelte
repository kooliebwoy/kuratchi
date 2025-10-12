<script lang="ts">
  import { page } from '$app/state';
  import { Home, Database, Users, Shield, Settings, Activity, Globe, Building2, Clock, Mail, File, Folder } from 'lucide-svelte';

  const menu = [
    { label: 'Overview', icon: Home, href: '/' },
    { label: 'Organizations', icon: Building2, href: '/organizations' },
    { label: 'Databases', icon: Database, href: '/databases' },
    { label: 'Domains', icon: Globe, href: '/domains' },
    { label: 'Sessions', icon: Clock, href: '/sessions' },
    { label: 'Users', icon: Users, href: '/users' },
    { label: 'Roles', icon: Shield, href: '/roles' },
    { label: 'Storage', icon: Folder, href: '/storage' },
    { label: 'Emails', icon: Mail, href: '/emails' },
    { label: 'Activity', icon: Activity, href: '/activity' },
    { label: 'Settings', icon: Settings, href: '/settings' },
    { label: 'Super Admin', icon: Shield, href: '/superadmin', role: 'isSuperAdmin' }
  ];

  const isActive = (href: string) => {
    return page.url.pathname === href;
  };
</script>

<aside class="flex h-full min-w-[260px] flex-col gap-6 border-r border-base-200 bg-base-200/30 px-6 py-6">
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
    {#each menu as item}
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
