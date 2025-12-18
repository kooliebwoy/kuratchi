<script lang="ts">
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
    import { onMount } from 'svelte';
    import { ImagePicker } from '../widgets/index.js';
    import { BlockActions } from '../utils/index.js';
    import SectionLayoutControls from './SectionLayoutControls.svelte';
    import { 
        type SectionLayout, 
        DEFAULT_SECTION_LAYOUT, 
        getSectionLayoutStyles,
        mergeLayoutWithDefaults 
    } from './section-layout.js';

    interface PromoOffer {
        value: string;
        label: string;
    }

    interface LayoutMetadata {
        backgroundColor: string;
        textColor: string;
        accentColor: string;
        buttonBackground: string;
        buttonTextColor: string;
        layout?: Partial<SectionLayout>;
    }

    interface Props {
        id?: string;
        type?: string;
        brandLogo?: { url?: string; alt?: string };
        backgroundImage?: { url?: string; alt?: string };
        offers?: PromoOffer[];
        disclaimer?: string;
        buttonLabel?: string;
        buttonLink?: string;
        metadata?: LayoutMetadata;
        editable?: boolean;
    }

    const createDefaultOffers = (): PromoOffer[] => [
        { value: '$3,000 OFF', label: 'SELECT MODELS' },
        { value: '$250 IN FREE', label: 'ACCESSORIES' },
        { value: '2-YEAR', label: 'WARRANTY' }
    ];

    let {
        id = crypto.randomUUID(),
        type = 'promo-banner',
        brandLogo = $bindable({ url: 'https://fakeimg.pl/200x60/?text=BRAND', alt: 'Brand Logo' }),
        backgroundImage = $bindable({ url: 'https://fakeimg.pl/1200x400/?text=Promo+Background', alt: 'Promo Background' }),
        offers = $bindable<PromoOffer[]>(createDefaultOffers()),
        disclaimer = $bindable('ON SELECT 2024 RANGER SPORTSMAN MODELS WHEN FINANCED WITH POLARIS ADVANTAGE'),
        buttonLabel = $bindable('View Offers'),
        buttonLink = $bindable('#'),
        metadata = $bindable<LayoutMetadata>({
            backgroundColor: '#1a1a1a',
            textColor: '#ffffff',
            accentColor: '#ff6600',
            buttonBackground: '#ffffff',
            buttonTextColor: '#1a1a1a',
            layout: { ...DEFAULT_SECTION_LAYOUT }
        }),
        editable = true
    }: Props = $props();

    let offersState = $state(offers);
    let editingOfferIndex = $state<number | null>(null);

    // Section layout state
    let sectionLayout = $state<SectionLayout>(mergeLayoutWithDefaults(metadata.layout));
    
    $effect(() => {
        metadata.layout = { ...sectionLayout };
    });

    const sectionLayoutStyles = $derived(getSectionLayoutStyles(sectionLayout));

    const layoutStyle = $derived(
        `--krt-promoBanner-bg: ${metadata.backgroundColor}; --krt-promoBanner-text: ${metadata.textColor}; --krt-promoBanner-accent: ${metadata.accentColor}; --krt-promoBanner-btn-bg: ${metadata.buttonBackground}; --krt-promoBanner-btn-text: ${metadata.buttonTextColor}; ${sectionLayoutStyles}`
    );

    let content = $derived({
        id,
        type,
        brandLogo,
        backgroundImage,
        offers: offersState,
        disclaimer,
        buttonLabel,
        buttonLink,
        metadata: { ...metadata }
    });

    let component = $state<HTMLElement>();
    const componentRef = {};
    let mounted = $state(false);

    function addOffer() {
        offersState = [...offersState, { value: 'NEW', label: 'OFFER' }];
    }

    function removeOffer(index: number) {
        offersState = offersState.filter((_, i) => i !== index);
        if (editingOfferIndex === index) editingOfferIndex = null;
    }

    onMount(() => {
        if (!editable) return;
        mounted = true;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
        return () => blockRegistry.unregister(componentRef);
    });
</script>

{#if editable}
<div class="editor-item group relative krt-promoBanner__wrapper" bind:this={component}>
    {#if mounted}
        <BlockActions {id} {type} element={component} inspectorTitle="Promo Banner Settings">
            {#snippet inspector()}
                <div class="krt-promoBannerDrawer">
                    <section class="krt-promoBannerDrawer__section">
                        <h3>Section Layout</h3>
                        <SectionLayoutControls bind:layout={sectionLayout} />
                    </section>

                    <section class="krt-promoBannerDrawer__section">
                        <h3>Colors</h3>
                        <div class="krt-promoBannerDrawer__grid">
                            <label class="krt-promoBannerDrawer__field">
                                <span>Background</span>
                                <input type="color" bind:value={metadata.backgroundColor} />
                            </label>
                            <label class="krt-promoBannerDrawer__field">
                                <span>Text</span>
                                <input type="color" bind:value={metadata.textColor} />
                            </label>
                            <label class="krt-promoBannerDrawer__field">
                                <span>Accent</span>
                                <input type="color" bind:value={metadata.accentColor} />
                            </label>
                            <label class="krt-promoBannerDrawer__field">
                                <span>Button BG</span>
                                <input type="color" bind:value={metadata.buttonBackground} />
                            </label>
                        </div>
                    </section>

                    <section class="krt-promoBannerDrawer__section">
                        <h3>Brand Logo</h3>
                        <ImagePicker bind:selectedImage={brandLogo} mode="single" />
                    </section>

                    <section class="krt-promoBannerDrawer__section">
                        <h3>Background Image</h3>
                        <ImagePicker bind:selectedImage={backgroundImage} mode="single" />
                    </section>

                    <section class="krt-promoBannerDrawer__section">
                        <h3>Offers</h3>
                        <div class="krt-promoBannerDrawer__list">
                            {#each offersState as offer, index}
                                <div class="krt-promoBannerDrawer__item">
                                    <div class="krt-promoBannerDrawer__itemHeader">
                                        <span>{offer.value}</span>
                                        <div class="krt-promoBannerDrawer__itemActions">
                                            <button type="button" onclick={() => editingOfferIndex = editingOfferIndex === index ? null : index}>
                                                {editingOfferIndex === index ? 'Close' : 'Edit'}
                                            </button>
                                            <button type="button" onclick={() => removeOffer(index)}>Remove</button>
                                        </div>
                                    </div>
                                    {#if editingOfferIndex === index}
                                        <div class="krt-promoBannerDrawer__itemEdit">
                                            <label class="krt-promoBannerDrawer__field">
                                                <span>Value (e.g. $3,000 OFF)</span>
                                                <input type="text" bind:value={offer.value} />
                                            </label>
                                            <label class="krt-promoBannerDrawer__field">
                                                <span>Label (e.g. SELECT MODELS)</span>
                                                <input type="text" bind:value={offer.label} />
                                            </label>
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                        <button type="button" class="krt-promoBannerDrawer__addBtn" onclick={addOffer}>
                            + Add Offer
                        </button>
                    </section>

                    <section class="krt-promoBannerDrawer__section">
                        <h3>Button</h3>
                        <label class="krt-promoBannerDrawer__field">
                            <span>Label</span>
                            <input type="text" bind:value={buttonLabel} />
                        </label>
                        <label class="krt-promoBannerDrawer__field">
                            <span>Link</span>
                            <input type="url" bind:value={buttonLink} placeholder="https://" />
                        </label>
                    </section>
                </div>
            {/snippet}
        </BlockActions>
    {/if}

    <section class="krt-promoBanner" style={layoutStyle} data-type={type}>
        <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
        {#if backgroundImage?.url}
            <div class="krt-promoBanner__bg" style="background-image: url({backgroundImage.url})"></div>
        {/if}
        <div class="krt-promoBanner__overlay"></div>
        <div class="krt-promoBanner__inner">
            <div class="krt-promoBanner__brand">
                {#if brandLogo?.url}
                    <img src={brandLogo.url} alt={brandLogo.alt ?? 'Brand'} class="krt-promoBanner__logo" />
                {:else}
                    <div class="krt-promoBanner__logoPlaceholder">Add logo</div>
                {/if}
            </div>
            <div class="krt-promoBanner__content">
                <div class="krt-promoBanner__offers">
                    {#each offersState as offer, index}
                        <div class="krt-promoBanner__offer">
                            <span class="krt-promoBanner__offerValue" contenteditable bind:innerHTML={offersState[index].value}></span>
                            <span class="krt-promoBanner__offerLabel" contenteditable bind:innerHTML={offersState[index].label}></span>
                        </div>
                    {/each}
                </div>
                <p class="krt-promoBanner__disclaimer" contenteditable bind:innerHTML={disclaimer}></p>
            </div>
            <div class="krt-promoBanner__action">
                <a href={buttonLink} class="krt-promoBanner__button" onclick={(e) => editable && e.preventDefault()} aria-label="View promotional offers">
                    <span contenteditable bind:innerHTML={buttonLabel}></span>
                </a>
            </div>
        </div>
    </section>
</div>
{:else}
    <section id={id} data-type={type} class="krt-promoBanner" style={layoutStyle}>
        {#if backgroundImage?.url}
            <div class="krt-promoBanner__bg" style="background-image: url({backgroundImage.url})"></div>
        {/if}
        <div class="krt-promoBanner__overlay"></div>
        <div class="krt-promoBanner__inner">
            <div class="krt-promoBanner__brand">
                {#if brandLogo?.url}
                    <img src={brandLogo.url} alt={brandLogo.alt ?? 'Brand'} class="krt-promoBanner__logo" />
                {/if}
            </div>
            <div class="krt-promoBanner__content">
                <div class="krt-promoBanner__offers">
                    {#each offers as offer}
                        <div class="krt-promoBanner__offer">
                            <span class="krt-promoBanner__offerValue">{@html offer.value}</span>
                            <span class="krt-promoBanner__offerLabel">{@html offer.label}</span>
                        </div>
                    {/each}
                </div>
                <p class="krt-promoBanner__disclaimer">{@html disclaimer}</p>
            </div>
            <div class="krt-promoBanner__action">
                <a href={buttonLink} class="krt-promoBanner__button">
                    {@html buttonLabel}
                </a>
            </div>
        </div>
    </section>
{/if}

<style>
    .krt-promoBanner {
        position: relative;
        width: 100%;
        min-height: 200px;
        background-color: var(--krt-promoBanner-bg, #1a1a1a);
        overflow: hidden;
    }

    .krt-promoBanner__bg {
        position: absolute;
        inset: 0;
        background-size: cover;
        background-position: center;
        opacity: 0.4;
    }

    .krt-promoBanner__overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.2) 100%);
    }

    .krt-promoBanner__inner {
        position: relative;
        z-index: 1;
        max-width: var(--krt-section-max-width, 1200px);
        margin: 0 auto;
        padding: 2rem;
        display: flex;
        align-items: center;
        gap: 2rem;
        flex-wrap: wrap;
    }

    .krt-promoBanner__brand {
        flex-shrink: 0;
    }

    .krt-promoBanner__logo {
        max-width: 180px;
        height: auto;
    }

    .krt-promoBanner__logoPlaceholder {
        width: 180px;
        height: 60px;
        background: rgba(255,255,255,0.1);
        border: 1px dashed rgba(255,255,255,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(255,255,255,0.5);
        font-size: 0.875rem;
        border-radius: 4px;
    }

    .krt-promoBanner__content {
        flex: 1;
        min-width: 300px;
    }

    .krt-promoBanner__offers {
        display: flex;
        flex-wrap: wrap;
        gap: 1.5rem;
        margin-bottom: 0.75rem;
    }

    .krt-promoBanner__offer {
        display: flex;
        flex-direction: column;
    }

    .krt-promoBanner__offerValue {
        font-size: 1.25rem;
        font-weight: 800;
        color: var(--krt-promoBanner-accent, #ff6600);
        outline: none;
    }

    .krt-promoBanner__offerLabel {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--krt-promoBanner-text, #ffffff);
        text-transform: uppercase;
        outline: none;
    }

    .krt-promoBanner__disclaimer {
        font-size: 0.7rem;
        color: var(--krt-promoBanner-text, #ffffff);
        opacity: 0.7;
        margin: 0;
        max-width: 400px;
        outline: none;
    }

    .krt-promoBanner__action {
        flex-shrink: 0;
    }

    .krt-promoBanner__button {
        display: inline-block;
        padding: 0.75rem 1.5rem;
        background: var(--krt-promoBanner-btn-bg, #ffffff);
        color: var(--krt-promoBanner-btn-text, #1a1a1a);
        text-decoration: none;
        font-weight: 600;
        font-size: 0.875rem;
        border-radius: 4px;
        transition: opacity 0.2s;
    }

    .krt-promoBanner__button:hover {
        opacity: 0.9;
    }

    .krt-promoBanner__button span {
        outline: none;
    }

    /* Drawer styles */
    .krt-promoBannerDrawer {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .krt-promoBannerDrawer__section {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .krt-promoBannerDrawer__section h3 {
        font-size: 0.875rem;
        font-weight: 600;
        margin: 0;
        color: #374151;
    }

    .krt-promoBannerDrawer__grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.75rem;
    }

    .krt-promoBannerDrawer__field {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .krt-promoBannerDrawer__field span {
        font-size: 0.75rem;
        color: #6b7280;
    }

    .krt-promoBannerDrawer__field input[type="color"] {
        width: 100%;
        height: 32px;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        cursor: pointer;
    }

    .krt-promoBannerDrawer__field input[type="text"],
    .krt-promoBannerDrawer__field input[type="url"] {
        padding: 0.5rem;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        font-size: 0.875rem;
    }

    .krt-promoBannerDrawer__list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .krt-promoBannerDrawer__item {
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        overflow: hidden;
    }

    .krt-promoBannerDrawer__itemHeader {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem 0.75rem;
        background: #f9fafb;
    }

    .krt-promoBannerDrawer__itemHeader span {
        font-size: 0.875rem;
        font-weight: 500;
    }

    .krt-promoBannerDrawer__itemActions {
        display: flex;
        gap: 0.5rem;
    }

    .krt-promoBannerDrawer__itemActions button {
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        background: #e5e7eb;
    }

    .krt-promoBannerDrawer__itemActions button:hover {
        background: #d1d5db;
    }

    .krt-promoBannerDrawer__itemEdit {
        padding: 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        border-top: 1px solid #e5e7eb;
    }

    .krt-promoBannerDrawer__addBtn {
        width: 100%;
        padding: 0.5rem;
        border: 1px dashed #d1d5db;
        border-radius: 6px;
        background: transparent;
        color: #6b7280;
        cursor: pointer;
        font-size: 0.875rem;
    }

    .krt-promoBannerDrawer__addBtn:hover {
        border-color: #9ca3af;
        color: #374151;
    }

    @media (max-width: 768px) {
        .krt-promoBanner__inner {
            flex-direction: column;
            text-align: center;
        }

        .krt-promoBanner__offers {
            justify-content: center;
        }

        .krt-promoBanner__disclaimer {
            max-width: 100%;
        }
    }
</style>
