<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { 
    logRouteActivity, 
    getSiteById
  } from '$lib/api/sites.remote';
  import { Layout, Save, ArrowLeft, Palette, ExternalLink, Settings2 } from 'lucide-svelte';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
  
  // Load data using remote functions
  logRouteActivity();
  const site = getSiteById();

  const siteId = $derived($page.params.id);
  const currentPath = $derived($page.url.pathname);
  
  // Determine active tab from URL
  const activeTab = $derived(() => {
    if (currentPath.endsWith('/theme')) return 'theme';
    if (currentPath.endsWith('/settings')) return 'settings';
    return 'editor';
  });

  function navigateToTab(tab: 'editor' | 'theme' | 'settings') {
    const basePath = `/sites/${siteId}`;
    if (tab === 'editor') {
      goto(basePath);
    } else {
      goto(`${basePath}/${tab}`);
    }
  }

  async function handleSave() {
    // This will be implemented with the API
    console.log('Saving site changes');
  }
</script>

<svelte:head>
  <title>{site.current?.name || 'Site'} - Kuratchi Dashboard</title>
</svelte:head>

<section class="space-y-6">
  <!-- Header -->
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div class="flex items-center gap-4">
      <button onclick={() => goto('/sites')} class="btn btn-ghost btn-sm btn-circle">
        <ArrowLeft class="h-4 w-4" />
      </button>
      <div>
        {#if site.loading}
          <div class="flex items-center gap-2">
            <span class="loading loading-spinner loading-sm"></span>
            <h1 class="text-2xl font-semibold">Loading...</h1>
          </div>
        {:else if site.current}
          <h1 class="text-2xl font-semibold">{site.current.name}</h1>
          <p class="text-sm text-base-content/60">{site.current.subdomain}.kuratchi.com</p>
        {/if}
      </div>
    </div>
    <div class="flex gap-2">
      {#if site.current?.subdomain}
        <a 
          href="https://{site.current.subdomain}.kuratchi.com" 
          target="_blank" 
          rel="noopener noreferrer"
          class="btn btn-ghost btn-sm"
        >
          <ExternalLink class="h-4 w-4" />
          Visit Site
        </a>
      {/if}
      <button class="btn btn-primary btn-sm" onclick={handleSave}>
        <Save class="h-4 w-4" />
        Save Changes
      </button>
    </div>
  </div>

  {#if site.loading}
    <div class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  {:else if site.error}
    <div class="alert alert-error">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>Error loading site</span>
    </div>
  {:else if site.current}
    <!-- Tabs -->
    <div class="tabs tabs-boxed bg-base-200/30 p-1">
      <button 
        class="tab {activeTab() === 'editor' ? 'tab-active' : ''}" 
        onclick={() => navigateToTab('editor')}
      >
        <Layout class="h-4 w-4 mr-2" />
        Editor
      </button>
      <button 
        class="tab {activeTab() === 'theme' ? 'tab-active' : ''}" 
        onclick={() => navigateToTab('theme')}
      >
        <Palette class="h-4 w-4 mr-2" />
        Theme
      </button>
      <button 
        class="tab {activeTab() === 'settings' ? 'tab-active' : ''}" 
        onclick={() => navigateToTab('settings')}
      >
        <Settings2 class="h-4 w-4 mr-2" />
        Settings
      </button>
    </div>

    <!-- Tab Content -->
    {@render children()}
  {/if}
</section>
