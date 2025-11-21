<script lang="ts">
  import type { DocContent } from '$lib/docs';

  export let data: { doc: DocContent };
</script>

<svelte:head>
  <title>{data.doc.title} | Kuratchi Docs</title>
  <meta name="description" content={data.doc.description} />
</svelte:head>

<section class="space-y-6 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
  <div class="space-y-2">
    <p class="text-sm font-semibold uppercase tracking-wide text-blue-600">Kuratchi SDK</p>
    <h1 class="text-3xl font-bold text-gray-900">{data.doc.title}</h1>
    <p class="text-base text-gray-600">{data.doc.description}</p>
  </div>

  <article class="prose max-w-none text-gray-900">
    {@html data.doc.html}
  </article>
</section>

<style>
  :global(.prose h1) {
    font-size: 2rem;
    font-weight: 800;
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
  }

  :global(.prose h2) {
    font-size: 1.5rem;
    font-weight: 700;
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
  }

  :global(.prose h3) {
    font-size: 1.25rem;
    font-weight: 700;
    margin-top: 1.25rem;
    margin-bottom: 0.5rem;
  }

  :global(.prose p),
  :global(.prose ul),
  :global(.prose ol) {
    margin-bottom: 1rem;
    line-height: 1.6;
    color: #374151;
  }

  :global(.prose code) {
    background-color: #f3f4f6;
    padding: 0.2rem 0.4rem;
    border-radius: 0.375rem;
    font-size: 0.9rem;
  }

  :global(.prose pre) {
    background-color: #0f172a;
    color: #e2e8f0;
    padding: 1rem;
    border-radius: 0.75rem;
    overflow-x: auto;
  }

  :global(.prose table) {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1rem;
  }

  :global(.prose th),
  :global(.prose td) {
    border: 1px solid #e5e7eb;
    padding: 0.75rem;
  }

  :global(.prose a) {
    color: #2563eb;
    text-decoration: underline;
  }
</style>
