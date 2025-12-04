<script lang="ts">
    import type { PluginContext } from '../context';
    import { 
        Bike, Building2, ExternalLink, Copy, Check, ChevronDown, ChevronRight,
        Search, LayoutGrid, List, Plus, Star, SlidersHorizontal, Layers
    } from '@lucide/svelte';

    let { ctx }: { ctx: PluginContext } = $props();

    // Types for catalog data
    interface CatalogOem {
        id: string;
        name: string;
        logo_url?: string;
        website_url?: string;
        description?: string;
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
        description?: string;
        status: string;
    }

    // Get catalog data from site metadata
    const oems = $derived<CatalogOem[]>((ctx.siteMetadata.catalogOems as CatalogOem[]) ?? []);
    const vehicles = $derived<CatalogVehicle[]>((ctx.siteMetadata.catalogVehicles as CatalogVehicle[]) ?? []);

    // State
    let activeTab = $state<'sections' | 'vehicles'>('sections');
    let searchQuery = $state('');
    let selectedOemId = $state<string | null>(null);
    let selectedCategory = $state<string>('all');
    let expandedOems = $state<Set<string>>(new Set());
    let copiedVehicleId = $state<string | null>(null);
    let selectedVehicles = $state<Set<string>>(new Set());

    // Catalog View Configuration
    let catalogConfig = $state({
        viewMode: 'grid' as 'grid' | 'list',
        gridColumns: 3 as 2 | 3 | 4,
        itemsPerPage: 12 as 6 | 9 | 12 | 18 | 24,
        filterPosition: 'left' as 'left' | 'right' | 'top',
        showFilters: true,
        showSearch: true,
        showPrices: true,
        showPagination: true
    });

    // Featured Vehicles Configuration
    let featuredConfig = $state({
        displayMode: 'grid' as 'grid' | 'carousel' | 'showcase',
        columns: 4 as 2 | 3 | 4,
        limit: 4,
        showPrices: true,
        showCategory: true
    });

    // Categories
    const categories = [
        { value: 'all', label: 'All Categories' },
        { value: 'atv', label: 'ATV' },
        { value: 'utv', label: 'UTV' },
        { value: 'dirtbike', label: 'Dirt Bike' },
        { value: 'pitbike', label: 'Pit Bike' },
        { value: 'motorcycle', label: 'Motorcycle' },
        { value: 'electric', label: 'Electric' },
        { value: 'other', label: 'Other' }
    ];

    // Filtered vehicles
    const filteredVehicles = $derived(() => {
        let result = vehicles.filter(v => v.status === 'published');

        if (selectedOemId) {
            result = result.filter(v => v.oem_id === selectedOemId);
        }

        if (selectedCategory !== 'all') {
            result = result.filter(v => v.category === selectedCategory);
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(v =>
                v.model_name?.toLowerCase().includes(query) ||
                v.oem_name?.toLowerCase().includes(query)
            );
        }

        return result;
    });

    // Vehicles grouped by OEM
    const vehiclesByOem = $derived(() => {
        const grouped: Record<string, CatalogVehicle[]> = {};
        for (const vehicle of filteredVehicles()) {
            if (!grouped[vehicle.oem_id]) {
                grouped[vehicle.oem_id] = [];
            }
            grouped[vehicle.oem_id].push(vehicle);
        }
        return grouped;
    });

    // Actions
    const toggleOemExpanded = (oemId: string) => {
        const newSet = new Set(expandedOems);
        if (newSet.has(oemId)) {
            newSet.delete(oemId);
        } else {
            newSet.add(oemId);
        }
        expandedOems = newSet;
    };

    const toggleVehicleSelected = (vehicleId: string) => {
        const newSet = new Set(selectedVehicles);
        if (newSet.has(vehicleId)) {
            newSet.delete(vehicleId);
        } else {
            newSet.add(vehicleId);
        }
        selectedVehicles = newSet;
    };

    const copyVehicleEmbed = (vehicle: CatalogVehicle) => {
        const embedCode = `{{vehicle:${vehicle.id}}}`;
        navigator.clipboard.writeText(embedCode);
        copiedVehicleId = vehicle.id;
        setTimeout(() => {
            copiedVehicleId = null;
        }, 2000);
    };

    // Insert Full Catalog View (inventory page)
    const insertCatalogView = () => {
        ctx.addBlock('catalog-view', {
            viewMode: catalogConfig.viewMode,
            gridColumns: catalogConfig.gridColumns,
            itemsPerPage: catalogConfig.itemsPerPage,
            filterPosition: catalogConfig.filterPosition,
            showFilters: catalogConfig.showFilters,
            showSearch: catalogConfig.showSearch,
            showPrices: catalogConfig.showPrices,
            showPagination: catalogConfig.showPagination,
            showViewToggle: true,
            title: 'Vehicle Inventory',
            showHeader: true
        });
    };

    // Insert Featured Vehicles Section
    const insertFeaturedVehicles = () => {
        ctx.addBlock('featured-vehicles', {
            vehicleIds: Array.from(selectedVehicles),
            displayMode: featuredConfig.displayMode,
            columns: featuredConfig.columns,
            limit: featuredConfig.limit,
            showPrices: featuredConfig.showPrices,
            showCategory: featuredConfig.showCategory,
            title: 'Featured Vehicles',
            showHeader: true,
            showCta: true,
            ctaText: 'View All Vehicles',
            ctaLink: '/catalog'
        });
    };

    // Insert Catalog Grid (simpler version)
    const insertCatalogGrid = () => {
        ctx.addBlock('catalog-grid', {
            oemId: selectedOemId || undefined,
            category: selectedCategory !== 'all' ? selectedCategory : undefined,
            columns: 3,
            showFilters: true,
            showPrices: true,
            title: 'Our Vehicles'
        });
    };

    const formatPrice = (amount: number | undefined, currency: string = 'USD') => {
        if (!amount) return '';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    const getCategoryLabel = (category: string) => {
        const cat = categories.find(c => c.value === category);
        return cat?.label || category;
    };
</script>

<div class="catalog-plugin">
    <div class="catalog-plugin__header">
        <h3>Vehicle Catalog</h3>
    </div>

    {#if oems.length === 0 && vehicles.length === 0}
        <div class="catalog-plugin__empty">
            <Bike size={32} strokeWidth={1.5} />
            <p>No catalog attached</p>
            <p class="catalog-plugin__hint">
                Add vehicles to your catalog from the
                <a href="/catalog" target="_blank" rel="noopener">Catalog Dashboard</a>
            </p>
        </div>
    {:else}
        <!-- Tabs -->
        <div class="catalog-plugin__tabs">
            <button 
                class="catalog-plugin__tab" 
                class:active={activeTab === 'sections'}
                onclick={() => activeTab = 'sections'}
            >
                <Layers size={14} />
                Sections
            </button>
            <button 
                class="catalog-plugin__tab"
                class:active={activeTab === 'vehicles'}
                onclick={() => activeTab = 'vehicles'}
            >
                <Bike size={14} />
                Vehicles
            </button>
        </div>

        {#if activeTab === 'sections'}
            <!-- SECTIONS TAB -->
            <div class="catalog-plugin__section">
                <h4 class="catalog-plugin__sectionTitle">Full Catalog Page</h4>
                <p class="catalog-plugin__sectionDesc">
                    Complete inventory view with search, filters, and pagination
                </p>
                
                <!-- Catalog View Config -->
                <div class="catalog-plugin__config">
                    <div class="catalog-plugin__configRow">
                        <label>Default View</label>
                        <div class="catalog-plugin__toggleGroup">
                            <button 
                                class="catalog-plugin__toggleBtn"
                                class:active={catalogConfig.viewMode === 'grid'}
                                onclick={() => catalogConfig.viewMode = 'grid'}
                            >
                                <LayoutGrid size={14} />
                            </button>
                            <button 
                                class="catalog-plugin__toggleBtn"
                                class:active={catalogConfig.viewMode === 'list'}
                                onclick={() => catalogConfig.viewMode = 'list'}
                            >
                                <List size={14} />
                            </button>
                        </div>
                    </div>
                    <div class="catalog-plugin__configRow">
                        <label>Grid Columns</label>
                        <select bind:value={catalogConfig.gridColumns} class="catalog-plugin__configSelect">
                            <option value={2}>2 columns</option>
                            <option value={3}>3 columns</option>
                            <option value={4}>4 columns</option>
                        </select>
                    </div>
                    <div class="catalog-plugin__configRow">
                        <label>Items per Page</label>
                        <select bind:value={catalogConfig.itemsPerPage} class="catalog-plugin__configSelect">
                            <option value={6}>6</option>
                            <option value={9}>9</option>
                            <option value={12}>12</option>
                            <option value={18}>18</option>
                            <option value={24}>24</option>
                        </select>
                    </div>
                    <div class="catalog-plugin__configRow">
                        <label>Filter Position</label>
                        <select bind:value={catalogConfig.filterPosition} class="catalog-plugin__configSelect">
                            <option value="left">Left sidebar</option>
                            <option value="right">Right sidebar</option>
                            <option value="top">Top bar</option>
                        </select>
                    </div>
                    <div class="catalog-plugin__configRow">
                        <label class="catalog-plugin__checkbox">
                            <input type="checkbox" bind:checked={catalogConfig.showFilters} />
                            Show Filters
                        </label>
                    </div>
                    <div class="catalog-plugin__configRow">
                        <label class="catalog-plugin__checkbox">
                            <input type="checkbox" bind:checked={catalogConfig.showPrices} />
                            Show Prices
                        </label>
                    </div>
                </div>
                <button class="catalog-plugin__addBtn" onclick={insertCatalogView}>
                    <Plus size={14} />
                    Add Catalog Page
                </button>
            </div>

            <div class="catalog-plugin__divider"></div>

            <div class="catalog-plugin__section">
                <h4 class="catalog-plugin__sectionTitle">Featured Vehicles</h4>
                <p class="catalog-plugin__sectionDesc">
                    Showcase selected vehicles with different layouts
                </p>
                
                <!-- Featured Config -->
                <div class="catalog-plugin__config">
                    <div class="catalog-plugin__configRow">
                        <label>Display Mode</label>
                        <select bind:value={featuredConfig.displayMode} class="catalog-plugin__configSelect">
                            <option value="grid">Grid</option>
                            <option value="carousel">Carousel</option>
                            <option value="showcase">Showcase</option>
                        </select>
                    </div>
                    <div class="catalog-plugin__configRow">
                        <label>Columns</label>
                        <select bind:value={featuredConfig.columns} class="catalog-plugin__configSelect">
                            <option value={2}>2</option>
                            <option value={3}>3</option>
                            <option value={4}>4</option>
                        </select>
                    </div>
                    <div class="catalog-plugin__configRow">
                        <label>Max Vehicles</label>
                        <select bind:value={featuredConfig.limit} class="catalog-plugin__configSelect">
                            <option value={3}>3</option>
                            <option value={4}>4</option>
                            <option value={6}>6</option>
                            <option value={8}>8</option>
                        </select>
                    </div>
                </div>

                {#if selectedVehicles.size > 0}
                    <div class="catalog-plugin__selectedCount">
                        {selectedVehicles.size} vehicle{selectedVehicles.size !== 1 ? 's' : ''} selected
                    </div>
                {/if}

                <button 
                    class="catalog-plugin__addBtn"
                    onclick={insertFeaturedVehicles}
                >
                    <Star size={14} />
                    Add Featured Section
                </button>
            </div>

            <div class="catalog-plugin__divider"></div>

            <div class="catalog-plugin__section">
                <h4 class="catalog-plugin__sectionTitle">Simple Grid</h4>
                <p class="catalog-plugin__sectionDesc">
                    Basic vehicle grid with minimal options
                </p>
                <button class="catalog-plugin__addBtn catalog-plugin__addBtn--secondary" onclick={insertCatalogGrid}>
                    <LayoutGrid size={14} />
                    Add Simple Grid
                </button>
            </div>

        {:else}
            <!-- VEHICLES TAB -->
            <div class="catalog-plugin__filters">
                <div class="catalog-plugin__search">
                    <Search size={14} />
                    <input
                        type="text"
                        placeholder="Search vehicles..."
                        bind:value={searchQuery}
                    />
                </div>
                <select bind:value={selectedCategory} class="catalog-plugin__select">
                    {#each categories as cat}
                        <option value={cat.value}>{cat.label}</option>
                    {/each}
                </select>
            </div>

            <div class="catalog-plugin__stats">
                <span>{filteredVehicles().length} vehicle{filteredVehicles().length !== 1 ? 's' : ''}</span>
                {#if selectedVehicles.size > 0}
                    <span>•</span>
                    <span class="catalog-plugin__statsHighlight">{selectedVehicles.size} selected</span>
                {/if}
            </div>

            <div class="catalog-plugin__vehicleList">
                {#each filteredVehicles() as vehicle}
                    <label class="catalog-plugin__vehicleItem">
                        <input 
                            type="checkbox" 
                            checked={selectedVehicles.has(vehicle.id)}
                            onchange={() => toggleVehicleSelected(vehicle.id)}
                        />
                        <div class="catalog-plugin__vehicleThumb">
                            {#if vehicle.thumbnail_url}
                                <img src={vehicle.thumbnail_url} alt={vehicle.model_name} />
                            {:else}
                                <Bike size={16} />
                            {/if}
                        </div>
                        <div class="catalog-plugin__vehicleDetails">
                            <span class="catalog-plugin__vehicleName">
                                {#if vehicle.model_year}{vehicle.model_year}{/if}
                                {vehicle.model_name}
                            </span>
                            <span class="catalog-plugin__vehicleBrand">{vehicle.oem_name}</span>
                        </div>
                        {#if vehicle.msrp}
                            <span class="catalog-plugin__vehiclePrice">
                                {formatPrice(vehicle.msrp, vehicle.currency)}
                            </span>
                        {/if}
                    </label>
                {/each}
            </div>
        {/if}

        <div class="catalog-plugin__footer">
            <a href="/catalog" target="_blank" rel="noopener" class="catalog-plugin__link">
                <ExternalLink size={14} />
                Manage Catalog
            </a>
        </div>
    {/if}
</div>

<style>
    .catalog-plugin {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 1rem;
        height: 100%;
        overflow-y: auto;
    }

    .catalog-plugin__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 0.25rem;
    }

    .catalog-plugin__header h3 {
        margin: 0;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--krt-editor-text-primary, #0f172a);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .catalog-plugin__empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 2rem 1rem;
        text-align: center;
        color: var(--krt-editor-text-muted, #94a3b8);
    }

    .catalog-plugin__empty p {
        margin: 0;
        font-size: 0.875rem;
    }

    .catalog-plugin__hint {
        font-size: 0.8125rem !important;
        line-height: 1.5;
    }

    .catalog-plugin__hint a {
        color: var(--krt-editor-accent, #3b82f6);
        text-decoration: none;
    }

    .catalog-plugin__hint a:hover {
        text-decoration: underline;
    }

    .catalog-plugin__actions {
        display: flex;
        gap: 0.5rem;
    }

    .catalog-plugin__actionBtn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.375rem;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        background: var(--krt-editor-bg, #ffffff);
        color: var(--krt-editor-text-secondary, #64748b);
        font-size: 0.8125rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        font-family: inherit;
    }

    .catalog-plugin__actionBtn:hover {
        background: var(--krt-editor-surface-hover, #f1f5f9);
        border-color: var(--krt-editor-border-hover, #cbd5e1);
    }

    .catalog-plugin__actionBtn--primary {
        flex: 1;
        background: var(--krt-editor-accent, #3b82f6);
        border-color: var(--krt-editor-accent, #3b82f6);
        color: #ffffff;
    }

    .catalog-plugin__actionBtn--primary:hover {
        background: var(--krt-editor-accent-hover, #2563eb);
        border-color: var(--krt-editor-accent-hover, #2563eb);
    }

    .catalog-plugin__actionBtn--sm {
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
    }

    .catalog-plugin__filters {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .catalog-plugin__search {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        background: var(--krt-editor-surface, #f8fafc);
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        color: var(--krt-editor-text-muted, #94a3b8);
    }

    .catalog-plugin__search input {
        flex: 1;
        border: none;
        background: transparent;
        font-size: 0.8125rem;
        color: var(--krt-editor-text-primary, #0f172a);
        outline: none;
    }

    .catalog-plugin__search input::placeholder {
        color: var(--krt-editor-text-muted, #94a3b8);
    }

    .catalog-plugin__select {
        padding: 0.5rem 0.75rem;
        background: var(--krt-editor-surface, #f8fafc);
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        font-size: 0.8125rem;
        color: var(--krt-editor-text-primary, #0f172a);
        cursor: pointer;
    }

    .catalog-plugin__stats {
        display: flex;
        gap: 0.5rem;
        font-size: 0.75rem;
        color: var(--krt-editor-text-muted, #94a3b8);
        padding: 0 0.25rem;
    }

    .catalog-plugin__list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        flex: 1;
        overflow-y: auto;
    }

    .catalog-plugin__oemGroup {
        position: relative;
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-md, 0.5rem);
        overflow: hidden;
    }

    .catalog-plugin__oemHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 0.75rem;
        background: var(--krt-editor-surface, #f8fafc);
        border: none;
        cursor: pointer;
        transition: background 0.15s ease;
    }

    .catalog-plugin__oemHeader:hover {
        background: var(--krt-editor-surface-hover, #f1f5f9);
    }

    .catalog-plugin__oemInfo {
        display: flex;
        align-items: center;
        gap: 0.625rem;
    }

    .catalog-plugin__oemLogo {
        width: 28px;
        height: 28px;
        object-fit: contain;
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
    }

    .catalog-plugin__oemIcon {
        width: 28px;
        height: 28px;
        display: grid;
        place-items: center;
        background: var(--krt-editor-bg, #ffffff);
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        color: var(--krt-editor-text-muted, #94a3b8);
    }

    .catalog-plugin__oemDetails {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.125rem;
    }

    .catalog-plugin__oemName {
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--krt-editor-text-primary, #0f172a);
    }

    .catalog-plugin__oemCount {
        font-size: 0.6875rem;
        color: var(--krt-editor-text-muted, #94a3b8);
    }

    .catalog-plugin__oemActions {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        color: var(--krt-editor-text-muted, #94a3b8);
    }

    .catalog-plugin__oemAddBtn {
        position: absolute;
        top: 0.5rem;
        right: 2rem;
        width: 24px;
        height: 24px;
        display: grid;
        place-items: center;
        border: none;
        background: var(--krt-editor-accent, #3b82f6);
        color: #ffffff;
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.15s ease;
    }

    .catalog-plugin__oemGroup:hover .catalog-plugin__oemAddBtn {
        opacity: 1;
    }

    .catalog-plugin__oemAddBtn:hover {
        background: var(--krt-editor-accent-hover, #2563eb);
    }

    .catalog-plugin__iconBtn {
        width: 28px;
        height: 28px;
        display: grid;
        place-items: center;
        border: none;
        background: transparent;
        color: var(--krt-editor-text-muted, #94a3b8);
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .catalog-plugin__iconBtn:hover {
        background: var(--krt-editor-bg, #ffffff);
        color: var(--krt-editor-text-primary, #0f172a);
    }

    .catalog-plugin__vehicles {
        display: flex;
        flex-direction: column;
        border-top: 1px solid var(--krt-editor-border, #e2e8f0);
    }

    .catalog-plugin__vehicleCard {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        padding: 0.625rem 0.75rem;
        background: var(--krt-editor-bg, #ffffff);
        border-bottom: 1px solid var(--krt-editor-border, #e2e8f0);
    }

    .catalog-plugin__vehicleCard:last-child {
        border-bottom: none;
    }

    .catalog-plugin__vehicleImg {
        width: 48px;
        height: 36px;
        object-fit: cover;
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        background: var(--krt-editor-surface, #f8fafc);
    }

    .catalog-plugin__vehiclePlaceholder {
        width: 48px;
        height: 36px;
        display: grid;
        place-items: center;
        background: var(--krt-editor-surface, #f8fafc);
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        color: var(--krt-editor-text-muted, #94a3b8);
    }

    .catalog-plugin__vehicleInfo {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
    }

    .catalog-plugin__vehicleName {
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--krt-editor-text-primary, #0f172a);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .catalog-plugin__vehicleMeta {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.6875rem;
    }

    .catalog-plugin__vehicleCategory {
        color: var(--krt-editor-text-muted, #94a3b8);
    }

    .catalog-plugin__vehiclePrice {
        color: var(--krt-editor-accent, #3b82f6);
        font-weight: 600;
    }

    .catalog-plugin__vehicleActions {
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }

    .catalog-plugin__emptyVehicles {
        padding: 1rem;
        text-align: center;
        font-size: 0.75rem;
        color: var(--krt-editor-text-muted, #94a3b8);
        background: var(--krt-editor-bg, #ffffff);
    }

    .catalog-plugin__footer {
        padding-top: 0.5rem;
        border-top: 1px solid var(--krt-editor-border, #e2e8f0);
    }

    .catalog-plugin__link {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        font-size: 0.8125rem;
        color: var(--krt-editor-text-secondary, #64748b);
        text-decoration: none;
    }

    .catalog-plugin__link:hover {
        color: var(--krt-editor-accent, #3b82f6);
    }

    /* Tabs */
    .catalog-plugin__tabs {
        display: flex;
        gap: 0.25rem;
        padding: 0.25rem;
        background: var(--krt-editor-surface, #f8fafc);
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
    }

    .catalog-plugin__tab {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.375rem;
        padding: 0.5rem 0.75rem;
        border: none;
        background: transparent;
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--krt-editor-text-muted, #94a3b8);
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .catalog-plugin__tab:hover {
        color: var(--krt-editor-text-primary, #0f172a);
    }

    .catalog-plugin__tab.active {
        background: var(--krt-editor-bg, #ffffff);
        color: var(--krt-editor-text-primary, #0f172a);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    /* Sections */
    .catalog-plugin__section {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .catalog-plugin__sectionTitle {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--krt-editor-text-primary, #0f172a);
    }

    .catalog-plugin__sectionDesc {
        margin: 0;
        font-size: 0.75rem;
        color: var(--krt-editor-text-muted, #94a3b8);
        line-height: 1.4;
    }

    .catalog-plugin__divider {
        height: 1px;
        background: var(--krt-editor-border, #e2e8f0);
        margin: 0.5rem 0;
    }

    /* Config */
    .catalog-plugin__config {
        display: flex;
        flex-direction: column;
        gap: 0.625rem;
        padding: 0.75rem;
        background: var(--krt-editor-surface, #f8fafc);
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
    }

    .catalog-plugin__configRow {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
    }

    .catalog-plugin__configRow > label {
        font-size: 0.75rem;
        color: var(--krt-editor-text-secondary, #64748b);
    }

    .catalog-plugin__configSelect {
        padding: 0.375rem 0.5rem;
        background: var(--krt-editor-bg, #ffffff);
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        font-size: 0.75rem;
        color: var(--krt-editor-text-primary, #0f172a);
        cursor: pointer;
    }

    .catalog-plugin__toggleGroup {
        display: flex;
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        overflow: hidden;
    }

    .catalog-plugin__toggleBtn {
        padding: 0.375rem 0.5rem;
        border: none;
        background: var(--krt-editor-bg, #ffffff);
        color: var(--krt-editor-text-muted, #94a3b8);
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .catalog-plugin__toggleBtn:first-child {
        border-right: 1px solid var(--krt-editor-border, #e2e8f0);
    }

    .catalog-plugin__toggleBtn:hover {
        background: var(--krt-editor-surface, #f8fafc);
    }

    .catalog-plugin__toggleBtn.active {
        background: var(--krt-editor-accent, #3b82f6);
        color: #ffffff;
    }

    .catalog-plugin__checkbox {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.75rem;
        color: var(--krt-editor-text-secondary, #64748b);
        cursor: pointer;
    }

    .catalog-plugin__checkbox input {
        accent-color: var(--krt-editor-accent, #3b82f6);
    }

    .catalog-plugin__selectedCount {
        padding: 0.5rem 0.75rem;
        background: var(--krt-editor-accent, #3b82f6);
        background: rgba(59, 130, 246, 0.1);
        color: var(--krt-editor-accent, #3b82f6);
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        font-size: 0.75rem;
        font-weight: 500;
        text-align: center;
    }

    .catalog-plugin__addBtn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.375rem;
        padding: 0.625rem 1rem;
        background: var(--krt-editor-accent, #3b82f6);
        border: none;
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        color: #ffffff;
        font-size: 0.8125rem;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s ease;
    }

    .catalog-plugin__addBtn:hover {
        background: var(--krt-editor-accent-hover, #2563eb);
    }

    .catalog-plugin__addBtn--secondary {
        background: transparent;
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        color: var(--krt-editor-text-secondary, #64748b);
    }

    .catalog-plugin__addBtn--secondary:hover {
        background: var(--krt-editor-surface, #f8fafc);
        border-color: var(--krt-editor-border-hover, #cbd5e1);
    }

    /* Vehicle List */
    .catalog-plugin__vehicleList {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        flex: 1;
        overflow-y: auto;
    }

    .catalog-plugin__vehicleItem {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        padding: 0.5rem 0.625rem;
        background: var(--krt-editor-bg, #ffffff);
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .catalog-plugin__vehicleItem:hover {
        border-color: var(--krt-editor-accent, #3b82f6);
    }

    .catalog-plugin__vehicleItem:has(input:checked) {
        background: rgba(59, 130, 246, 0.05);
        border-color: var(--krt-editor-accent, #3b82f6);
    }

    .catalog-plugin__vehicleItem input {
        accent-color: var(--krt-editor-accent, #3b82f6);
    }

    .catalog-plugin__vehicleThumb {
        width: 40px;
        height: 30px;
        display: grid;
        place-items: center;
        background: var(--krt-editor-surface, #f8fafc);
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        overflow: hidden;
        color: var(--krt-editor-text-muted, #94a3b8);
    }

    .catalog-plugin__vehicleThumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .catalog-plugin__vehicleDetails {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
    }

    .catalog-plugin__vehicleBrand {
        font-size: 0.6875rem;
        color: var(--krt-editor-text-muted, #94a3b8);
    }

    .catalog-plugin__statsHighlight {
        color: var(--krt-editor-accent, #3b82f6);
        font-weight: 500;
    }
</style>
