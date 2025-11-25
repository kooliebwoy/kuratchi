<script lang="ts">
  import { Editor, type PageData, defaultPageData } from '@kuratchi/editor';
  import { Button, Loading } from '@kuratchi/ui';
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
    console.log('[Dashboard] Loading site.metadata:', meta);
    console.log('[Dashboard] Loading header from metadata:', meta.header);
    console.log('[Dashboard] Loading footer from metadata:', meta.footer);
    siteHeader = (meta.header as Record<string, unknown>) ?? null;
    siteFooter = (meta.footer as Record<string, unknown>) ?? null;
    console.log('[Dashboard] Initialized siteHeader:', siteHeader);
    console.log('[Dashboard] Initialized siteFooter:', siteFooter);
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
    console.log('[Dashboard] handleSiteHeaderUpdate called with:', header);
    if (!site?.id) {
      console.log('[Dashboard] handleSiteHeaderUpdate: no site.id');
      return;
    }
    
    const updatedMetadata = { ...siteMetadata, header, footer: siteFooter };
    console.log('[Dashboard] handleSiteHeaderUpdate: updatedMetadata:', updatedMetadata);
    
    try {
      console.log('[Dashboard] handleSiteHeaderUpdate: calling saveSiteMetadata');
      await saveSiteMetadata({ siteId: site.id, metadata: updatedMetadata });
      console.log('[Dashboard] handleSiteHeaderUpdate: saveSiteMetadata completed');
      siteHeader = header;
      // Update site.metadata to reflect the change
      if (site) {
        site.metadata = { ...site.metadata, ...updatedMetadata };
        console.log('[Dashboard] handleSiteHeaderUpdate: updated site.metadata');
      }
    } catch (err) {
      console.error('[Dashboard] Failed to save site header', err);
    }
  }

  async function handleSiteFooterUpdate(footer: Record<string, unknown> | null) {
    console.log('[Dashboard] handleSiteFooterUpdate called with:', footer);
    if (!site?.id) {
      console.log('[Dashboard] handleSiteFooterUpdate: no site.id');
      return;
    }
    
    const updatedMetadata = { ...siteMetadata, header: siteHeader, footer };
    console.log('[Dashboard] handleSiteFooterUpdate: updatedMetadata:', updatedMetadata);
    
    try {
      console.log('[Dashboard] handleSiteFooterUpdate: calling saveSiteMetadata');
      await saveSiteMetadata({ siteId: site.id, metadata: updatedMetadata });
      console.log('[Dashboard] handleSiteFooterUpdate: saveSiteMetadata completed');
      siteFooter = footer;
      // Update site.metadata to reflect the change
      if (site) {
        site.metadata = { ...site.metadata, ...updatedMetadata };
        console.log('[Dashboard] handleSiteFooterUpdate: updated site.metadata');
      }
    } catch (err) {
      console.error('[Dashboard] Failed to save site footer', err);
    }
  }

  async function handleSiteMetadataUpdate(metadata: Record<string, unknown>) {
    if (!site?.id) return;

    // Editor passes metadata without header/footer. Reattach them for persistence.
    const updatedMetadata = { ...metadata, header: siteHeader, footer: siteFooter };

    try {
      await saveSiteMetadata({ siteId: site.id, metadata: updatedMetadata });
      siteMetadata = { ...metadata };
    } catch (err) {
      console.error('Failed to save site metadata', err);
    }
  }
</script>

<div class="card border border-base-200 bg-base-200/30 p-5">
  <div class="card-body p-0">
    {#if queryError}
      <div class="kui-callout error m-6">Failed to load site editor</div>
    {:else if !loaded || loading}
      <div class="flex justify-center py-12">
        <Loading />
      </div>
    {:else}
      <div class="flex items-center justify-between border-b border-base-200 bg-base-100 px-4 py-2 text-sm">
          <div class="kui-inline">
          <div class="font-medium">{site?.name ?? 'Site'}</div>
          <Button variant="ghost" size="xs" href="/sites">Back to Sites</Button>
          {#if saving}
            <div class="kui-inline">
              <Loading size="sm" />
              <span class="kui-subtext">Saving…</span>
            </div>
          {:else if saveMessage}
            <span class="kui-subtext success">{saveMessage}</span>
          {:else}
            <span class="kui-subtext">All changes saved</span>
          {/if}
        </div>
        {#if site?.subdomain}
          <span class="kui-pill">{site.subdomain}.kuratchi.com</span>
        {/if}
      </div>

      {#if saveError}
        <div class="kui-callout error m-4">
          <span>{saveError}</span>
        </div>
      {/if}

      <!-- Create Page Modal -->
      {#if showCreatePageModal}
        <div class="kui-modal-overlay">
          <div class="kui-modal">
            <div class="kui-modal-header">
              <h3>Create New Page</h3>
              <Button variant="ghost" size="xs" onclick={closeCreatePageModal} aria-label="Close">✕</Button>
            </div>
            
            <div class="kui-stack">
              <label class="kui-form-control">
                <span class="kui-label">Page Title</span>
                <input
                  type="text"
                  class="kui-input"
                  placeholder="About Us"
                  bind:value={newPageTitle}
                  disabled={creatingPage}
                />
              </label>

              <label class="kui-form-control">
                <span class="kui-label">URL Slug</span>
                <input
                  type="text"
                  class="kui-input"
                  placeholder="about-us"
                  bind:value={newPageSlug}
                  disabled={creatingPage}
                />
                <span class="kui-helper">URL: /{newPageSlug || 'page-slug'}</span>
              </label>
            </div>

            <div class="kui-modal-actions">
              <Button variant="ghost" onclick={closeCreatePageModal} disabled={creatingPage}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onclick={handleCreatePage}
                disabled={!newPageTitle || !newPageSlug || creatingPage}
              >
                {#if creatingPage}
                  <Loading size="sm" />
                  Creating...
                {:else}
                  Create Page
                {/if}
              </Button>
            </div>
          </div>
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
          onSiteMetadataUpdate={handleSiteMetadataUpdate}
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

<style>
  .kui-callout {
    border-radius: 12px;
    padding: 12px;
    border: 1px solid #e5e7eb;
    background: #f8fafc;
  }

  .kui-callout.error {
    border-color: rgba(248, 113, 113, 0.4);
    background: #fef2f2;
    color: #b91c1c;
  }

  .kui-inline {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .kui-subtext {
    color: #6b7280;
  }

  .kui-subtext.success {
    color: #16a34a;
  }

  .kui-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 999px;
    background: #f4f4f5;
    color: #3f3f46;
    font-size: 12px;
    font-weight: 600;
  }

  .kui-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.3);
    display: grid;
    place-items: center;
    z-index: 40;
    padding: 16px;
  }

  .kui-modal {
    background: white;
    border-radius: 16px;
    width: min(460px, 95vw);
    padding: 16px;
    box-shadow: 0 20px 50px rgba(15, 23, 42, 0.15);
  }

  .kui-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
  }

  .kui-stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .kui-form-control {
    display: grid;
    gap: 6px;
  }

  .kui-label {
    font-weight: 600;
    font-size: 14px;
  }

  .kui-input {
    width: 100%;
    border-radius: 10px;
    border: 1px solid #e4e4e7;
    padding: 10px 12px;
    background: white;
  }

  .kui-input:focus {
    outline: 2px solid rgba(129, 140, 248, 0.35);
    border-color: #a5b4fc;
  }

  .kui-helper {
    font-size: 12px;
    color: #6b7280;
  }

  .kui-modal-actions {
    margin-top: 12px;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
</style>
