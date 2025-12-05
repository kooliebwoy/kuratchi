<script lang="ts">
    import { onMount, getContext } from 'svelte';
    import { Bike, ChevronLeft, ChevronRight } from '@lucide/svelte';
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
    import SectionLayoutControls from './SectionLayoutControls.svelte';
    import { type SectionLayout, getSectionLayoutStyles, mergeLayoutWithDefaults } from './section-layout.js';

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
        
        // Section layout
        layout?: Partial<SectionLayout>;
        isEditing?: boolean;
        onLayoutChange?: (layout: SectionLayout) => void;
    }

    // Get catalog data from context (provided by Editor)
    const siteMetadata = getContext<{
        catalogVehicles: CatalogVehicle[];
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
        title = 'Featured Vehicles',
        subtitle = '',
        showHeader = true,
        headerAlign = 'center',
        ctaText = 'View All Vehicles',
        ctaLink = '/catalog',
        showCta = true,
        layout = {},
        isEditing = false,
        onLayoutChange
    }: Props = $props();

    // Carousel state
    let carouselIndex = $state(0);

    // Use context data if props are empty, otherwise use props
    const vehicles = $derived(
        vehiclesProp.length > 0 ? vehiclesProp : (siteMetadata?.catalogVehicles || [])
    );

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
                        <button class="featured-vehicles__showcaseBtn">View Details</button>
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
                            <button class="featured-vehicles__cardBtn">View Details</button>
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
</style>
