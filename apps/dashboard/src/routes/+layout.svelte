<script lang="ts">
  import '../app.css';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Header from '$lib/components/Header.svelte';
  import type { LayoutData } from './$types';
  import type { Snippet } from 'svelte';
	import { getOrganizationNameById } from '$lib/api/organizations.remote';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();

  const isAuthenticated = data.isAuthenticated;
  const isSuperadmin = data.isSuperadmin;
  const user = data.user;
  
  const workspace = $derived(user.organizationId ? await getOrganizationNameById(user.organizationId) : 'Unknown Organization');
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
{:else}
  {@render children()}
{/if}