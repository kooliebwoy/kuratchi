<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { getBlock, getHeader, getFooter, blogStore } from '@kuratchi/editor';
	
	let { children, data } = $props();
	
	const site = $derived(data?.site);
	
	// Get header/footer/metadata from site.metadata (site-level)
	const siteMetadata = $derived((site?.metadata ?? {}) as Record<string, unknown>);
	const siteHeader = $derived((siteMetadata.header ?? null) as Record<string, unknown> | null);
	const siteFooter = $derived((siteMetadata.footer ?? null) as Record<string, unknown> | null);
	const backgroundColor = $derived(
		typeof siteMetadata.backgroundColor === 'string'
			? siteMetadata.backgroundColor
			: '#ffffff'
	);

	const blogData = $derived(() => {
		const raw = (siteMetadata as any).blog;
		return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
	});

	$effect(() => {
		if (blogData) {
			blogStore.set(blogData as any);
		}
	});
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
	<div class="min-h-screen bg-base-100 text-base-content" style:background-color={backgroundColor}>
		<!-- Site Header -->
		{#if siteHeader?.blocks && Array.isArray(siteHeader.blocks)}
			{#each siteHeader.blocks as headerBlock}
				{@const headerType = typeof headerBlock.type === 'string' ? headerBlock.type : null}
				{#if headerType}
					{@const headerEntry = getHeader(headerType)}
					{#if headerEntry?.component}
						{@const HeaderComponent = headerEntry.component}
						{@const headerProps = { ...headerBlock, editable: false } satisfies Record<string, unknown>}
						<HeaderComponent {...headerProps} />
					{/if}
				{/if}
			{/each}
		{/if}

		<!-- Page Content -->
		{@render children?.()}

		<!-- Site Footer -->
		{#if siteFooter?.blocks && Array.isArray(siteFooter.blocks)}
			{#each siteFooter.blocks as footerBlock}
				{@const footerType = typeof footerBlock.type === 'string' ? footerBlock.type : null}
				{#if footerType}
					{@const footerEntry = getFooter(footerType)}
					{#if footerEntry?.component}
						{@const FooterComponent = footerEntry.component}
						{@const footerProps = { ...footerBlock, editable: false } satisfies Record<string, unknown>}
						<FooterComponent {...footerProps} />
					{/if}
				{/if}
			{/each}
		{/if}
	</div>
{/if}
