<script lang="ts">
  import { Editor, type PageData } from '@kuratchi/editor';
  import { getSiteById } from '$lib/api/sites.remote';

  const site = getSiteById();

  // Initialize page data for the editor
  let pageData = $state<PageData>({
    title: 'Untitled Page',
    seoTitle: '',
    seoDescription: '',
    slug: '',
    header: null,
    content: [],
    footer: null
  });

  // Load site content when available
  $effect(() => {
    if (site.current) {
      // TODO: Load actual page data from the site
      pageData = {
        title: site.current.name,
        seoTitle: site.current.name,
        seoDescription: site.current.description || '',
        slug: site.current.subdomain,
        header: null,
        content: [],
        footer: null
      };
    }
  });

  // Handle editor updates
  async function handleEditorUpdate(updatedPageData: PageData) {
    console.log('Editor updated:', updatedPageData);
    // TODO: Save to API
  }
</script>

<div class="card border border-base-200 bg-base-200/30">
  <div class="card-body p-0">
    {#if site.loading}
      <div class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
    {:else if site.error}
      <div class="alert alert-error m-6">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Error loading site</span>
      </div>
    {:else if site.current}
      <Editor 
        bind:pageData={pageData}
        editable={true}
        showUI={true}
        onUpdate={handleEditorUpdate}
        autoSaveDelay={2000}
      />
    {/if}
  </div>
</div>
