<script lang="ts">
	let { data } = $props();
	const doc = data.doc;
</script>

<svelte:head>
	<title>{doc.title} · Kuratchi SDK Docs</title>
</svelte:head>

<article class="prose">
	<p class="mb-3 text-sm text-gray-500">
		<a href="/sdk/overview" class="hover:text-gray-800">SDK</a>
		<span class="mx-1 text-gray-400">/</span>
		<span>{doc.title}</span>
	</p>
	<h1 class="mb-6 text-3xl font-bold">{doc.title}</h1>
	<div class="mt-2" data-doc-slug={doc.slug}>
		{@html doc.html}
	</div>
</article>
