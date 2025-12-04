<script lang="ts">
    import { Bike, Search, Filter, ChevronDown } from '@lucide/svelte';
    import SectionLayoutControls from './SectionLayoutControls.svelte';
    import { type SectionLayout, getSectionLayoutStyles, mergeLayoutWithDefaults } from './section-layout.js';

    interface Props {
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
    }

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
        description?: string;
        status: string;
    }

    let {
        oemId,
        category,
        columns = 3,
        showFilters = true,
        showPrices = true,
        title = 'Our Vehicles',
        subtitle = 'Browse our selection of powersport vehicles',
        layout = {},
        vehicles = [],
        oems = [],
        isEditing = false,
        onLayoutChange
    }: Props = $props();

    // Merge layout with defaults
    const mergedLayout = $derived(mergeLayoutWithDefaults(layout));
    const layoutStyles = $derived(getSectionLayoutStyles(mergedLayout));

    // Filter state
    let searchQuery = $state('');
    let selectedOem = $state(oemId || 'all');
    let selectedCategory = $state(category || 'all');
    let showFilterDropdown = $state(false);

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
</script>

<section class="catalog-grid" style={layoutStyles}>
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
                            <button class="catalog-grid__cardBtn">
                                View Details
                            </button>
                        </div>
                    </article>
                {/each}
            </div>
        {/if}
    </div>
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
</style>
