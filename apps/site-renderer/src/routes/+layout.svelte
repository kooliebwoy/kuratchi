<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	
	let { children, data } = $props();
	
	const site = $derived(data?.site);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	{#if site}
		<title>{site.name}</title>
		{#if site.description}
			<meta name="description" content={site.description} />
		{/if}
	{/if}
</svelte:head>

{#if !site}
	<div class="min-h-screen flex items-center justify-center bg-base-200">
		<div class="text-center">
			<h1 class="text-4xl font-bold mb-4">Site Not Found</h1>
			<p class="text-base-content/60">The requested site could not be found.</p>
		</div>
	</div>
{:else}
	{@render children?.()}
{/if}
