<script lang="ts">
  import { Editor, type PageData, defaultPageData } from '@kuratchi/editor';
  import { loadSiteEditor, saveSitePage, saveSiteMetadata, listSitePages, createSitePage, loadSitePage, type PageListItem } from '$lib/functions/editor.remote';
  import { uploadSiteMedia } from '$lib/functions/storage.remote';

  const clone = <T>(value: T): T => {
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(value);
      } catch (error) {
        console.warn('structuredClone failed, falling back to JSON clone', error);
      }
    }

    return JSON.parse(JSON.stringify(value));
  };

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
  let siteHeader = $state<Record<string, unknown> | null>(null);
  let siteFooter = $state<Record<string, unknown> | null>(null);
  let siteMetadata = $state<Record<string, unknown>>({});
  let loaded = $state(false);
  let saving = $state(false);
  let saveError = $state<string | null>(null);
  let saveMessage = $state<string | null>(null);
  let saveMessageTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Page management
  let pages = $state<PageListItem[]>([]);
  let currentPageId = $state<string | null>(null);
  let showCreatePageModal = $state(false);
  let newPageTitle = $state('');
  let newPageSlug = $state('');
  let creatingPage = $state(false);
  const initialData = await editorQuery;

  site = initialData.site;
  pageData = clone(initialData.page);
  
  // Extract site-level data from site.metadata
  if (site?.metadata) {
    const meta = site.metadata as Record<string, unknown>;
    siteHeader = (meta.header as Record<string, unknown>) ?? null;
    siteFooter = (meta.footer as Record<string, unknown>) ?? null;
    siteMetadata = { ...meta };
    delete siteMetadata.header;
    delete siteMetadata.footer;
  }

  loaded = true;
  
  // Load pages list
  loadPagesList();
  
  // Set current page ID
  if (pageData.id) {
    currentPageId = pageData.id;
  }
  
  async function loadPagesList() {
    try {
      const pagesQuery = listSitePages();
      const pagesData = await pagesQuery;
      pages = pagesData;
    } catch (err) {
      console.error('Failed to load pages', err);
    }
  }
  
  async function switchToPage(pageId: string) {
    if (!site?.id || pageId === currentPageId) return;
    
    try {
      const loadPageQuery = loadSitePage({ siteId: site.id, pageId });
      const loadedPage = await loadPageQuery;
      pageData = clone(loadedPage);
      currentPageId = pageId;
    } catch (err) {
      console.error('Failed to load page', err);
      saveError = 'Failed to load page';
    }
  }
  
  function openCreatePageModal() {
    newPageTitle = '';
    newPageSlug = '';
    showCreatePageModal = true;
  }
  
  function closeCreatePageModal() {
    showCreatePageModal = false;
    newPageTitle = '';
    newPageSlug = '';
  }
  
  function generateSlug(title: string) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  
  $effect(() => {
    if (newPageTitle && !newPageSlug) {
      newPageSlug = generateSlug(newPageTitle);
    }
  });
  
  async function handleCreatePage() {
    if (!site?.id || !newPageTitle || !newPageSlug) return;
    
    creatingPage = true;
    
    try {
      const result = await createSitePage({ siteId: site.id, title: newPageTitle, slug: newPageSlug });
      
      // Reload pages list
      await loadPagesList();
      
      // Auto-add to header menu if not present
      try {
        const link = `/${newPageSlug}`;
        const currentHeader = (siteHeader || {}) as Record<string, unknown>;
        const currentMenu = Array.isArray((currentHeader as any).menu) ? ([...(currentHeader as any).menu] as any[]) : [];
        const exists = currentMenu.some((item) => typeof item === 'object' && item && (item as any).link === link);
        if (!exists) {
          const updatedMenu = [...currentMenu, { label: newPageTitle, link }];
          const updatedHeader = { ...currentHeader, menu: updatedMenu } as Record<string, unknown>;
          const newMetadata = { ...siteMetadata, header: updatedHeader, footer: siteFooter } as Record<string, unknown>;
          await saveSiteMetadata({ siteId: site.id, metadata: newMetadata });
          siteHeader = updatedHeader;
          siteMetadata = { ...newMetadata };
        }
      } catch (e) {
        console.warn('Failed to auto-add page to header menu (non-fatal):', e);
      }

      // Switch to the new page
      await switchToPage(result.id);
      
      closeCreatePageModal();
      setSaveMessage('Page created successfully');
    } catch (err) {
      console.error('Failed to create page', err);
      saveError = 'Failed to create page. The slug might already exist.';
    } finally {
      creatingPage = false;
    }
  }

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

  async function handleSiteHeaderUpdate(header: Record<string, unknown> | null) {
    if (!site?.id) return;
    
    const updatedMetadata = { ...siteMetadata, header, footer: siteFooter };
    
    try {
      await saveSiteMetadata({ siteId: site.id, metadata: updatedMetadata });
      siteHeader = header;
    } catch (err) {
      console.error('Failed to save site header', err);
    }
  }

  async function handleSiteFooterUpdate(footer: Record<string, unknown> | null) {
    if (!site?.id) return;
    
    const updatedMetadata = { ...siteMetadata, header: siteHeader, footer };
    
    try {
      await saveSiteMetadata({ siteId: site.id, metadata: updatedMetadata });
      siteFooter = footer;
    } catch (err) {
      console.error('Failed to save site footer', err);
    }
  }
</script>

<div class="card border border-base-200 bg-base-200/30 p-5">
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
          <a class="btn btn-neutral btn-xs" href="/sites">Back to Sites</a>
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

      <!-- Create Page Modal -->
      {#if showCreatePageModal}
        <div class="modal modal-open">
          <div class="modal-box">
            <h3 class="font-bold text-lg mb-4">Create New Page</h3>
            
            <div class="form-control mb-4">
              <label class="label">
                <span class="label-text">Page Title</span>
              </label>
              <input
                type="text"
                class="input input-bordered"
                placeholder="About Us"
                bind:value={newPageTitle}
                disabled={creatingPage}
              />
            </div>

            <div class="form-control mb-4">
              <label class="label">
                <span class="label-text">URL Slug</span>
              </label>
              <input
                type="text"
                class="input input-bordered"
                placeholder="about-us"
                bind:value={newPageSlug}
                disabled={creatingPage}
              />
              <label class="label">
                <span class="label-text-alt">URL: /{newPageSlug || 'page-slug'}</span>
              </label>
            </div>

            <div class="modal-action">
              <button class="btn" onclick={closeCreatePageModal} disabled={creatingPage}>
                Cancel
              </button>
              <button
                class="btn btn-primary"
                onclick={handleCreatePage}
                disabled={!newPageTitle || !newPageSlug || creatingPage}
              >
                {#if creatingPage}
                  <span class="loading loading-spinner loading-sm"></span>
                  Creating...
                {:else}
                  Create Page
                {/if}
              </button>
            </div>
          </div>
          <div class="modal-backdrop" onclick={closeCreatePageModal}></div>
        </div>
      {/if}

      {#key currentPageId || pageData.id || pageData.slug}
        <Editor 
          bind:pageData={pageData}
          bind:siteHeader={siteHeader}
          bind:siteFooter={siteFooter}
          bind:siteMetadata={siteMetadata}
          editable={true}
          showUI={true}
          onUpdate={handleEditorUpdate}
          onSiteHeaderUpdate={handleSiteHeaderUpdate}
          onSiteFooterUpdate={handleSiteFooterUpdate}
          autoSaveDelay={2000}
          {pages}
          {currentPageId}
          onPageSwitch={switchToPage}
          onCreatePage={openCreatePageModal}
          imageConfig={{
            uploadHandler: async (file, folder) => {
              if (!site?.id) throw new Error('Site not loaded');
              
              // Convert File to ArrayBuffer for command serialization
              const fileData = await file.arrayBuffer();
              
              const result = await uploadSiteMedia({
                siteId: site.id,
                fileData,
                fileName: file.name,
                fileType: file.type,
                folder: folder || 'images'
              });
              
              return result;
            }
          }}
        />
      {/key}
    {/if}
  </div>
</div>
