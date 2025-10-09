<script lang="ts">
  import { getAllMedia, getFolders, uploadMedia, updateMedia, deleteMedia, createFolder, updateFolder, deleteFolder } from './storage.remote';
  import { Modal, Badge, Button, InfoCard } from '@kuratchi/ui';
  import { Upload, FolderPlus, Trash2, Edit, Image, Film, FileText, File as FileIcon, X, Grid3x3, List, Folder } from 'lucide-svelte';

  // Load data directly
  let mediaQuery = getAllMedia();
  let foldersQuery = getFolders();
  
  let media = $derived(mediaQuery.current ?? []);
  let folders = $derived(foldersQuery.current ?? []);
  
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
  
  // Modal state
  let folderModalMode = $state<'create' | 'edit'>('create');
  let editingFolder = $state<any>(null);
  let editingMedia = $state<any>(null);
  let deletingMedia = $state<any>(null);
  let uploadingFiles = $state<File[]>([]);
  
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
    // For images, return a thumbnail URL (you'd implement actual logic here)
    if (media.mimeType?.startsWith('image/')) {
      return media.url || `/api/media/${media.id}/thumbnail`;
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
  
  function resetFolderForm() {
    folderFormData = { name: '', slug: '' };
    editingFolder = null;
  }
  
  function resetMediaForm() {
    mediaFormData = { filename: '', alt: '', folder: '' };
    editingMedia = null;
  }
  
  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      uploadingFiles = Array.from(input.files);
      showUploadModal = true;
    }
  }
  
  function handleUploadSubmit() {
    showUploadModal = false;
    uploadingFiles = [];
  }
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
      <label for="file-upload" class="btn btn-primary btn-sm cursor-pointer">
        <Upload class="h-4 w-4" />
        Upload Files
      </label>
      <input 
        id="file-upload" 
        type="file" 
        multiple 
        class="hidden" 
        onchange={handleFileSelect}
        accept="image/*,video/*,.pdf,.doc,.docx"
      />
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
                  <button 
                    class:active={selectedFolder === folder.id}
                    onclick={() => selectedFolder = folder.id}
                  >
                    <Folder class="h-4 w-4" />
                    {folder.name}
                  </button>
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
                <div class="card border border-base-200 bg-base-100 hover:shadow-lg transition-shadow group">
                  <div class="aspect-square bg-base-200 relative overflow-hidden">
                    {#if thumbnail}
                      <img src={thumbnail} alt={item.alt || item.filename} class="w-full h-full object-cover" />
                    {:else}
                      <div class="w-full h-full flex items-center justify-center">
                        <Icon class="h-12 w-12 text-base-content/30" />
                      </div>
                    {/if}
                    <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button class="btn btn-sm btn-circle btn-ghost text-white" onclick={() => openEditMediaModal(item)}>
                        <Edit class="h-4 w-4" />
                      </button>
                      <button class="btn btn-sm btn-circle btn-ghost text-error" onclick={() => openDeleteConfirm(item)}>
                        <Trash2 class="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div class="card-body p-3">
                    <p class="text-xs font-medium truncate" title={item.filename}>{item.filename}</p>
                    <p class="text-xs text-base-content/50">{formatFileSize(item.size)}</p>
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
                      <td>{formatFileSize(item.size)}</td>
                      <td class="text-sm">{new Date(item.created_at).toLocaleDateString()}</td>
                      <td>
                        <div class="flex gap-2">
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
  {#snippet header()}
    <h3 class="font-bold text-lg">Upload Files</h3>
  {/snippet}
    <div class="space-y-4">
      <div class="space-y-2">
        {#each uploadingFiles as file}
          <div class="flex items-center gap-3 p-3 bg-base-200 rounded-lg">
            <FileIcon class="h-5 w-5" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate">{file.name}</p>
              <p class="text-xs text-base-content/50">{formatFileSize(file.size)}</p>
            </div>
          </div>
        {/each}
      </div>
      
      <div class="form-control">
        <label class="label" for="upload-folder"><span class="label-text">Folder (Optional)</span></label>
        <select id="upload-folder" name="folder" class="select select-bordered">
          <option value="">Root</option>
          {#each folders as folder}
            <option value={folder.id}>{folder.name}</option>
          {/each}
        </select>
      </div>
      
      <div class="flex gap-2 justify-end mt-4">
        <button type="button" class="btn" onclick={() => { showUploadModal = false; uploadingFiles = []; }}>Cancel</button>
        <form {...uploadMedia} onsubmit={handleUploadSubmit} style="display: inline;">
          {#each uploadingFiles as file}
            <input type="file" name="files" files={[file]} style="display: none;" />
          {/each}
          <button type="submit" class="btn btn-primary">Upload {uploadingFiles.length} {uploadingFiles.length === 1 ? 'File' : 'Files'}</button>
        </form>
      </div>
    </div>
</Modal>

<!-- Edit Media Modal -->
<Modal bind:open={showEditModal}>
  {#snippet header()}
    <h3 class="font-bold text-lg">Edit File</h3>
  {/snippet}
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
  {#snippet header()}
    <h3 class="font-bold text-lg">{folderModalMode === 'create' ? 'New Folder' : 'Edit Folder'}</h3>
  {/snippet}
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
  {#snippet header()}
    <h3 class="font-bold text-lg text-error">Delete File</h3>
  {/snippet}
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
