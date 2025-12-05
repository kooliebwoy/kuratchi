<script lang="ts">
  import { setContext } from 'svelte';
  import { getBlock, getSection } from '@kuratchi/editor';

  interface PagePayload {
    content?: Array<Record<string, unknown>>;
  }

  interface PageResponse {
    title?: string;
    seoDescription?: string;
    data?: PagePayload | null;
  }

  let { data } = $props();

  const site = data?.site ?? null;
  const page = (data?.page ?? null) as PageResponse | null;
  const pageData = (page?.data ?? null) as PagePayload | null;
  const contentBlocks = (pageData?.content ?? []) as Array<Record<string, unknown>>;

  // Catalog data for CatalogGrid and FeaturedVehicles sections
  const catalogOems = data?.catalogOems ?? [];
  const catalogVehicles = data?.catalogVehicles ?? [];

  // Provide siteMetadata context for catalog sections (matches Editor's context shape)
  setContext('siteMetadata', {
    get catalogOems() { return catalogOems; },
    get catalogVehicles() { return catalogVehicles; }
  });

  const blockKey = (block: Record<string, unknown>, index: number) => {
    if (typeof block.id === 'string' && block.id.length > 0) return block.id;
    if (typeof block.type === 'string' && block.type.length > 0) return `${block.type}-${index}`;
    return `block-${index}`;
  };

  // Helper to get component from either blocks or sections registry
  const getComponent = (type: string) => {
    const block = getBlock(type);
    if (block?.component) return block.component;
    
    const section = getSection(type);
    if (section?.component) return section.component;
    
    return null;
  };
</script>

{#if page && pageData}
  <main class="container mx-auto px-6 py-16 space-y-8">
    <section class="space-y-8">
      {#if contentBlocks.length > 0}
        {#each contentBlocks as block, index (blockKey(block, index))}
          {@const blockType = typeof block.type === 'string' ? block.type : null}
          {#if blockType}
            {@const Component = getComponent(blockType)}
            {#if Component}
              {@const props = { ...block, editable: false } satisfies Record<string, unknown>}
              <Component {...props} />
            {/if}
          {/if}
        {/each}
      {:else}
        <p class="text-base-content/60">No content available for this page.</p>
      {/if}
    </section>
  </main>
{:else}
  <div class="container mx-auto px-6 py-24 text-center space-y-6">
    <h1 class="text-4xl font-bold">Page Not Found</h1>
    <p class="text-xl text-base-content/70 max-w-2xl mx-auto">
      The page you're looking for doesn't exist.
    </p>
    <a href="/" class="btn btn-primary">Go Home</a>
  </div>
{/if}
