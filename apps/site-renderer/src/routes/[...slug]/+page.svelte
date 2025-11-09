<script lang="ts">
  import { getBlock } from '@kuratchi/editor';

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

  const blockKey = (block: Record<string, unknown>, index: number) => {
    if (typeof block.id === 'string' && block.id.length > 0) return block.id;
    if (typeof block.type === 'string' && block.type.length > 0) return `${block.type}-${index}`;
    return `block-${index}`;
  };
</script>

{#if page && pageData}
  <main class="container mx-auto px-6 py-16 space-y-8">
    <section class="space-y-8">
      {#if contentBlocks.length > 0}
        {#each contentBlocks as block, index (blockKey(block, index))}
          {@const blockType = typeof block.type === 'string' ? block.type : null}
          {#if blockType}
            {@const blockEntry = getBlock(blockType)}
            {#if blockEntry?.component}
              {@const Component = blockEntry.component}
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
