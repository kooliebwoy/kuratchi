<script lang="ts">
  import { Editor, type PageData, defaultPageData } from '@kuratchi/editor';
  import { loadSiteEditor, saveSitePage } from '$lib/api/editor.remote';

  const clone = <T>(value: T): T =>
    typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));

  interface SiteInfo {
    id: string;
    name: string | null;
    subdomain: string | null;
    description: string | null;
    databaseId: string | null;
    dbuuid: string | null;
    workerName: string | null;
  }

  const editorQuery = loadSiteEditor();
  const loading = $derived(editorQuery.loading);
  const queryError = $derived(editorQuery.error);

  let site = $state<SiteInfo | null>(null);
  let pageData = $state<PageData>(clone(defaultPageData));
  let loaded = $state(false);
  let saving = $state(false);
  let saveError = $state<string | null>(null);
  let saveMessage = $state<string | null>(null);
  let saveMessageTimeout: ReturnType<typeof setTimeout> | null = null;
  const initialData = await editorQuery;

  site = initialData.site;
  pageData = clone(initialData.page);

  loaded = true;

  function setSaveMessage(message: string | null) {
    if (saveMessageTimeout) {
      clearTimeout(saveMessageTimeout);
      saveMessageTimeout = null;
    }

    saveMessage = message;

    if (message) {
      saveMessageTimeout = setTimeout(() => {
        saveMessage = null;
        saveMessageTimeout = null;
      }, 3000);
    }
  }

  async function handleEditorUpdate(updatedPageData: PageData) {
    if (!site?.id) return;

    saving = true;
    saveError = null;

    const payload = clone(updatedPageData);

    try {
      const result = await saveSitePage({ siteId: site.id, page: payload }).updates(
        editorQuery.withOverride((current) => (current ? { ...current, page: payload } : current))
      );

      if (result?.id) {
        payload.id = result.id;
      }

      pageData = payload;
      setSaveMessage('Changes saved');
    } catch (err) {
      console.error('Failed to save page', err);
      saveError = 'Failed to save changes. Please try again.';
    } finally {
      saving = false;
    }
  }
</script>

<div class="card border border-base-200 bg-base-200/30">
  <div class="card-body p-0">
    {#if queryError}
      <div class="alert alert-error m-6">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Failed to load site editor</span>
      </div>
    {:else if !loaded || loading}
      <div class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
    {:else}
      <div class="flex items-center justify-between border-b border-base-200 bg-base-100 px-4 py-2 text-sm">
        <div class="flex items-center gap-3">
          <div class="font-medium">{site?.name ?? 'Site'}</div>
          {#if saving}
            <div class="flex items-center gap-1 text-base-content/80">
              <span class="loading loading-spinner loading-xs"></span>
              <span>Saving…</span>
            </div>
          {:else if saveMessage}
            <span class="text-success">{saveMessage}</span>
          {:else}
            <span class="text-base-content/60">All changes saved</span>
          {/if}
        </div>
        {#if site?.subdomain}
          <span class="badge badge-outline">{site.subdomain}.kuratchi.com</span>
        {/if}
      </div>

      {#if saveError}
        <div class="alert alert-error m-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{saveError}</span>
        </div>
      {/if}

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
