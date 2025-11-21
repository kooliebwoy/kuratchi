<script lang="ts">
  import { page } from '$app/state';
  import { getAllMedia, getFolders, getBucketDetails, uploadMedia, updateMedia, deleteMedia, createFolder, updateFolder, deleteFolder } from '$lib/functions/storage.remote';
  import { Button, Card, Badge, Dialog, Loading } from '@kuratchi/ui';
  import { Upload, FolderPlus, Trash2, Edit, Image, Film, FileText, File as FileIcon, X, Grid3x3, List, Folder, Eye, ArrowLeft, Copy, CheckCircle, Globe } from 'lucide-svelte';

  let bucketName = $derived(page.params.bucket);

  let bucketDetailsQuery = $derived(getBucketDetails(bucketName));
  let mediaQuery = $derived(getAllMedia(bucketName));
  let foldersQuery = $derived(getFolders(bucketName));
  
  let bucketDetails = $derived(bucketDetailsQuery.current);
  let media = $derived<any[]>(mediaQuery.current ?? []);
  let folders = $derived<any[]>(foldersQuery.current ?? []);
  
  let publicUrl = $derived(bucketDetails?.publicUrl);
  
  function getFileUrl(key: string) {
    if (!publicUrl) return null;
    return `${publicUrl}/${key}`;
  }
  
  let copiedUrl = $state(false);
  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      copiedUrl = true;
      setTimeout(() => copiedUrl = false, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }
  
  let selectedFolder = $state<string | null>(null);
  let viewMode = $state<'grid' | 'list'>('grid');
  let searchQuery = $state('');
  let fileFilter = $state<'all' | 'images' | 'videos' | 'documents'>('all');
  
  let showUploadModal = $state(false);
  let showFolderModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteConfirm = $state(false);
  let showDeleteFolderConfirm = $state(false);
  let showPreviewModal = $state(false);
  
  let folderModalMode = $state<'create' | 'edit'>('create');
  let editingFolder = $state<any>(null);
  let deletingFolder = $state<any>(null);
  let editingMedia = $state<any>(null);
  let deletingMedia = $state<any>(null);
  let previewMedia = $state<any>(null);
  let uploadingFiles = $state<File[]>([]);
  let fileInput: HTMLInputElement | null = null;
  
  let folderFormData = $state({ name: '', slug: '' });
  let mediaFormData = $state({ filename: '', alt: '', folder: '' });
  
  let filteredMedia = $derived(() => {
    let result = media || [];
    if (selectedFolder) result = result.filter((m: any) => m.folder === selectedFolder);
    if (fileFilter !== 'all') {
      result = result.filter((m: any) => {
        if (fileFilter === 'images') return m.mimeType?.startsWith('image/');
        if (fileFilter === 'videos') return m.mimeType?.startsWith('video/');
        if (fileFilter === 'documents') return m.mimeType?.includes('pdf') || m.mimeType?.includes('document');
        return true;
      });
    }
    if (searchQuery) {
      result = result.filter((m: any) => 
        m.filename?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.originalFilename?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return result;
  });
  
  function formatFileSize(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
  
  function getFileIcon(mimeType: string) {
    if (mimeType?.startsWith('image/')) return Image;
    if (mimeType?.startsWith('video/')) return Film;
    if (mimeType?.includes('pdf') || mimeType?.includes('document')) return FileText;
    return FileIcon;
  }
  
  function getThumbnailUrl(item: any) {
    if (item.mimeType?.startsWith('image/')) return item.url;
    return null;
  }
  
  function openCreateFolderModal() {
    folderModalMode = 'create';
    folderFormData = { name: '', slug: '' };
    showFolderModal = true;
  }
  
  function openEditFolderModal(folder: any) {
    folderModalMode = 'edit';
    editingFolder = folder;
    folderFormData = { name: folder.name, slug: folder.slug };
    showFolderModal = true;
  }
  function openEditMediaModal(item: any) {
    editingMedia = item;
    mediaFormData = { filename: item.filename, alt: item.alt || '', folder: item.folder || '' };
    showEditModal = true;
  }

  function openDeleteConfirm(item: any) {
    deletingMedia = item;
    showDeleteConfirm = true;
  }

  function openPreviewMedia(item: any) {
    previewMedia = item;
    showPreviewModal = true;
  }
  
  function resetFolderForm() {
    folderFormData = { name: '', slug: '' };
    editingFolder = null;
  }
  
  function resetMediaForm() {
    mediaFormData = { filename: '', alt: '', folder: '' };
    editingMedia = null;
  }
</script>

<svelte:head>
  <title>Storage - Bucket {bucketName}</title>
</svelte:head>

<div class="kui-bucket">
  <header class="kui-bucket__header">
    <div class="kui-inline">
      <Button variant="ghost" size="sm" href="/storage">
        <ArrowLeft class="kui-icon" /> Back
      </Button>
      <div>
        <p class="kui-eyebrow">Storage</p>
        <h1>{bucketName}</h1>
        <p class="kui-subtext">Manage files, folders, and domains</p>
      </div>
    </div>
    <div class="kui-inline end">
      <Button variant="outline" size="sm" onclick={openCreateFolderModal}>
        <FolderPlus class="kui-icon" />
        New Folder
      </Button>
      <Button variant="primary" size="sm" onclick={() => { showUploadModal = true; }}>
        <Upload class="kui-icon" />
        Upload
      </Button>
    </div>
  </header>

  <Card class="kui-panel">
    <div class="kui-meta">
      <div class="kui-inline">
        <Badge variant={bucketDetails?.publicUrl ? 'success' : 'neutral'} size="xs">
          <Globe class="kui-icon" />
          {bucketDetails?.publicUrl ? 'Public' : 'Private'}
        </Badge>
        {#if bucketDetails?.publicUrl}
          <span class="kui-code">{bucketDetails.publicUrl}</span>
          <Button variant="ghost" size="xs" onclick={() => copyUrl(bucketDetails.publicUrl)}>
            {#if copiedUrl}
              <CheckCircle class="kui-icon" />
            {:else}
              <Copy class="kui-icon" />
            {/if}
            Copy URL
          </Button>
        {/if}
      </div>

      <div class="kui-controls">
        <div class="kui-input-group">
          <input class="kui-input" type="text" placeholder="Search files..." bind:value={searchQuery} />
        </div>
        <div class="kui-inline">
          <Button variant={viewMode === 'grid' ? 'primary' : 'ghost'} size="xs" onclick={() => viewMode = 'grid'}>
            <Grid3x3 class="kui-icon" />
          </Button>
          <Button variant={viewMode === 'list' ? 'primary' : 'ghost'} size="xs" onclick={() => viewMode = 'list'}>
            <List class="kui-icon" />
          </Button>
          <FormSelect field={{ name: 'filter', bind: { value: fileFilter } } as any} class="kui-select--sm">
            <option value="all">All</option>
            <option value="images">Images</option>
            <option value="videos">Videos</option>
            <option value="documents">Documents</option>
          </FormSelect>
          <FormSelect field={{ name: 'folder', bind: { value: selectedFolder } } as any} class="kui-select--sm">
            <option value="">All folders</option>
            {#each folders as folder}
              <option value={folder.slug}>{folder.name}</option>
            {/each}
          </FormSelect>
        </div>
      </div>
    </div>

    {#if mediaQuery.loading}
      <div class="kui-center"><Loading size="md" /></div>
    {:else if filteredMedia.length === 0}
      <div class="kui-center">
        <Folder class="kui-empty__icon" />
        <p class="kui-subtext">No files found</p>
      </div>
    {:else if viewMode === 'grid'}
      <div class="kui-grid">
        {#each filteredMedia as item}
          <Card class="kui-panel">
            <div class="kui-file">
              <div class="kui-file__thumb">
                {#if getThumbnailUrl(item)}
                  <img src={getThumbnailUrl(item)} alt={item.filename} />
                {:else}
                  {@const Icon = getFileIcon(item.mimeType || '')}
                  <Icon class="kui-icon" />
                {/if}
              </div>
              <div class="kui-file__meta">
                <p class="kui-strong">{item.filename}</p>
                <p class="kui-subtext">{item.mimeType || 'unknown'} · {formatFileSize(item.size || 0)}</p>
                {#if item.folder}
                  <Badge variant="ghost" size="xs">{item.folder}</Badge>
                {/if}
              </div>
              <div class="kui-inline end">
                <Button variant="ghost" size="xs" onclick={() => openPreviewMedia(item)}><Eye class="kui-icon" /></Button>
                <Button variant="ghost" size="xs" onclick={() => openEditMediaModal(item)}><Edit class="kui-icon" /></Button>
                <Button variant="ghost" size="xs" onclick={() => openDeleteConfirm(item)}><Trash2 class="kui-icon error" /></Button>
              </div>
            </div>
          </Card>
        {/each}
      </div>
    {:else}
      <div class="kui-table-scroll">
        <table class="kui-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Type</th>
              <th>Size</th>
              <th>Folder</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredMedia as item}
              {@const Icon = getFileIcon(item.mimeType || '')}
              <tr>
                <td class="kui-inline">
                  <Icon class="kui-icon" />
                  <span class="kui-strong">{item.filename}</span>
                </td>
                <td class="kui-subtext">{item.mimeType || 'unknown'}</td>
                <td class="kui-subtext">{formatFileSize(item.size || 0)}</td>
                <td class="kui-subtext">{item.folder || '-'}</td>
                <td class="text-right">
                  <div class="kui-inline end">
                    <Button variant="ghost" size="xs" onclick={() => openPreviewMedia(item)}><Eye class="kui-icon" /></Button>
                    <Button variant="ghost" size="xs" onclick={() => openEditMediaModal(item)}><Edit class="kui-icon" /></Button>
                    <Button variant="ghost" size="xs" onclick={() => openDeleteConfirm(item)}><Trash2 class="kui-icon error" /></Button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </Card>
</div>

{#if showUploadModal}
  <Dialog bind:open={showUploadModal} size="md" onClose={() => { showUploadModal = false; uploadingFiles = []; }}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3>Upload Files</h3>
        <Button variant="ghost" size="xs" onclick={() => { showUploadModal = false; uploadingFiles = []; }}>
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="kui-stack">
        <input type="file" multiple bind:this={fileInput} onchange={(e) => {
          const target = e.target as HTMLInputElement;
          uploadingFiles = Array.from(target.files || []);
        }} />
        {#if uploadingFiles.length > 0}
          <div class="kui-file-list">
            {#each uploadingFiles as file}
              <div class="kui-inline space">
                <span>{file.name}</span>
                <span class="kui-subtext">{formatFileSize(file.size)}</span>
              </div>
            {/each}
          </div>
        {/if}
        <div class="kui-modal-actions">
          <Button variant="ghost" onclick={() => { showUploadModal = false; uploadingFiles = []; }}>Cancel</Button>
          <Button variant="primary" type="submit" form={uploadMedia.formId} disabled={uploadingFiles.length === 0}>
            Upload
          </Button>
        </div>
        <form {...uploadMedia} id={uploadMedia.formId} class="hidden-form">
          <input type="hidden" name="bucketName" value={bucketName} />
        </form>
      </div>
    {/snippet}
  </Dialog>
{/if}

{#if showFolderModal}
  <Dialog bind:open={showFolderModal} size="sm" onClose={() => { showFolderModal = false; resetFolderForm(); }}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3>{folderModalMode === 'create' ? 'Create Folder' : 'Edit Folder'}</h3>
        <Button variant="ghost" size="xs" onclick={() => { showFolderModal = false; resetFolderForm(); }}>
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="kui-stack">
        <FormField label="Folder Name">
          <FormInput field={{ name: 'folderName', bind: { value: folderFormData.name } } as any} />
        </FormField>
        <FormField label="Slug">
          <FormInput field={{ name: 'folderSlug', bind: { value: folderFormData.slug } } as any} />
        </FormField>
        <div class="kui-modal-actions">
          <Button variant="ghost" onclick={() => { showFolderModal = false; resetFolderForm(); }}>Cancel</Button>
          <Button variant="primary" type="submit" form={folderModalMode === 'create' ? createFolder.formId : updateFolder.formId}>
            {folderModalMode === 'create' ? 'Create Folder' : 'Save Changes'}
          </Button>
        </div>
        <form {...createFolder} id={createFolder.formId} class="hidden-form">
          <input type="hidden" name="bucketName" value={bucketName} />
          <input type="hidden" name="name" value={folderFormData.name} />
          <input type="hidden" name="slug" value={folderFormData.slug} />
        </form>
        <form {...updateFolder} id={updateFolder.formId} class="hidden-form">
          <input type="hidden" name="bucketName" value={bucketName} />
          <input type="hidden" name="oldSlug" value={editingFolder?.slug} />
          <input type="hidden" name="name" value={folderFormData.name} />
          <input type="hidden" name="slug" value={folderFormData.slug} />
        </form>
      </div>
    {/snippet}
  </Dialog>
{/if}

{#if showEditModal && editingMedia}
  <Dialog bind:open={showEditModal} size="md" onClose={() => { showEditModal = false; resetMediaForm(); }}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3>Edit Media</h3>
        <Button variant="ghost" size="xs" onclick={() => { showEditModal = false; resetMediaForm(); }}>
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="kui-stack">
        <FormField label="Filename">
          <FormInput field={{ name: 'filename', bind: { value: mediaFormData.filename } } as any} />
        </FormField>
        <FormField label="Alt text">
          <FormInput field={{ name: 'alt', bind: { value: mediaFormData.alt } } as any} />
        </FormField>
        <FormField label="Folder">
          <FormSelect field={{ name: 'folder', bind: { value: mediaFormData.folder } } as any}>
            <option value="">None</option>
            {#each folders as folder}
              <option value={folder.slug}>{folder.name}</option>
            {/each}
          </FormSelect>
        </FormField>
        <div class="kui-modal-actions">
          <Button variant="ghost" onclick={() => { showEditModal = false; resetMediaForm(); }}>Cancel</Button>
          <Button variant="primary" type="submit" form={updateMedia.formId}>Save Changes</Button>
        </div>
        <form {...updateMedia} id={updateMedia.formId} class="hidden-form">
          <input type="hidden" name="bucketName" value={bucketName} />
          <input type="hidden" name="key" value={editingMedia.key} />
          <input type="hidden" name="filename" value={mediaFormData.filename} />
          <input type="hidden" name="alt" value={mediaFormData.alt} />
          <input type="hidden" name="folder" value={mediaFormData.folder} />
        </form>
      </div>
    {/snippet}
  </Dialog>
{/if}

{#if showDeleteConfirm && deletingMedia}
  <Dialog bind:open={showDeleteConfirm} size="sm" onClose={() => { showDeleteConfirm = false; deletingMedia = null; }}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3 class="text-error">Delete File</h3>
        <Button variant="ghost" size="xs" onclick={() => { showDeleteConfirm = false; deletingMedia = null; }}>
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="kui-stack">
        <p class="kui-subtext">Are you sure you want to delete {deletingMedia.filename}?</p>
        <div class="kui-modal-actions">
          <Button variant="ghost" onclick={() => { showDeleteConfirm = false; deletingMedia = null; }}>Cancel</Button>
          <form {...deleteMedia} onsubmit={() => { showDeleteConfirm = false; deletingMedia = null; }}>
            <input type="hidden" name="bucketName" value={bucketName} />
            <input type="hidden" name="key" value={deletingMedia.key} />
            <Button type="submit" variant="error">Delete File</Button>
          </form>
        </div>
      </div>
    {/snippet}
  </Dialog>
{/if}

{#if showDeleteFolderConfirm && deletingFolder}
  <Dialog bind:open={showDeleteFolderConfirm} size="sm" onClose={() => { showDeleteFolderConfirm = false; deletingFolder = null; }}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3 class="text-error">Delete Folder</h3>
        <Button variant="ghost" size="xs" onclick={() => { showDeleteFolderConfirm = false; deletingFolder = null; }}>
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="kui-stack">
        <p class="kui-subtext">Delete folder {deletingFolder.name}?</p>
        <div class="kui-modal-actions">
          <Button variant="ghost" onclick={() => { showDeleteFolderConfirm = false; deletingFolder = null; }}>Cancel</Button>
          <form {...deleteFolder} onsubmit={() => { showDeleteFolderConfirm = false; deletingFolder = null; }}>
            <input type="hidden" name="bucketName" value={bucketName} />
            <input type="hidden" name="slug" value={deletingFolder.slug} />
            <Button type="submit" variant="error">Delete Folder</Button>
          </form>
        </div>
      </div>
    {/snippet}
  </Dialog>
{/if}

{#if showPreviewModal && previewMedia}
  <Dialog bind:open={showPreviewModal} size="lg" onClose={() => { showPreviewModal = false; previewMedia = null; }}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3>Preview</h3>
        <Button variant="ghost" size="xs" onclick={() => { showPreviewModal = false; previewMedia = null; }}>
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="kui-stack">
        {#if previewMedia.mimeType?.startsWith('image/')}
          <img src={previewMedia.url} alt={previewMedia.filename} class="kui-preview" />
        {:else}
          <div class="kui-callout">
            <p class="kui-strong">{previewMedia.filename}</p>
            <p class="kui-subtext">{previewMedia.mimeType}</p>
            {#if getFileUrl(previewMedia.key)}
              <a href={getFileUrl(previewMedia.key) || '#'} target="_blank" rel="noreferrer" class="kui-button-link">
                <ExternalLink class="kui-icon" /> Open file
              </a>
            {/if}
          </div>
        {/if}
      </div>
    {/snippet}
  </Dialog>
{/if}

<style>
  .kui-bucket {
    display: grid;
    gap: var(--kui-spacing-md);
  }

  .kui-bucket__header {
    display: flex;
    justify-content: space-between;
    gap: var(--kui-spacing-md);
    flex-wrap: wrap;
    align-items: center;
  }

  .kui-eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--kui-color-muted);
    font-weight: 700;
    margin: 0;
    font-size: 0.8rem;
  }

  h1 {
    margin: 0.1rem 0 0.2rem;
    font-size: 1.6rem;
  }

  .kui-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .kui-inline.end {
    justify-content: flex-end;
  }

  .kui-icon {
    width: 1rem;
    height: 1rem;
  }

  .kui-icon.spinning {
    animation: spin 1s linear infinite;
  }

  .kui-panel .kui-card__body {
    gap: var(--kui-spacing-md);
  }

  .kui-meta {
    display: grid;
    gap: var(--kui-spacing-sm);
  }

  .kui-controls {
    display: flex;
    gap: var(--kui-spacing-sm);
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
  }

  .kui-input-group {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    padding: 0.45rem 0.6rem;
    background: var(--kui-color-surface);
  }

  .kui-input {
    border: none;
    outline: none;
    background: transparent;
    font-size: 0.95rem;
    color: var(--kui-color-text);
  }

  .kui-select--sm {
    padding: 0.4rem 0.6rem;
  }

  .kui-table-scroll {
    overflow: auto;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-lg);
    background: var(--kui-color-surface);
  }

  .kui-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 100%;
  }

  .kui-table th,
  .kui-table td {
    padding: 0.65rem;
    border-bottom: 1px solid var(--kui-color-border);
    text-align: left;
  }

  .kui-table thead th {
    background: var(--kui-color-surface-muted);
    font-weight: 700;
    font-size: 0.9rem;
  }

  .kui-grid {
    display: grid;
    gap: var(--kui-spacing-sm);
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .kui-file {
    display: grid;
    gap: var(--kui-spacing-sm);
  }

  .kui-file__thumb {
    height: 160px;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    display: grid;
    place-items: center;
    overflow: hidden;
    background: var(--kui-color-surface-muted);
  }

  .kui-file__thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .kui-file__meta {
    display: grid;
    gap: 0.25rem;
  }

  .kui-file-list {
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    padding: var(--kui-spacing-sm);
    background: var(--kui-color-surface-muted);
    display: grid;
    gap: 0.35rem;
  }

  .kui-file-list .space {
    justify-content: space-between;
    width: 100%;
  }

  .kui-preview {
    max-width: 100%;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    display: block;
  }

  .hidden-form {
    display: none;
  }

  .kui-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--kui-spacing-sm);
  }

  .kui-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--kui-spacing-sm);
  }

  .kui-stack {
    display: grid;
    gap: var(--kui-spacing-sm);
  }

  .kui-callout {
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    padding: var(--kui-spacing-sm);
    background: var(--kui-color-surface);
  }

  .kui-callout.error {
    border-color: color-mix(in srgb, var(--kui-color-error) 40%, var(--kui-color-border) 60%);
    background: rgba(239, 68, 68, 0.08);
  }

  .kui-button-link {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--kui-color-primary);
    text-decoration: none;
  }

  .kui-empty__icon {
    width: 3rem;
    height: 3rem;
    color: var(--kui-color-muted);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
