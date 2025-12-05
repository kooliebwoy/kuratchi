<script lang="ts">
  import { Button, Card, Dialog, Badge, Loading } from '@kuratchi/ui';
  import { 
    Building2, Plus, Pencil, Trash2, X, Search, ExternalLink, 
    ChevronRight, Bike, Globe, Image as ImageIcon
  } from '@lucide/svelte';
  import { 
    getOems, createOem, updateOem, deleteOem, getVehicles
  } from '$lib/functions/catalog.remote';
  import { goto } from '$app/navigation';

  // Data
  const oems = getOems();
  const vehicles = getVehicles();
  const oemsData = $derived(oems.current || []);
  const vehiclesData = $derived(vehicles.current || []);

  // Get vehicle count per OEM
  const vehicleCountByOem = $derived(() => {
    const counts: Record<string, number> = {};
    for (const v of vehiclesData) {
      const oemId = v.oem_id;
      counts[oemId] = (counts[oemId] || 0) + 1;
    }
    return counts;
  });

  // State
  let searchQuery = $state('');
  let showAddModal = $state(false);
  let showEditModal = $state(false);
  let showDeleteModal = $state(false);
  let selectedOem = $state<any>(null);

  // Form state
  let formName = $state('');
  let formWebsite = $state('');
  let formLogo = $state('');
  let formDescription = $state('');
  let isSubmitting = $state(false);
  let formError = $state<string | null>(null);

  // Filtered OEMs
  const filteredOems = $derived(() => {
    if (!searchQuery) return oemsData;
    const query = searchQuery.toLowerCase();
    return oemsData.filter((o: any) => 
      o.name?.toLowerCase().includes(query) ||
      o.website_url?.toLowerCase().includes(query)
    );
  });

  // Handlers
  function openAddModal() {
    formName = '';
    formWebsite = '';
    formLogo = '';
    formDescription = '';
    formError = null;
    showAddModal = true;
  }

  function openEditModal(oem: any) {
    selectedOem = oem;
    formName = oem.name || '';
    formWebsite = oem.website_url || '';
    formLogo = oem.logo_url || '';
    formDescription = oem.description || '';
    formError = null;
    showEditModal = true;
  }

  function openDeleteModal(oem: any) {
    selectedOem = oem;
    showDeleteModal = true;
  }

  function closeModals() {
    showAddModal = false;
    showEditModal = false;
    showDeleteModal = false;
    selectedOem = null;
    formError = null;
  }

  async function handleAdd() {
    if (!formName.trim()) {
      formError = 'Name is required';
      return;
    }

    isSubmitting = true;
    formError = null;

    try {
      await createOem({
        name: formName.trim(),
        websiteUrl: formWebsite.trim() || undefined,
        logoUrl: formLogo.trim() || undefined,
        description: formDescription.trim() || undefined
      });
      // Refresh both OEMs and vehicles to ensure consistency
      await Promise.all([oems.refresh(), vehicles.refresh()]);
      closeModals();
    } catch (err: any) {
      formError = err.message || 'Failed to add OEM';
    } finally {
      isSubmitting = false;
    }
  }

  async function handleUpdate() {
    if (!selectedOem || !formName.trim()) {
      formError = 'Name is required';
      return;
    }

    isSubmitting = true;
    formError = null;

    try {
      await updateOem({
        id: selectedOem.id,
        name: formName.trim(),
        websiteUrl: formWebsite.trim() || undefined,
        logoUrl: formLogo.trim() || undefined,
        description: formDescription.trim() || undefined
      });
      await Promise.all([oems.refresh(), vehicles.refresh()]);
      closeModals();
    } catch (err: any) {
      formError = err.message || 'Failed to update OEM';
    } finally {
      isSubmitting = false;
    }
  }

  async function handleDelete() {
    if (!selectedOem) return;

    isSubmitting = true;
    formError = null;

    try {
      await deleteOem({ id: selectedOem.id });
      await Promise.all([oems.refresh(), vehicles.refresh()]);
      closeModals();
    } catch (err: any) {
      formError = err.message || 'Failed to delete OEM';
    } finally {
      isSubmitting = false;
    }
  }

  function viewOemVehicles(oem: any) {
    goto(`/catalog?oem=${oem.id}`);
  }
</script>

<svelte:head>
  <title>OEM Management - Kuratchi</title>
</svelte:head>

<div class="oems-page">
  <!-- Search and Add Button -->
  <div class="search-header">
    <div class="search-bar">
      <Search class="search-icon" />
      <input 
        type="text" 
        placeholder="Search OEMs..." 
        bind:value={searchQuery}
        class="search-input"
      />
    </div>
    <Button variant="primary" size="sm" onclick={openAddModal} class="add-btn">
      <Plus class="icon" />
      Add OEM
    </Button>
  </div>

  <!-- OEMs Grid -->
  {#if oems.loading}
    <div class="center-content">
      <Loading size="md" />
      <p class="subtext">Loading OEMs...</p>
    </div>
  {:else if filteredOems().length === 0}
    <Card>
      <div class="empty-state">
        <Building2 class="empty-icon" />
        <h3>No OEMs Found</h3>
        <p class="subtext">
          {#if searchQuery}
            No OEMs match your search. Try a different query.
          {:else}
            Add your first OEM to start building your catalog.
          {/if}
        </p>
        {#if !searchQuery}
          <Button variant="primary" size="sm" onclick={openAddModal}>
            <Plus class="icon" /> Add OEM
          </Button>
        {/if}
      </div>
    </Card>
  {:else}
    <div class="oems-grid">
      {#each filteredOems() as oem}
        {@const vehicleCount = vehicleCountByOem()[oem.id] || 0}
        <Card class="oem-card">
          <div class="oem-card-content">
            <div class="oem-logo">
              {#if oem.logo_url}
                <img src={oem.logo_url} alt={oem.name} />
              {:else}
                <Building2 />
              {/if}
            </div>
            <div class="oem-info">
              <h3 class="oem-name">{oem.name}</h3>
              {#if oem.website_url}
                <a href={oem.website_url} target="_blank" rel="noopener" class="oem-website">
                  <Globe class="icon-sm" />
                  {oem.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </a>
              {/if}
              {#if oem.description}
                <p class="oem-description">{oem.description}</p>
              {/if}
            </div>
            <div class="oem-stats">
              <Badge variant={vehicleCount > 0 ? 'primary' : 'secondary'}>
                {vehicleCount} vehicle{vehicleCount !== 1 ? 's' : ''}
              </Badge>
            </div>
          </div>
          <div class="oem-actions">
            <Button variant="ghost" size="sm" onclick={() => viewOemVehicles(oem)}>
              View Vehicles <ChevronRight class="icon-sm" />
            </Button>
            <div class="action-buttons">
              <button class="icon-btn" onclick={() => openEditModal(oem)} title="Edit">
                <Pencil />
              </button>
              <button class="icon-btn danger" onclick={() => openDeleteModal(oem)} title="Delete">
                <Trash2 />
              </button>
            </div>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
</div>

<!-- Add OEM Modal -->
<Dialog bind:open={showAddModal}>
  <div class="modal-content">
    <div class="modal-header">
      <h2>Add New OEM</h2>
      <button class="close-btn" onclick={closeModals}><X /></button>
    </div>
    
    <form onsubmit={(e) => { e.preventDefault(); handleAdd(); }}>
      <label class="form-field">
        <span class="form-label">Name <span class="required">*</span></span>
        <input type="text" class="form-input" bind:value={formName} placeholder="e.g., Kayo USA" />
      </label>

      <label class="form-field">
        <span class="form-label">Website URL</span>
        <input type="url" class="form-input" bind:value={formWebsite} placeholder="https://..." />
      </label>

      <label class="form-field">
        <span class="form-label">Logo URL</span>
        <input type="url" class="form-input" bind:value={formLogo} placeholder="https://..." />
      </label>

      <label class="form-field">
        <span class="form-label">Description</span>
        <textarea class="form-textarea" bind:value={formDescription} placeholder="Brief description of the OEM..." rows="3"></textarea>
      </label>

      {#if formError}
        <p class="error-text">{formError}</p>
      {/if}

      <div class="modal-actions">
        <Button variant="ghost" onclick={closeModals} disabled={isSubmitting}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Adding...' : 'Add OEM'}
        </Button>
      </div>
    </form>
  </div>
</Dialog>

<!-- Edit OEM Modal -->
<Dialog bind:open={showEditModal}>
  <div class="modal-content">
    <div class="modal-header">
      <h2>Edit OEM</h2>
      <button class="close-btn" onclick={closeModals}><X /></button>
    </div>
    
    <form onsubmit={(e) => { e.preventDefault(); handleUpdate(); }}>
      <label class="form-field">
        <span class="form-label">Name <span class="required">*</span></span>
        <input type="text" class="form-input" bind:value={formName} placeholder="e.g., Kayo USA" />
      </label>

      <label class="form-field">
        <span class="form-label">Website URL</span>
        <input type="url" class="form-input" bind:value={formWebsite} placeholder="https://..." />
      </label>

      <label class="form-field">
        <span class="form-label">Logo URL</span>
        <input type="url" class="form-input" bind:value={formLogo} placeholder="https://..." />
      </label>

      <label class="form-field">
        <span class="form-label">Description</span>
        <textarea class="form-textarea" bind:value={formDescription} placeholder="Brief description of the OEM..." rows="3"></textarea>
      </label>

      {#if formError}
        <p class="error-text">{formError}</p>
      {/if}

      <div class="modal-actions">
        <Button variant="ghost" onclick={closeModals} disabled={isSubmitting}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  </div>
</Dialog>

<!-- Delete Confirmation Modal -->
<Dialog bind:open={showDeleteModal}>
  <div class="modal-content">
    <div class="modal-header">
      <h2>Delete OEM</h2>
      <button class="close-btn" onclick={closeModals}><X /></button>
    </div>
    
    <p class="delete-warning">
      Are you sure you want to delete <strong>{selectedOem?.name}</strong>?
    </p>
    <p class="subtext">
      This action cannot be undone. You must delete all vehicles under this OEM first.
    </p>

    {#if formError}
      <p class="error-text">{formError}</p>
    {/if}

    <div class="modal-actions">
      <Button variant="ghost" onclick={closeModals} disabled={isSubmitting}>Cancel</Button>
      <Button variant="error" onclick={handleDelete} disabled={isSubmitting}>
        {isSubmitting ? 'Deleting...' : 'Delete OEM'}
      </Button>
    </div>
  </div>
</Dialog>

<style>
  .oems-page {
    display: grid;
    gap: var(--kui-spacing-md);
  }

  .search-header {
    display: flex;
    flex-direction: column;
    gap: var(--kui-spacing-sm);
  }

  @media (min-width: 640px) {
    .search-header {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
  }

  
  h2 { margin: 0; font-size: 1.25rem; }
  h3 { margin: 0; }

  .subtext {
    color: var(--kui-color-muted);
    margin: 0;
  }

  .search-bar {
    position: relative;
    max-width: 400px;
  }

  .search-icon {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    width: 1rem;
    height: 1rem;
    color: var(--kui-color-muted);
  }

  .search-input {
    width: 100%;
    padding: 0.6rem 0.75rem 0.6rem 2.25rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    background: var(--kui-color-surface);
    color: var(--kui-color-text);
    font-size: 0.9rem;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--kui-color-primary);
  }

  .oems-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: var(--kui-spacing-md);
  }

  :global(.oem-card) {
    display: flex;
    flex-direction: column;
  }

  .oem-card-content {
    display: flex;
    gap: var(--kui-spacing-md);
    padding: var(--kui-spacing-md);
    flex: 1;
  }

  .oem-logo {
    width: 60px;
    height: 60px;
    border-radius: var(--kui-radius-md);
    background: var(--kui-color-surface-muted);
    display: grid;
    place-items: center;
    flex-shrink: 0;
    overflow: hidden;
    color: var(--kui-color-muted);
  }

  .oem-logo img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .oem-info {
    flex: 1;
    min-width: 0;
  }

  .oem-name {
    font-size: 1.1rem;
    font-weight: 600;
  }

  .oem-website {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--kui-color-primary);
    font-size: 0.85rem;
    text-decoration: none;
    margin-top: 0.25rem;
  }

  .oem-website:hover {
    text-decoration: underline;
  }

  .oem-description {
    color: var(--kui-color-muted);
    font-size: 0.85rem;
    margin: 0.5rem 0 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .oem-stats {
    flex-shrink: 0;
  }

  .oem-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--kui-spacing-sm) var(--kui-spacing-md);
    border-top: 1px solid var(--kui-color-border);
    background: var(--kui-color-surface-muted);
  }

  .action-buttons {
    display: flex;
    gap: 0.25rem;
  }

  .icon-btn {
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    color: var(--kui-color-muted);
    border-radius: var(--kui-radius-sm);
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: all 0.15s ease;
  }

  .icon-btn:hover {
    background: var(--kui-color-surface);
    color: var(--kui-color-text);
  }

  .icon-btn.danger:hover {
    background: color-mix(in srgb, var(--kui-color-error) 10%, transparent);
    color: var(--kui-color-error);
  }

  .icon { width: 1rem; height: 1rem; }
  .icon-sm { width: 0.85rem; height: 0.85rem; }

  .center-content {
    display: grid;
    place-items: center;
    gap: 0.5rem;
    text-align: center;
    padding: var(--kui-spacing-xl);
  }

  .empty-state {
    display: grid;
    place-items: center;
    gap: 0.5rem;
    text-align: center;
    padding: var(--kui-spacing-xl);
  }

  .empty-icon {
    width: 3rem;
    height: 3rem;
    color: var(--kui-color-muted);
  }

  .modal-content {
    padding: var(--kui-spacing-lg);
    min-width: 400px;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--kui-spacing-md);
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    color: var(--kui-color-muted);
    border-radius: var(--kui-radius-sm);
    cursor: pointer;
    display: grid;
    place-items: center;
  }

  .close-btn:hover {
    background: var(--kui-color-surface-muted);
    color: var(--kui-color-text);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--kui-spacing-sm);
    margin-top: var(--kui-spacing-lg);
  }

  .error-text {
    color: var(--kui-color-error);
    font-size: 0.85rem;
    margin: var(--kui-spacing-sm) 0;
  }

  .delete-warning {
    margin: 0 0 var(--kui-spacing-sm);
  }

  /* Form styles */
  .form-field {
    margin-bottom: var(--kui-spacing-md);
  }

  .form-label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    margin-bottom: 0.375rem;
    color: var(--kui-color-text);
  }

  .form-label .required {
    color: var(--kui-color-error);
  }

  .form-input,
  .form-textarea {
    width: 100%;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    background: var(--kui-color-surface);
    color: var(--kui-color-text);
    font-size: 0.9rem;
    font-family: inherit;
    transition: border-color 0.15s ease;
  }

  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    border-color: var(--kui-color-primary);
  }

  .form-input::placeholder,
  .form-textarea::placeholder {
    color: var(--kui-color-muted);
  }

  .form-textarea {
    resize: vertical;
    min-height: 80px;
  }

  @media (max-width: 768px) {
    .oems-grid {
      grid-template-columns: 1fr;
    }

    .modal-content {
      min-width: auto;
    }
  }
</style>
