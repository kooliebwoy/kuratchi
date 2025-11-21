<script lang="ts">
  import '../app.css';
  import AppShell from '$components/app-shell/AppShell.svelte';
  import type { LayoutData } from './$types';
  import type { Snippet } from 'svelte';
	import { getOrganizationNameById } from '$lib/functions/organizations.remote';
	import HelpWidget from '$components/HelpWidget.svelte';
  import { page } from '$app/state';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();

  // Make these reactive to data changes
  const isAuthenticated = $derived(data.isAuthenticated);
  const isSuperadmin = $derived(data.isSuperadmin);
  const user = $derived(data.user);
  const skipRootLayout = $derived(page.data.skipRootLayout);
  
  const workspace = $derived(user?.organizationId ? await getOrganizationNameById(user.organizationId) : 'Unknown Organization');
</script>

{#if isAuthenticated && !skipRootLayout}
  <AppShell {workspace} {user} {isSuperadmin}>
    {@render children()}
  </AppShell>
  <HelpWidget />
{:else}
  {@render children()}
{/if}
