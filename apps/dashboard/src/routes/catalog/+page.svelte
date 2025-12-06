<script lang="ts">
  import { Button, Card, Dialog, Badge, Loading, SlidePanel } from '@kuratchi/ui';
  import { Bike, Building2, Plus, Search, Grid3x3, List, Pencil, Trash2, FileText, AlertCircle, ChevronRight, X, Loader2, Check, Tag } from '@lucide/svelte';
  import { 
    getVehicles, getOems, deleteVehicle, updateVehicle,
    scrapeVehicleUrl, importScrapedVehicle,
    getCategories, type CatalogCategory as Category
  } from '$lib/functions/catalog.remote';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';

  // Data
  const vehicles = getVehicles();
  const oems = getOems();
  const categories = getCategories();
  const vehiclesData = $derived(vehicles.current || []);
  const oemsData = $derived(oems.current || []);
  const categoriesData = $derived(categories.current || []);

  // Get OEM filter from URL
  const selectedOemId = $derived(page.url.searchParams.get('oem'));
  const selectedOem = $derived(selectedOemId ? oemsData.find((o: any) => o.id === selectedOemId) : null);

  // State
  let viewMode = $state<'grid' | 'list'>('grid');
  let showAddModal = $state(false);
  let showDeleteModal = $state(false);
  let showVehicleDrawer = $state(false);
  let activeTab = $state<'url' | 'manual' | 'pdf'>('url');
  let selectedVehicle = $state<any>(null);
  let searchQuery = $state('');
  let categoryFilter = $state<string>('all');
  let isEditingVehicle = $state(false);
  let editableVehicle = $state<any>(null);
  let isSavingVehicle = $state(false);

  // Dynamic categories from category management system
  interface CategoryOption {
    value: string;
    label: string;
    count: number;
    color: string;
    icon: string;
  }

  const availableCategories: CategoryOption[] = $derived.by(() => {
    // Count vehicles by category slug
    const categoryMap = new Map<string, number>();
    vehiclesData.forEach(vehicle => {
      if (vehicle.category) {
        categoryMap.set(vehicle.category, (categoryMap.get(vehicle.category) || 0) + 1);
      }
    });

    // Use categories from management system with vehicle counts
    const categoriesWithCounts = categoriesData.map(category => ({
      value: category.slug,
      label: category.name,
      count: categoryMap.get(category.slug) || 0,
      color: category.color,
      icon: category.icon
    })) as CategoryOption[];

    // Add "All Vehicles" at the beginning
    return [
      { value: 'all', label: 'All Vehicles', count: vehiclesData.length, color: '#6b7280', icon: 'list' },
      ...categoriesWithCounts.sort((a, b) => b.count - a.count)
    ];
  });

  
  // Scraping state
  let scrapeUrl = $state('');
  let scrapeLoading = $state(false);
  let scrapeError = $state<string | null>(null);
  let scrapedData = $state<any>(null);
  let selectedOemForImport = $state('');
  let importSubmitting = $state(false);
  let importError = $state<string | null>(null);
  let deleteSubmitting = $state(false);

  // Filtered vehicles
  const filteredVehicles = $derived.by(() => {
    let result = vehiclesData;
    
    // Filter by OEM if selected
    if (selectedOemId) {
      result = result.filter((v: any) => v.oem_id === selectedOemId);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((v: any) => 
        v.model_name?.toLowerCase().includes(query) ||
        v.oem_name?.toLowerCase().includes(query)
      );
    }
    
    // Filter by category slug
    if (categoryFilter !== 'all') {
      result = result.filter((v: any) => v.category === categoryFilter);
    }
    
    return result;
  });

  // Handlers
  function openAddModal() {
    showAddModal = true;
    activeTab = 'url';
    scrapedData = null;
    scrapeError = null;
    scrapeUrl = '';
  }

  function closeAddModal() {
    showAddModal = false;
    scrapedData = null;
    scrapeError = null;
  }

  function openVehicleDrawer(vehicle: any) {
    selectedVehicle = vehicle;
    editableVehicle = { ...vehicle }; 
    showVehicleDrawer = true;
    isEditingVehicle = false;
  }

  function closeVehicleDrawer() {
    showVehicleDrawer = false;
    selectedVehicle = null;
    isEditingVehicle = false;
    editableVehicle = null;
  }

  function startEditingVehicle() {
    isEditingVehicle = true;
    editableVehicle = { ...selectedVehicle };
  }

  function cancelEditingVehicle() {
    isEditingVehicle = false;
    editableVehicle = { ...selectedVehicle };
  }

  async function saveVehicleChanges() {
    if (isSavingVehicle) return;
    isSavingVehicle = true;
    
    try {
      console.log('Saving vehicle:', editableVehicle);
      
      await updateVehicle({
        id: editableVehicle.id,
        modelName: editableVehicle.model_name,
        modelYear: editableVehicle.model_year ? parseInt(editableVehicle.model_year) : undefined,
        category: editableVehicle.category || undefined,
        msrp: editableVehicle.msrp ? parseInt(editableVehicle.msrp) : undefined,
        currency: editableVehicle.currency,
        description: editableVehicle.description,
        status: editableVehicle.status
      });
      
      // Refresh vehicles list
      await vehicles.refresh();
      
      selectedVehicle = { ...editableVehicle };
      isEditingVehicle = false;
      console.log('Vehicle saved successfully');
    } catch (error) {
      console.error('Error saving vehicle:', error);
    } finally {
      isSavingVehicle = false;
    }
  }

  function openDeleteModal(vehicle: any) {
    selectedVehicle = vehicle;
    showDeleteModal = true;
  }

  function closeDeleteModal() {
    showDeleteModal = false;
    selectedVehicle = null;
  }

  async function handleScrape() {
    if (!scrapeUrl) return;
    
    scrapeLoading = true;
    scrapeError = null;
    scrapedData = null;

    try {
      const result = await scrapeVehicleUrl({ url: scrapeUrl });
      scrapedData = result;
    } catch (err: any) {
      scrapeError = err.message || 'Failed to scrape URL';
    } finally {
      scrapeLoading = false;
    }
  }

  async function handleImportVehicle() {
    if (!selectedOemForImport || !scrapedData) {
      importError = 'Please select an OEM';
      return;
    }

    importSubmitting = true;
    importError = null;

    try {
      await importScrapedVehicle({
        oemId: selectedOemForImport,
        scrapedData: JSON.stringify(scrapedData)
      });
      
      await vehicles.refresh();
      scrapedData = null;
      selectedOemForImport = '';
      closeAddModal();
    } catch (err: any) {
      console.error('[handleImportVehicle] error:', err);
      importError = err.message || 'Failed to import vehicle';
    } finally {
      importSubmitting = false;
    }
  }

  async function handleDeleteVehicle() {
    if (!selectedVehicle) return;

    deleteSubmitting = true;

    try {
      await deleteVehicle({ id: selectedVehicle.id });
      await vehicles.refresh();
      closeDeleteModal();
      closeVehicleDrawer(); // Close the drawer after successful deletion
    } catch (err: any) {
      console.error('[handleDeleteVehicle] error:', err);
    } finally {
      deleteSubmitting = false;
    }
  }

  function formatPrice(amount: number | null, currency: string = 'USD') {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Get the CDN thumbnail URL for a vehicle
   * Only returns R2 CDN URL - no fallback to source URLs
   */
  function getThumbnailUrl(vehicle: any): string | null {
    return vehicle.cdn_thumbnail_url || null;
  }

  /**
   * Get CDN images array for a vehicle  
   * Only returns R2 CDN URLs - no fallback to source URLs
   */
  function getImages(vehicle: any): string[] {
    return parseArray(vehicle.cdn_images);
  }

  /**
   * Check if vehicle images are still being processed
   */
  function isProcessingImages(vehicle: any): boolean {
    const hasSources = vehicle.thumbnail_url || parseArray(vehicle.images).length > 0;
    const hasCdn = vehicle.cdn_thumbnail_url || parseArray(vehicle.cdn_images).length > 0;
    return hasSources && !hasCdn;
  }

  /**
   * Parse JSON array or return array directly
   */
  function parseArray(value: any): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function getCategoryLabel(category: string): string {
    const foundCategory = categoriesData.find(cat => cat.slug === category);
    return foundCategory ? foundCategory.name : category;
  }

  function getCategoryInfo(category: string) {
    const foundCategory = categoriesData.find(cat => cat.slug === category);
    return foundCategory || { name: category, color: '#6b7280', icon: 'tag' };
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'published': return 'primary';
      case 'draft': return 'secondary';
      case 'archived': return 'ghost';
      default: return 'secondary';
    }
  }

  function parseSpecs(specs: string | Record<string, string>) {
    if (typeof specs === 'string') {
      try {
        return JSON.parse(specs);
      } catch {
        return {};
      }
    }
    return specs || {};
  }
</script>

<svelte:head>
  <title>{selectedOem ? `${selectedOem.name} Vehicles` : 'Vehicles'} - Catalog Management</title>
</svelte:head>

<div class="vehicles-page">
  <!-- Sidebar -->
  <div class="sidebar">
    <!-- Search -->
    <div class="search-section">
      <div class="search-container">
        <div class="search-input-wrapper">
          <Search class="search-icon" />
          <input 
            type="text" 
            placeholder="Search vehicles..." 
            bind:value={searchQuery}
            class="search-input"
          />
          {#if searchQuery}
            <button 
              class="search-clear"
              onclick={() => searchQuery = ''}
              title="Clear search"
            >
              <X class="search-clear-icon" />
            </button>
          {/if}
        </div>
      </div>
    </div>

    <!-- Categories -->
    <div class="categories">
      <h3 class="categories-title">Categories</h3>
      {#each availableCategories as category}
        <button
          onclick={() => categoryFilter = category.value}
          class={`category-btn ${categoryFilter === category.value ? 'active' : ''}`}
          style="--category-color: {category.color};"
        >
          <span>{category.label}</span>
          <span class="count">{category.count}</span>
        </button>
      {/each}
    </div>

    <!-- Add Vehicle Button -->
    <div class="add-section">
      <Button variant="primary" size="sm" onclick={openAddModal} class="add-btn">
        <Plus class="icon" />
        Add Vehicle
      </Button>
    </div>
  </div>

  <!-- Main Content -->
  <div class="main-content">
    <!-- Header -->
    <div class="content-header">
      <div class="header-info">
        <h2>
          {selectedOem ? `${selectedOem.name} Vehicles` : 'All Vehicles'}
        </h2>
        <p class="subtext">
          {filteredVehicles.length} of {vehiclesData.length} vehicles
        </p>
      </div>
      
      <!-- View Toggle -->
      <div class="view-toggle">
        <button
          onclick={() => viewMode = 'grid'}
          class={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
          title="Grid view"
        >
          <Grid3x3 class="icon" />
        </button>
        <button
          onclick={() => viewMode = 'list'}
          class={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
          title="List view"
        >
          <List class="icon" />
        </button>
      </div>
    </div>

  <!-- Empty State -->
  {#if filteredVehicles.length === 0}
    <Card>
      <div class="empty-state">
        <Bike class="empty-icon" />
        <h3>No vehicles found</h3>
        <p class="subtext">Add your first vehicle to get started</p>
        <Button variant="primary" size="sm" onclick={openAddModal}>
          <Plus class="icon" />
          Add Vehicle
        </Button>
      </div>
    </Card>
  {:else if viewMode === 'grid'}
    <!-- Grid View -->
    <div class="vehicles-grid">
      {#each filteredVehicles as vehicle}
        <div class="vehicle-card-wrapper" onclick={() => openVehicleDrawer(vehicle)} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && openVehicleDrawer(vehicle)}>
          <Card class="vehicle-card">
            <!-- Image with overlay actions -->
            <div class="vehicle-image">
            {#if getThumbnailUrl(vehicle)}
              <img src={getThumbnailUrl(vehicle)} alt={vehicle.model_name} />
            {:else if isProcessingImages(vehicle)}
              <div class="vehicle-placeholder processing">
                <Loader2 class="icon spinning" />
                <span class="processing-text">Processing...</span>
              </div>
            {:else}
              <div class="vehicle-placeholder">
                <Bike class="icon" />
              </div>
            {/if}
            <!-- Status Badge -->
            <Badge variant={getStatusColor(vehicle.status)} size="xs" class="status-badge">
              {vehicle.status}
            </Badge>
                      </div>

          <!-- Content -->
          <div class="vehicle-content">
            <div class="vehicle-info">
              <p class="vehicle-oem">{vehicle.oem_name}</p>
              <h3 class="vehicle-name">{vehicle.model_name}</h3>
            </div>

            <div class="vehicle-meta">
              {#if vehicle.category}
                {@const categoryInfo = getCategoryInfo(vehicle.category)}
                <div class="category-badge" style="--category-color: {categoryInfo.color};">
                  <Tag class="category-icon" />
                  <span>{categoryInfo.name}</span>
                </div>
              {/if}
              <span class="vehicle-price">{formatPrice(vehicle.msrp, vehicle.currency)}</span>
            </div>
          </div>
          </Card>
        </div>
      {/each}
    </div>
  {:else}
    <!-- List View -->
    <div class="vehicles-list">
      {#each filteredVehicles as vehicle}
        <div class="vehicle-list-wrapper" onclick={() => openVehicleDrawer(vehicle)} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && openVehicleDrawer(vehicle)}>
          <Card class="vehicle-list-item">
            <div class="vehicle-list-content">
            <!-- Thumbnail -->
            <div class="vehicle-thumbnail">
              {#if getThumbnailUrl(vehicle)}
                <img src={getThumbnailUrl(vehicle)} alt={vehicle.model_name} />
              {:else if isProcessingImages(vehicle)}
                <div class="vehicle-placeholder processing">
                  <Loader2 class="icon spinning" />
                </div>
              {:else}
                <div class="vehicle-placeholder">
                  <Bike class="icon" />
                </div>
              {/if}
            </div>

            <!-- Info -->
            <div class="vehicle-details">
              <div class="vehicle-header">
                <h3 class="vehicle-name">{vehicle.model_name}</h3>
                {#if vehicle.model_year}
                  <Badge variant="secondary" size="xs">{vehicle.model_year}</Badge>
                {/if}
                {#if vehicle.category}
                  {@const categoryInfo = getCategoryInfo(vehicle.category)}
                  <div class="category-badge-sm" style="--category-color: {categoryInfo.color};">
                    <Tag class="category-icon-sm" />
                    <span>{categoryInfo.name}</span>
                  </div>
                {/if}
                <Badge variant={getStatusColor(vehicle.status)} size="xs">
                  {vehicle.status}
                </Badge>
              </div>
              <p class="vehicle-subtitle">{vehicle.oem_name}</p>
              <p class="vehicle-price">{formatPrice(vehicle.msrp, vehicle.currency)}</p>
            </div>
          </div>
            </Card>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Add Vehicle Modal -->
{#if showAddModal}
  <Dialog bind:open={showAddModal} size="lg" onClose={closeAddModal}>
    {#snippet header()}
      <div class="modal-header">
        <h3>Add Vehicle</h3>
        <Button variant="ghost" size="xs" onclick={closeAddModal}>
          <X class="icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="modal-content">
        <!-- Tabs -->
        <div class="modal-tabs">
          <button 
            onclick={() => activeTab = 'url'}
            class={`modal-tab ${activeTab === 'url' ? 'active' : ''}`}
          >
            From URL
          </button>
          <button 
            onclick={() => activeTab = 'manual'}
            class={`modal-tab ${activeTab === 'manual' ? 'active' : ''}`}
          >
            Manual
          </button>
          <button 
            onclick={() => activeTab = 'pdf'}
            class={`modal-tab ${activeTab === 'pdf' ? 'active' : ''}`}
          >
            PDF
          </button>
        </div>

        {#if activeTab === 'url'}
          <div class="modal-section">
            <p class="modal-text">
              Paste an OEM product page URL and we'll automatically extract the vehicle data.
            </p>
            
            <div class="modal-field">
              <label for="scrape-url" class="modal-label">Product URL</label>
              <div class="modal-input-group">
                <input 
                  id="scrape-url"
                  type="url" 
                  placeholder="https://www.ridekayo.com/ts-90" 
                  bind:value={scrapeUrl}
                  class="modal-input"
                />
                <Button 
                  variant="primary" 
                  size="sm" 
                  onclick={handleScrape}
                  disabled={!scrapeUrl || scrapeLoading}
                >
                  {#if scrapeLoading}
                    <Loader2 class="icon spinning" />
                  {:else}
                    <Search class="icon" />
                  {/if}
                  Scrape
                </Button>
              </div>
            </div>

            {#if scrapeError}
              <div class="modal-alert error">
                <AlertCircle class="alert-icon" />
                {scrapeError}
              </div>
            {/if}

            {#if scrapedData}
              <div class="modal-card">
                <div class="modal-card-header success">
                  <Check class="alert-icon" />
                  Data extracted successfully!
                </div>

                <div class="modal-card-content">
                  <div class="scrape-preview">
                    {#if scrapedData.thumbnailUrl}
                      <img src={scrapedData.thumbnailUrl} alt="Preview" class="preview-image" />
                    {/if}
                    <div class="preview-info">
                      <h4 class="preview-title">{scrapedData.modelName || 'Unknown Model'}</h4>
                      {#if scrapedData.msrp}
                        <p class="preview-price">{formatPrice(scrapedData.msrp)}</p>
                      {/if}
                      {#if scrapedData.category}
                        <Badge variant="neutral" size="xs" class="preview-badge">{getCategoryLabel(scrapedData.category)}</Badge>
                      {/if}
                    </div>
                  </div>

                  <div class="modal-field">
                    <label for="oem-select" class="modal-label">Select OEM</label>
                    <select id="oem-select" class="modal-input" bind:value={selectedOemForImport} required>
                      <option value="">-- Select OEM --</option>
                      {#each oemsData as oem}
                        <option value={oem.id}>{oem.name}</option>
                      {/each}
                    </select>
                    {#if oemsData.length === 0}
                      <p class="modal-help-text warning">
                        No OEMs found. Create an OEM first to import vehicles.
                      </p>
                    {/if}
                  </div>

                  {#if importError}
                    <div class="modal-alert error">{importError}</div>
                  {/if}

                  <div class="modal-actions">
                    <Button variant="ghost" type="button" onclick={() => { scrapedData = null; importError = null; }} class="flex-1">
                      Cancel
                    </Button>
                    <Button variant="primary" onclick={handleImportVehicle} disabled={importSubmitting || !selectedOemForImport} class="flex-1">
                      {#if importSubmitting}
                        <Loading size="sm" /> Importing...
                      {:else}
                        Import
                      {/if}
                    </Button>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {:else if activeTab === 'manual'}
          <div class="modal-empty">
            <AlertCircle class="empty-icon" />
            <p class="modal-text">Manual entry form is coming soon. Use URL scraping for now.</p>
          </div>
        {:else}
          <div class="modal-empty">
            <AlertCircle class="empty-icon" />
            <p class="modal-text">PDF parsing is coming soon. Use URL scraping for now.</p>
          </div>
        {/if}
      </div>
    {/snippet}
  </Dialog>
{/if}

<!-- Vehicle Details SlidePanel -->
<SlidePanel
  bind:open={showVehicleDrawer}
  title={selectedVehicle?.model_name || 'Vehicle Details'}
  subtitle={selectedVehicle?.oem_name || ''}
  size="md"
  closeOnBackdrop={!isEditingVehicle}
  onclose={closeVehicleDrawer}
>
  {#snippet children()}
    {#if selectedVehicle}
      <!-- Vehicle Image -->
      {#if getThumbnailUrl(selectedVehicle)}
        <div class="drawer-image">
          <img src={getThumbnailUrl(selectedVehicle)} alt={selectedVehicle.model_name} />
        </div>
      {:else if isProcessingImages(selectedVehicle)}
        <div class="drawer-image processing">
          <div class="processing-indicator">
            <Loader2 class="icon spinning" />
            <span>Uploading images...</span>
          </div>
        </div>
      {/if}

      <!-- Vehicle Info -->
      <div class="drawer-info">
        {#if isEditingVehicle}
          <!-- Edit Mode -->
          <div class="edit-form">
            <div class="form-group">
              <label class="form-label" for="category">Category</label>
              <select id="category" bind:value={editableVehicle.category} class="form-input">
                <option value="">Select category...</option>
                {#each categoriesData as category}
                  <option value={category.slug}>
                    {category.name}
                  </option>
                {/each}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="status">Status</label>
              <select id="status" bind:value={editableVehicle.status} class="form-input">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="model-year">Model Year</label>
              <input 
                id="model-year"
                type="number" 
                bind:value={editableVehicle.model_year} 
                class="form-input"
                placeholder="2024"
              />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="price">Price</label>
                <input 
                  id="price"
                  type="number" 
                  bind:value={editableVehicle.msrp} 
                  class="form-input"
                  placeholder="0"
                />
              </div>
              <div class="form-group">
                <label class="form-label" for="currency">Currency</label>
                <select id="currency" bind:value={editableVehicle.currency} class="form-input">
                  <option value="USD">USD</option>
                  <option value="CAD">CAD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="description">Description</label>
              <textarea 
                id="description"
                bind:value={editableVehicle.description} 
                class="form-textarea"
                rows="3"
                placeholder="Vehicle description..."
              ></textarea>
            </div>
          </div>
        {:else}
          <!-- View Mode -->
          <div class="drawer-badges">
            <Badge variant="neutral">{getCategoryLabel(selectedVehicle.category)}</Badge>
            <Badge variant={getStatusColor(selectedVehicle.status)}>{selectedVehicle.status}</Badge>
            {#if selectedVehicle.model_year}
              <Badge variant="secondary">{selectedVehicle.model_year}</Badge>
            {/if}
          </div>

          <div class="detail-field">
            <p class="detail-label">Price</p>
            <p class="detail-price">{formatPrice(selectedVehicle.msrp, selectedVehicle.currency)}</p>
          </div>

          {#if selectedVehicle.description}
            <div class="detail-field">
              <p class="detail-label">Description</p>
              <p class="detail-description">{selectedVehicle.description}</p>
            </div>
          {/if}

          {#if Object.keys(parseSpecs(selectedVehicle.specifications)).length > 0}
            <div class="specifications">
              <p class="detail-label">Specifications</p>
              <div class="specs-grid">
                {#each Object.entries(parseSpecs(selectedVehicle.specifications)) as [key, value]}
                  <div class="spec-item">
                    <p class="spec-key">{key}</p>
                    <p class="spec-value">{value}</p>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        {/if}
      </div>
    {/if}
  {/snippet}

  {#snippet footer()}
    {#if isEditingVehicle}
      <!-- Edit Mode Actions -->
      <Button variant="ghost" onclick={cancelEditingVehicle}>
        Cancel
      </Button>
      <Button variant="primary" onclick={saveVehicleChanges} disabled={isSavingVehicle}>
        {#if isSavingVehicle}
          <Loader2 class="icon spinning" />
          Saving...
        {:else}
          <Check class="icon" />
          Save Changes
        {/if}
      </Button>
    {:else}
      <!-- View Mode Actions -->
      <Button variant="error" onclick={() => openDeleteModal(selectedVehicle)}>
        <Trash2 class="icon" />
        Delete
      </Button>
      <Button variant="primary" onclick={startEditingVehicle}>
        <Pencil class="icon" />
        Edit
      </Button>
    {/if}
  {/snippet}
</SlidePanel>

<!-- Delete Confirmation Modal -->
{#if showDeleteModal && selectedVehicle}
  <Dialog bind:open={showDeleteModal} size="sm" onClose={closeDeleteModal}>
    {#snippet header()}
      <h3 class="font-bold">Delete Vehicle</h3>
    {/snippet}
    {#snippet children()}
      <div class="space-y-4">
        <p>Are you sure you want to delete <strong>{selectedVehicle.model_name}</strong>? This action cannot be undone.</p>
        <div class="flex gap-2">
          <Button variant="ghost" onclick={closeDeleteModal} class="flex-1">Cancel</Button>
          <Button variant="error" onclick={handleDeleteVehicle} disabled={deleteSubmitting} class="flex-1">
            {#if deleteSubmitting}
              <Loading size="sm" /> Deleting...
            {:else}
              Delete
            {/if}
          </Button>
        </div>
      </div>
    {/snippet}
  </Dialog>
{/if}
</div>

<style>
  .vehicles-page {
    display: flex;
    gap: var(--kui-spacing-lg);
    height: 100%;
  }

  /* Sidebar */
  .sidebar {
    width: 256px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
  }

  .search-section {
    margin-bottom: var(--kui-spacing-lg);
  }

  .search-container {
    position: relative;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 0.875rem;
    width: 1rem;
    height: 1rem;
    color: var(--kui-color-muted);
    pointer-events: none;
    z-index: 1;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 2.5rem 0.75rem 2.5rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-lg);
    background: var(--kui-color-surface);
    color: var(--kui-color-text);
    font-size: 0.875rem;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--kui-color-primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--kui-color-primary) 10%, transparent);
  }

  .search-input::placeholder {
    color: var(--kui-color-muted);
  }

  .search-clear {
    position: absolute;
    right: 0.75rem;
    width: 1.5rem;
    height: 1.5rem;
    border: none;
    background: transparent;
    color: var(--kui-color-muted);
    border-radius: var(--kui-radius-sm);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    z-index: 1;
  }

  .search-clear:hover {
    background: var(--kui-color-surface-muted);
    color: var(--kui-color-text);
  }

  .search-clear-icon {
    width: 0.75rem;
    height: 0.75rem;
  }

  .categories {
    flex: 1;
  }

  .categories-title {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--kui-color-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: var(--kui-spacing-sm);
  }

  .category-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-sm);
    background: transparent;
    color: var(--kui-color-text);
    font-size: 0.8125rem;
    font-weight: 400;
    cursor: pointer;
    transition: all 0.2s ease;
    --category-color: var(--kui-color-primary);
  }

  .category-btn:hover {
    background: color-mix(in srgb, var(--category-color) 8%, transparent);
    border-color: var(--category-color);
  }

  .category-btn.active {
    background: color-mix(in srgb, var(--category-color) 15%, transparent);
    color: var(--category-color);
    border-color: var(--category-color);
    font-weight: 500;
  }

  .category-btn .count {
    font-size: 0.7rem;
    color: var(--kui-color-muted);
    margin-left: 0.25rem;
  }

  .category-btn.active .count {
    color: var(--category-color);
  }

  .add-section {
    margin-top: var(--kui-spacing-lg);
    padding-top: var(--kui-spacing-lg);
    border-top: 1px solid var(--kui-color-border);
  }

  .add-btn {
    width: 100%;
  }

  /* Main Content */
  .main-content {
    flex: 1;
    min-width: 0;
  }

  .content-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--kui-spacing-lg);
  }

  .header-info h2 {
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0;
  }

  .subtext {
    color: var(--kui-color-muted);
    font-size: 0.875rem;
    margin: 0.25rem 0 0;
  }

  .view-toggle {
    display: flex;
    gap: 0.25rem;
    border-radius: var(--kui-radius-md);
    border: 1px solid var(--kui-color-border);
    padding: 0.25rem;
  }

  .view-btn {
    padding: 0.5rem;
    border-radius: var(--kui-radius-sm);
    border: none;
    background: transparent;
    color: var(--kui-color-text);
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .view-btn:hover {
    background: var(--kui-color-surface-muted);
  }

  .view-btn.active {
    background: var(--kui-color-primary);
    color: white;
  }

  .icon {
    width: 1rem;
    height: 1rem;
  }

  /* Empty State */
  .empty-state {
    display: grid;
    place-items: center;
    gap: var(--kui-spacing-md);
    text-align: center;
    padding: var(--kui-spacing-xl);
  }

  .empty-icon {
    width: 3rem;
    height: 3rem;
    color: var(--kui-color-muted);
  }

  /* Grid View */
  .vehicles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--kui-spacing-md);
  }

  .vehicle-card-wrapper {
    cursor: pointer;
    transition: all 0.2s ease;
    height: 100%;
  }

  .vehicle-card-wrapper:hover {
    transform: translateY(-2px);
  }

  :global(.vehicle-card) {
    overflow: hidden;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  :global(.vehicle-card:hover) {
    box-shadow: var(--kui-shadow-md);
  }

  .vehicle-image {
    position: relative;
    height: 160px;
    background: var(--kui-color-surface-muted);
    overflow: hidden;
    flex-shrink: 0;
  }

  .vehicle-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.2s ease;
  }

  .vehicle-card-wrapper:hover .vehicle-image img {
    transform: scale(1.05);
  }

  .vehicle-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--kui-color-muted);
    gap: 0.5rem;
  }

  .vehicle-placeholder.processing {
    background: linear-gradient(135deg, var(--kui-color-surface) 0%, var(--kui-color-muted-bg) 100%);
  }

  .vehicle-placeholder .processing-text {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .status-badge {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
  }

  .vehicle-content {
    padding: var(--kui-spacing-md);
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .vehicle-info {
    margin-bottom: var(--kui-spacing-sm);
    flex: 1;
  }

  .vehicle-oem {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--kui-color-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
  }

  .vehicle-name {
    font-size: 0.875rem;
    font-weight: 700;
    margin: 0.25rem 0 0;
    line-height: 1.25;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-clamp: 2;
    overflow: hidden;
  }

  .vehicle-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--kui-spacing-sm);
    margin-top: auto;
    padding-top: var(--kui-spacing-sm);
    border-top: 1px solid var(--kui-color-border);
  }

  .vehicle-price {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--kui-color-primary);
  }

  /* Category Badges */
  .category-badge {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: color-mix(in srgb, var(--category-color) 10%, transparent);
    color: var(--category-color);
    border: 1px solid color-mix(in srgb, var(--category-color) 30%, transparent);
    border-radius: var(--kui-radius-sm);
    font-size: 0.75rem;
    font-weight: 500;
    --category-color: var(--kui-color-primary);
  }

  .category-icon {
    width: 0.75rem;
    height: 0.75rem;
  }

  .category-badge-sm {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.375rem;
    background: color-mix(in srgb, var(--category-color) 10%, transparent);
    color: var(--category-color);
    border: 1px solid color-mix(in srgb, var(--category-color) 30%, transparent);
    border-radius: var(--kui-radius-sm);
    font-size: 0.625rem;
    font-weight: 500;
    --category-color: var(--kui-color-primary);
  }

  .category-icon-sm {
    width: 0.625rem;
    height: 0.625rem;
  }

  /* List View */
  .vehicles-list {
    display: flex;
    flex-direction: column;
    gap: var(--kui-spacing-sm);
  }

  .vehicle-list-wrapper {
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .vehicle-list-wrapper:hover {
    transform: translateY(-1px);
  }

  :global(.vehicle-list-item) {
    transition: all 0.2s ease;
  }

  :global(.vehicle-list-item:hover) {
    box-shadow: var(--kui-shadow-md);
  }

  .vehicle-list-content {
    display: flex;
    align-items: center;
    gap: var(--kui-spacing-md);
    padding: var(--kui-spacing-md);
  }

  .vehicle-thumbnail {
    width: 64px;
    height: 64px;
    flex-shrink: 0;
    border-radius: var(--kui-radius-md);
    background: var(--kui-color-surface-muted);
    overflow: hidden;
  }

  .vehicle-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .vehicle-details {
    flex: 1;
    min-width: 0;
  }

  .vehicle-header {
    display: flex;
    align-items: center;
    gap: var(--kui-spacing-sm);
    margin-bottom: 0.25rem;
  }

  .vehicle-header .vehicle-name {
    font-size: 1rem;
    font-weight: 700;
    margin: 0;
  }

  .vehicle-subtitle {
    font-size: 0.875rem;
    color: var(--kui-color-muted);
    margin: 0 0 0.25rem;
  }

  .vehicle-details .vehicle-price {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--kui-color-primary);
    margin: 0;
  }

  .vehicle-actions {
    display: flex;
    gap: var(--kui-spacing-sm);
    flex-shrink: 0;
  }

  /* Vehicle Details SlidePanel Content */
  .drawer-image {
    aspect-ratio: 16/9;
    border-radius: var(--kui-radius-md);
    overflow: hidden;
    background: var(--kui-color-surface-muted);
    margin-bottom: var(--kui-spacing-lg);
  }

  .drawer-image.processing {
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--kui-color-surface) 0%, var(--kui-color-muted-bg) 100%);
  }

  .drawer-image .processing-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    color: var(--kui-color-muted);
  }

  .drawer-image .processing-indicator span {
    font-size: 0.875rem;
  }

  .drawer-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .drawer-info {
    display: flex;
    flex-direction: column;
    gap: var(--kui-spacing-lg);
  }

  .drawer-badges {
    display: flex;
    align-items: center;
    gap: var(--kui-spacing-sm);
    flex-wrap: wrap;
  }

  .detail-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .detail-label {
    font-size: 0.875rem;
    color: var(--kui-color-muted);
    margin: 0;
  }

  .detail-price {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--kui-color-primary);
    margin: 0;
  }

  .detail-description {
    font-size: 0.875rem;
    line-height: 1.5;
    margin: 0;
  }

  .specifications {
    display: flex;
    flex-direction: column;
    gap: var(--kui-spacing-md);
  }

  .specs-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--kui-spacing-sm);
  }

  @media (max-width: 480px) {
    .specs-grid {
      grid-template-columns: 1fr;
    }
  }

  .spec-item {
    background: var(--kui-color-surface-muted);
    border-radius: var(--kui-radius-md);
    padding: var(--kui-spacing-sm);
  }

  .spec-key {
    font-size: 0.75rem;
    color: var(--kui-color-muted);
    margin: 0;
  }

  .spec-value {
    font-size: 0.875rem;
    font-weight: 600;
    margin: 0.25rem 0 0;
  }

  /* Edit Form Styles */
  .edit-form {
    display: flex;
    flex-direction: column;
    gap: var(--kui-spacing-md);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-row {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: var(--kui-spacing-md);
  }

  @media (max-width: 480px) {
    .form-row {
      grid-template-columns: 1fr;
    }
  }

  .form-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--kui-color-text);
    margin: 0;
  }

  .form-input,
  .form-textarea {
    padding: 0.75rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    background: var(--kui-color-surface);
    color: var(--kui-color-text);
    font-size: 0.875rem;
    transition: border-color 0.2s ease;
  }

  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    border-color: var(--kui-color-primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--kui-color-primary) 10%, transparent);
  }

  .form-textarea {
    resize: vertical;
    min-height: 80px;
    font-family: inherit;
  }

  /* Animations */
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .spinning {
    animation: spin 1s linear infinite;
  }

  /* Modal Styles */
  .modal-content {
    display: flex;
    flex-direction: column;
    gap: var(--kui-spacing-md);
  }

  .modal-tabs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.25rem;
    background: var(--kui-color-surface-muted);
    padding: 0.25rem;
    border-radius: var(--kui-radius-md);
  }

  .modal-tab {
    padding: 0.75rem;
    border: none;
    background: transparent;
    color: var(--kui-color-text);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border-radius: var(--kui-radius-sm);
    transition: all 0.2s ease;
  }

  .modal-tab:hover {
    background: var(--kui-color-surface);
  }

  .modal-tab.active {
    background: var(--kui-color-surface);
    color: var(--kui-color-primary);
    box-shadow: var(--kui-shadow-sm);
  }

  .modal-section {
    display: flex;
    flex-direction: column;
    gap: var(--kui-spacing-md);
  }

  .modal-text {
    font-size: 0.875rem;
    color: var(--kui-color-muted);
    margin: 0;
  }

  .modal-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .modal-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--kui-color-text);
    margin: 0;
  }

  .modal-input-group {
    display: flex;
    gap: var(--kui-spacing-sm);
    align-items: center;
  }

  .modal-input {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    background: var(--kui-color-surface);
    color: var(--kui-color-text);
    font-size: 0.875rem;
    transition: border-color 0.2s ease;
  }

  .modal-input:focus {
    outline: none;
    border-color: var(--kui-color-primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--kui-color-primary) 10%, transparent);
  }

  .modal-input::placeholder {
    color: var(--kui-color-muted);
  }

  .modal-alert {
    display: flex;
    align-items: center;
    gap: var(--kui-spacing-sm);
    padding: var(--kui-spacing-md);
    border-radius: var(--kui-radius-md);
    font-size: 0.875rem;
  }

  .modal-alert.error {
    background: color-mix(in srgb, #ef4444 10%, transparent);
    color: #dc2626;
    border: 1px solid color-mix(in srgb, #ef4444 30%, transparent);
  }

  .alert-icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }

  .modal-card {
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    overflow: hidden;
  }

  .modal-card-header {
    display: flex;
    align-items: center;
    gap: var(--kui-spacing-sm);
    padding: var(--kui-spacing-md);
    font-size: 0.875rem;
    font-weight: 600;
    background: color-mix(in srgb, #10b981 10%, transparent);
    color: #059669;
    border-bottom: 1px solid color-mix(in srgb, #10b981 30%, transparent);
  }

  .modal-card-header.success {
    background: color-mix(in srgb, #10b981 10%, transparent);
    color: #059669;
    border-bottom: 1px solid color-mix(in srgb, #10b981 30%, transparent);
  }

  .modal-card-content {
    display: flex;
    flex-direction: column;
    gap: var(--kui-spacing-md);
    padding: var(--kui-spacing-md);
  }

  .scrape-preview {
    display: flex;
    gap: var(--kui-spacing-md);
    padding: var(--kui-spacing-md);
    background: var(--kui-color-surface-muted);
    border-radius: var(--kui-radius-md);
  }

  .preview-image {
    width: 96px;
    height: 96px;
    flex-shrink: 0;
    border-radius: var(--kui-radius-md);
    object-fit: cover;
  }

  .preview-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .preview-title {
    font-size: 0.875rem;
    font-weight: 700;
    margin: 0;
  }

  .preview-price {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--kui-color-primary);
    margin: 0;
  }

  .preview-badge {
    align-self: flex-start;
  }

  .modal-help-text {
    font-size: 0.75rem;
    margin: 0;
  }

  .modal-help-text.warning {
    color: #d97706;
  }

  .modal-actions {
    display: flex;
    gap: var(--kui-spacing-sm);
    padding-top: var(--kui-spacing-md);
    border-top: 1px solid var(--kui-color-border);
  }

  .modal-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--kui-spacing-md);
    padding: var(--kui-spacing-xl);
    text-align: center;
  }

  .empty-icon {
    width: 2rem;
    height: 2rem;
    color: var(--kui-color-muted);
  }

  .flex-1 {
    flex: 1;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--kui-spacing-md);
  }

  .modal-header h3 {
    font-size: 1.125rem;
    font-weight: 700;
    margin: 0;
  }

  /* Responsive */
  @media (max-width: 1024px) {
    .vehicles-grid {
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    }
  }

  @media (max-width: 768px) {
    .vehicles-page {
      flex-direction: column;
    }

    .sidebar {
      width: 100%;
    }

    .vehicles-grid {
      grid-template-columns: 1fr;
    }

    .specs-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
