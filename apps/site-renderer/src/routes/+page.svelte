<script lang="ts">
  import { getBlock } from '@kuratchi/editor';

  interface PagePayload {
    content?: Array<Record<string, unknown>>;
    metadata?: Record<string, unknown> | null;
    header?: Record<string, unknown> | null;
    footer?: Record<string, unknown> | null;
  }

  interface PageResponse {
    title?: string;
    data?: PagePayload | null;
  }

  let { data } = $props();

  const site = data?.site ?? null;
  const page = (data?.page ?? null) as PageResponse | null;
  const pageData = (page?.data ?? null) as PagePayload | null;
  const contentBlocks = (pageData?.content ?? []) as Array<Record<string, unknown>>;

  const seoDescription = typeof pageData?.metadata?.seoDescription === 'string'
    ? (pageData.metadata!.seoDescription as string)
    : null;

  const backgroundColor = typeof pageData?.metadata?.backgroundColor === 'string'
    ? (pageData.metadata!.backgroundColor as string)
    : undefined;

  const blockKey = (block: Record<string, unknown>, index: number) => {
    if (typeof block.id === 'string' && block.id.length > 0) return block.id;
    if (typeof block.type === 'string' && block.type.length > 0) return `${block.type}-${index}`;
    return `block-${index}`;
  };
</script>

<div class="min-h-screen bg-base-100 text-base-content" style:background-color={backgroundColor}>
  {#if page && pageData}
    <main class="container mx-auto px-6 py-16 space-y-8">
      {#if page.title}
        <header class="text-center space-y-3">
          <h1 class="text-4xl sm:text-5xl font-bold tracking-tight">
            {page.title}
          </h1>
          {#if seoDescription}
            <p class="text-lg text-base-content/70 max-w-2xl mx-auto">
              {seoDescription}
            </p>
          {/if}
        </header>
      {/if}

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
      <h1 class="text-4xl font-bold">Welcome to {site?.name || 'Your Site'}</h1>
      <p class="text-xl text-base-content/70 max-w-2xl mx-auto">
        {site?.description || 'This site is being built with Kuratchi.'}
      </p>
      <div class="alert alert-info max-w-2xl mx-auto">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span>No homepage has been created yet. Create pages in the dashboard to get started.</span>
      </div>
    </div>
  {/if}
</div>
