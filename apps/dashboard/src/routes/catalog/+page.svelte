<script lang="ts">
  import { Button, Card, Dialog, FormField, FormInput, FormSelect, FormTextarea, Badge, Tabs, Loading } from '@kuratchi/ui';
  import { 
    Bike, Plus, Link, FileText, Pencil, Trash2, X, Search, 
    Building2, Upload, Loader2, ExternalLink, Check, AlertCircle, ChevronLeft
  } from '@lucide/svelte';
  import { 
    getVehicles, getOems, createVehicle, createOem, deleteVehicle, 
    scrapeVehicleUrl, importScrapedVehicle 
  } from '$lib/functions/catalog.remote';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';

  // Data
  const vehicles = getVehicles();
  const oems = getOems();
  const vehiclesData = $derived(vehicles.current || []);
  const oemsData = $derived(oems.current || []);

  // Get OEM filter from URL
  const selectedOemId = $derived(page.url.searchParams.get('oem'));
  const selectedOem = $derived(selectedOemId ? oemsData.find((o: any) => o.id === selectedOemId) : null);

  // State
  let showAddModal = $state(false);
  let showOemModal = $state(false);
  let showScrapeModal = $state(false);
  let showDeleteModal = $state(false);
  let activeTab = $state<'url' | 'manual' | 'pdf'>('url');
  let selectedVehicle = $state<any>(null);
  let searchQuery = $state('');
  let categoryFilter = $state<string>('all');

  // Scraping state
  let scrapeUrl = $state('');
  let scrapeLoading = $state(false);
  let scrapeError = $state<string | null>(null);
  let scrapedData = $state<any>(null);
  let selectedOemForImport = $state('');

  // Form state for OEM
  let newOemName = $state('');
  let newOemWebsite = $state('');
  let newOemLogo = $state('');
  let oemSubmitting = $state(false);
  let oemError = $state<string | null>(null);

  // Form state for import
  let importSubmitting = $state(false);
  let importError = $state<string | null>(null);

  // Form state for delete
  let deleteSubmitting = $state(false);

  // Filtered vehicles
  const filteredVehicles = $derived(() => {
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

  function openOemModal() {
    showOemModal = true;
    newOemName = '';
    newOemWebsite = '';
    newOemLogo = '';
    oemError = null;
  }

  function closeOemModal() {
    showOemModal = false;
    newOemName = '';
    newOemWebsite = '';
    newOemLogo = '';
    oemError = null;
  }

  // Add OEM handler
  async function handleAddOem() {
    if (!newOemName.trim()) {
      oemError = 'Name is required';
      return;
    }

    oemSubmitting = true;
    oemError = null;

    try {
      await createOem({
        name: newOemName.trim(),
        websiteUrl: newOemWebsite.trim() || undefined,
        logoUrl: newOemLogo.trim() || undefined
      });
      
      await oems.refresh();
      closeOemModal();
    } catch (err: any) {
      console.error('[handleAddOem] error:', err);
      oemError = err.message || 'Failed to add OEM';
    } finally {
      oemSubmitting = false;
    }
  }

  // Import scraped vehicle handler
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

  // Delete vehicle handler
  async function handleDeleteVehicle() {
    if (!selectedVehicle) return;

    deleteSubmitting = true;

    try {
      await deleteVehicle({ id: selectedVehicle.id });
      await vehicles.refresh();
      closeDeleteModal();
    } catch (err: any) {
      console.error('[handleDeleteVehicle] error:', err);
    } finally {
      deleteSubmitting = false;
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

  function formatPrice(amount: number | null, currency: string = 'USD') {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  function getCategoryLabel(category: string) {
    const labels: Record<string, string> = {
      atv: 'ATV',
      utv: 'UTV / Side-by-Side',
      dirtbike: 'Dirt Bike',
      pitbike: 'Pit Bike',
      motorcycle: 'Motorcycle',
      electric: 'Electric',
      other: 'Other'
    };
    return labels[category] || category;
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

  function parseFeatures(features: string | string[]) {
    if (typeof features === 'string') {
      try {
        return JSON.parse(features);
      } catch {
        return [];
      }
    }
    return features || [];
  }

  function parseImages(images: string | string[]) {
    if (typeof images === 'string') {
      try {
        return JSON.parse(images);
      } catch {
        return [];
      }
    }
    return images || [];
  }
</script>

<svelte:head>
  <title>OEM Catalog - Kuratchi Dashboard</title>
</svelte:head>

<div class="kui-catalog">
  <header class="kui-catalog__header">
    <div class="kui-inline">
      {#if selectedOem}
        <Button variant="ghost" size="sm" onclick={() => goto('/catalog')} class="back-btn">
          <ChevronLeft class="kui-icon" />
        </Button>
      {/if}
      <div class="kui-icon-box">
        <Bike />
      </div>
      <div>
        <p class="kui-eyebrow">Data Management</p>
        {#if selectedOem}
          <h1>{selectedOem.name} - Vehicles</h1>
          <p class="kui-subtext">{filteredVehicles().length} vehicle{filteredVehicles().length !== 1 ? 's' : ''}</p>
        {:else}
          <h1>OEM Catalog</h1>
          <p class="kui-subtext">Manage powersport vehicle data from OEMs</p>
        {/if}
      </div>
    </div>
    <div class="kui-inline gap">
      <Button variant="ghost" size="sm" href="/catalog/oems">
        <Building2 class="kui-icon" />
        Manage OEMs
      </Button>
      <Button variant="primary" size="sm" onclick={openAddModal}>
        <Plus class="kui-icon" />
        Add Vehicle
      </Button>
    </div>
  </header>

  <!-- Filters -->
  <div class="kui-filters">
    <div class="kui-search">
      <Search class="kui-search__icon" />
      <input 
        type="text" 
        placeholder="Search vehicles..." 
        bind:value={searchQuery}
        class="kui-search__input"
      />
    </div>
    <select bind:value={categoryFilter} class="kui-select">
      <option value="all">All Categories</option>
      <option value="atv">ATV</option>
      <option value="utv">UTV / Side-by-Side</option>
      <option value="dirtbike">Dirt Bike</option>
      <option value="pitbike">Pit Bike</option>
      <option value="motorcycle">Motorcycle</option>
      <option value="electric">Electric</option>
      <option value="other">Other</option>
    </select>
  </div>

  <!-- Stats -->
  <div class="kui-stats">
    <Card class="kui-stat">
      <p class="kui-stat__value">{vehiclesData.length}</p>
      <p class="kui-stat__label">Total Vehicles</p>
    </Card>
    <Card class="kui-stat">
      <p class="kui-stat__value">{oemsData.length}</p>
      <p class="kui-stat__label">OEMs</p>
    </Card>
    <Card class="kui-stat">
      <p class="kui-stat__value">{vehiclesData.filter((v: any) => v.status === 'published').length}</p>
      <p class="kui-stat__label">Published</p>
    </Card>
  </div>

  <!-- Vehicle Grid -->
  {#if filteredVehicles().length === 0}
    <Card class="kui-empty-card">
      <div class="kui-empty">
        <div class="kui-icon-hero">
          <Bike />
        </div>
        <h3>No vehicles yet</h3>
        <p class="kui-subtext">Add your first vehicle by scraping an OEM URL or entering data manually.</p>
        <Button variant="primary" size="sm" onclick={openAddModal}>
          <Plus class="kui-icon" />
          Add Vehicle
        </Button>
      </div>
    </Card>
  {:else}
    <div class="kui-vehicle-grid">
      {#each filteredVehicles() as vehicle}
        <Card class="kui-vehicle">
          <div class="kui-vehicle__image">
            {#if vehicle.thumbnail_url}
              <img src={vehicle.thumbnail_url} alt={vehicle.model_name} />
            {:else}
              <div class="kui-vehicle__placeholder">
                <Bike />
              </div>
            {/if}
            <Badge variant={getStatusColor(vehicle.status)} size="xs" class="kui-vehicle__badge">
              {vehicle.status}
            </Badge>
          </div>
          
          <div class="kui-vehicle__content">
            <div class="kui-vehicle__header">
              <div>
                <p class="kui-eyebrow">{vehicle.oem_name}</p>
                <h3>{vehicle.model_name}</h3>
                {#if vehicle.model_year}
                  <Badge variant="secondary" size="xs">{vehicle.model_year}</Badge>
                {/if}
              </div>
              <div class="kui-inline gap-sm">
                <Button variant="ghost" size="xs" href={`/catalog/${vehicle.id}`}>
                  <Pencil class="kui-icon" />
                </Button>
                <Button variant="ghost" size="xs" onclick={() => openDeleteModal(vehicle)}>
                  <Trash2 class="kui-icon" />
                </Button>
              </div>
            </div>

            <div class="kui-vehicle__meta">
              <Badge variant="neutral" size="xs">{getCategoryLabel(vehicle.category)}</Badge>
              <span class="kui-vehicle__price">{formatPrice(vehicle.msrp, vehicle.currency)}</span>
            </div>

            {#if Object.keys(parseSpecs(vehicle.specifications)).length > 0}
              <div class="kui-vehicle__specs">
                {#each Object.entries(parseSpecs(vehicle.specifications)).slice(0, 4) as [key, value]}
                  <div class="kui-spec">
                    <span class="kui-spec__label">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span class="kui-spec__value">{value}</span>
                  </div>
                {/each}
              </div>
            {/if}

            {#if vehicle.source_url}
              <a href={vehicle.source_url} target="_blank" rel="noopener" class="kui-source-link">
                <ExternalLink class="kui-icon" />
                View Source
              </a>
            {/if}
          </div>
        </Card>
      {/each}
    </div>
  {/if}
</div>

<!-- Add Vehicle Modal -->
{#if showAddModal}
  <Dialog bind:open={showAddModal} size="lg" onClose={closeAddModal}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3>Add Vehicle</h3>
        <Button variant="ghost" size="xs" onclick={closeAddModal}>
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="kui-add-tabs">
        <button 
          class={`kui-tab ${activeTab === 'url' ? 'is-active' : ''}`} 
          onclick={() => activeTab = 'url'}
        >
          <Link class="kui-icon" />
          From URL
        </button>
        <button 
          class={`kui-tab ${activeTab === 'manual' ? 'is-active' : ''}`} 
          onclick={() => activeTab = 'manual'}
        >
          <Pencil class="kui-icon" />
          Manual Entry
        </button>
        <button 
          class={`kui-tab ${activeTab === 'pdf' ? 'is-active' : ''}`} 
          onclick={() => activeTab = 'pdf'}
        >
          <FileText class="kui-icon" />
          From PDF
        </button>
      </div>

      {#if activeTab === 'url'}
        <div class="kui-scrape-section">
          <p class="kui-help-text">
            Paste an OEM product page URL and we'll automatically extract the vehicle data using advanced web scraping.
          </p>
          
          <div class="kui-url-input">
            <FormField label="Product URL">
              <div class="kui-input-group">
                <input 
                  type="url" 
                  placeholder="https://www.ridekayo.com/ts-90" 
                  bind:value={scrapeUrl}
                  class="kui-input"
                />
                <Button 
                  variant="primary" 
                  size="sm" 
                  onclick={handleScrape}
                  disabled={!scrapeUrl || scrapeLoading}
                >
                  {#if scrapeLoading}
                    <Loader2 class="kui-icon kui-spin" />
                    Scraping...
                  {:else}
                    <Search class="kui-icon" />
                    Scrape
                  {/if}
                </Button>
              </div>
            </FormField>
          </div>

          {#if scrapeError}
            <div class="kui-error">
              <AlertCircle class="kui-icon" />
              {scrapeError}
            </div>
          {/if}

          {#if scrapedData}
            <div class="kui-scraped-preview">
              <div class="kui-scraped-header">
                <Check class="kui-icon kui-success" />
                <span>Data extracted successfully!</span>
              </div>

              <div class="kui-scraped-content">
                {#if scrapedData.thumbnailUrl}
                  <img src={scrapedData.thumbnailUrl} alt="Preview" class="kui-scraped-image" />
                {/if}

                <div class="kui-scraped-details">
                  <h4>{scrapedData.modelName || 'Unknown Model'}</h4>
                  {#if scrapedData.msrp}
                    <p class="kui-price">{formatPrice(scrapedData.msrp)}</p>
                  {/if}
                  {#if scrapedData.category}
                    <Badge variant="neutral" size="xs">{getCategoryLabel(scrapedData.category)}</Badge>
                  {/if}

                  {#if Object.keys(scrapedData.specifications || {}).length > 0}
                    <div class="kui-scraped-specs">
                      <p class="kui-eyebrow">Specifications Found</p>
                      {#each Object.entries(scrapedData.specifications).slice(0, 6) as [key, value]}
                        <div class="kui-spec-row">
                          <span>{key}</span>
                          <span>{value}</span>
                        </div>
                      {/each}
                    </div>
                  {/if}

                  {#if (scrapedData.features || []).length > 0}
                    <div class="kui-scraped-features">
                      <p class="kui-eyebrow">Features Found: {scrapedData.features.length}</p>
                    </div>
                  {/if}
                </div>
              </div>

              <div class="kui-import-form">
                <FormField label="Select OEM">
                  <select class="kui-native-select" bind:value={selectedOemForImport} required>
                    <option value="">-- Select OEM --</option>
                    {#each oemsData as oem}
                      <option value={oem.id}>{oem.name}</option>
                    {/each}
                  </select>
                  {#if oemsData.length === 0}
                    <p class="kui-help-text kui-warning">
                      No OEMs found. <button type="button" class="kui-link" onclick={openOemModal}>Add an OEM first</button>
                    </p>
                  {/if}
                </FormField>

                {#if importError}
                  <div class="kui-callout error">{importError}</div>
                {/if}

                <div class="kui-import-actions">
                  <Button variant="ghost" type="button" onclick={() => { scrapedData = null; importError = null; }}>
                    Cancel
                  </Button>
                  <Button variant="primary" onclick={handleImportVehicle} disabled={importSubmitting || !selectedOemForImport}>
                    {#if importSubmitting}
                      <Loading size="sm" /> Importing...
                    {:else}
                      Import Vehicle
                    {/if}
                  </Button>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {:else if activeTab === 'manual'}
        <div class="kui-coming-soon-section">
          <div class="kui-coming-soon">
            <AlertCircle class="kui-icon" />
            Manual entry form is coming soon. Use URL scraping for now.
          </div>
        </div>
      {:else}
        <div class="kui-pdf-section">
          <div class="kui-upload-zone">
            <Upload class="kui-upload-icon" />
            <h4>Upload OEM Specification PDF</h4>
            <p class="kui-subtext">
              Drag and drop a PDF or click to browse. We'll extract vehicle specifications automatically.
            </p>
            <input type="file" accept=".pdf" class="kui-file-input" />
            <Button variant="ghost" size="sm">
              <FileText class="kui-icon" />
              Select PDF
            </Button>
          </div>
          <p class="kui-coming-soon">
            <AlertCircle class="kui-icon" />
            PDF parsing is coming soon. Use URL scraping for now.
          </p>
        </div>
      {/if}
    {/snippet}
  </Dialog>
{/if}

<!-- OEM Management Modal -->
{#if showOemModal}
  <Dialog bind:open={showOemModal} size="md" onClose={closeOemModal}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3>Manage OEMs</h3>
        <Button variant="ghost" size="xs" onclick={closeOemModal}>
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="kui-oem-section">
        <div class="kui-oem-list">
          {#if oemsData.length === 0}
            <p class="kui-subtext">No OEMs added yet.</p>
          {:else}
            {#each oemsData as oem}
              <div class="kui-oem-item">
                {#if oem.logo_url}
                  <img src={oem.logo_url} alt={oem.name} class="kui-oem-logo" />
                {:else}
                  <div class="kui-oem-placeholder">
                    <Building2 />
                  </div>
                {/if}
                <div class="kui-oem-info">
                  <h4>{oem.name}</h4>
                  {#if oem.website_url}
                    <a href={oem.website_url} target="_blank" rel="noopener" class="kui-subtext">
                      {oem.website_url}
                    </a>
                  {/if}
                </div>
              </div>
            {/each}
          {/if}
        </div>

        <div class="kui-divider"></div>

        <div class="kui-oem-form">
          <h4>Add New OEM</h4>
          <FormField label="Name">
            <input type="text" class="kui-input" bind:value={newOemName} placeholder="Kayo USA" required />
          </FormField>
          <FormField label="Website URL">
            <input type="url" class="kui-input" bind:value={newOemWebsite} placeholder="https://www.ridekayo.com" />
          </FormField>
          <FormField label="Logo URL">
            <input type="url" class="kui-input" bind:value={newOemLogo} placeholder="https://..." />
          </FormField>
          
          {#if oemError}
            <div class="kui-callout error">{oemError}</div>
          {/if}
          
          <Button variant="primary" size="sm" onclick={handleAddOem} disabled={oemSubmitting}>
            {#if oemSubmitting}
              <Loading size="sm" /> Adding...
            {:else}
              <Plus class="kui-icon" />
              Add OEM
            {/if}
          </Button>
        </div>
      </div>
    {/snippet}
  </Dialog>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteModal && selectedVehicle}
  <Dialog bind:open={showDeleteModal} size="sm" onClose={closeDeleteModal}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3>Delete Vehicle</h3>
        <Button variant="ghost" size="xs" onclick={closeDeleteModal}>
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="kui-stack">
        <p>Are you sure you want to delete <strong>{selectedVehicle.model_name}</strong>? This action cannot be undone.</p>
        <div class="kui-modal-actions">
          <Button variant="ghost" onclick={closeDeleteModal}>Cancel</Button>
          <Button variant="error" onclick={handleDeleteVehicle} disabled={deleteSubmitting}>
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

<style>
  .kui-catalog {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .kui-catalog__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
  }

  .kui-inline {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .kui-inline.gap {
    gap: 8px;
  }

  .kui-inline.gap-sm {
    gap: 4px;
  }

  .kui-icon-box {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #fde68a, #fbbf24);
    color: #78350f;
  }

  h1 {
    margin: 0;
    font-size: 28px;
  }

  h3 {
    margin: 0;
    font-size: 18px;
  }

  h4 {
    margin: 0;
    font-size: 16px;
  }

  .kui-eyebrow {
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #6b7280;
    margin: 0 0 4px;
  }

  .kui-subtext {
    color: #6b7280;
    margin: 0;
    font-size: 14px;
  }

  .kui-icon {
    width: 16px;
    height: 16px;
  }

  /* Filters */
  .kui-filters {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .kui-search {
    position: relative;
    flex: 1;
    min-width: 200px;
    max-width: 400px;
  }

  .kui-search__icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    width: 18px;
    height: 18px;
    color: #9ca3af;
  }

  .kui-search__input {
    width: 100%;
    padding: 10px 12px 10px 40px;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    font-size: 14px;
    background: white;
    transition: border-color 0.2s;
  }

  .kui-search__input:focus {
    outline: none;
    border-color: var(--kui-color-primary);
  }

  .kui-select {
    padding: 10px 32px 10px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    font-size: 14px;
    background: white;
    cursor: pointer;
  }

  /* Stats */
  .kui-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
  }

  .kui-stat {
    text-align: center;
    padding: 16px;
  }

  .kui-stat__value {
    font-size: 32px;
    font-weight: 700;
    color: var(--kui-color-primary);
    margin: 0;
  }

  .kui-stat__label {
    font-size: 13px;
    color: #6b7280;
    margin: 4px 0 0;
  }

  /* Vehicle Grid */
  .kui-vehicle-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 16px;
  }

  .kui-vehicle {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .kui-vehicle__image {
    position: relative;
    height: 180px;
    background: #f4f4f5;
    overflow: hidden;
  }

  .kui-vehicle__image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .kui-vehicle__placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #d4d4d8;
  }

  .kui-vehicle__placeholder :global(svg) {
    width: 48px;
    height: 48px;
  }

  .kui-vehicle__badge {
    position: absolute;
    top: 10px;
    right: 10px;
  }

  .kui-vehicle__content {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .kui-vehicle__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
  }

  .kui-vehicle__meta {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: space-between;
  }

  .kui-vehicle__price {
    font-size: 18px;
    font-weight: 700;
    color: #059669;
  }

  .kui-vehicle__specs {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    padding: 12px;
    background: #f9fafb;
    border-radius: 8px;
  }

  .kui-spec {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .kui-spec__label {
    font-size: 10px;
    text-transform: uppercase;
    color: #9ca3af;
    letter-spacing: 0.05em;
  }

  .kui-spec__value {
    font-size: 13px;
    font-weight: 500;
  }

  .kui-source-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--kui-color-primary);
    text-decoration: none;
  }

  .kui-source-link:hover {
    text-decoration: underline;
  }

  /* Empty State */
  .kui-empty-card {
    padding: 48px 24px;
  }

  .kui-empty {
    display: grid;
    gap: 12px;
    justify-items: center;
    text-align: center;
  }

  .kui-icon-hero {
    width: 80px;
    height: 80px;
    border-radius: 20px;
    background: linear-gradient(135deg, #fde68a, #fbbf24);
    display: grid;
    place-items: center;
    color: #78350f;
  }

  .kui-icon-hero :global(svg) {
    width: 40px;
    height: 40px;
  }

  /* Modal */
  .kui-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  /* Tabs */
  .kui-add-tabs {
    display: flex;
    gap: 4px;
    padding: 4px;
    background: #f4f4f5;
    border-radius: 10px;
    margin-bottom: 20px;
  }

  .kui-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 16px;
    border: none;
    border-radius: 8px;
    background: transparent;
    font-size: 14px;
    font-weight: 500;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
  }

  .kui-tab:hover {
    color: #374151;
  }

  .kui-tab.is-active {
    background: white;
    color: var(--kui-color-primary);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  /* Scrape Section */
  .kui-scrape-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .kui-help-text {
    font-size: 14px;
    color: #6b7280;
    background: #f9fafb;
    padding: 12px;
    border-radius: 8px;
  }

  .kui-input-group {
    display: flex;
    gap: 8px;
  }

  .kui-input-group .kui-input {
    flex: 1;
  }

  .kui-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 14px;
  }

  .kui-input:focus {
    outline: none;
    border-color: var(--kui-color-primary);
  }

  .kui-error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    color: #dc2626;
    font-size: 14px;
  }

  .kui-spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Scraped Preview */
  .kui-scraped-preview {
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
  }

  .kui-scraped-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: #ecfdf5;
    color: #059669;
    font-weight: 500;
  }

  .kui-success {
    color: #059669;
  }

  .kui-scraped-content {
    display: grid;
    grid-template-columns: 160px 1fr;
    gap: 16px;
    padding: 16px;
  }

  .kui-scraped-image {
    width: 160px;
    height: 120px;
    object-fit: cover;
    border-radius: 8px;
  }

  .kui-scraped-details {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .kui-price {
    font-size: 20px;
    font-weight: 700;
    color: #059669;
    margin: 0;
  }

  .kui-scraped-specs {
    margin-top: 8px;
  }

  .kui-spec-row {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    padding: 4px 0;
    border-bottom: 1px solid #f4f4f5;
  }

  .kui-import-form {
    padding: 16px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .kui-import-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  /* Manual Form */
  .kui-manual-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .kui-form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .kui-input-prefix {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: white;
  }

  .kui-input-prefix :global(input) {
    border: none;
    padding: 10px 0;
  }

  .back-btn {
    margin-right: 0.5rem;
  }

  .font-mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
    font-size: 13px;
  }

  /* PDF Section */
  .kui-pdf-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .kui-upload-zone {
    border: 2px dashed #e5e7eb;
    border-radius: 12px;
    padding: 48px 24px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .kui-upload-icon {
    width: 48px;
    height: 48px;
    color: #9ca3af;
  }

  .kui-file-input {
    display: none;
  }

  .kui-coming-soon {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 8px;
    color: #b45309;
    font-size: 14px;
  }

  /* OEM Section */
  .kui-oem-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .kui-oem-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 240px;
    overflow-y: auto;
  }

  .kui-oem-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: #f9fafb;
    border-radius: 8px;
  }

  .kui-oem-logo {
    width: 48px;
    height: 48px;
    object-fit: contain;
    border-radius: 8px;
    background: white;
  }

  .kui-oem-placeholder {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #e5e7eb;
    border-radius: 8px;
    color: #9ca3af;
  }

  .kui-oem-info {
    flex: 1;
  }

  .kui-oem-info a {
    font-size: 13px;
    color: var(--kui-color-primary);
    text-decoration: none;
  }

  .kui-divider {
    height: 1px;
    background: #e5e7eb;
  }

  .kui-oem-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Native input styling */
  .kui-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 14px;
    background: white;
    color: #374151;
  }

  .kui-input:focus {
    outline: none;
    border-color: var(--kui-color-primary, #3b82f6);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .kui-input::placeholder {
    color: #9ca3af;
  }

  /* Native Select for import form */
  .kui-native-select {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    font-size: 14px;
    background: white;
    color: #374151;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
    background-position: right 8px center;
    background-repeat: no-repeat;
    background-size: 20px;
    padding-right: 36px;
  }

  .kui-native-select:focus {
    outline: none;
    border-color: var(--kui-color-primary, #3b82f6);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .kui-native-select:invalid {
    color: #9ca3af;
  }

  .kui-help-text {
    font-size: 12px;
    color: #f59e0b;
    margin-top: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .kui-help-text.kui-warning {
    color: #f59e0b;
  }

  .kui-link {
    color: var(--kui-color-primary, #3b82f6);
    background: none;
    border: none;
    padding: 0;
    font-size: inherit;
    cursor: pointer;
    text-decoration: underline;
  }

  .kui-link:hover {
    color: var(--kui-color-primary-dark, #2563eb);
  }

  .kui-callout {
    border: 1px solid var(--kui-color-border);
    border-radius: 8px;
    padding: 12px;
    background: var(--kui-color-surface-muted);
    color: var(--kui-color-text);
    font-size: 14px;
  }

  .kui-callout.error {
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.08);
    color: #dc2626;
  }

  .kui-stack {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .kui-modal-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
  }

  .kui-coming-soon-section {
    padding: 24px;
    text-align: center;
  }

  @media (max-width: 768px) {
    .kui-form-grid {
      grid-template-columns: 1fr;
    }

    .kui-scraped-content {
      grid-template-columns: 1fr;
    }

    .kui-scraped-image {
      width: 100%;
      height: 160px;
    }
  }
</style>
