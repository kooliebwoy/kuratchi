<script lang="ts">
    import { onMount, getContext } from 'svelte';
    import { Bike, Search, Filter, ChevronDown, X, ChevronLeft, ChevronRight } from '@lucide/svelte';
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
    import SectionLayoutControls from './SectionLayoutControls.svelte';
    import { type SectionLayout, getSectionLayoutStyles, mergeLayoutWithDefaults } from './section-layout.js';
    import { openFormModal, openVehicleInquiryModal, type AfterSubmitAction } from '../plugins/modals/modal-manager.svelte.js';

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

    interface LeadCTA {
        id: string;
        label: string;
        formId?: string;
        style: 'primary' | 'secondary' | 'outline' | 'ghost';
        icon?: string;
        afterSubmitAction?: AfterSubmitAction;
        afterSubmitMessage?: string;
        afterSubmitUrl?: string;
        prefillMapping?: Record<string, string>;
    }

    // Get catalog data from context (provided by Editor)
    const siteMetadata = getContext<{
        catalogOems: CatalogOem[];
        catalogVehicles: CatalogVehicle[];
        forms?: { id: string; name: string; fields: any[] }[];
    }>('siteMetadata');

    interface Props {
        id?: string;
        type?: string;
        editable?: boolean;
        oemId?: string;
        category?: string;
        columns?: number;
        showFilters?: boolean;
        showPrices?: boolean;
        title?: string;
        subtitle?: string;
        layout?: Partial<SectionLayout>;
        vehicles?: CatalogVehicle[];
        oems?: CatalogOem[];
        isEditing?: boolean;
        onLayoutChange?: (layout: SectionLayout) => void;
        // Vehicle details configuration
        detailsMode?: 'modal' | 'page';
        detailsPagePattern?: string;
        // Lead CTAs
        listCTAs?: LeadCTA[];
        detailCTAs?: LeadCTA[];
    }

    let {
        id = crypto.randomUUID(),
        type = 'catalog-grid',
        editable = true,
        oemId,
        category,
        columns = 3,
        showFilters = true,
        showPrices = true,
        title = '',
        subtitle = '',
        layout = {},
        vehicles: vehiclesProp = [],
        oems: oemsProp = [],
        isEditing = false,
        onLayoutChange,
        detailsMode = 'modal',
        detailsPagePattern = '/vehicles/{slug}',
        listCTAs = [],
        detailCTAs = []
    }: Props = $props();

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
        oemId,
        category,
        columns,
        showFilters,
        showPrices,
        title,
        subtitle,
        listCTAs,
        detailCTAs,
        layout
    });

    onMount(() => {
        if (!editable) return;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
        return () => blockRegistry.unregister(componentRef);
    });

    // Merge layout with defaults
    const mergedLayout = $derived(mergeLayoutWithDefaults(layout));
    const layoutStyles = $derived(getSectionLayoutStyles(mergedLayout));

    // Filter state
    let searchQuery = $state('');
    let selectedOem = $state(oemId || 'all');
    let selectedCategory = $state(category || 'all');
    let showFilterDropdown = $state(false);

    // Vehicle details modal state
    let showDetailsModal = $state(false);
    let selectedVehicle = $state<CatalogVehicle | null>(null);
    let currentImageIndex = $state(0);

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

    // Filtered vehicles
    const filteredVehicles = $derived(() => {
        let result = vehicles.filter(v => v.status === 'published');

        if (selectedOem !== 'all') {
            result = result.filter(v => v.oem_id === selectedOem);
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

    const handleLayoutChange = (newLayout: SectionLayout) => {
        if (onLayoutChange) {
            onLayoutChange(newLayout);
        }
    };

    // Vehicle details handlers
    const handleViewDetails = (vehicle: CatalogVehicle) => {
        if (detailsMode === 'page') {
            // Navigate to vehicle detail page
            const slug = vehicle.model_name.toLowerCase().replace(/\s+/g, '-');
            const url = detailsPagePattern
                .replace('{id}', vehicle.id)
                .replace('{slug}', slug);
            window.location.href = url;
        } else {
            // Show modal
            selectedVehicle = vehicle;
            currentImageIndex = 0;
            showDetailsModal = true;
        }
    };

    const closeDetailsModal = () => {
        showDetailsModal = false;
        selectedVehicle = null;
        currentImageIndex = 0;
    };

    // Handle Lead CTA click
    const handleLeadCTA = (cta: LeadCTA, vehicle: CatalogVehicle) => {
        const prefillData: Record<string, string> = {};
        
        // Build prefill data based on mapping
        if (cta.prefillMapping) {
            Object.entries(cta.prefillMapping).forEach(([formField, vehicleField]) => {
                const value = vehicleField === 'name' 
                    ? `${vehicle.model_year || ''} ${vehicle.oem_name} ${vehicle.model_name}`.trim()
                    : vehicleField === 'price' 
                        ? vehicle.msrp?.toString() || ''
                        : vehicleField === 'category'
                            ? vehicle.category
                            : vehicleField === 'oem'
                                ? vehicle.oem_name
                                : (vehicle as any)[vehicleField] || '';
                if (value) prefillData[formField] = value;
            });
        } else {
            // Default prefill: vehicle name
            prefillData['vehicle'] = `${vehicle.model_year || ''} ${vehicle.oem_name} ${vehicle.model_name}`.trim();
            prefillData['vehicle_id'] = vehicle.id;
        }

        const afterSubmitAction: AfterSubmitAction = cta.afterSubmitAction || {
            type: cta.afterSubmitUrl ? 'redirect' : cta.afterSubmitMessage ? 'message' : 'close',
            url: cta.afterSubmitUrl,
            message: cta.afterSubmitMessage
        };

        const vehicleName = `${vehicle.model_year || ''} ${vehicle.oem_name} ${vehicle.model_name}`.trim();

        if (cta.formId) {
            openFormModal({
                formId: cta.formId,
                title: `${cta.label} - ${vehicleName}`,
                prefillData,
                afterSubmit: afterSubmitAction
            });
        } else {
            // Open generic vehicle inquiry modal with a default form
            openVehicleInquiryModal({
                vehicleId: vehicle.id,
                vehicleName,
                formId: 'vehicle-inquiry',
                additionalData: {
                    vehicle_price: vehicle.msrp?.toString() || '',
                    vehicle_category: vehicle.category,
                    vehicle_oem: vehicle.oem_name
                },
                afterSubmit: afterSubmitAction
            });
        }
    };

    const nextImage = () => {
        if (selectedVehicle?.images && selectedVehicle.images.length > 0) {
            currentImageIndex = (currentImageIndex + 1) % selectedVehicle.images.length;
        }
    };

    const prevImage = () => {
        if (selectedVehicle?.images && selectedVehicle.images.length > 0) {
            currentImageIndex = (currentImageIndex - 1 + selectedVehicle.images.length) % selectedVehicle.images.length;
        }
    };
</script>

<section class="catalog-grid" class:editor-item={editable} style={layoutStyles} bind:this={component}>
    {#if isEditing}
        <SectionLayoutControls
            layout={mergedLayout}
            onchange={handleLayoutChange}
        />
    {/if}

    <div class="catalog-grid__container">
        <!-- Header -->
        <div class="catalog-grid__header">
            {#if title}
                <h2 class="catalog-grid__title">{title}</h2>
            {/if}
            {#if subtitle}
                <p class="catalog-grid__subtitle">{subtitle}</p>
            {/if}
        </div>

        <!-- Filters -->
        {#if showFilters}
            <div class="catalog-grid__filters">
                <div class="catalog-grid__search">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search vehicles..."
                        bind:value={searchQuery}
                    />
                </div>

                <div class="catalog-grid__filterGroup">
                    {#if oems.length > 1}
                        <select bind:value={selectedOem} class="catalog-grid__select">
                            <option value="all">All Brands</option>
                            {#each oems as oem}
                                <option value={oem.id}>{oem.name}</option>
                            {/each}
                        </select>
                    {/if}

                    <select bind:value={selectedCategory} class="catalog-grid__select">
                        {#each categories as cat}
                            <option value={cat.value}>{cat.label}</option>
                        {/each}
                    </select>
                </div>
            </div>
        {/if}

        <!-- Results count -->
        <div class="catalog-grid__results">
            {filteredVehicles().length} vehicle{filteredVehicles().length !== 1 ? 's' : ''} found
        </div>

        <!-- Grid -->
        {#if filteredVehicles().length === 0}
            <div class="catalog-grid__empty">
                <Bike size={48} strokeWidth={1} />
                <p>No vehicles found</p>
                <p class="catalog-grid__emptyHint">Try adjusting your filters</p>
            </div>
        {:else}
            <div
                class="catalog-grid__grid"
                style="--columns: {columns}"
            >
                {#each filteredVehicles() as vehicle}
                    <article class="catalog-grid__card">
                        <div class="catalog-grid__cardImage">
                            {#if vehicle.thumbnail_url}
                                <img src={vehicle.thumbnail_url} alt={vehicle.model_name} />
                            {:else}
                                <div class="catalog-grid__cardPlaceholder">
                                    <Bike size={32} />
                                </div>
                            {/if}
                            <span class="catalog-grid__cardCategory">
                                {getCategoryLabel(vehicle.category)}
                            </span>
                        </div>
                        <div class="catalog-grid__cardContent">
                            <span class="catalog-grid__cardBrand">{vehicle.oem_name}</span>
                            <h3 class="catalog-grid__cardTitle">
                                {#if vehicle.model_year}{vehicle.model_year}{/if}
                                {vehicle.model_name}
                            </h3>
                            {#if showPrices && vehicle.msrp}
                                <span class="catalog-grid__cardPrice">
                                    {formatPrice(vehicle.msrp, vehicle.currency)}
                                </span>
                            {/if}
                            <div class="catalog-grid__cardActions">
                                <button class="catalog-grid__cardBtn" onclick={() => handleViewDetails(vehicle)}>
                                    View Details
                                </button>
                                {#each listCTAs as cta (cta.id)}
                                    <button 
                                        class="catalog-grid__cardBtn catalog-grid__cardBtn--{cta.style}"
                                        onclick={() => handleLeadCTA(cta, vehicle)}
                                    >
                                        {cta.label}
                                    </button>
                                {/each}
                            </div>
                        </div>
                    </article>
                {/each}
            </div>
        {/if}
    </div>

    <!-- Vehicle Details Modal -->
    {#if showDetailsModal && selectedVehicle}
        <div 
            class="catalog-grid__modal-backdrop"
            onclick={closeDetailsModal}
            onkeydown={(e) => e.key === 'Escape' && closeDetailsModal()}
            role="button"
            tabindex="0"
            aria-label="Close modal"
        >
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <div 
                class="catalog-grid__modal"
                onclick={(e) => e.stopPropagation()}
                onkeydown={(e) => e.stopPropagation()}
                role="document"
            >
                <button class="catalog-grid__modal-close" onclick={closeDetailsModal} aria-label="Close">
                    <X size={24} />
                </button>

                <div class="catalog-grid__modal-content">
                    <!-- Image Gallery -->
                    <div class="catalog-grid__modal-gallery">
                        {#if selectedVehicle.images && selectedVehicle.images.length > 0}
                            <div class="catalog-grid__modal-image">
                                <img 
                                    src={selectedVehicle.images[currentImageIndex]} 
                                    alt="{selectedVehicle.model_name} - Image {currentImageIndex + 1}"
                                />
                                {#if selectedVehicle.images.length > 1}
                                    <button class="catalog-grid__modal-nav catalog-grid__modal-nav--prev" onclick={prevImage} aria-label="Previous image">
                                        <ChevronLeft size={24} />
                                    </button>
                                    <button class="catalog-grid__modal-nav catalog-grid__modal-nav--next" onclick={nextImage} aria-label="Next image">
                                        <ChevronRight size={24} />
                                    </button>
                                    <div class="catalog-grid__modal-dots">
                                        {#each selectedVehicle.images as _, i}
                                            <button
                                                class="catalog-grid__modal-dot"
                                                class:active={i === currentImageIndex}
                                                onclick={() => currentImageIndex = i}
                                                aria-label="Go to image {i + 1}"
                                            ></button>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                        {:else if selectedVehicle.thumbnail_url}
                            <div class="catalog-grid__modal-image">
                                <img src={selectedVehicle.thumbnail_url} alt={selectedVehicle.model_name} />
                            </div>
                        {:else}
                            <div class="catalog-grid__modal-placeholder">
                                <Bike size={64} />
                            </div>
                        {/if}
                    </div>

                    <!-- Vehicle Details -->
                    <div class="catalog-grid__modal-details">
                        <span class="catalog-grid__modal-brand">{selectedVehicle.oem_name}</span>
                        <h2 class="catalog-grid__modal-title">
                            {#if selectedVehicle.model_year}{selectedVehicle.model_year}{/if}
                            {selectedVehicle.model_name}
                        </h2>
                        <span class="catalog-grid__modal-category">{getCategoryLabel(selectedVehicle.category)}</span>

                        {#if selectedVehicle.msrp}
                            <div class="catalog-grid__modal-price">
                                {formatPrice(selectedVehicle.msrp, selectedVehicle.currency)}
                            </div>
                        {/if}

                        {#if selectedVehicle.description}
                            <p class="catalog-grid__modal-description">{selectedVehicle.description}</p>
                        {/if}

                        {#if selectedVehicle.specifications && Object.keys(selectedVehicle.specifications).length > 0}
                            <div class="catalog-grid__modal-specs">
                                <h3>Specifications</h3>
                                <div class="catalog-grid__modal-specs-grid">
                                    {#each Object.entries(selectedVehicle.specifications) as [key, value]}
                                        <div class="catalog-grid__modal-spec">
                                            <span class="catalog-grid__modal-spec-label">{key}</span>
                                            <span class="catalog-grid__modal-spec-value">{value}</span>
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/if}

                        {#if selectedVehicle.features && selectedVehicle.features.length > 0}
                            <div class="catalog-grid__modal-features">
                                <h3>Features</h3>
                                <ul>
                                    {#each selectedVehicle.features as feature}
                                        <li>{feature}</li>
                                    {/each}
                                </ul>
                            </div>
                        {/if}
                        
                        {#if detailCTAs.length > 0}
                            <div class="catalog-grid__modalCTAs">
                                {#each detailCTAs as cta (cta.id)}
                                    <button 
                                        class="catalog-grid__modalCTA catalog-grid__modalCTA--{cta.style}"
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
</section>

<style>
    .catalog-grid {
        position: relative;
        padding: var(--section-padding-y, 4rem) var(--section-padding-x, 2rem);
        background: var(--section-bg, #ffffff);
    }

    .catalog-grid__container {
        max-width: var(--section-max-width, 1200px);
        margin: 0 auto;
    }

    .catalog-grid__header {
        text-align: center;
        margin-bottom: 2rem;
    }

    .catalog-grid__title {
        margin: 0 0 0.5rem;
        font-size: 2.25rem;
        font-weight: 700;
        color: #0f172a;
    }

    .catalog-grid__subtitle {
        margin: 0;
        font-size: 1.125rem;
        color: #64748b;
    }

    .catalog-grid__filters {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        margin-bottom: 1.5rem;
        padding: 1rem;
        background: #f8fafc;
        border-radius: 0.75rem;
    }

    .catalog-grid__search {
        flex: 1;
        min-width: 200px;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        color: #94a3b8;
    }

    .catalog-grid__search input {
        flex: 1;
        border: none;
        background: transparent;
        font-size: 0.9375rem;
        color: #0f172a;
        outline: none;
    }

    .catalog-grid__search input::placeholder {
        color: #94a3b8;
    }

    .catalog-grid__filterGroup {
        display: flex;
        gap: 0.75rem;
    }

    .catalog-grid__select {
        padding: 0.75rem 1rem;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        font-size: 0.9375rem;
        color: #0f172a;
        cursor: pointer;
        min-width: 150px;
    }

    .catalog-grid__results {
        margin-bottom: 1rem;
        font-size: 0.875rem;
        color: #64748b;
    }

    .catalog-grid__empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        padding: 4rem 2rem;
        text-align: center;
        color: #94a3b8;
    }

    .catalog-grid__empty p {
        margin: 0;
        font-size: 1.125rem;
    }

    .catalog-grid__emptyHint {
        font-size: 0.875rem !important;
    }

    .catalog-grid__grid {
        display: grid;
        grid-template-columns: repeat(var(--columns, 3), 1fr);
        gap: 1.5rem;
    }

    @media (max-width: 1024px) {
        .catalog-grid__grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }

    @media (max-width: 640px) {
        .catalog-grid__grid {
            grid-template-columns: 1fr;
        }

        .catalog-grid__filters {
            flex-direction: column;
        }

        .catalog-grid__filterGroup {
            flex-direction: column;
        }
    }

    .catalog-grid__card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        overflow: hidden;
        transition: all 0.2s ease;
    }

    .catalog-grid__card:hover {
        box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.1);
        transform: translateY(-2px);
    }

    .catalog-grid__cardImage {
        position: relative;
        aspect-ratio: 4/3;
        background: #f8fafc;
    }

    .catalog-grid__cardImage img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .catalog-grid__cardPlaceholder {
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
        color: #cbd5e1;
    }

    .catalog-grid__cardCategory {
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

    .catalog-grid__cardContent {
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
    }

    .catalog-grid__cardBrand {
        font-size: 0.75rem;
        font-weight: 600;
        color: #3b82f6;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .catalog-grid__cardTitle {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 600;
        color: #0f172a;
    }

    .catalog-grid__cardPrice {
        font-size: 1.25rem;
        font-weight: 700;
        color: #059669;
        margin-top: 0.25rem;
    }

    .catalog-grid__cardBtn {
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

    .catalog-grid__cardBtn:hover {
        background: #1e293b;
    }

    /* Modal Styles */
    .catalog-grid__modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.75);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        overflow-y: auto;
    }

    .catalog-grid__modal {
        position: relative;
        background: #ffffff;
        border-radius: 1rem;
        max-width: 900px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }

    .catalog-grid__modal-close {
        position: absolute;
        top: 1rem;
        right: 1rem;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.9);
        border: none;
        border-radius: 50%;
        cursor: pointer;
        z-index: 10;
        transition: background 0.15s ease;
    }

    .catalog-grid__modal-close:hover {
        background: #f1f5f9;
    }

    .catalog-grid__modal-content {
        display: grid;
        grid-template-columns: 1fr;
    }

    @media (min-width: 768px) {
        .catalog-grid__modal-content {
            grid-template-columns: 1fr 1fr;
        }
    }

    .catalog-grid__modal-gallery {
        position: relative;
        background: #f8fafc;
    }

    .catalog-grid__modal-image {
        position: relative;
        aspect-ratio: 4/3;
    }

    .catalog-grid__modal-image img {
        width: 100%;
        height: 100%;
        object-fit: contain;
    }

    .catalog-grid__modal-placeholder {
        aspect-ratio: 4/3;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f1f5f9;
        color: #94a3b8;
    }

    .catalog-grid__modal-nav {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.9);
        border: none;
        border-radius: 50%;
        cursor: pointer;
        transition: background 0.15s ease;
    }

    .catalog-grid__modal-nav:hover {
        background: #ffffff;
    }

    .catalog-grid__modal-nav--prev {
        left: 0.75rem;
    }

    .catalog-grid__modal-nav--next {
        right: 0.75rem;
    }

    .catalog-grid__modal-dots {
        position: absolute;
        bottom: 1rem;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 0.5rem;
    }

    .catalog-grid__modal-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.5);
        border: none;
        cursor: pointer;
        transition: background 0.15s ease;
    }

    .catalog-grid__modal-dot.active {
        background: #ffffff;
    }

    .catalog-grid__modal-details {
        padding: 2rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .catalog-grid__modal-brand {
        font-size: 0.875rem;
        font-weight: 600;
        color: #3b82f6;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .catalog-grid__modal-title {
        margin: 0;
        font-size: 1.75rem;
        font-weight: 700;
        color: #0f172a;
        line-height: 1.2;
    }

    .catalog-grid__modal-category {
        display: inline-block;
        padding: 0.25rem 0.75rem;
        background: #f1f5f9;
        color: #64748b;
        font-size: 0.75rem;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border-radius: 9999px;
        width: fit-content;
    }

    .catalog-grid__modal-price {
        font-size: 1.5rem;
        font-weight: 700;
        color: #059669;
        margin-top: 0.5rem;
    }

    .catalog-grid__modal-description {
        margin: 0.5rem 0;
        color: #475569;
        line-height: 1.6;
    }

    .catalog-grid__modal-specs {
        margin-top: 1rem;
    }

    .catalog-grid__modal-specs h3 {
        margin: 0 0 0.75rem;
        font-size: 1rem;
        font-weight: 600;
        color: #0f172a;
    }

    .catalog-grid__modal-specs-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.5rem;
    }

    .catalog-grid__modal-spec {
        display: flex;
        flex-direction: column;
        padding: 0.75rem;
        background: #f8fafc;
        border-radius: 0.5rem;
    }

    .catalog-grid__modal-spec-label {
        font-size: 0.75rem;
        color: #64748b;
        margin-bottom: 0.25rem;
    }

    .catalog-grid__modal-spec-value {
        font-weight: 600;
        color: #0f172a;
    }

    .catalog-grid__modal-features {
        margin-top: 1rem;
    }

    .catalog-grid__modal-features h3 {
        margin: 0 0 0.75rem;
        font-size: 1rem;
        font-weight: 600;
        color: #0f172a;
    }

    .catalog-grid__modal-features ul {
        margin: 0;
        padding-left: 1.25rem;
        display: grid;
        gap: 0.375rem;
    }

    .catalog-grid__modal-features li {
        color: #475569;
        line-height: 1.5;
    }

    /* Lead CTA Buttons */
    .catalog-grid__cardActions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: auto;
        padding-top: 0.75rem;
    }

    .catalog-grid__modalCTAs {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-top: 1.5rem;
        padding-top: 1.5rem;
        border-top: 1px solid #e2e8f0;
    }

    /* Card Button Variants */
    .catalog-grid__cardBtn--primary {
        background: #2563eb;
        color: white;
    }

    .catalog-grid__cardBtn--primary:hover {
        background: #1d4ed8;
    }

    .catalog-grid__cardBtn--secondary {
        background: #64748b;
        color: white;
    }

    .catalog-grid__cardBtn--secondary:hover {
        background: #475569;
    }

    .catalog-grid__cardBtn--outline {
        background: transparent;
        border: 1px solid #2563eb;
        color: #2563eb;
    }

    .catalog-grid__cardBtn--outline:hover {
        background: #2563eb;
        color: white;
    }

    .catalog-grid__cardBtn--ghost {
        background: transparent;
        color: #2563eb;
    }

    .catalog-grid__cardBtn--ghost:hover {
        background: #eff6ff;
    }

    /* Modal CTA Variants */
    .catalog-grid__modalCTA {
        flex: 1;
        min-width: 140px;
        padding: 0.875rem 1.25rem;
        font-size: 0.9375rem;
        font-weight: 600;
        border-radius: 0.5rem;
        cursor: pointer;
        transition: all 0.2s ease;
        border: none;
    }

    .catalog-grid__modalCTA--primary {
        background: #2563eb;
        color: white;
    }

    .catalog-grid__modalCTA--primary:hover {
        background: #1d4ed8;
    }

    .catalog-grid__modalCTA--secondary {
        background: #64748b;
        color: white;
    }

    .catalog-grid__modalCTA--secondary:hover {
        background: #475569;
    }

    .catalog-grid__modalCTA--outline {
        background: transparent;
        border: 1px solid #2563eb;
        color: #2563eb;
    }

    .catalog-grid__modalCTA--outline:hover {
        background: #2563eb;
        color: white;
    }

    .catalog-grid__modalCTA--ghost {
        background: #f1f5f9;
        color: #2563eb;
    }

    .catalog-grid__modalCTA--ghost:hover {
        background: #e2e8f0;
    }

    @media (max-width: 767px) {
        .catalog-grid__modal {
            max-height: none;
        }

        .catalog-grid__modal-details {
            padding: 1.5rem;
        }

        .catalog-grid__modal-title {
            font-size: 1.5rem;
        }

        .catalog-grid__modal-specs-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
