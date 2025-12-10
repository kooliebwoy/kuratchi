<script lang="ts">
    import { onMount, getContext } from 'svelte';
    import { Bike, Search, Grid, List, ChevronLeft, ChevronRight, SlidersHorizontal, X } from '@lucide/svelte';
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
    import SectionLayoutControls from './SectionLayoutControls.svelte';
    import { type SectionLayout, getSectionLayoutStyles, mergeLayoutWithDefaults } from './section-layout.js';
    import { openFormModal, openVehicleInquiryModal, type AfterSubmitAction } from '../plugins/modals/modal-manager.svelte.js';

    // Get catalog data from context (provided by Editor)
    const siteMetadata = getContext<{
        catalogOems: CatalogOem[];
        catalogVehicles: CatalogVehicle[];
        forms?: any[];
    }>('siteMetadata');

    interface CatalogOem {
        id: string;
        name: string;
        logo_url?: string;
    }

    interface CatalogVehicle {
        id: string;
        oem_id: string;
        oem_name: string;
        model_name: string;
        model_year?: number;
        category: string;
        msrp?: number;
        currency?: string;
        thumbnail_url?: string;
        images?: string[];
        specifications?: Record<string, string>;
        features?: string[];
        description?: string;
        status: string;
    }

    // Lead CTA types
    interface LeadCTA {
        id: string;
        label: string;
        formId: string;
        style: 'primary' | 'secondary' | 'outline' | 'ghost';
        icon?: string;
        afterSubmitAction: 'close' | 'message' | 'redirect';
        afterSubmitMessage?: string;
        afterSubmitUrl?: string;
        prefillMapping?: Record<string, string>;
    }

    interface Props {
        // Identity
        id?: string;
        type?: string;
        editable?: boolean;
        
        // Data
        vehicles?: CatalogVehicle[];
        oems?: CatalogOem[];
        
        // Layout configuration
        viewMode?: 'grid' | 'list';
        gridColumns?: 2 | 3 | 4;
        itemsPerPage?: 6 | 9 | 12 | 18 | 24;
        
        // Filter configuration
        showFilters?: boolean;
        filterPosition?: 'left' | 'right' | 'top';
        collapsibleFilters?: boolean;
        
        // Display options
        showSearch?: boolean;
        showViewToggle?: boolean;
        showPrices?: boolean;
        showPagination?: boolean;
        
        // Header
        title?: string;
        subtitle?: string;
        showHeader?: boolean;
        
        // Vehicle details configuration
        detailsMode?: 'modal' | 'page' | 'none';
        detailsPagePattern?: string; // e.g., '/vehicles/{id}' or '/inventory/{slug}'
        detailsButtonText?: string;
        
        // Lead CTAs
        listCTAs?: LeadCTA[];
        detailCTAs?: LeadCTA[];
        
        // Section layout
        layout?: Partial<SectionLayout>;
        isEditing?: boolean;
        onLayoutChange?: (layout: SectionLayout) => void;
    }

    let {
        id = crypto.randomUUID(),
        type = 'catalog-view',
        editable = true,
        vehicles: vehiclesProp = [],
        oems: oemsProp = [],
        viewMode = 'grid',
        gridColumns = 3,
        itemsPerPage = 12,
        showFilters = true,
        filterPosition = 'left',
        collapsibleFilters = true,
        showSearch = true,
        showViewToggle = true,
        showPrices = true,
        showPagination = true,
        title = '',
        subtitle = '',
        showHeader = true,
        detailsMode = 'modal',
        detailsPagePattern = '/vehicles/{id}',
        detailsButtonText = 'View Details',
        listCTAs = [],
        detailCTAs = [],
        layout = {},
        isEditing = false,
        onLayoutChange
    }: Props = $props();

    // State
    let currentViewMode = $state(viewMode);
    let selectedVehicle = $state<CatalogVehicle | null>(null);
    let showDetailsModal = $state(false);

    // Use context data if props are empty, otherwise use props
    const vehicles = $derived(
        vehiclesProp.length > 0 ? vehiclesProp : (siteMetadata?.catalogVehicles || [])
    );
    const oems = $derived(
        oemsProp.length > 0 ? oemsProp : (siteMetadata?.catalogOems || [])
    );

    // Block registry for editor persistence
    let component = $state<HTMLElement>();
    const componentRef = {};
    
    // Don't save vehicles/oems to content - they come from context
    const content = $derived({
        id,
        type,
        viewMode: currentViewMode,
        gridColumns,
        itemsPerPage,
        showFilters,
        filterPosition,
        collapsibleFilters,
        showSearch,
        showViewToggle,
        showPrices,
        showPagination,
        title,
        subtitle,
        showHeader,
        detailsMode,
        detailsPagePattern,
        detailsButtonText,
        listCTAs,
        detailCTAs,
        layout
    });

    // Handle vehicle details view
    const handleViewDetails = (vehicle: CatalogVehicle) => {
        if (detailsMode === 'none') return;
        
        if (detailsMode === 'page') {
            // Build URL from pattern
            const url = detailsPagePattern
                .replace('{id}', vehicle.id)
                .replace('{slug}', vehicle.model_name.toLowerCase().replace(/\s+/g, '-'));
            window.location.href = url;
            return;
        }
        
        // Default: modal
        selectedVehicle = vehicle;
        showDetailsModal = true;
    };

    const closeDetailsModal = () => {
        showDetailsModal = false;
        selectedVehicle = null;
    };

    // Handle Lead CTA click
    const handleLeadCTA = (cta: LeadCTA, vehicle: CatalogVehicle) => {
        const prefillData: Record<string, any> = {
            vehicle_id: vehicle.id,
            vehicle_name: `${vehicle.model_year || ''} ${vehicle.model_name}`.trim(),
            vehicle_price: vehicle.msrp,
            vehicle_category: vehicle.category,
            vehicle_oem: vehicle.oem_name
        };

        // Apply any custom prefill mappings
        if (cta.prefillMapping) {
            Object.entries(cta.prefillMapping).forEach(([formField, contextField]) => {
                if (contextField === 'vehicleId') prefillData[formField] = vehicle.id;
                if (contextField === 'vehicleName') prefillData[formField] = `${vehicle.model_year || ''} ${vehicle.model_name}`.trim();
                if (contextField === 'vehiclePrice') prefillData[formField] = vehicle.msrp;
                if (contextField === 'vehicleCategory') prefillData[formField] = vehicle.category;
                if (contextField === 'vehicleOem') prefillData[formField] = vehicle.oem_name;
            });
        }

        // Build after submit action
        let afterSubmit: AfterSubmitAction;
        switch (cta.afterSubmitAction) {
            case 'close':
                afterSubmit = { type: 'close' };
                break;
            case 'redirect':
                afterSubmit = { type: 'redirect', url: cta.afterSubmitUrl || '/' };
                break;
            case 'message':
            default:
                afterSubmit = { 
                    type: 'message', 
                    message: cta.afterSubmitMessage || 'Thank you! We\'ll be in touch soon.',
                    messageType: 'success',
                    autoCloseDelay: 3000
                };
        }

        // Open the modal
        openVehicleInquiryModal({
            vehicleId: vehicle.id,
            vehicleName: `${vehicle.model_year || ''} ${vehicle.model_name}`.trim(),
            formId: cta.formId,
            additionalData: prefillData,
            afterSubmit
        });
    };

    onMount(() => {
        if (!editable) return;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
        return () => blockRegistry.unregister(componentRef);
    });
    let searchQuery = $state('');
    let selectedOem = $state<string>('all');
    let selectedCategory = $state<string>('all');
    let selectedYear = $state<string>('all');
    let priceRange = $state<{ min: number | null; max: number | null }>({ min: null, max: null });
    let currentPage = $state(1);
    let filtersExpanded = $state(!collapsibleFilters);
    let mobileFiltersOpen = $state(false);

    // Layout
    const mergedLayout = $derived(mergeLayoutWithDefaults(layout));
    const layoutStyles = $derived(getSectionLayoutStyles(mergedLayout));

    // Categories
    const categories = [
        { value: 'all', label: 'All Categories' },
        { value: 'atv', label: 'ATV' },
        { value: 'utv', label: 'UTV / Side-by-Side' },
        { value: 'dirtbike', label: 'Dirt Bike' },
        { value: 'pitbike', label: 'Pit Bike' },
        { value: 'motorcycle', label: 'Motorcycle' },
        { value: 'electric', label: 'Electric' },
        { value: 'other', label: 'Other' }
    ];

    // Get unique years from vehicles
    const availableYears = $derived(() => {
        const years = new Set<number>();
        vehicles.forEach(v => {
            if (v.model_year) years.add(v.model_year);
        });
        return Array.from(years).sort((a, b) => b - a);
    });

    // Filtered vehicles
    const filteredVehicles = $derived(() => {
        let result = vehicles.filter(v => v.status === 'published');

        if (selectedOem !== 'all') {
            result = result.filter(v => v.oem_id === selectedOem);
        }

        if (selectedCategory !== 'all') {
            result = result.filter(v => v.category === selectedCategory);
        }

        if (selectedYear !== 'all') {
            result = result.filter(v => v.model_year === parseInt(selectedYear));
        }

        if (priceRange.min !== null) {
            result = result.filter(v => (v.msrp || 0) >= priceRange.min!);
        }

        if (priceRange.max !== null) {
            result = result.filter(v => (v.msrp || 0) <= priceRange.max!);
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(v =>
                v.model_name?.toLowerCase().includes(query) ||
                v.oem_name?.toLowerCase().includes(query) ||
                v.description?.toLowerCase().includes(query)
            );
        }

        return result;
    });

    // Pagination
    const totalPages = $derived(Math.ceil(filteredVehicles().length / itemsPerPage));
    const paginatedVehicles = $derived(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredVehicles().slice(start, start + itemsPerPage);
    });

    // Reset page when filters change
    $effect(() => {
        // Dependencies
        searchQuery; selectedOem; selectedCategory; selectedYear; priceRange;
        currentPage = 1;
    });

    // Helpers
    const formatPrice = (amount: number | undefined, currency: string = 'USD') => {
        if (!amount) return '';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    const getCategoryLabel = (cat: string) => {
        const found = categories.find(c => c.value === cat);
        return found?.label || cat;
    };

    const clearFilters = () => {
        searchQuery = '';
        selectedOem = 'all';
        selectedCategory = 'all';
        selectedYear = 'all';
        priceRange = { min: null, max: null };
    };

    const hasActiveFilters = $derived(
        selectedOem !== 'all' || 
        selectedCategory !== 'all' || 
        selectedYear !== 'all' || 
        priceRange.min !== null || 
        priceRange.max !== null ||
        searchQuery !== ''
    );

    const handleLayoutChange = (newLayout: SectionLayout) => {
        onLayoutChange?.(newLayout);
    };
</script>

<section class="catalog-view" class:editor-item={editable} style={layoutStyles} data-filter-position={filterPosition} bind:this={component}>
    {#if isEditing}
        <SectionLayoutControls
            layout={mergedLayout}
            onchange={handleLayoutChange}
        />
    {/if}

    <div class="catalog-view__container">
        <!-- Header -->
        {#if showHeader && (title || subtitle)}
            <header class="catalog-view__header">
                {#if title}
                    <h1 class="catalog-view__title">{title}</h1>
                {/if}
                {#if subtitle}
                    <p class="catalog-view__subtitle">{subtitle}</p>
                {/if}
            </header>
        {/if}

        <!-- Top Bar: Search + View Toggle -->
        <div class="catalog-view__topbar">
            {#if showSearch}
                <div class="catalog-view__search">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search vehicles..."
                        bind:value={searchQuery}
                    />
                    {#if searchQuery}
                        <button class="catalog-view__searchClear" onclick={() => searchQuery = ''}>
                            <X size={16} />
                        </button>
                    {/if}
                </div>
            {/if}

            <div class="catalog-view__topbarActions">
                <!-- Mobile filter toggle -->
                {#if showFilters && filterPosition !== 'top'}
                    <button 
                        class="catalog-view__mobileFilterBtn"
                        onclick={() => mobileFiltersOpen = !mobileFiltersOpen}
                    >
                        <SlidersHorizontal size={18} />
                        Filters
                        {#if hasActiveFilters}
                            <span class="catalog-view__filterBadge"></span>
                        {/if}
                    </button>
                {/if}

                {#if showViewToggle}
                    <div class="catalog-view__viewToggle">
                        <button
                            class="catalog-view__viewBtn"
                            class:active={currentViewMode === 'grid'}
                            onclick={() => currentViewMode = 'grid'}
                            title="Grid view"
                        >
                            <Grid size={18} />
                        </button>
                        <button
                            class="catalog-view__viewBtn"
                            class:active={currentViewMode === 'list'}
                            onclick={() => currentViewMode = 'list'}
                            title="List view"
                        >
                            <List size={18} />
                        </button>
                    </div>
                {/if}

                <span class="catalog-view__count">
                    {filteredVehicles().length} vehicle{filteredVehicles().length !== 1 ? 's' : ''}
                </span>
            </div>
        </div>

        <!-- Top Filters (if position is top) -->
        {#if showFilters && filterPosition === 'top'}
            <div class="catalog-view__filtersTop">
                <div class="catalog-view__filterRow">
                    <select bind:value={selectedOem} class="catalog-view__select">
                        <option value="all">All Brands</option>
                        {#each oems as oem}
                            <option value={oem.id}>{oem.name}</option>
                        {/each}
                    </select>

                    <select bind:value={selectedCategory} class="catalog-view__select">
                        {#each categories as cat}
                            <option value={cat.value}>{cat.label}</option>
                        {/each}
                    </select>

                    {#if availableYears().length > 0}
                        <select bind:value={selectedYear} class="catalog-view__select">
                            <option value="all">All Years</option>
                            {#each availableYears() as year}
                                <option value={year.toString()}>{year}</option>
                            {/each}
                        </select>
                    {/if}

                    {#if hasActiveFilters}
                        <button class="catalog-view__clearBtn" onclick={clearFilters}>
                            Clear Filters
                        </button>
                    {/if}
                </div>
            </div>
        {/if}

        <!-- Main Content Area -->
        <div class="catalog-view__main" class:has-sidebar={showFilters && filterPosition !== 'top'}>
            <!-- Sidebar Filters -->
            {#if showFilters && filterPosition !== 'top'}
                <aside 
                    class="catalog-view__sidebar"
                    class:mobile-open={mobileFiltersOpen}
                    data-position={filterPosition}
                >
                    <div class="catalog-view__sidebarHeader">
                        <h3>Filters</h3>
                        {#if hasActiveFilters}
                            <button class="catalog-view__clearLink" onclick={clearFilters}>
                                Clear all
                            </button>
                        {/if}
                        <button 
                            class="catalog-view__sidebarClose"
                            onclick={() => mobileFiltersOpen = false}
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <!-- Brand Filter -->
                    <div class="catalog-view__filterGroup">
                        <h4>Brand</h4>
                        <div class="catalog-view__filterOptions">
                            <label class="catalog-view__filterOption">
                                <input 
                                    type="radio" 
                                    name="oem" 
                                    value="all" 
                                    bind:group={selectedOem}
                                />
                                <span>All Brands</span>
                            </label>
                            {#each oems as oem}
                                <label class="catalog-view__filterOption">
                                    <input 
                                        type="radio" 
                                        name="oem" 
                                        value={oem.id} 
                                        bind:group={selectedOem}
                                    />
                                    <span>{oem.name}</span>
                                </label>
                            {/each}
                        </div>
                    </div>

                    <!-- Category Filter -->
                    <div class="catalog-view__filterGroup">
                        <h4>Category</h4>
                        <div class="catalog-view__filterOptions">
                            {#each categories as cat}
                                <label class="catalog-view__filterOption">
                                    <input 
                                        type="radio" 
                                        name="category" 
                                        value={cat.value} 
                                        bind:group={selectedCategory}
                                    />
                                    <span>{cat.label}</span>
                                </label>
                            {/each}
                        </div>
                    </div>

                    <!-- Year Filter -->
                    {#if availableYears().length > 0}
                        <div class="catalog-view__filterGroup">
                            <h4>Year</h4>
                            <div class="catalog-view__filterOptions">
                                <label class="catalog-view__filterOption">
                                    <input 
                                        type="radio" 
                                        name="year" 
                                        value="all" 
                                        bind:group={selectedYear}
                                    />
                                    <span>All Years</span>
                                </label>
                                {#each availableYears() as year}
                                    <label class="catalog-view__filterOption">
                                        <input 
                                            type="radio" 
                                            name="year" 
                                            value={year.toString()} 
                                            bind:group={selectedYear}
                                        />
                                        <span>{year}</span>
                                    </label>
                                {/each}
                            </div>
                        </div>
                    {/if}

                    <!-- Price Range -->
                    {#if showPrices}
                        <div class="catalog-view__filterGroup">
                            <h4>Price Range</h4>
                            <div class="catalog-view__priceInputs">
                                <input
                                    type="number"
                                    placeholder="Min"
                                    bind:value={priceRange.min}
                                    class="catalog-view__priceInput"
                                />
                                <span>to</span>
                                <input
                                    type="number"
                                    placeholder="Max"
                                    bind:value={priceRange.max}
                                    class="catalog-view__priceInput"
                                />
                            </div>
                        </div>
                    {/if}
                </aside>

                <!-- Mobile overlay -->
                {#if mobileFiltersOpen}
                    <div 
                        class="catalog-view__overlay"
                        onclick={() => mobileFiltersOpen = false}
                    ></div>
                {/if}
            {/if}

            <!-- Vehicle Grid/List -->
            <div class="catalog-view__content">
                {#if paginatedVehicles().length === 0}
                    <div class="catalog-view__empty">
                        <Bike size={48} strokeWidth={1} />
                        <p>No vehicles found</p>
                        {#if hasActiveFilters}
                            <button class="catalog-view__emptyBtn" onclick={clearFilters}>
                                Clear filters
                            </button>
                        {/if}
                    </div>
                {:else if currentViewMode === 'grid'}
                    <div 
                        class="catalog-view__grid"
                        style="--columns: {gridColumns}"
                    >
                        {#each paginatedVehicles() as vehicle}
                            <article class="catalog-view__card">
                                <div class="catalog-view__cardImage">
                                    {#if vehicle.thumbnail_url}
                                        <img src={vehicle.thumbnail_url} alt={vehicle.model_name} />
                                    {:else}
                                        <div class="catalog-view__cardPlaceholder">
                                            <Bike size={32} />
                                        </div>
                                    {/if}
                                    <span class="catalog-view__cardCategory">
                                        {getCategoryLabel(vehicle.category)}
                                    </span>
                                </div>
                                <div class="catalog-view__cardContent">
                                    <span class="catalog-view__cardBrand">{vehicle.oem_name}</span>
                                    <h3 class="catalog-view__cardTitle">
                                        {#if vehicle.model_year}{vehicle.model_year}{/if}
                                        {vehicle.model_name}
                                    </h3>
                                    {#if showPrices && vehicle.msrp}
                                        <span class="catalog-view__cardPrice">
                                            {formatPrice(vehicle.msrp, vehicle.currency)}
                                        </span>
                                    {/if}
                                    <div class="catalog-view__cardActions">
                                        {#if detailsMode !== 'none'}
                                            <button 
                                                class="catalog-view__cardBtn"
                                                onclick={() => handleViewDetails(vehicle)}
                                            >
                                                {detailsButtonText}
                                            </button>
                                        {/if}
                                        {#if listCTAs.length > 0}
                                            {#each listCTAs as cta (cta.id)}
                                                <button 
                                                    class="catalog-view__cardBtn catalog-view__cardBtn--{cta.style}"
                                                    onclick={() => handleLeadCTA(cta, vehicle)}
                                                >
                                                    {cta.label}
                                                </button>
                                            {/each}
                                        {/if}
                                    </div>
                                </div>
                            </article>
                        {/each}
                    </div>
                {:else}
                    <div class="catalog-view__list">
                        {#each paginatedVehicles() as vehicle}
                            <article class="catalog-view__listItem">
                                <div class="catalog-view__listImage">
                                    {#if vehicle.thumbnail_url}
                                        <img src={vehicle.thumbnail_url} alt={vehicle.model_name} />
                                    {:else}
                                        <div class="catalog-view__listPlaceholder">
                                            <Bike size={24} />
                                        </div>
                                    {/if}
                                </div>
                                <div class="catalog-view__listContent">
                                    <div class="catalog-view__listHeader">
                                        <span class="catalog-view__listBrand">{vehicle.oem_name}</span>
                                        <span class="catalog-view__listCategory">
                                            {getCategoryLabel(vehicle.category)}
                                        </span>
                                    </div>
                                    <h3 class="catalog-view__listTitle">
                                        {#if vehicle.model_year}{vehicle.model_year}{/if}
                                        {vehicle.model_name}
                                    </h3>
                                    {#if vehicle.description}
                                        <p class="catalog-view__listDesc">{vehicle.description}</p>
                                    {/if}
                                </div>
                                <div class="catalog-view__listActions">
                                    {#if showPrices && vehicle.msrp}
                                        <span class="catalog-view__listPrice">
                                            {formatPrice(vehicle.msrp, vehicle.currency)}
                                        </span>
                                    {/if}
                                    {#if detailsMode !== 'none'}
                                        <button 
                                            class="catalog-view__listBtn"
                                            onclick={() => handleViewDetails(vehicle)}
                                        >
                                            {detailsButtonText}
                                        </button>
                                    {/if}
                                    {#if listCTAs.length > 0}
                                        {#each listCTAs as cta (cta.id)}
                                            <button 
                                                class="catalog-view__listBtn catalog-view__listBtn--{cta.style}"
                                                onclick={() => handleLeadCTA(cta, vehicle)}
                                            >
                                                {cta.label}
                                            </button>
                                        {/each}
                                    {/if}
                                </div>
                            </article>
                        {/each}
                    </div>
                {/if}

                <!-- Pagination -->
                {#if showPagination && totalPages > 1}
                    <nav class="catalog-view__pagination">
                        <button
                            class="catalog-view__pageBtn"
                            disabled={currentPage === 1}
                            onclick={() => currentPage = Math.max(1, currentPage - 1)}
                        >
                            <ChevronLeft size={18} />
                            Previous
                        </button>

                        <div class="catalog-view__pageNumbers">
                            {#each Array.from({ length: totalPages }, (_, i) => i + 1) as page}
                                {#if page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)}
                                    <button
                                        class="catalog-view__pageNum"
                                        class:active={page === currentPage}
                                        onclick={() => currentPage = page}
                                    >
                                        {page}
                                    </button>
                                {:else if page === currentPage - 2 || page === currentPage + 2}
                                    <span class="catalog-view__pageEllipsis">...</span>
                                {/if}
                            {/each}
                        </div>

                        <button
                            class="catalog-view__pageBtn"
                            disabled={currentPage === totalPages}
                            onclick={() => currentPage = Math.min(totalPages, currentPage + 1)}
                        >
                            Next
                            <ChevronRight size={18} />
                        </button>
                    </nav>
                {/if}
            </div>
        </div>
    </div>
</section>

<!-- Vehicle Details Modal -->
{#if showDetailsModal && selectedVehicle}
    <div 
        class="catalog-view__modalOverlay"
        onclick={closeDetailsModal}
        onkeydown={(e) => e.key === 'Escape' && closeDetailsModal()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vehicle-modal-title"
        tabindex="-1"
    >
        <div 
            class="catalog-view__modal"
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => e.stopPropagation()}
            role="document"
        >
            <button 
                class="catalog-view__modalClose"
                onclick={closeDetailsModal}
                aria-label="Close modal"
            >
                <X size={24} />
            </button>
            
            <div class="catalog-view__modalContent">
                <!-- Image Gallery -->
                <div class="catalog-view__modalGallery">
                    {#if selectedVehicle.thumbnail_url}
                        <img 
                            src={selectedVehicle.thumbnail_url} 
                            alt={selectedVehicle.model_name}
                            class="catalog-view__modalImage"
                        />
                    {:else}
                        <div class="catalog-view__modalPlaceholder">
                            <Bike size={64} />
                        </div>
                    {/if}
                </div>
                
                <!-- Vehicle Info -->
                <div class="catalog-view__modalInfo">
                    <div class="catalog-view__modalHeader">
                        <span class="catalog-view__modalBrand">{selectedVehicle.oem_name}</span>
                        <span class="catalog-view__modalCategory">
                            {getCategoryLabel(selectedVehicle.category)}
                        </span>
                    </div>
                    
                    <h2 id="vehicle-modal-title" class="catalog-view__modalTitle">
                        {#if selectedVehicle.model_year}{selectedVehicle.model_year}{/if}
                        {selectedVehicle.model_name}
                    </h2>
                    
                    {#if showPrices && selectedVehicle.msrp}
                        <div class="catalog-view__modalPrice">
                            {formatPrice(selectedVehicle.msrp, selectedVehicle.currency)}
                        </div>
                    {/if}
                    
                    {#if selectedVehicle.description}
                        <p class="catalog-view__modalDesc">{selectedVehicle.description}</p>
                    {/if}
                    
                    <!-- Specifications if available -->
                    {#if selectedVehicle.specifications && Object.keys(selectedVehicle.specifications).length > 0}
                        <div class="catalog-view__modalSpecs">
                            <h3 class="catalog-view__modalSpecsTitle">Specifications</h3>
                            <dl class="catalog-view__modalSpecsList">
                                {#each Object.entries(selectedVehicle.specifications) as [key, value]}
                                    <div class="catalog-view__modalSpecItem">
                                        <dt>{key}</dt>
                                        <dd>{value}</dd>
                                    </div>
                                {/each}
                            </dl>
                        </div>
                    {/if}
                    
                    <!-- Features if available -->
                    {#if selectedVehicle.features && selectedVehicle.features.length > 0}
                        <div class="catalog-view__modalFeatures">
                            <h3 class="catalog-view__modalFeaturesTitle">Features</h3>
                            <ul class="catalog-view__modalFeaturesList">
                                {#each selectedVehicle.features as feature}
                                    <li>{feature}</li>
                                {/each}
                            </ul>
                        </div>
                    {/if}

                    <!-- Detail CTAs -->
                    {#if detailCTAs.length > 0}
                        <div class="catalog-view__modalCTAs">
                            {#each detailCTAs as cta (cta.id)}
                                <button 
                                    class="catalog-view__modalCTA catalog-view__modalCTA--{cta.style}"
                                    onclick={() => selectedVehicle && handleLeadCTA(cta, selectedVehicle)}
                                >
                                    {cta.label}
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .catalog-view {
        position: relative;
        padding: var(--section-padding-y, 3rem) var(--section-padding-x, 1.5rem);
        background: var(--section-bg, #ffffff);
    }

    .catalog-view__container {
        max-width: var(--section-max-width, 1400px);
        margin: 0 auto;
    }

    /* Header */
    .catalog-view__header {
        margin-bottom: 2rem;
    }

    .catalog-view__title {
        margin: 0 0 0.5rem;
        font-size: 2rem;
        font-weight: 700;
        color: #0f172a;
    }

    .catalog-view__subtitle {
        margin: 0;
        font-size: 1rem;
        color: #64748b;
    }

    /* Top Bar */
    .catalog-view__topbar {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        align-items: center;
        margin-bottom: 1.5rem;
        padding-bottom: 1.5rem;
        border-bottom: 1px solid #e2e8f0;
    }

    .catalog-view__search {
        flex: 1;
        min-width: 200px;
        max-width: 400px;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        color: #64748b;
    }

    .catalog-view__search input {
        flex: 1;
        border: none;
        background: transparent;
        font-size: 0.9375rem;
        color: #0f172a;
        outline: none;
    }

    .catalog-view__search input::placeholder {
        color: #94a3b8;
    }

    .catalog-view__searchClear {
        padding: 0.25rem;
        border: none;
        background: transparent;
        color: #94a3b8;
        cursor: pointer;
        border-radius: 0.25rem;
    }

    .catalog-view__searchClear:hover {
        color: #64748b;
        background: #e2e8f0;
    }

    .catalog-view__topbarActions {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-left: auto;
    }

    .catalog-view__mobileFilterBtn {
        display: none;
        align-items: center;
        gap: 0.5rem;
        padding: 0.625rem 1rem;
        border: 1px solid #e2e8f0;
        background: #ffffff;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: #374151;
        cursor: pointer;
        position: relative;
    }

    .catalog-view__filterBadge {
        position: absolute;
        top: -4px;
        right: -4px;
        width: 10px;
        height: 10px;
        background: #3b82f6;
        border-radius: 50%;
    }

    .catalog-view__viewToggle {
        display: flex;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        overflow: hidden;
    }

    .catalog-view__viewBtn {
        padding: 0.5rem 0.75rem;
        border: none;
        background: #ffffff;
        color: #64748b;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .catalog-view__viewBtn:first-child {
        border-right: 1px solid #e2e8f0;
    }

    .catalog-view__viewBtn:hover {
        background: #f8fafc;
    }

    .catalog-view__viewBtn.active {
        background: #0f172a;
        color: #ffffff;
    }

    .catalog-view__count {
        font-size: 0.875rem;
        color: #64748b;
        white-space: nowrap;
    }

    /* Top Filters */
    .catalog-view__filtersTop {
        margin-bottom: 1.5rem;
    }

    .catalog-view__filterRow {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        align-items: center;
    }

    .catalog-view__select {
        padding: 0.625rem 1rem;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        color: #0f172a;
        cursor: pointer;
        min-width: 140px;
    }

    .catalog-view__clearBtn {
        padding: 0.625rem 1rem;
        background: transparent;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        color: #64748b;
        cursor: pointer;
    }

    .catalog-view__clearBtn:hover {
        background: #f8fafc;
        color: #0f172a;
    }

    /* Main Layout */
    .catalog-view__main {
        display: flex;
        gap: 2rem;
    }

    .catalog-view__main.has-sidebar[data-filter-position="right"] {
        flex-direction: row-reverse;
    }

    /* Sidebar */
    .catalog-view__sidebar {
        flex-shrink: 0;
        width: 260px;
    }

    .catalog-view__sidebarHeader {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1.5rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid #e2e8f0;
    }

    .catalog-view__sidebarHeader h3 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        color: #0f172a;
    }

    .catalog-view__clearLink {
        margin-left: auto;
        padding: 0;
        border: none;
        background: transparent;
        font-size: 0.8125rem;
        color: #3b82f6;
        cursor: pointer;
    }

    .catalog-view__clearLink:hover {
        text-decoration: underline;
    }

    .catalog-view__sidebarClose {
        display: none;
        padding: 0.25rem;
        border: none;
        background: transparent;
        color: #64748b;
        cursor: pointer;
    }

    .catalog-view__filterGroup {
        margin-bottom: 1.5rem;
    }

    .catalog-view__filterGroup h4 {
        margin: 0 0 0.75rem;
        font-size: 0.8125rem;
        font-weight: 600;
        color: #374151;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .catalog-view__filterOptions {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .catalog-view__filterOption {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        color: #374151;
        cursor: pointer;
    }

    .catalog-view__filterOption input {
        accent-color: #3b82f6;
    }

    .catalog-view__priceInputs {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .catalog-view__priceInputs span {
        font-size: 0.875rem;
        color: #64748b;
    }

    .catalog-view__priceInput {
        flex: 1;
        padding: 0.5rem 0.75rem;
        border: 1px solid #e2e8f0;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        width: 80px;
    }

    .catalog-view__overlay {
        display: none;
    }

    /* Content */
    .catalog-view__content {
        flex: 1;
        min-width: 0;
    }

    /* Empty State */
    .catalog-view__empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        padding: 4rem 2rem;
        text-align: center;
        color: #94a3b8;
    }

    .catalog-view__empty p {
        margin: 0;
        font-size: 1.125rem;
    }

    .catalog-view__emptyBtn {
        padding: 0.625rem 1.25rem;
        background: #0f172a;
        color: #ffffff;
        border: none;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        cursor: pointer;
    }

    /* Grid View */
    .catalog-view__grid {
        display: grid;
        grid-template-columns: repeat(var(--columns, 3), 1fr);
        gap: 1.5rem;
    }

    .catalog-view__card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        overflow: hidden;
        transition: all 0.2s ease;
    }

    .catalog-view__card:hover {
        box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.1);
        transform: translateY(-2px);
    }

    .catalog-view__cardImage {
        position: relative;
        aspect-ratio: 4/3;
        background: #f8fafc;
    }

    .catalog-view__cardImage img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .catalog-view__cardPlaceholder {
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
        color: #cbd5e1;
    }

    .catalog-view__cardCategory {
        position: absolute;
        top: 0.75rem;
        left: 0.75rem;
        padding: 0.25rem 0.625rem;
        background: rgba(0, 0, 0, 0.7);
        color: #ffffff;
        font-size: 0.6875rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border-radius: 0.25rem;
    }

    .catalog-view__cardContent {
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
    }

    .catalog-view__cardBrand {
        font-size: 0.75rem;
        font-weight: 600;
        color: #3b82f6;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .catalog-view__cardTitle {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 600;
        color: #0f172a;
    }

    .catalog-view__cardPrice {
        font-size: 1.25rem;
        font-weight: 700;
        color: #059669;
        margin-top: 0.25rem;
    }

    .catalog-view__cardBtn {
        margin-top: 0.75rem;
        padding: 0.625rem 1rem;
        background: #0f172a;
        color: #ffffff;
        border: none;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s ease;
    }

    .catalog-view__cardBtn:hover {
        background: #1e293b;
    }

    /* List View */
    .catalog-view__list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .catalog-view__listItem {
        display: flex;
        gap: 1.5rem;
        padding: 1.25rem;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        transition: all 0.2s ease;
    }

    .catalog-view__listItem:hover {
        box-shadow: 0 4px 20px -4px rgba(0, 0, 0, 0.08);
    }

    .catalog-view__listImage {
        flex-shrink: 0;
        width: 180px;
        aspect-ratio: 4/3;
        background: #f8fafc;
        border-radius: 0.5rem;
        overflow: hidden;
    }

    .catalog-view__listImage img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .catalog-view__listPlaceholder {
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
        color: #cbd5e1;
    }

    .catalog-view__listContent {
        flex: 1;
        min-width: 0;
    }

    .catalog-view__listHeader {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.5rem;
    }

    .catalog-view__listBrand {
        font-size: 0.75rem;
        font-weight: 600;
        color: #3b82f6;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .catalog-view__listCategory {
        padding: 0.125rem 0.5rem;
        background: #f1f5f9;
        color: #64748b;
        font-size: 0.6875rem;
        font-weight: 500;
        border-radius: 0.25rem;
    }

    .catalog-view__listTitle {
        margin: 0 0 0.5rem;
        font-size: 1.25rem;
        font-weight: 600;
        color: #0f172a;
    }

    .catalog-view__listDesc {
        margin: 0;
        font-size: 0.875rem;
        color: #64748b;
        line-height: 1.5;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .catalog-view__listActions {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.75rem;
        flex-shrink: 0;
    }

    .catalog-view__listPrice {
        font-size: 1.5rem;
        font-weight: 700;
        color: #059669;
    }

    .catalog-view__listBtn {
        padding: 0.625rem 1.25rem;
        background: #0f172a;
        color: #ffffff;
        border: none;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        white-space: nowrap;
    }

    .catalog-view__listBtn:hover {
        background: #1e293b;
    }

    /* Pagination */
    .catalog-view__pagination {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        margin-top: 2rem;
        padding-top: 2rem;
        border-top: 1px solid #e2e8f0;
    }

    .catalog-view__pageBtn {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.5rem 1rem;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        color: #374151;
        cursor: pointer;
    }

    .catalog-view__pageBtn:hover:not(:disabled) {
        background: #f8fafc;
    }

    .catalog-view__pageBtn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .catalog-view__pageNumbers {
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }

    .catalog-view__pageNum {
        min-width: 36px;
        height: 36px;
        display: grid;
        place-items: center;
        background: transparent;
        border: none;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        color: #374151;
        cursor: pointer;
    }

    .catalog-view__pageNum:hover {
        background: #f1f5f9;
    }

    .catalog-view__pageNum.active {
        background: #0f172a;
        color: #ffffff;
    }

    .catalog-view__pageEllipsis {
        padding: 0 0.25rem;
        color: #94a3b8;
    }

    /* Responsive */
    @media (max-width: 1024px) {
        .catalog-view__grid {
            grid-template-columns: repeat(2, 1fr);
        }

        .catalog-view__sidebar {
            width: 220px;
        }
    }

    @media (max-width: 768px) {
        .catalog-view__mobileFilterBtn {
            display: flex;
        }

        .catalog-view__main.has-sidebar {
            display: block;
        }

        .catalog-view__sidebar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100%;
            max-width: 320px;
            background: #ffffff;
            z-index: 1000;
            padding: 1.5rem;
            overflow-y: auto;
            transform: translateX(-100%);
            transition: transform 0.3s ease;
        }

        .catalog-view__sidebar[data-position="right"] {
            left: auto;
            transform: translateX(100%);
        }

        .catalog-view__sidebar.mobile-open {
            transform: translateX(0);
        }

        .catalog-view__sidebarClose {
            display: block;
        }

        .catalog-view__overlay {
            display: block;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 999;
        }

        .catalog-view__grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
        }

        .catalog-view__listItem {
            flex-direction: column;
            gap: 1rem;
        }

        .catalog-view__listImage {
            width: 100%;
        }

        .catalog-view__listActions {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            width: 100%;
        }

        .catalog-view__pagination {
            flex-wrap: wrap;
        }
    }

    @media (max-width: 480px) {
        .catalog-view__grid {
            grid-template-columns: 1fr;
        }

        .catalog-view__topbar {
            flex-direction: column;
            align-items: stretch;
        }

        .catalog-view__search {
            max-width: none;
        }

        .catalog-view__topbarActions {
            justify-content: space-between;
        }
    }

    /* Vehicle Details Modal */
    .catalog-view__modalOverlay {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    .catalog-view__modal {
        position: relative;
        width: 100%;
        max-width: 900px;
        max-height: 90vh;
        overflow-y: auto;
        background: #ffffff;
        border-radius: 1rem;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        animation: slideUp 0.3s ease;
    }

    @keyframes slideUp {
        from { 
            opacity: 0;
            transform: translateY(20px);
        }
        to { 
            opacity: 1;
            transform: translateY(0);
        }
    }

    .catalog-view__modalClose {
        position: absolute;
        top: 1rem;
        right: 1rem;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2.5rem;
        height: 2.5rem;
        border: none;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.9);
        color: #64748b;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .catalog-view__modalClose:hover {
        background: #f1f5f9;
        color: #0f172a;
    }

    .catalog-view__modalContent {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2rem;
    }

    .catalog-view__modalGallery {
        aspect-ratio: 4/3;
        background: #f8fafc;
        border-radius: 1rem 0 0 1rem;
        overflow: hidden;
    }

    .catalog-view__modalImage {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .catalog-view__modalPlaceholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #cbd5e1;
    }

    .catalog-view__modalInfo {
        padding: 2rem 2rem 2rem 0;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .catalog-view__modalHeader {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .catalog-view__modalBrand {
        font-size: 0.875rem;
        font-weight: 600;
        color: #3b82f6;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .catalog-view__modalCategory {
        padding: 0.25rem 0.75rem;
        font-size: 0.75rem;
        font-weight: 500;
        color: #64748b;
        background: #f1f5f9;
        border-radius: 9999px;
    }

    .catalog-view__modalTitle {
        margin: 0;
        font-size: 1.75rem;
        font-weight: 700;
        color: #0f172a;
        line-height: 1.2;
    }

    .catalog-view__modalPrice {
        font-size: 1.5rem;
        font-weight: 700;
        color: #059669;
    }

    .catalog-view__modalDesc {
        margin: 0;
        font-size: 1rem;
        color: #64748b;
        line-height: 1.6;
    }

    .catalog-view__modalSpecs,
    .catalog-view__modalFeatures {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #e2e8f0;
    }

    .catalog-view__modalSpecsTitle,
    .catalog-view__modalFeaturesTitle {
        margin: 0 0 0.75rem;
        font-size: 1rem;
        font-weight: 600;
        color: #0f172a;
    }

    .catalog-view__modalSpecsList {
        margin: 0;
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.5rem;
    }

    .catalog-view__modalSpecItem {
        display: flex;
        justify-content: space-between;
        padding: 0.5rem;
        background: #f8fafc;
        border-radius: 0.375rem;
    }

    .catalog-view__modalSpecItem dt {
        font-size: 0.875rem;
        color: #64748b;
    }

    .catalog-view__modalSpecItem dd {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 500;
        color: #0f172a;
    }

    .catalog-view__modalFeaturesList {
        margin: 0;
        padding-left: 1.25rem;
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.375rem;
    }

    .catalog-view__modalFeaturesList li {
        font-size: 0.875rem;
        color: #475569;
    }

    /* Card Actions Container */
    .catalog-view__cardActions {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-top: 0.75rem;
    }

    /* CTA Button Styles */
    .catalog-view__cardBtn--secondary {
        background: #64748b;
    }

    .catalog-view__cardBtn--secondary:hover {
        background: #475569;
    }

    .catalog-view__cardBtn--outline {
        background: transparent;
        color: #0f172a;
        border: 1.5px solid #e2e8f0;
    }

    .catalog-view__cardBtn--outline:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
    }

    .catalog-view__cardBtn--ghost {
        background: transparent;
        color: #3b82f6;
    }

    .catalog-view__cardBtn--ghost:hover {
        background: #eff6ff;
    }

    /* List Button Styles */
    .catalog-view__listBtn--secondary {
        background: #64748b;
    }

    .catalog-view__listBtn--secondary:hover {
        background: #475569;
    }

    .catalog-view__listBtn--outline {
        background: transparent;
        color: #0f172a;
        border: 1.5px solid #e2e8f0;
    }

    .catalog-view__listBtn--outline:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
    }

    .catalog-view__listBtn--ghost {
        background: transparent;
        color: #3b82f6;
    }

    .catalog-view__listBtn--ghost:hover {
        background: #eff6ff;
    }

    /* Modal CTA Container */
    .catalog-view__modalCTAs {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-top: 1.5rem;
        padding-top: 1.5rem;
        border-top: 1px solid #e2e8f0;
    }

    .catalog-view__modalCTA {
        flex: 1;
        min-width: 140px;
        padding: 0.75rem 1.25rem;
        border: none;
        border-radius: 0.5rem;
        font-size: 0.9375rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .catalog-view__modalCTA--primary {
        background: #0f172a;
        color: #ffffff;
    }

    .catalog-view__modalCTA--primary:hover {
        background: #1e293b;
    }

    .catalog-view__modalCTA--secondary {
        background: #64748b;
        color: #ffffff;
    }

    .catalog-view__modalCTA--secondary:hover {
        background: #475569;
    }

    .catalog-view__modalCTA--outline {
        background: transparent;
        color: #0f172a;
        border: 1.5px solid #e2e8f0;
    }

    .catalog-view__modalCTA--outline:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
    }

    .catalog-view__modalCTA--ghost {
        background: transparent;
        color: #3b82f6;
    }

    .catalog-view__modalCTA--ghost:hover {
        background: #eff6ff;
    }

    @media (max-width: 768px) {
        .catalog-view__modalContent {
            grid-template-columns: 1fr;
        }

        .catalog-view__modalGallery {
            border-radius: 1rem 1rem 0 0;
        }

        .catalog-view__modalInfo {
            padding: 0 1.5rem 1.5rem;
        }

        .catalog-view__modalSpecsList,
        .catalog-view__modalFeaturesList {
            grid-template-columns: 1fr;
        }

        .catalog-view__modalCTAs {
            flex-direction: column;
        }

        .catalog-view__modalCTA {
            min-width: auto;
        }
    }
</style>
