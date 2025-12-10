<script lang="ts">
    import { onMount, getContext } from 'svelte';
    import { Bike, ChevronLeft, ChevronRight, X } from '@lucide/svelte';
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
    import SectionLayoutControls from './SectionLayoutControls.svelte';
    import { type SectionLayout, getSectionLayoutStyles, mergeLayoutWithDefaults } from './section-layout.js';
    import { openFormModal, openVehicleInquiryModal, type AfterSubmitAction } from '../plugins/modals/modal-manager.svelte.js';

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

    interface Props {
        // Identity
        id?: string;
        type?: string;
        editable?: boolean;
        
        // Featured vehicle IDs or filter criteria
        vehicleIds?: string[];
        oemId?: string;
        category?: string;
        limit?: number;
        
        // All vehicles (passed from siteMetadata)
        vehicles?: CatalogVehicle[];
        
        // Display options
        displayMode?: 'grid' | 'carousel' | 'showcase';
        columns?: 2 | 3 | 4;
        showPrices?: boolean;
        showCategory?: boolean;
        showDescription?: boolean;
        
        // Header
        title?: string;
        subtitle?: string;
        showHeader?: boolean;
        headerAlign?: 'left' | 'center';
        
        // CTA
        ctaText?: string;
        ctaLink?: string;
        showCta?: boolean;
        
        // Vehicle details configuration
        detailsMode?: 'modal' | 'page' | 'none';
        detailsPagePattern?: string;
        detailsButtonText?: string;
        
        // Lead CTAs
        listCTAs?: LeadCTA[];
        detailCTAs?: LeadCTA[];
        
        // Section layout
        layout?: Partial<SectionLayout>;
        isEditing?: boolean;
        onLayoutChange?: (layout: SectionLayout) => void;
    }

    // Get catalog data from context (provided by Editor)
    const siteMetadata = getContext<{
        catalogVehicles: CatalogVehicle[];
        forms?: { id: string; name: string; fields: any[] }[];
    }>('siteMetadata');

    let {
        id = crypto.randomUUID(),
        type = 'featured-vehicles',
        editable = true,
        vehicleIds = [],
        oemId,
        category,
        limit = 4,
        vehicles: vehiclesProp = [],
        displayMode = 'grid',
        columns = 4,
        showPrices = true,
        showCategory = true,
        showDescription = false,
        title = '',
        subtitle = '',
        showHeader = true,
        headerAlign = 'center',
        ctaText = 'View All Vehicles',
        ctaLink = '/catalog',
        showCta = true,
        detailsMode = 'modal',
        detailsPagePattern = '/vehicles/{id}',
        detailsButtonText = 'View Details',
        listCTAs = [],
        detailCTAs = [],
        layout = {},
        isEditing = false,
        onLayoutChange
    }: Props = $props();

    // Carousel state
    let carouselIndex = $state(0);
    let selectedVehicle = $state<CatalogVehicle | null>(null);
    let showDetailsModal = $state(false);

    // Use context data if props are empty, otherwise use props
    const vehicles = $derived(
        vehiclesProp.length > 0 ? vehiclesProp : (siteMetadata?.catalogVehicles || [])
    );

    // Handle vehicle details view
    const handleViewDetails = (vehicle: CatalogVehicle) => {
        if (detailsMode === 'none') return;
        
        if (detailsMode === 'page') {
            const url = detailsPagePattern
                .replace('{id}', vehicle.id)
                .replace('{slug}', vehicle.model_name.toLowerCase().replace(/\s+/g, '-'));
            window.location.href = url;
            return;
        }
        
        selectedVehicle = vehicle;
        showDetailsModal = true;
    };

    const closeDetailsModal = () => {
        showDetailsModal = false;
        selectedVehicle = null;
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
                formId: 'vehicle-inquiry', // Default inquiry form ID
                additionalData: {
                    vehicle_price: vehicle.msrp?.toString() || '',
                    vehicle_category: vehicle.category,
                    vehicle_oem: vehicle.oem_name
                },
                afterSubmit: afterSubmitAction
            });
        }
    };

    // Block registry for editor persistence
    let component = $state<HTMLElement>();
    const componentRef = {};
    
    // Don't save vehicles to content - they come from context
    const content = $derived({
        id,
        type,
        vehicleIds,
        oemId,
        category,
        limit,
        displayMode,
        columns,
        showPrices,
        showCategory,
        showDescription,
        title,
        subtitle,
        showHeader,
        headerAlign,
        ctaText,
        ctaLink,
        showCta,
        detailsMode,
        detailsPagePattern,
        detailsButtonText,
        listCTAs,
        detailCTAs,
        layout
    });

    onMount(() => {
        if (!editable) return;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
        return () => blockRegistry.unregister(componentRef);
    });

    // Layout
    const mergedLayout = $derived(mergeLayoutWithDefaults(layout));
    const layoutStyles = $derived(getSectionLayoutStyles(mergedLayout));

    // Get featured vehicles
    const featuredVehicles = $derived(() => {
        let result = vehicles.filter(v => v.status === 'published');

        // If specific IDs provided, use those
        if (vehicleIds.length > 0) {
            result = result.filter(v => vehicleIds.includes(v.id));
            // Maintain order of vehicleIds
            result.sort((a, b) => vehicleIds.indexOf(a.id) - vehicleIds.indexOf(b.id));
        } else {
            // Otherwise filter by OEM/category
            if (oemId) {
                result = result.filter(v => v.oem_id === oemId);
            }
            if (category) {
                result = result.filter(v => v.category === category);
            }
        }

        return result.slice(0, limit);
    });

    // Carousel navigation
    const canGoBack = $derived(carouselIndex > 0);
    const canGoForward = $derived(carouselIndex < featuredVehicles().length - columns);

    const goBack = () => {
        if (canGoBack) carouselIndex--;
    };

    const goForward = () => {
        if (canGoForward) carouselIndex++;
    };

    // Categories
    const categories: Record<string, string> = {
        atv: 'ATV',
        utv: 'UTV',
        dirtbike: 'Dirt Bike',
        pitbike: 'Pit Bike',
        motorcycle: 'Motorcycle',
        electric: 'Electric',
        other: 'Other'
    };

    const getCategoryLabel = (cat: string) => categories[cat] || cat;

    const formatPrice = (amount: number | undefined, currency: string = 'USD') => {
        if (!amount) return '';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    const handleLayoutChange = (newLayout: SectionLayout) => {
        onLayoutChange?.(newLayout);
    };
</script>

<section class="featured-vehicles" class:editor-item={editable} style={layoutStyles} bind:this={component}>
    {#if isEditing}
        <SectionLayoutControls
            layout={mergedLayout}
            onchange={handleLayoutChange}
        />
    {/if}

    <div class="featured-vehicles__container">
        <!-- Header -->
        {#if showHeader && (title || subtitle)}
            <header class="featured-vehicles__header" data-align={headerAlign}>
                {#if title}
                    <h2 class="featured-vehicles__title">{title}</h2>
                {/if}
                {#if subtitle}
                    <p class="featured-vehicles__subtitle">{subtitle}</p>
                {/if}
            </header>
        {/if}

        {#if featuredVehicles().length === 0}
            <div class="featured-vehicles__empty">
                <Bike size={40} strokeWidth={1} />
                <p>No featured vehicles</p>
                {#if isEditing}
                    <p class="featured-vehicles__emptyHint">
                        Configure vehicle IDs or filters in the section settings
                    </p>
                {/if}
            </div>
        {:else if displayMode === 'showcase'}
            <!-- Showcase: Large featured vehicle with smaller ones -->
            {#if featuredVehicles().length > 0}
            {@const mainVehicle = featuredVehicles()[0]}
            {@const otherVehicles = featuredVehicles().slice(1, 4)}
            <div class="featured-vehicles__showcase">
                
                <article class="featured-vehicles__showcaseMain">
                    <div class="featured-vehicles__showcaseImage">
                        {#if mainVehicle.thumbnail_url}
                            <img src={mainVehicle.thumbnail_url} alt={mainVehicle.model_name} />
                        {:else}
                            <div class="featured-vehicles__showcasePlaceholder">
                                <Bike size={48} />
                            </div>
                        {/if}
                        {#if showCategory}
                            <span class="featured-vehicles__showcaseCategory">
                                {getCategoryLabel(mainVehicle.category)}
                            </span>
                        {/if}
                    </div>
                    <div class="featured-vehicles__showcaseContent">
                        <span class="featured-vehicles__showcaseBrand">{mainVehicle.oem_name}</span>
                        <h3 class="featured-vehicles__showcaseTitle">
                            {#if mainVehicle.model_year}{mainVehicle.model_year}{/if}
                            {mainVehicle.model_name}
                        </h3>
                        {#if showDescription && mainVehicle.description}
                            <p class="featured-vehicles__showcaseDesc">{mainVehicle.description}</p>
                        {/if}
                        {#if showPrices && mainVehicle.msrp}
                            <span class="featured-vehicles__showcasePrice">
                                {formatPrice(mainVehicle.msrp, mainVehicle.currency)}
                            </span>
                        {/if}
                        <div class="featured-vehicles__showcaseActions">
                            {#if detailsMode !== 'none'}
                                <button 
                                    class="featured-vehicles__showcaseBtn"
                                    onclick={() => handleViewDetails(mainVehicle)}
                                >
                                    {detailsButtonText}
                                </button>
                            {/if}
                            {#each listCTAs as cta (cta.id)}
                                <button 
                                    class="featured-vehicles__showcaseBtn featured-vehicles__showcaseBtn--{cta.style}"
                                    onclick={() => handleLeadCTA(cta, mainVehicle)}
                                >
                                    {cta.label}
                                </button>
                            {/each}
                        </div>
                    </div>
                </article>

                {#if otherVehicles.length > 0}
                    <div class="featured-vehicles__showcaseSide">
                        {#each otherVehicles as vehicle}
                            <article class="featured-vehicles__showcaseCard">
                                <div class="featured-vehicles__showcaseCardImage">
                                    {#if vehicle.thumbnail_url}
                                        <img src={vehicle.thumbnail_url} alt={vehicle.model_name} />
                                    {:else}
                                        <div class="featured-vehicles__cardPlaceholder">
                                            <Bike size={24} />
                                        </div>
                                    {/if}
                                </div>
                                <div class="featured-vehicles__showcaseCardContent">
                                    <span class="featured-vehicles__cardBrand">{vehicle.oem_name}</span>
                                    <h4 class="featured-vehicles__cardTitle">
                                        {#if vehicle.model_year}{vehicle.model_year}{/if}
                                        {vehicle.model_name}
                                    </h4>
                                    {#if showPrices && vehicle.msrp}
                                        <span class="featured-vehicles__cardPrice">
                                            {formatPrice(vehicle.msrp, vehicle.currency)}
                                        </span>
                                    {/if}
                                </div>
                            </article>
                        {/each}
                    </div>
                {/if}
            </div>
            {/if}
        {:else if displayMode === 'carousel'}
            <!-- Carousel -->
            <div class="featured-vehicles__carousel">
                <button 
                    class="featured-vehicles__carouselBtn featured-vehicles__carouselBtn--prev"
                    disabled={!canGoBack}
                    onclick={goBack}
                >
                    <ChevronLeft size={24} />
                </button>

                <div class="featured-vehicles__carouselTrack" style="--columns: {columns}">
                    <div 
                        class="featured-vehicles__carouselSlides"
                        style="transform: translateX(-{carouselIndex * (100 / columns)}%)"
                    >
                        {#each featuredVehicles() as vehicle}
                            <article class="featured-vehicles__card">
                                <div class="featured-vehicles__cardImage">
                                    {#if vehicle.thumbnail_url}
                                        <img src={vehicle.thumbnail_url} alt={vehicle.model_name} />
                                    {:else}
                                        <div class="featured-vehicles__cardPlaceholder">
                                            <Bike size={32} />
                                        </div>
                                    {/if}
                                    {#if showCategory}
                                        <span class="featured-vehicles__cardCategory">
                                            {getCategoryLabel(vehicle.category)}
                                        </span>
                                    {/if}
                                </div>
                                <div class="featured-vehicles__cardContent">
                                    <span class="featured-vehicles__cardBrand">{vehicle.oem_name}</span>
                                    <h3 class="featured-vehicles__cardTitle">
                                        {#if vehicle.model_year}{vehicle.model_year}{/if}
                                        {vehicle.model_name}
                                    </h3>
                                    {#if showPrices && vehicle.msrp}
                                        <span class="featured-vehicles__cardPrice">
                                            {formatPrice(vehicle.msrp, vehicle.currency)}
                                        </span>
                                    {/if}
                                </div>
                            </article>
                        {/each}
                    </div>
                </div>

                <button 
                    class="featured-vehicles__carouselBtn featured-vehicles__carouselBtn--next"
                    disabled={!canGoForward}
                    onclick={goForward}
                >
                    <ChevronRight size={24} />
                </button>
            </div>
        {:else}
            <!-- Grid -->
            <div class="featured-vehicles__grid" style="--columns: {columns}">
                {#each featuredVehicles() as vehicle}
                    <article class="featured-vehicles__card">
                        <div class="featured-vehicles__cardImage">
                            {#if vehicle.thumbnail_url}
                                <img src={vehicle.thumbnail_url} alt={vehicle.model_name} />
                            {:else}
                                <div class="featured-vehicles__cardPlaceholder">
                                    <Bike size={32} />
                                </div>
                            {/if}
                            {#if showCategory}
                                <span class="featured-vehicles__cardCategory">
                                    {getCategoryLabel(vehicle.category)}
                                </span>
                            {/if}
                        </div>
                        <div class="featured-vehicles__cardContent">
                            <span class="featured-vehicles__cardBrand">{vehicle.oem_name}</span>
                            <h3 class="featured-vehicles__cardTitle">
                                {#if vehicle.model_year}{vehicle.model_year}{/if}
                                {vehicle.model_name}
                            </h3>
                            {#if showDescription && vehicle.description}
                                <p class="featured-vehicles__cardDesc">{vehicle.description}</p>
                            {/if}
                            {#if showPrices && vehicle.msrp}
                                <span class="featured-vehicles__cardPrice">
                                    {formatPrice(vehicle.msrp, vehicle.currency)}
                                </span>
                            {/if}
                            <div class="featured-vehicles__cardActions">
                                {#if detailsMode !== 'none'}
                                    <button 
                                        class="featured-vehicles__cardBtn"
                                        onclick={() => handleViewDetails(vehicle)}
                                    >
                                        {detailsButtonText}
                                    </button>
                                {/if}
                                {#each listCTAs as cta (cta.id)}
                                    <button 
                                        class="featured-vehicles__cardBtn featured-vehicles__cardBtn--{cta.style}"
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

        <!-- CTA -->
        {#if showCta && ctaText}
            <div class="featured-vehicles__cta">
                <a href={ctaLink} class="featured-vehicles__ctaBtn">
                    {ctaText}
                </a>
            </div>
        {/if}
    </div>
</section>

<!-- Vehicle Details Modal -->
{#if showDetailsModal && selectedVehicle}
    <div 
        class="featured-vehicles__modalOverlay"
        onclick={closeDetailsModal}
        onkeydown={(e) => e.key === 'Escape' && closeDetailsModal()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vehicle-modal-title"
        tabindex="-1"
    >
        <div 
            class="featured-vehicles__modal"
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => e.stopPropagation()}
            role="document"
        >
            <button 
                class="featured-vehicles__modalClose"
                onclick={closeDetailsModal}
                aria-label="Close modal"
            >
                <X size={24} />
            </button>
            
            <div class="featured-vehicles__modalContent">
                <div class="featured-vehicles__modalGallery">
                    {#if selectedVehicle.thumbnail_url}
                        <img 
                            src={selectedVehicle.thumbnail_url} 
                            alt={selectedVehicle.model_name}
                            class="featured-vehicles__modalImage"
                        />
                    {:else}
                        <div class="featured-vehicles__modalPlaceholder">
                            <Bike size={64} />
                        </div>
                    {/if}
                </div>
                
                <div class="featured-vehicles__modalInfo">
                    <div class="featured-vehicles__modalHeader">
                        <span class="featured-vehicles__modalBrand">{selectedVehicle.oem_name}</span>
                        <span class="featured-vehicles__modalCategory">
                            {getCategoryLabel(selectedVehicle.category)}
                        </span>
                    </div>
                    
                    <h2 id="vehicle-modal-title" class="featured-vehicles__modalTitle">
                        {#if selectedVehicle.model_year}{selectedVehicle.model_year}{/if}
                        {selectedVehicle.model_name}
                    </h2>
                    
                    {#if showPrices && selectedVehicle.msrp}
                        <div class="featured-vehicles__modalPrice">
                            {formatPrice(selectedVehicle.msrp, selectedVehicle.currency)}
                        </div>
                    {/if}
                    
                    {#if selectedVehicle.description}
                        <p class="featured-vehicles__modalDesc">{selectedVehicle.description}</p>
                    {/if}
                    
                    {#if detailCTAs.length > 0}
                        <div class="featured-vehicles__modalCTAs">
                            {#each detailCTAs as cta (cta.id)}
                                <button 
                                    class="featured-vehicles__modalCTA featured-vehicles__modalCTA--{cta.style}"
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
    .featured-vehicles {
        position: relative;
        padding: var(--section-padding-y, 4rem) var(--section-padding-x, 2rem);
        background: var(--section-bg, #ffffff);
    }

    .featured-vehicles__container {
        max-width: var(--section-max-width, 1200px);
        margin: 0 auto;
    }

    /* Header */
    .featured-vehicles__header {
        margin-bottom: 2.5rem;
    }

    .featured-vehicles__header[data-align="center"] {
        text-align: center;
    }

    .featured-vehicles__title {
        margin: 0 0 0.5rem;
        font-size: 2rem;
        font-weight: 700;
        color: #0f172a;
    }

    .featured-vehicles__subtitle {
        margin: 0;
        font-size: 1.125rem;
        color: #64748b;
    }

    /* Empty State */
    .featured-vehicles__empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        padding: 3rem 2rem;
        text-align: center;
        color: #94a3b8;
        background: #f8fafc;
        border-radius: 0.75rem;
        border: 2px dashed #e2e8f0;
    }

    .featured-vehicles__empty p {
        margin: 0;
    }

    .featured-vehicles__emptyHint {
        font-size: 0.875rem;
    }

    /* Grid */
    .featured-vehicles__grid {
        display: grid;
        grid-template-columns: repeat(var(--columns, 4), 1fr);
        gap: 1.5rem;
    }

    /* Card */
    .featured-vehicles__card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        overflow: hidden;
        transition: all 0.2s ease;
    }

    .featured-vehicles__card:hover {
        box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.1);
        transform: translateY(-2px);
    }

    .featured-vehicles__cardImage {
        position: relative;
        aspect-ratio: 4/3;
        background: #f8fafc;
    }

    .featured-vehicles__cardImage img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .featured-vehicles__cardPlaceholder {
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
        color: #cbd5e1;
    }

    .featured-vehicles__cardCategory {
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

    .featured-vehicles__cardContent {
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
    }

    .featured-vehicles__cardBrand {
        font-size: 0.75rem;
        font-weight: 600;
        color: #3b82f6;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .featured-vehicles__cardTitle {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 600;
        color: #0f172a;
    }

    .featured-vehicles__cardDesc {
        margin: 0.25rem 0 0;
        font-size: 0.875rem;
        color: #64748b;
        line-height: 1.5;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .featured-vehicles__cardPrice {
        font-size: 1.25rem;
        font-weight: 700;
        color: #059669;
        margin-top: 0.25rem;
    }

    .featured-vehicles__cardBtn {
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

    .featured-vehicles__cardBtn:hover {
        background: #1e293b;
    }

    /* Carousel */
    .featured-vehicles__carousel {
        position: relative;
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .featured-vehicles__carouselBtn {
        flex-shrink: 0;
        width: 44px;
        height: 44px;
        display: grid;
        place-items: center;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 50%;
        color: #374151;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .featured-vehicles__carouselBtn:hover:not(:disabled) {
        background: #f8fafc;
        border-color: #cbd5e1;
    }

    .featured-vehicles__carouselBtn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .featured-vehicles__carouselTrack {
        flex: 1;
        overflow: hidden;
    }

    .featured-vehicles__carouselSlides {
        display: flex;
        gap: 1.5rem;
        transition: transform 0.3s ease;
    }

    .featured-vehicles__carouselSlides .featured-vehicles__card {
        flex: 0 0 calc((100% - (var(--columns) - 1) * 1.5rem) / var(--columns));
    }

    /* Showcase */
    .featured-vehicles__showcase {
        display: grid;
        grid-template-columns: 1.5fr 1fr;
        gap: 1.5rem;
    }

    .featured-vehicles__showcaseMain {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        overflow: hidden;
    }

    .featured-vehicles__showcaseImage {
        position: relative;
        aspect-ratio: 16/10;
        background: #f8fafc;
    }

    .featured-vehicles__showcaseImage img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .featured-vehicles__showcasePlaceholder {
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
        color: #cbd5e1;
    }

    .featured-vehicles__showcaseCategory {
        position: absolute;
        top: 1rem;
        left: 1rem;
        padding: 0.375rem 0.75rem;
        background: rgba(0, 0, 0, 0.7);
        color: #ffffff;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border-radius: 0.375rem;
    }

    .featured-vehicles__showcaseContent {
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .featured-vehicles__showcaseBrand {
        font-size: 0.8125rem;
        font-weight: 600;
        color: #3b82f6;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .featured-vehicles__showcaseTitle {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 700;
        color: #0f172a;
    }

    .featured-vehicles__showcaseDesc {
        margin: 0.25rem 0 0;
        font-size: 0.9375rem;
        color: #64748b;
        line-height: 1.6;
    }

    .featured-vehicles__showcasePrice {
        font-size: 1.75rem;
        font-weight: 700;
        color: #059669;
        margin-top: 0.5rem;
    }

    .featured-vehicles__showcaseBtn {
        margin-top: 1rem;
        padding: 0.75rem 1.5rem;
        background: #0f172a;
        color: #ffffff;
        border: none;
        border-radius: 0.5rem;
        font-size: 0.9375rem;
        font-weight: 500;
        cursor: pointer;
        align-self: flex-start;
    }

    .featured-vehicles__showcaseBtn:hover {
        background: #1e293b;
    }

    .featured-vehicles__showcaseSide {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .featured-vehicles__showcaseCard {
        flex: 1;
        display: flex;
        gap: 1rem;
        padding: 1rem;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        transition: all 0.2s ease;
    }

    .featured-vehicles__showcaseCard:hover {
        box-shadow: 0 4px 20px -4px rgba(0, 0, 0, 0.08);
    }

    .featured-vehicles__showcaseCardImage {
        flex-shrink: 0;
        width: 100px;
        aspect-ratio: 4/3;
        background: #f8fafc;
        border-radius: 0.5rem;
        overflow: hidden;
    }

    .featured-vehicles__showcaseCardImage img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .featured-vehicles__showcaseCardContent {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        justify-content: center;
    }

    /* CTA */
    .featured-vehicles__cta {
        margin-top: 2.5rem;
        text-align: center;
    }

    .featured-vehicles__ctaBtn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.875rem 2rem;
        background: transparent;
        color: #0f172a;
        border: 2px solid #0f172a;
        border-radius: 0.5rem;
        font-size: 0.9375rem;
        font-weight: 600;
        text-decoration: none;
        transition: all 0.15s ease;
    }

    .featured-vehicles__ctaBtn:hover {
        background: #0f172a;
        color: #ffffff;
    }

    /* Responsive */
    @media (max-width: 1024px) {
        .featured-vehicles__grid {
            grid-template-columns: repeat(3, 1fr);
        }

        .featured-vehicles__showcase {
            grid-template-columns: 1fr;
        }

        .featured-vehicles__showcaseSide {
            flex-direction: row;
        }

        .featured-vehicles__showcaseCard {
            flex: 1;
        }
    }

    @media (max-width: 768px) {
        .featured-vehicles__grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
        }

        .featured-vehicles__showcaseSide {
            flex-direction: column;
        }

        .featured-vehicles__carouselBtn {
            display: none;
        }

        .featured-vehicles__carouselSlides {
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
        }

        .featured-vehicles__carouselSlides .featured-vehicles__card {
            scroll-snap-align: start;
            flex: 0 0 80%;
        }
    }

    @media (max-width: 480px) {
        .featured-vehicles__grid {
            grid-template-columns: 1fr;
        }
    }

    /* Vehicle Details Modal */
    .featured-vehicles__modalOverlay {
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

    .featured-vehicles__modal {
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

    .featured-vehicles__modalClose {
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

    .featured-vehicles__modalClose:hover {
        background: #f1f5f9;
        color: #0f172a;
    }

    .featured-vehicles__modalContent {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2rem;
    }

    .featured-vehicles__modalGallery {
        aspect-ratio: 4/3;
        background: #f8fafc;
        border-radius: 1rem 0 0 1rem;
        overflow: hidden;
    }

    .featured-vehicles__modalImage {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .featured-vehicles__modalPlaceholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #cbd5e1;
    }

    .featured-vehicles__modalInfo {
        padding: 2rem 2rem 2rem 0;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .featured-vehicles__modalHeader {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .featured-vehicles__modalBrand {
        font-size: 0.875rem;
        font-weight: 600;
        color: #3b82f6;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .featured-vehicles__modalCategory {
        padding: 0.25rem 0.75rem;
        font-size: 0.75rem;
        font-weight: 500;
        color: #64748b;
        background: #f1f5f9;
        border-radius: 9999px;
    }

    .featured-vehicles__modalTitle {
        margin: 0;
        font-size: 1.75rem;
        font-weight: 700;
        color: #0f172a;
        line-height: 1.2;
    }

    .featured-vehicles__modalPrice {
        font-size: 1.5rem;
        font-weight: 700;
        color: #059669;
    }

    .featured-vehicles__modalDesc {
        margin: 0;
        font-size: 1rem;
        color: #64748b;
        line-height: 1.6;
    }

    /* Lead CTA Buttons */
    .featured-vehicles__cardActions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: auto;
        padding-top: 0.75rem;
    }

    .featured-vehicles__showcaseActions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-top: 0.5rem;
    }

    .featured-vehicles__modalCTAs {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-top: 1.5rem;
        padding-top: 1.5rem;
        border-top: 1px solid #e2e8f0;
    }

    /* Card Button Variants */
    .featured-vehicles__cardBtn--primary {
        background: #2563eb;
        color: white;
    }

    .featured-vehicles__cardBtn--primary:hover {
        background: #1d4ed8;
    }

    .featured-vehicles__cardBtn--secondary {
        background: #64748b;
        color: white;
    }

    .featured-vehicles__cardBtn--secondary:hover {
        background: #475569;
    }

    .featured-vehicles__cardBtn--outline {
        background: transparent;
        border: 1px solid #2563eb;
        color: #2563eb;
    }

    .featured-vehicles__cardBtn--outline:hover {
        background: #2563eb;
        color: white;
    }

    .featured-vehicles__cardBtn--ghost {
        background: transparent;
        color: #2563eb;
    }

    .featured-vehicles__cardBtn--ghost:hover {
        background: #eff6ff;
    }

    /* Showcase Button Variants */
    .featured-vehicles__showcaseBtn--primary {
        background: #2563eb;
        color: white;
    }

    .featured-vehicles__showcaseBtn--primary:hover {
        background: #1d4ed8;
    }

    .featured-vehicles__showcaseBtn--secondary {
        background: #64748b;
        color: white;
    }

    .featured-vehicles__showcaseBtn--secondary:hover {
        background: #475569;
    }

    .featured-vehicles__showcaseBtn--outline {
        background: transparent;
        border: 1px solid #2563eb;
        color: #2563eb;
    }

    .featured-vehicles__showcaseBtn--outline:hover {
        background: #2563eb;
        color: white;
    }

    .featured-vehicles__showcaseBtn--ghost {
        background: transparent;
        color: #2563eb;
    }

    .featured-vehicles__showcaseBtn--ghost:hover {
        background: #eff6ff;
    }

    /* Modal CTA Variants */
    .featured-vehicles__modalCTA {
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

    .featured-vehicles__modalCTA--primary {
        background: #2563eb;
        color: white;
    }

    .featured-vehicles__modalCTA--primary:hover {
        background: #1d4ed8;
    }

    .featured-vehicles__modalCTA--secondary {
        background: #64748b;
        color: white;
    }

    .featured-vehicles__modalCTA--secondary:hover {
        background: #475569;
    }

    .featured-vehicles__modalCTA--outline {
        background: transparent;
        border: 1px solid #2563eb;
        color: #2563eb;
    }

    .featured-vehicles__modalCTA--outline:hover {
        background: #2563eb;
        color: white;
    }

    .featured-vehicles__modalCTA--ghost {
        background: #f1f5f9;
        color: #2563eb;
    }

    .featured-vehicles__modalCTA--ghost:hover {
        background: #e2e8f0;
    }

    @media (max-width: 768px) {
        .featured-vehicles__modalContent {
            grid-template-columns: 1fr;
        }

        .featured-vehicles__modalGallery {
            border-radius: 1rem 1rem 0 0;
        }

        .featured-vehicles__modalInfo {
            padding: 0 1.5rem 1.5rem;
        }
    }
</style>
