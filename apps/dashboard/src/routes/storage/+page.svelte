<script lang="ts">
  import { getStorageMedia, getStorageDetails, uploadStorageMedia, deleteStorageMedia, updateStorageDomain } from '$lib/functions/storage.remote';
  import { getSites } from '$lib/functions/sites.remote';
  import { Button, Card, Badge, Dialog, Loading } from '@kuratchi/ui';
  import { Upload, Trash2, Image, Film, FileText, File as FileIcon, X, Grid3x3, List, Folder, Eye, Copy, CheckCircle, Globe, AlertCircle, Package, Mail, FolderOpen, Settings } from '@lucide/svelte';

  // Queries
  const sites = getSites();
  
  // Source filter: 'all', 'sites', 'sites/{subdomain}', 'catalog', 'uploads', 'emails'
  let sourceFilter = $state<string>('all');
  let siteFilter = $state<string>(''); // Only used when sourceFilter is 'sites'
  
  // Build the actual filter for the query
  let queryFilter = $derived.by(() => {
    if (sourceFilter === 'all') return undefined;
    if (sourceFilter === 'sites' && siteFilter) return `sites/${siteFilter}`;
    return sourceFilter;
  });
  
  let storageQuery = $derived(getStorageMedia(queryFilter));
  let detailsQuery = getStorageDetails(undefined);
  
  let storageData = $derived(storageQuery.current);
  let detailsData = $derived(detailsQuery.current);
  let sitesData = $derived(sites.current || []);
  
  let media = $derived<any[]>(storageData?.media ?? []);
  let publicUrl = $derived(storageData?.publicUrl || detailsData?.publicUrl);
  let storageDomain = $derived(detailsData?.storageDomain);
  let bucketName = $derived(detailsData?.bucket);
  
  // UI State
  let viewMode = $state<'grid' | 'list'>('grid');
  let searchQuery = $state('');
  let fileFilter = $state<'all' | 'images' | 'videos' | 'documents'>('all');
  
  let showUploadModal = $state(false);
  let showDeleteConfirm = $state(false);
  let showPreviewModal = $state(false);
  let showSettingsModal = $state(false);
  
  let deletingMedia = $state<any>(null);
  let previewMedia = $state<any>(null);
  let uploadingFiles = $state<File[]>([]);
  let uploadingSiteSubdomain = $state('');
  let uploadingFolder = $state('');
  let isUploading = $state(false);
  
  let copiedUrl = $state(false);
  
  // Settings modal state
  let newStorageDomain = $state('');
  let isSavingDomain = $state(false);
  
  // Filtered media
  let filteredMedia = $derived.by(() => {
    let result = media || [];
    
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
        m.key?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return result;
  });
  
  // Helpers
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
  
  function getSourceIcon(source: string) {
    if (source === 'catalog') return Package;
    if (source === 'sites') return Globe;
    if (source === 'emails') return Mail;
    if (source === 'uploads') return FolderOpen;
    return Folder;
  }
  
  function getSourceLabel(item: any) {
    if (item.source === 'catalog' && item.catalogInfo) {
      return `${item.catalogInfo.oem} / ${item.catalogInfo.model}`;
    }
    if (item.source === 'sites' && item.site) {
      return item.site;
    }
    return item.source || 'other';
  }
  
  function getThumbnailUrl(item: any) {
    if (item.mimeType?.startsWith('image/') && item.url) return item.url;
    return null;
  }
  
  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      copiedUrl = true;
      setTimeout(() => copiedUrl = false, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }
  
  function openDeleteConfirm(item: any) {
    deletingMedia = item;
    showDeleteConfirm = true;
  }
  
  function openPreviewMedia(item: any) {
    previewMedia = item;
    showPreviewModal = true;
  }
  
  async function handleUpload() {
    if (uploadingFiles.length === 0 || isUploading) return;
    
    isUploading = true;
    try {
      for (const file of uploadingFiles) {
        const formData = new FormData();
        formData.append('file', file);
        if (uploadingSiteSubdomain) formData.append('siteSubdomain', uploadingSiteSubdomain);
        if (uploadingFolder) formData.append('folder', uploadingFolder);
        
        // Use the form action approach
        await fetch('?/uploadStorageMedia', {
          method: 'POST',
          body: formData
        });
      }
      
      await storageQuery.refresh();
      showUploadModal = false;
      uploadingFiles = [];
      uploadingSiteSubdomain = '';
      uploadingFolder = '';
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      isUploading = false;
    }
  }
  
  async function handleDelete() {
    if (!deletingMedia) return;
    
    try {
      const formData = new FormData();
      formData.append('key', deletingMedia.key);
      
      await fetch('?/deleteStorageMedia', {
        method: 'POST',
        body: formData
      });
      
      await storageQuery.refresh();
      showDeleteConfirm = false;
      deletingMedia = null;
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }
  
  function openSettingsModal() {
    newStorageDomain = storageDomain || '';
    showSettingsModal = true;
  }
  
  async function handleSaveDomain() {
    if (!newStorageDomain.trim() || isSavingDomain) return;
    
    isSavingDomain = true;
    try {
      await updateStorageDomain({ storageDomain: newStorageDomain.trim() });
      await detailsQuery.refresh();
      showSettingsModal = false;
    } catch (err) {
      console.error('Failed to save domain:', err);
    } finally {
      isSavingDomain = false;
    }
  }
</script>

<svelte:head>
  <title>Storage - Kuratchi Dashboard</title>
</svelte:head>

<div class="storage-page">
  <header class="storage-header">
    <div class="header-info">
      <h1>Storage</h1>
      <p class="subtext">Organization file storage</p>
    </div>
    <div class="header-actions">
      <Button variant="ghost" size="sm" onclick={openSettingsModal}>
        <Settings class="icon" />
      </Button>
      <Button variant="primary" size="sm" onclick={() => showUploadModal = true}>
        <Upload class="icon" />
        Upload
      </Button>
    </div>
  </header>

  {#if detailsQuery.loading}
    <Card>
      <div class="center-content">
        <Loading size="md" />
        <p class="subtext">Loading storage...</p>
      </div>
    </Card>
  {:else if !detailsData?.success}
    <Card>
      <div class="center-content">
        <AlertCircle class="empty-icon" />
        <p class="empty-text">Storage not configured</p>
        <p class="subtext">{detailsData?.error || 'No storage bucket found for this organization.'}</p>
      </div>
    </Card>
  {:else}
    <!-- Storage Info Bar -->
    <Card class="info-bar">
      <div class="info-row">
        <div class="info-left">
          <Badge variant={publicUrl ? 'success' : 'neutral'} size="xs">
            <Globe class="badge-icon" />
            {publicUrl ? 'Public' : 'Private'}
          </Badge>
          {#if publicUrl}
            <code class="url-code">{publicUrl}</code>
            <Button variant="ghost" size="xs" onclick={() => copyUrl(publicUrl)}>
              {#if copiedUrl}
                <CheckCircle class="icon" />
              {:else}
                <Copy class="icon" />
              {/if}
            </Button>
          {/if}
        </div>
        
        <div class="info-right">
          <!-- Source Filter -->
          <select class="source-select" bind:value={sourceFilter}>
            <option value="all">All Sources</option>
            <option value="sites">Site Files</option>
            <option value="catalog">Catalog Images</option>
            <option value="uploads">Uploads</option>
            <option value="emails">Emails</option>
          </select>
          
          <!-- Site Filter (only when source is 'sites') -->
          {#if sourceFilter === 'sites'}
            <select class="site-select" bind:value={siteFilter}>
              <option value="">All Sites</option>
              {#each sitesData as site}
                <option value={site.subdomain}>{site.name}</option>
              {/each}
            </select>
          {/if}
          
          <!-- File Type Filter -->
          <select class="filter-select" bind:value={fileFilter}>
            <option value="all">All Types</option>
            <option value="images">Images</option>
            <option value="videos">Videos</option>
            <option value="documents">Documents</option>
          </select>
          
          <!-- Search -->
          <input 
            class="search-input" 
            type="text" 
            placeholder="Search files..." 
            bind:value={searchQuery} 
          />
          
          <!-- View Toggle -->
          <div class="view-toggle">
            <button
              onclick={() => viewMode = 'grid'}
              class={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
            >
              <Grid3x3 class="icon" />
            </button>
            <button
              onclick={() => viewMode = 'list'}
              class={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
            >
              <List class="icon" />
            </button>
          </div>
        </div>
      </div>
    </Card>

    <!-- Media Content -->
    <Card>
      {#if storageQuery.loading}
        <div class="center-content">
          <Loading size="md" />
        </div>
      {:else if filteredMedia.length === 0}
        <div class="center-content">
          <Folder class="empty-icon" />
          <p class="empty-text">No files found</p>
          <p class="subtext">
            {sourceFilter !== 'all' ? `No files in ${sourceFilter}` : 'Upload files to get started'}
          </p>
        </div>
      {:else if viewMode === 'grid'}
        <div class="media-grid">
          {#each filteredMedia as item}
            {@const SourceIcon = getSourceIcon(item.source)}
            <div class="media-card">
              <div class="media-thumb">
                {#if getThumbnailUrl(item)}
                  <img src={getThumbnailUrl(item)} alt={item.filename} />
                {:else}
                  {@const Icon = getFileIcon(item.mimeType || '')}
                  <Icon class="thumb-icon" />
                {/if}
              </div>
              <div class="media-info">
                <p class="media-name" title={item.filename}>{item.filename}</p>
                <p class="media-meta">
                  {item.mimeType?.split('/')[1] || 'file'} · {formatFileSize(item.size || 0)}
                </p>
                <Badge variant="ghost" size="xs">
                  <SourceIcon class="badge-icon" />
                  {getSourceLabel(item)}
                </Badge>
              </div>
              <div class="media-actions">
                <Button variant="ghost" size="xs" onclick={() => openPreviewMedia(item)}>
                  <Eye class="icon" />
                </Button>
                {#if item.url}
                  <Button variant="ghost" size="xs" onclick={() => copyUrl(item.url)}>
                    <Copy class="icon" />
                  </Button>
                {/if}
                <Button variant="ghost" size="xs" onclick={() => openDeleteConfirm(item)}>
                  <Trash2 class="icon error" />
                </Button>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="table-wrapper">
          <table class="media-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Source</th>
                <th>Type</th>
                <th>Size</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredMedia as item}
                {@const Icon = getFileIcon(item.mimeType || '')}
                {@const SourceIcon = getSourceIcon(item.source)}
                <tr>
                  <td>
                    <div class="file-cell">
                      <Icon class="icon" />
                      <span class="file-name">{item.filename}</span>
                    </div>
                  </td>
                  <td>
                    <div class="source-cell">
                      <SourceIcon class="icon muted" />
                      <span class="muted">{getSourceLabel(item)}</span>
                    </div>
                  </td>
                  <td class="muted">{item.mimeType?.split('/')[1] || 'file'}</td>
                  <td class="muted">{formatFileSize(item.size || 0)}</td>
                  <td class="text-right">
                    <div class="action-row">
                      <Button variant="ghost" size="xs" onclick={() => openPreviewMedia(item)}>
                        <Eye class="icon" />
                      </Button>
                      {#if item.url}
                        <Button variant="ghost" size="xs" onclick={() => copyUrl(item.url)}>
                          <Copy class="icon" />
                        </Button>
                      {/if}
                      <Button variant="ghost" size="xs" onclick={() => openDeleteConfirm(item)}>
                        <Trash2 class="icon error" />
                      </Button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </Card>
  {/if}
</div>

<!-- Upload Modal -->
{#if showUploadModal}
  <Dialog bind:open={showUploadModal} size="md" onClose={() => { showUploadModal = false; uploadingFiles = []; }}>
    {#snippet header()}
      <div class="modal-header">
        <h3>Upload Files</h3>
        <Button variant="ghost" size="xs" onclick={() => { showUploadModal = false; uploadingFiles = []; }}>
          <X class="icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="modal-content">
        <div class="form-field">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="form-label">Files</label>
          <input 
            type="file" 
            multiple 
            onchange={(e) => {
              const target = e.target as HTMLInputElement;
              uploadingFiles = Array.from(target.files || []);
            }} 
          />
        </div>
        
        {#if uploadingFiles.length > 0}
          <div class="file-list">
            {#each uploadingFiles as file}
              <div class="file-item">
                <span>{file.name}</span>
                <span class="muted">{formatFileSize(file.size)}</span>
              </div>
            {/each}
          </div>
        {/if}
        
        <div class="form-field">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="form-label">Site (optional)</label>
          <select class="form-select" bind:value={uploadingSiteSubdomain}>
            <option value="">Organization root</option>
            {#each sitesData as site}
              <option value={site.subdomain}>{site.name}</option>
            {/each}
          </select>
        </div>
        
        <div class="form-field">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="form-label">Folder (optional)</label>
          <input 
            type="text" 
            class="form-input" 
            placeholder="e.g., images, documents" 
            bind:value={uploadingFolder}
          />
        </div>
        
        <div class="modal-actions">
          <Button variant="ghost" onclick={() => { showUploadModal = false; uploadingFiles = []; }}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onclick={handleUpload} 
            disabled={uploadingFiles.length === 0 || isUploading}
          >
            {#if isUploading}
              <Loading size="sm" />
              Uploading...
            {:else}
              Upload {uploadingFiles.length} file{uploadingFiles.length !== 1 ? 's' : ''}
            {/if}
          </Button>
        </div>
      </div>
    {/snippet}
  </Dialog>
{/if}

<!-- Delete Confirmation -->
{#if showDeleteConfirm && deletingMedia}
  <Dialog bind:open={showDeleteConfirm} size="sm" onClose={() => { showDeleteConfirm = false; deletingMedia = null; }}>
    {#snippet header()}
      <div class="modal-header">
        <h3 class="text-error">Delete File</h3>
        <Button variant="ghost" size="xs" onclick={() => { showDeleteConfirm = false; deletingMedia = null; }}>
          <X class="icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="modal-content">
        <p class="muted">Are you sure you want to delete <strong>{deletingMedia.filename}</strong>?</p>
        <p class="muted small">Path: {deletingMedia.key}</p>
        <div class="modal-actions">
          <Button variant="ghost" onclick={() => { showDeleteConfirm = false; deletingMedia = null; }}>
            Cancel
          </Button>
          <Button variant="error" onclick={handleDelete}>
            Delete File
          </Button>
        </div>
      </div>
    {/snippet}
  </Dialog>
{/if}

<!-- Preview Modal -->
{#if showPreviewModal && previewMedia}
  <Dialog bind:open={showPreviewModal} size="lg" onClose={() => { showPreviewModal = false; previewMedia = null; }}>
    {#snippet header()}
      <div class="modal-header">
        <h3>{previewMedia.filename}</h3>
        <Button variant="ghost" size="xs" onclick={() => { showPreviewModal = false; previewMedia = null; }}>
          <X class="icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="modal-content">
        {#if previewMedia.mimeType?.startsWith('image/') && previewMedia.url}
          <img src={previewMedia.url} alt={previewMedia.filename} class="preview-image" />
        {:else if previewMedia.mimeType?.startsWith('video/') && previewMedia.url}
          <!-- svelte-ignore a11y_media_has_caption -->
          <video src={previewMedia.url} controls class="preview-video"></video>
        {:else}
          {@const Icon = getFileIcon(previewMedia.mimeType || '')}
          <div class="preview-info">
            <Icon class="preview-icon" />
            <p class="preview-name">{previewMedia.filename}</p>
            <p class="muted">{previewMedia.mimeType || 'Unknown type'}</p>
            <p class="muted">{formatFileSize(previewMedia.size || 0)}</p>
          </div>
        {/if}
        
        {#if previewMedia.url}
          <div class="preview-actions">
            <Button variant="ghost" size="sm" onclick={() => copyUrl(previewMedia.url)}>
              <Copy class="icon" />
              Copy URL
            </Button>
            <Button variant="ghost" size="sm" href={previewMedia.url} target="_blank">
              Open in new tab
            </Button>
          </div>
        {/if}
      </div>
    {/snippet}
  </Dialog>
{/if}

<!-- Settings Modal -->
{#if showSettingsModal}
  <Dialog bind:open={showSettingsModal} size="sm" onClose={() => showSettingsModal = false}>
    {#snippet header()}
      <div class="modal-header">
        <h3>Storage Settings</h3>
        <Button variant="ghost" size="xs" onclick={() => showSettingsModal = false}>
          <X class="icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="modal-content">
        <div class="form-group">
          <label for="storageDomain">Storage Domain</label>
          <p class="muted small">Custom domain for your R2 bucket (e.g., org-name.kuratchi.cloud)</p>
          <input
            id="storageDomain"
            type="text"
            bind:value={newStorageDomain}
            placeholder="your-org.kuratchi.cloud"
            class="form-input"
          />
          {#if storageDomain}
            <p class="muted small">Current: {storageDomain}</p>
          {:else}
            <p class="muted small text-warning">Not configured - CDN URLs won't work until set</p>
          {/if}
        </div>
        <div class="modal-actions">
          <Button variant="ghost" onclick={() => showSettingsModal = false}>
            Cancel
          </Button>
          <Button variant="primary" onclick={handleSaveDomain} disabled={isSavingDomain || !newStorageDomain.trim()}>
            {isSavingDomain ? 'Saving...' : 'Save Domain'}
          </Button>
        </div>
      </div>
    {/snippet}
  </Dialog>
{/if}

<style>
  .storage-page {
    display: grid;
    gap: 1.5rem;
  }

  .storage-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .storage-header h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .subtext {
    color: var(--kui-color-muted);
    font-size: 0.875rem;
    margin: 0.25rem 0 0;
  }

  .icon {
    width: 1rem;
    height: 1rem;
  }

  .badge-icon {
    width: 0.75rem;
    height: 0.75rem;
  }

  /* Info Bar */
  .info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .info-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .info-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .url-code {
    font-family: ui-monospace, monospace;
    font-size: 0.8rem;
    background: var(--kui-color-surface-muted);
    padding: 0.25rem 0.5rem;
    border-radius: var(--kui-radius-sm);
  }

  .source-select,
  .site-select,
  .filter-select {
    padding: 0.4rem 0.75rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    background: var(--kui-color-surface);
    font-size: 0.875rem;
    color: var(--kui-color-text);
  }

  .search-input {
    padding: 0.4rem 0.75rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    background: var(--kui-color-surface);
    font-size: 0.875rem;
    color: var(--kui-color-text);
    width: 180px;
  }

  .view-toggle {
    display: flex;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    overflow: hidden;
  }

  .view-btn {
    padding: 0.4rem;
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--kui-color-text);
  }

  .view-btn.active {
    background: var(--kui-color-primary);
    color: white;
  }

  /* Center Content */
  .center-content {
    display: grid;
    place-items: center;
    gap: 0.75rem;
    text-align: center;
    padding: 3rem 1.5rem;
  }

  .empty-icon {
    width: 3rem;
    height: 3rem;
    color: var(--kui-color-muted);
  }

  .empty-text {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  /* Media Grid */
  .media-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
  }

  .media-card {
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-lg);
    overflow: hidden;
    background: var(--kui-color-surface);
    transition: box-shadow 0.2s ease;
  }

  .media-card:hover {
    box-shadow: var(--kui-shadow-md);
  }

  .media-thumb {
    height: 140px;
    background: var(--kui-color-surface-muted);
    display: grid;
    place-items: center;
    overflow: hidden;
  }

  .media-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .thumb-icon {
    width: 2.5rem;
    height: 2.5rem;
    color: var(--kui-color-muted);
  }

  .media-info {
    padding: 0.75rem;
    display: grid;
    gap: 0.25rem;
  }

  .media-name {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .media-meta {
    margin: 0;
    font-size: 0.75rem;
    color: var(--kui-color-muted);
  }

  .media-actions {
    display: flex;
    justify-content: flex-end;
    padding: 0.5rem 0.75rem;
    border-top: 1px solid var(--kui-color-border);
    gap: 0.25rem;
  }

  /* Table */
  .table-wrapper {
    overflow-x: auto;
  }

  .media-table {
    width: 100%;
    border-collapse: collapse;
  }

  .media-table th,
  .media-table td {
    padding: 0.75rem;
    border-bottom: 1px solid var(--kui-color-border);
    text-align: left;
  }

  .media-table thead th {
    background: var(--kui-color-surface-muted);
    font-weight: 600;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--kui-color-muted);
  }

  .file-cell {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .source-cell {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .file-name {
    font-weight: 500;
  }

  .action-row {
    display: flex;
    justify-content: flex-end;
    gap: 0.25rem;
  }

  .text-right {
    text-align: right;
  }

  .muted {
    color: var(--kui-color-muted);
  }

  .small {
    font-size: 0.8rem;
  }

  .error {
    color: var(--kui-color-error);
  }

  .text-error {
    color: var(--kui-color-error);
  }

  .text-warning {
    color: var(--kui-color-warning, #f59e0b);
  }

  /* Modals */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .modal-header h3 {
    margin: 0;
  }

  .modal-content {
    display: grid;
    gap: 1rem;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .form-field {
    display: grid;
    gap: 0.5rem;
  }

  .form-label {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .form-input,
  .form-select {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    background: var(--kui-color-surface);
    font-size: 0.875rem;
    color: var(--kui-color-text);
  }

  .file-list {
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    padding: 0.75rem;
    background: var(--kui-color-surface-muted);
    display: grid;
    gap: 0.5rem;
  }

  .file-item {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
  }

  /* Preview */
  .preview-image,
  .preview-video {
    max-width: 100%;
    border-radius: var(--kui-radius-md);
    display: block;
  }

  .preview-info {
    display: grid;
    place-items: center;
    gap: 0.5rem;
    padding: 2rem;
    text-align: center;
  }

  .preview-icon {
    width: 3rem;
    height: 3rem;
    color: var(--kui-color-muted);
  }

  .preview-name {
    margin: 0;
    font-weight: 600;
  }

  .preview-actions {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--kui-color-border);
  }
</style>
