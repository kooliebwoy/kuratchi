<script lang="ts">
  import '../app.css';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Header from '$lib/components/Header.svelte';
  import type { LayoutData } from './$types';
  import type { Snippet } from 'svelte';
	import { getOrganizationNameById } from '$lib/api/organizations.remote';
	import HelpWidget from '$components/HelpWidget.svelte';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();

  // Make these reactive to data changes
  const isAuthenticated = $derived(data.isAuthenticated);
  const isSuperadmin = $derived(data.isSuperadmin);
  const user = $derived(data.user);
  
  const workspace = $derived(user?.organizationId ? await getOrganizationNameById(user.organizationId) : 'Unknown Organization');
</script>

{#if isAuthenticated}
  <div class="flex min-h-screen bg-base-100 text-base-content">
    <Sidebar {isSuperadmin} />
    <div class="flex flex-1 flex-col">
      <Header {workspace} {user} {isSuperadmin} />
      <main class="flex-1 overflow-y-auto px-8 py-8">
        {@render children()}
      </main>
    </div>
  </div>

  <HelpWidget />
{:else}
  {@render children()}
{/if}