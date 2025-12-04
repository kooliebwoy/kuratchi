<script lang="ts">
  import { Editor, type EditorState, type PageData, defaultPageData } from '@kuratchi/editor';
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
  
  // Forms attached to this site
  let siteForms = $state<any[]>([]);
  
  // Catalog data
  let catalogOems = $state<any[]>([]);
  let catalogVehicles = $state<any[]>([]);
  
  const initialData = await editorQuery;

  site = initialData.site;
  pageData = clone(initialData.page);
  siteForms = initialData.forms || [];
  catalogOems = initialData.catalogOems || [];
  catalogVehicles = initialData.catalogVehicles || [];

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
    siteMetadata = { ...meta, forms: siteForms, catalogOems, catalogVehicles };
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

  async function handleEditorStateUpdate(state: EditorState) {
    if (!site?.id) return;

    saving = true;
    saveError = null;

    const pagePayload = clone(state.page);
    const metadataPayload = {
      ...(state.metadata || {}),
      header: state.header,
      footer: state.footer
    } as Record<string, unknown>;

    try {
      const pageSave = saveSitePage({ siteId: site.id, page: pagePayload }).updates(
        editorQuery.withOverride((current) => (current ? { ...current, page: pagePayload } : current))
      );

      const [pageResult] = await Promise.all([
        pageSave,
        saveSiteMetadata({ siteId: site.id, metadata: metadataPayload })
      ]);

      if (pageResult?.id) {
        pagePayload.id = pageResult.id;
      }

      pageData = pagePayload;
      currentPageId = pagePayload.id ?? currentPageId;
      siteHeader = state.header;
      siteFooter = state.footer;
      siteMetadata = { ...(state.metadata || {}) };

      if (site) {
        site.metadata = { ...metadataPayload };
      }

      setSaveMessage('Changes saved');
    } catch (err) {
      console.error('Failed to save editor state', err);
      saveError = 'Failed to save changes. Please try again.';
    } finally {
      saving = false;
    }
  }
</script>

<div class="editor-container">
    {#if queryError}
      <div class="kui-callout error">Failed to load site editor</div>
    {:else if !loaded || loading}
      <div class="loading-container">
        <Loading />
      </div>
    {:else}
      <div class="header-bar">
        <div class="header-left">
          <Button variant="ghost" size="xs" href="/sites">← Back to Sites</Button>
          <div class="site-info">
            <h2>{site?.name ?? 'Site'}</h2>
            {#if site?.subdomain}
              <p class="subdomain">{site.subdomain}.kuratchi.site</p>
            {/if}
          </div>
        </div>

        <div class="header-right">
          {#if saving}
            <div class="status-indicator">
              <Loading size="sm" />
              <span>Saving…</span>
            </div>
          {:else if saveMessage}
            <span class="status-message success">{saveMessage}</span>
          {:else}
            <span class="status-message">All changes saved</span>
          {/if}
        </div>
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
          onStateUpdate={handleEditorStateUpdate}
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

<style>
  .editor-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
  }

  .loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 48px 20px;
  }

  .kui-callout {
    border-radius: 12px;
    padding: 12px;
    border: 1px solid #e5e7eb;
    background: #f8fafc;
    margin: 16px;
  }

  .kui-callout.error {
    border-color: rgba(248, 113, 113, 0.4);
    background: #fef2f2;
    color: #b91c1c;
  }

  .header-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #e5e7eb;
    background: #ffffff;
    padding: 12px 20px;
    gap: 20px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1;
  }

  .site-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .site-info h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #1f2937;
  }

  .site-info .subdomain {
    margin: 0;
    font-size: 13px;
    color: #6b7280;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
    white-space: nowrap;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #6b7280;
  }

  .status-message {
    font-size: 13px;
    color: #6b7280;
  }

  .status-message.success {
    color: #16a34a;
  }

  .kui-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
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
