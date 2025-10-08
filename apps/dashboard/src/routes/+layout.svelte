<script lang="ts">
  import '../app.css';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Header from '$lib/components/Header.svelte';
  import type { LayoutData } from './$types';
  import type { Snippet } from 'svelte';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();

  const isAuthenticated = data.isAuthenticated;
  const user = data.user;
  
  const workspace = 'Orbit SaaS Workspace';
</script>

{#if isAuthenticated}
  <div class="flex min-h-screen bg-base-100 text-base-content">
    <Sidebar />
    <div class="flex flex-1 flex-col">
      <Header {workspace} {user} />
      <main class="flex-1 overflow-y-auto px-8 py-8">
        {@render children()}
      </main>
    </div>
  </div>
{:else}
  {@render children()}
{/if}