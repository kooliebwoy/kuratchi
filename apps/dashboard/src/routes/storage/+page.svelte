<script lang="ts">
  import { getAllMedia, getFolders, uploadMedia, updateMedia, deleteMedia, createFolder, updateFolder, deleteFolder } from '$lib/api/storage.remote';
  import { Modal, Badge, Button, InfoCard } from '@kuratchi/ui';
  import { Upload, FolderPlus, Trash2, Edit, Image, Film, FileText, File as FileIcon, X, Grid3x3, List, Folder, Eye } from 'lucide-svelte';

  // Load data directly
  let mediaQuery = getAllMedia();
  let foldersQuery = getFolders();
  
  let media = $derived<any[]>(mediaQuery.current ?? []);
  let folders = $derived<any[]>(foldersQuery.current ?? []);
  
  // State
  let selectedFolder = $state<string | null>(null);
  let viewMode = $state<'grid' | 'list'>('grid');
  let searchQuery = $state('');
  let fileFilter = $state<'all' | 'images' | 'videos' | 'documents'>('all');
  
  // Modals
  let showUploadModal = $state(false);
  let showFolderModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteConfirm = $state(false);
  let showDeleteFolderConfirm = $state(false);
  let showPreviewModal = $state(false);
  
  // Modal state
  let folderModalMode = $state<'create' | 'edit'>('create');
  let editingFolder = $state<any>(null);
  let deletingFolder = $state<any>(null);
  let editingMedia = $state<any>(null);
  let deletingMedia = $state<any>(null);
  let previewMedia = $state<any>(null);
  let uploadingFiles = $state<File[]>([]);
  let fileInput: HTMLInputElement | null = null;
  
  // Form data
  let folderFormData = $state({ name: '', slug: '' });
  let mediaFormData = $state({ filename: '', alt: '', folder: '' });
  
  // Computed
  let filteredMedia = $derived(() => {
    let result = media || [];
    
    // Filter by folder
    if (selectedFolder) {
      result = result.filter((m: any) => m.folder === selectedFolder);
    }
    
    // Filter by type
    if (fileFilter !== 'all') {
      result = result.filter((m: any) => {
        if (fileFilter === 'images') return m.mimeType?.startsWith('image/');
        if (fileFilter === 'videos') return m.mimeType?.startsWith('video/');
        if (fileFilter === 'documents') return m.mimeType?.includes('pdf') || m.mimeType?.includes('document');
        return true;
      });
    }
    
    // Filter by search
    if (searchQuery) {
      result = result.filter((m: any) => 
        m.filename?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.originalFilename?.toLowerCase().includes(searchQuery.toLowerCase())
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
  
  function getThumbnailUrl(media: any) {
    // For images, return the media URL directly
    if (media.mimeType?.startsWith('image/')) {
      return media.url;
    }
    return null;
  }
  
  // Actions
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

  function openUploadModal() {
    showUploadModal = true;
    uploadingFiles = [];
    resetFileInput();
  }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      uploadingFiles = Array.from(input.files);
    } else {
      uploadingFiles = [];
    }
  }

  function resetFileInput() {
    if (fileInput) {
      fileInput.value = '';
    }
  }

  function cancelUpload() {
    showUploadModal = false;
    uploadingFiles = [];
    resetFileInput();
  }

  function handleUploadSubmit(event: SubmitEvent) {
    const form = event.currentTarget as HTMLFormElement;
    const filesField = form.elements.namedItem('files[]') as HTMLInputElement | null;
    const hasFiles = !!filesField?.files && filesField.files.length > 0;

    if (!hasFiles) {
      event.preventDefault();
      return;
    }

    showUploadModal = false;
    uploadingFiles = [];

    requestAnimationFrame(() => {
      resetFileInput();
    });
  }

  function closePreviewModal() {
    showPreviewModal = false;
  }

  $effect(() => {
    if (!showPreviewModal) {
      previewMedia = null;
    }
  });
</script>

<svelte:head>
  <title>Storage - Kuratchi</title>
</svelte:head>

<section class="space-y-6">
  <!-- Header -->
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold">Media Library</h1>
      <p class="text-sm text-base-content/60">Manage your files and media assets</p>
    </div>
    <div class="flex gap-2">
      <button class="btn btn-outline btn-sm" onclick={openCreateFolderModal}>
        <FolderPlus class="h-4 w-4" />
        New Folder
      </button>
      <button class="btn btn-primary btn-sm" type="button" onclick={openUploadModal}>
        <Upload class="h-4 w-4" />
        Upload Files
      </button>
    </div>
  </div>

  <!-- Main Content Area -->
  <div class="card bg-base-100 border border-base-200">
    <div class="card-body p-0">
      <div class="flex flex-col lg:flex-row">
        <!-- Sidebar -->
        <aside class="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-base-200 p-4 space-y-6">
          <!-- Folders -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-semibold text-sm">Folders</h3>
              <button class="btn btn-ghost btn-xs btn-circle" onclick={openCreateFolderModal}>
                <FolderPlus class="h-3 w-3" />
              </button>
            </div>
            <ul class="menu menu-sm w-full p-0">
              <li>
                <button 
                  class:active={selectedFolder === null}
                  onclick={() => selectedFolder = null}
                >
                  <Folder class="h-4 w-4" />
                  All Files
                </button>
              </li>
              {#each folders as folder}
                <li>
                  <div class="flex items-center justify-between w-full group">
                    <button 
                      class:active={selectedFolder === folder.id}
                      onclick={() => selectedFolder = folder.id}
                      class="flex-1 flex items-center gap-2"
                    >
                      <Folder class="h-4 w-4" />
                      {folder.name}
                    </button>
                    <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        class="btn btn-ghost btn-xs btn-circle" 
                        onclick={(e) => { e.stopPropagation(); openEditFolderModal(folder); }}
                        title="Edit folder"
                      >
                        <Edit class="h-3 w-3" />
                      </button>
                      <button 
                        class="btn btn-ghost btn-xs btn-circle text-error" 
                        onclick={(e) => { e.stopPropagation(); deletingFolder = folder; showDeleteFolderConfirm = true; }}
                        title="Delete folder"
                      >
                        <Trash2 class="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </li>
              {/each}
            </ul>
          </div>
          
          <!-- File Type Filter -->
          <div>
            <h3 class="font-semibold text-sm mb-3">File Type</h3>
            <ul class="menu menu-sm w-full p-0">
              <li>
                <button class:active={fileFilter === 'all'} onclick={() => fileFilter = 'all'}>
                  <FileIcon class="h-4 w-4" />
                  All Types
                </button>
              </li>
              <li>
                <button class:active={fileFilter === 'images'} onclick={() => fileFilter = 'images'}>
                  <Image class="h-4 w-4" />
                  Images
                </button>
              </li>
              <li>
                <button class:active={fileFilter === 'videos'} onclick={() => fileFilter = 'videos'}>
                  <Film class="h-4 w-4" />
                  Videos
                </button>
              </li>
              <li>
                <button class:active={fileFilter === 'documents'} onclick={() => fileFilter = 'documents'}>
                  <FileText class="h-4 w-4" />
                  Documents
                </button>
              </li>
            </ul>
          </div>
        </aside>

        <!-- Main Content -->
        <main class="flex-1 p-4 lg:p-6 space-y-4">
          <!-- Toolbar -->
          <div class="flex flex-wrap items-center gap-3 pb-4 border-b border-base-200">
            <input 
              type="text" 
              placeholder="Search files..." 
              class="input input-bordered input-sm flex-1 min-w-[200px]"
              bind:value={searchQuery}
            />
            <div class="join">
              <button 
                class="join-item btn btn-sm" 
                class:btn-active={viewMode === 'grid'} 
                onclick={() => viewMode = 'grid'}
              >
                <Grid3x3 class="h-4 w-4" />
              </button>
              <button 
                class="join-item btn btn-sm" 
                class:btn-active={viewMode === 'list'} 
                onclick={() => viewMode = 'list'}
              >
                <List class="h-4 w-4" />
              </button>
            </div>
          </div>

          <!-- Content Area -->
          {#if filteredMedia().length === 0}
            <div class="text-center py-16">
              <FileIcon class="h-16 w-16 mx-auto text-base-content/20 mb-4" />
              <p class="text-lg font-medium text-base-content/60">No files found</p>
              <p class="text-sm text-base-content/40 mt-1">Upload some files to get started</p>
            </div>
          {:else if viewMode === 'grid'}
            <!-- Grid View -->
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {#each filteredMedia() as item}
                {@const thumbnail = getThumbnailUrl(item)}
                {@const Icon = getFileIcon(item.mimeType)}
                <div
                  class="card border border-base-200 bg-base-100 hover:shadow-lg transition-shadow group cursor-pointer"
                  role="button"
                  tabindex="0"
                  onclick={() => openPreviewMedia(item)}
                  onkeydown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPreviewMedia(item); } }}
                >
                  <div class="aspect-square bg-base-200 relative overflow-hidden">
                    {#if thumbnail}
                      <img src={thumbnail} alt={item.alt || item.filename} class="w-full h-full object-cover" />
                    {:else}
                      <div class="w-full h-full flex items-center justify-center">
                        <Icon class="h-12 w-12 text-base-content/30" />
                      </div>
                    {/if}
                    <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button class="btn btn-sm btn-circle btn-ghost text-white" onclick={(event) => { event.stopPropagation(); openPreviewMedia(item); }}>
                        <Eye class="h-4 w-4" />
                      </button>
                      <button class="btn btn-sm btn-circle btn-ghost text-white" onclick={(event) => { event.stopPropagation(); openEditMediaModal(item); }}>
                        <Edit class="h-4 w-4" />
                      </button>
                      <button class="btn btn-sm btn-circle btn-ghost text-error" onclick={(event) => { event.stopPropagation(); openDeleteConfirm(item); }}>
                        <Trash2 class="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div class="card-body p-3">
                    <p class="text-xs font-medium truncate" title={item.filename}>{item.filename}</p>
                    <p class="text-xs text-base-content/50">{formatFileSize(item.size ?? 0)}</p>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <!-- List View -->
            <div class="overflow-x-auto">
              <table class="table table-zebra">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Uploaded</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {#each filteredMedia() as item}
                    {@const Icon = getFileIcon(item.mimeType)}
                    <tr>
                      <td>
                        <div class="flex items-center gap-3">
                          <Icon class="h-5 w-5 text-base-content/50" />
                          <span class="font-medium">{item.filename}</span>
                        </div>
                      </td>
                      <td><Badge variant="ghost" size="sm">{item.mimeType?.split('/')[0] || 'file'}</Badge></td>
                      <td>{formatFileSize(item.size ?? 0)}</td>
                      <td class="text-sm">{new Date(item.created_at ?? item.uploaded ?? Date.now()).toLocaleDateString()}</td>
                      <td>
                        <div class="flex gap-2">
                          <button class="btn btn-ghost btn-xs" onclick={() => openPreviewMedia(item)}>
                            <Eye class="h-3 w-3" />
                          </button>
                          <button class="btn btn-ghost btn-xs" onclick={() => openEditMediaModal(item)}>
                            <Edit class="h-3 w-3" />
                          </button>
                          <button class="btn btn-ghost btn-xs text-error" onclick={() => openDeleteConfirm(item)}>
                            <Trash2 class="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </main>
      </div>
    </div>
  </div>
</section>

<!-- Upload Modal -->
<Modal bind:open={showUploadModal}>
  <div class="space-y-2 mb-4">
    <h3 class="font-bold text-lg">Upload Files</h3>
    <p class="text-sm text-base-content/60">Select files and choose a destination folder.</p>
  </div>
    <div class="space-y-4">
      <form {...uploadMedia} onsubmit={handleUploadSubmit} class="space-y-4" enctype="multipart/form-data">
        <div class="space-y-2">
          <label class="label" for="file-upload"><span class="label-text">Select files</span></label>
          <input
            id="file-upload"
            name="files[]"
            type="file"
            multiple
            class="file-input file-input-bordered w-full"
            bind:this={fileInput}
            onchange={handleFileSelect}
            accept="image/*,video/*,.pdf,.doc,.docx"
          />
          {#if uploadingFiles.length === 0}
            <p class="text-sm text-base-content/60">No files selected yet.</p>
          {:else}
            {#each uploadingFiles as file}
              <div class="flex items-center gap-3 p-3 bg-base-200 rounded-lg">
                <FileIcon class="h-5 w-5" />
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium truncate">{file.name}</p>
                  <p class="text-xs text-base-content/50">{formatFileSize(file.size)}</p>
                </div>
              </div>
            {/each}
          {/if}
        </div>

        <div class="form-control">
          <label class="label" for="upload-folder"><span class="label-text">Folder (Optional)</span></label>
          <select id="upload-folder" name="folder" class="select select-bordered" value={selectedFolder || ''}>
            <option value="">Root</option>
            {#each folders as folder}
              <option value={folder.id}>{folder.name}</option>
            {/each}
          </select>
        </div>

        <div class="flex gap-2 justify-end mt-4">
          <button type="button" class="btn" onclick={cancelUpload}>Cancel</button>
          <button type="submit" class="btn btn-primary" disabled={uploadingFiles.length === 0}>
            Upload {uploadingFiles.length}
            {uploadingFiles.length === 1 ? ' File' : ' Files'}
          </button>
        </div>
      </form>
    </div>
</Modal>

<!-- Preview Modal -->
<Modal bind:open={showPreviewModal}>
  <div class="flex flex-col gap-1 mb-4">
    <h3 class="font-bold text-lg">Preview File</h3>
    <p class="text-sm text-base-content/60 truncate">{previewMedia?.filename}</p>
  </div>
  {#if previewMedia}
    {#if previewMedia.mimeType?.startsWith('image/')}
      <img src={previewMedia.url} alt={previewMedia.alt || previewMedia.filename} class="max-h-[70vh] w-full object-contain rounded-lg" />
    {:else if previewMedia.mimeType?.startsWith('video/')}
      <video src={previewMedia.url} controls class="w-full rounded-lg" style="max-height:70vh;">
        <track kind="captions" srclang="en" label="Captions" src="data:text/vtt,WEBVTT%0A%0A" default />
        <p>Your browser does not support embedded videos. <a href={previewMedia.url} target="_blank" rel="noreferrer noopener">Open in a new tab</a>.</p>
      </video>
    {:else}
      <div class="p-6 text-center space-y-3">
        <FileIcon class="h-12 w-12 mx-auto text-base-content/40" />
        <p class="text-sm text-base-content/70">
          {#if previewMedia.filename}
            Preview not available for this file type: {previewMedia.filename}
          {:else}
            Preview not available for this file type.
          {/if}
        </p>
      </div>
    {/if}
    <div class="flex gap-2 justify-end mt-4">
      <a class="btn btn-outline" href={previewMedia.url} target="_blank" rel="noreferrer noopener" download={previewMedia.filename}>
        Open in new tab
      </a>
      <button type="button" class="btn btn-primary" onclick={closePreviewModal}>Close</button>
    </div>
  {:else}
    <p class="text-sm text-base-content/60">No file selected.</p>
  {/if}
</Modal>

<!-- Edit Media Modal -->
<Modal bind:open={showEditModal}>
  <div class="mb-4">
    <h3 class="font-bold text-lg">Edit File</h3>
  </div>
    <form {...updateMedia} onsubmit={() => { showEditModal = false; resetMediaForm(); }} class="space-y-3">
      <input type="hidden" name="id" value={editingMedia?.id} />
      <div class="form-control">
        <label class="label" for="media-filename"><span class="label-text">Filename</span></label>
        <input id="media-filename" {...updateMedia.fields.filename.as('text')} class="input input-bordered" value={mediaFormData.filename} />
      </div>
      <div class="form-control">
        <label class="label" for="media-alt"><span class="label-text">Alt Text</span></label>
        <input id="media-alt" {...updateMedia.fields.alt.as('text')} class="input input-bordered" placeholder="Describe the image" value={mediaFormData.alt} />
      </div>
      <div class="form-control">
        <label class="label" for="media-folder"><span class="label-text">Folder</span></label>
        <select id="media-folder" {...updateMedia.fields.folder.as('text')} class="select select-bordered" value={mediaFormData.folder}>
          <option value="">Root</option>
          {#each folders as folder}
            <option value={folder.id}>{folder.name}</option>
          {/each}
        </select>
      </div>
      <div class="flex gap-2 justify-end mt-4">
        <button type="button" class="btn" onclick={() => { showEditModal = false; resetMediaForm(); }}>Cancel</button>
        <button type="submit" class="btn btn-primary">Save Changes</button>
      </div>
    </form>
</Modal>

<!-- Folder Modal -->
<Modal bind:open={showFolderModal}>
  <div class="mb-4">
    <h3 class="font-bold text-lg">{folderModalMode === 'create' ? 'New Folder' : 'Edit Folder'}</h3>
  </div>
    {#if folderModalMode === 'create'}
      <form {...createFolder} onsubmit={() => { showFolderModal = false; resetFolderForm(); }} class="space-y-3">
        <div class="form-control">
          <label class="label" for="folder-name"><span class="label-text">Name</span></label>
          <input id="folder-name" {...createFolder.fields.name.as('text')} class="input input-bordered" placeholder="My Folder" required />
        </div>
        <div class="form-control">
          <label class="label" for="folder-slug"><span class="label-text">Slug</span></label>
          <input id="folder-slug" {...createFolder.fields.slug.as('text')} class="input input-bordered" placeholder="my-folder" required />
        </div>
        <div class="flex gap-2 justify-end mt-4">
          <button type="button" class="btn" onclick={() => { showFolderModal = false; resetFolderForm(); }}>Cancel</button>
          <button type="submit" class="btn btn-primary">Create Folder</button>
        </div>
      </form>
    {:else}
      <form {...updateFolder} onsubmit={() => { showFolderModal = false; resetFolderForm(); }} class="space-y-3">
        <input type="hidden" name="id" value={editingFolder?.id} />
        <div class="form-control">
          <label class="label" for="folder-name-edit"><span class="label-text">Name</span></label>
          <input id="folder-name-edit" {...updateFolder.fields.name.as('text')} class="input input-bordered" value={folderFormData.name} required />
        </div>
        <div class="form-control">
          <label class="label" for="folder-slug-edit"><span class="label-text">Slug</span></label>
          <input id="folder-slug-edit" {...updateFolder.fields.slug.as('text')} class="input input-bordered" value={folderFormData.slug} required />
        </div>
        <div class="flex gap-2 justify-end mt-4">
          <button type="button" class="btn" onclick={() => { showFolderModal = false; resetFolderForm(); }}>Cancel</button>
          <button type="submit" class="btn btn-primary">Save Changes</button>
        </div>
      </form>
    {/if}
</Modal>

<!-- Delete Confirmation -->
<Modal bind:open={showDeleteConfirm}>
  <div class="mb-4">
    <h3 class="font-bold text-lg text-error">Delete File</h3>
  </div>
    <div class="space-y-4">
      <p class="text-base-content/70">
        Are you sure you want to delete <strong class="font-semibold">{deletingMedia?.filename}</strong>?
      </p>
      <p class="text-sm text-error">This action cannot be undone.</p>
      
      <div class="flex gap-2 justify-end">
        <button type="button" class="btn btn-outline" onclick={() => { showDeleteConfirm = false; deletingMedia = null; }}>
          Cancel
        </button>
        <form {...deleteMedia} onsubmit={() => { showDeleteConfirm = false; deletingMedia = null; }}>
          <input type="hidden" name="id" value={deletingMedia?.id} />
          <button type="submit" class="btn btn-error">Delete File</button>
        </form>
      </div>
    </div>
</Modal>

<!-- Delete Folder Confirmation -->
<Modal bind:open={showDeleteFolderConfirm}>
  <div class="mb-4">
    <h3 class="font-bold text-lg text-error">Delete Folder</h3>
  </div>
    <div class="space-y-4">
      <p class="text-base-content/70">
        Are you sure you want to delete the folder <strong class="font-semibold">{deletingFolder?.name}</strong>?
      </p>
      <p class="text-sm text-error">This will delete all files inside this folder. This action cannot be undone.</p>
      
      <div class="flex gap-2 justify-end">
        <button type="button" class="btn btn-outline" onclick={() => { showDeleteFolderConfirm = false; deletingFolder = null; }}>
          Cancel
        </button>
        <form {...deleteFolder} onsubmit={() => { showDeleteFolderConfirm = false; deletingFolder = null; }}>
          <input type="hidden" name="id" value={deletingFolder?.id} />
          <button type="submit" class="btn btn-error">Delete Folder</button>
        </form>
      </div>
    </div>
</Modal>
