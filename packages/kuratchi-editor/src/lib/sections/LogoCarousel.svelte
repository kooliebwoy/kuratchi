<script lang="ts">
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
    import { onMount } from 'svelte';
    import { ChevronLeft, ChevronRight } from '@lucide/svelte';
    import { ImagePicker } from '../widgets/index.js';
    import { BlockActions } from '../utils/index.js';
    import SectionLayoutControls from './SectionLayoutControls.svelte';
    import { 
        type SectionLayout, 
        DEFAULT_SECTION_LAYOUT, 
        getSectionLayoutStyles,
        mergeLayoutWithDefaults 
    } from './section-layout.js';

    interface LogoItem {
        image: { url?: string; alt?: string };
        link?: string;
    }

    interface LayoutMetadata {
        backgroundColor: string;
        headingColor: string;
        arrowColor: string;
        layout?: Partial<SectionLayout>;
    }

    interface Props {
        id?: string;
        type?: string;
        heading?: string;
        logos?: LogoItem[];
        metadata?: LayoutMetadata;
        editable?: boolean;
    }

    const createDefaultLogos = (): LogoItem[] => [
        { image: { url: 'https://fakeimg.pl/150x80/?text=Brand+1', alt: 'Brand 1' }, link: '#' },
        { image: { url: 'https://fakeimg.pl/150x80/?text=Brand+2', alt: 'Brand 2' }, link: '#' },
        { image: { url: 'https://fakeimg.pl/150x80/?text=Brand+3', alt: 'Brand 3' }, link: '#' },
        { image: { url: 'https://fakeimg.pl/150x80/?text=Brand+4', alt: 'Brand 4' }, link: '#' },
        { image: { url: 'https://fakeimg.pl/150x80/?text=Brand+5', alt: 'Brand 5' }, link: '#' },
        { image: { url: 'https://fakeimg.pl/150x80/?text=Brand+6', alt: 'Brand 6' }, link: '#' }
    ];

    let {
        id = crypto.randomUUID(),
        type = 'logo-carousel',
        heading = $bindable('Brands We Carry'),
        logos = $bindable<LogoItem[]>(createDefaultLogos()),
        metadata = $bindable<LayoutMetadata>({
            backgroundColor: '#ffffff',
            headingColor: '#1a1a1a',
            arrowColor: '#1a1a1a',
            layout: { ...DEFAULT_SECTION_LAYOUT }
        }),
        editable = true
    }: Props = $props();

    let logosState = $state(logos);
    let editingIndex = $state<number | null>(null);
    let scrollContainer = $state<HTMLElement>();
    let canScrollLeft = $state(false);
    let canScrollRight = $state(true);

    // Section layout state
    let sectionLayout = $state<SectionLayout>(mergeLayoutWithDefaults(metadata.layout));
    
    $effect(() => {
        metadata.layout = { ...sectionLayout };
    });

    const sectionLayoutStyles = $derived(getSectionLayoutStyles(sectionLayout));

    const layoutStyle = $derived(
        `--krt-logoCarousel-bg: ${metadata.backgroundColor}; --krt-logoCarousel-heading: ${metadata.headingColor}; --krt-logoCarousel-arrow: ${metadata.arrowColor}; ${sectionLayoutStyles}`
    );

    let content = $derived({
        id,
        type,
        heading,
        logos: logosState,
        metadata: { ...metadata }
    });

    let component = $state<HTMLElement>();
    const componentRef = {};
    let mounted = $state(false);

    function addLogo() {
        logosState = [...logosState, { 
            image: { url: 'https://fakeimg.pl/150x80/?text=New', alt: 'New Brand' }, 
            link: '#' 
        }];
    }

    function removeLogo(index: number) {
        logosState = logosState.filter((_, i) => i !== index);
        if (editingIndex === index) editingIndex = null;
    }

    function updateScrollState() {
        if (!scrollContainer) return;
        canScrollLeft = scrollContainer.scrollLeft > 0;
        canScrollRight = scrollContainer.scrollLeft < scrollContainer.scrollWidth - scrollContainer.clientWidth - 10;
    }

    function scrollLeft() {
        if (!scrollContainer) return;
        scrollContainer.scrollBy({ left: -200, behavior: 'smooth' });
    }

    function scrollRight() {
        if (!scrollContainer) return;
        scrollContainer.scrollBy({ left: 200, behavior: 'smooth' });
    }

    onMount(() => {
        if (!editable) return;
        mounted = true;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
        
        if (scrollContainer) {
            updateScrollState();
            scrollContainer.addEventListener('scroll', updateScrollState);
        }
        
        return () => {
            blockRegistry.unregister(componentRef);
            scrollContainer?.removeEventListener('scroll', updateScrollState);
        };
    });
</script>

{#if editable}
<div class="editor-item group relative krt-logoCarousel__wrapper" bind:this={component}>
    {#if mounted}
        <BlockActions {id} {type} element={component} inspectorTitle="Logo Carousel Settings">
            {#snippet inspector()}
                <div class="krt-logoCarouselDrawer">
                    <section class="krt-logoCarouselDrawer__section">
                        <h3>Section Layout</h3>
                        <SectionLayoutControls bind:layout={sectionLayout} />
                    </section>

                    <section class="krt-logoCarouselDrawer__section">
                        <h3>Colors</h3>
                        <div class="krt-logoCarouselDrawer__grid">
                            <label class="krt-logoCarouselDrawer__field">
                                <span>Background</span>
                                <input type="color" bind:value={metadata.backgroundColor} />
                            </label>
                            <label class="krt-logoCarouselDrawer__field">
                                <span>Heading</span>
                                <input type="color" bind:value={metadata.headingColor} />
                            </label>
                            <label class="krt-logoCarouselDrawer__field">
                                <span>Arrows</span>
                                <input type="color" bind:value={metadata.arrowColor} />
                            </label>
                        </div>
                    </section>

                    <section class="krt-logoCarouselDrawer__section">
                        <h3>Logos</h3>
                        <div class="krt-logoCarouselDrawer__list">
                            {#each logosState as logo, index}
                                <div class="krt-logoCarouselDrawer__item">
                                    <div class="krt-logoCarouselDrawer__itemHeader">
                                        <span>{logo.image?.alt || `Logo ${index + 1}`}</span>
                                        <div class="krt-logoCarouselDrawer__itemActions">
                                            <button type="button" onclick={() => editingIndex = editingIndex === index ? null : index}>
                                                {editingIndex === index ? 'Close' : 'Edit'}
                                            </button>
                                            <button type="button" onclick={() => removeLogo(index)}>Remove</button>
                                        </div>
                                    </div>
                                    {#if editingIndex === index}
                                        <div class="krt-logoCarouselDrawer__itemEdit">
                                            <label class="krt-logoCarouselDrawer__field">
                                                <span>Link (optional)</span>
                                                <input type="url" bind:value={logo.link} placeholder="https://" />
                                            </label>
                                            <div class="krt-logoCarouselDrawer__field">
                                                <span>Logo Image</span>
                                                <ImagePicker 
                                                    bind:selectedImage={logosState[index].image}
                                                    mode="single" 
                                                />
                                            </div>
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                        <button type="button" class="krt-logoCarouselDrawer__addBtn" onclick={addLogo}>
                            + Add Logo
                        </button>
                    </section>
                </div>
            {/snippet}
        </BlockActions>
    {/if}

    <section class="krt-logoCarousel" style={layoutStyle} data-type={type}>
        <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
        <div class="krt-logoCarousel__inner">
            <h2 class="krt-logoCarousel__heading" contenteditable bind:innerHTML={heading}></h2>
            <div class="krt-logoCarousel__container">
                <button type="button" class="krt-logoCarousel__arrow krt-logoCarousel__arrow--left" onclick={scrollLeft} disabled={!canScrollLeft} aria-label="Scroll left">
                    <ChevronLeft size={24} />
                </button>
                <div class="krt-logoCarousel__track" bind:this={scrollContainer} onscroll={updateScrollState}>
                    {#each logosState as logo}
                        {#if logo.link && logo.link !== '#'}
                            <a href={logo.link} class="krt-logoCarousel__logo" onclick={(e) => editable && e.preventDefault()}>
                                {#if logo.image?.url}
                                    <img src={logo.image.url} alt={logo.image.alt ?? 'Brand logo'} loading="lazy" />
                                {:else}
                                    <div class="krt-logoCarousel__placeholder">Add logo</div>
                                {/if}
                            </a>
                        {:else}
                            <div class="krt-logoCarousel__logo">
                                {#if logo.image?.url}
                                    <img src={logo.image.url} alt={logo.image.alt ?? 'Brand logo'} loading="lazy" />
                                {:else}
                                    <div class="krt-logoCarousel__placeholder">Add logo</div>
                                {/if}
                            </div>
                        {/if}
                    {/each}
                </div>
                <button type="button" class="krt-logoCarousel__arrow krt-logoCarousel__arrow--right" onclick={scrollRight} disabled={!canScrollRight} aria-label="Scroll right">
                    <ChevronRight size={24} />
                </button>
            </div>
        </div>
    </section>
</div>
{:else}
    <section id={id} data-type={type} class="krt-logoCarousel" style={layoutStyle}>
        <div class="krt-logoCarousel__inner">
            <h2 class="krt-logoCarousel__heading">{@html heading}</h2>
            <div class="krt-logoCarousel__container">
                <div class="krt-logoCarousel__track krt-logoCarousel__track--static">
                    {#each logos as logo}
                        {#if logo.link && logo.link !== '#'}
                            <a href={logo.link} class="krt-logoCarousel__logo">
                                {#if logo.image?.url}
                                    <img src={logo.image.url} alt={logo.image.alt ?? 'Brand logo'} loading="lazy" />
                                {/if}
                            </a>
                        {:else}
                            <div class="krt-logoCarousel__logo">
                                {#if logo.image?.url}
                                    <img src={logo.image.url} alt={logo.image.alt ?? 'Brand logo'} loading="lazy" />
                                {/if}
                            </div>
                        {/if}
                    {/each}
                </div>
            </div>
        </div>
    </section>
{/if}

<style>
    .krt-logoCarousel {
        width: 100%;
        background-color: var(--krt-logoCarousel-bg, #ffffff);
        padding: var(--krt-section-padding-y, 3rem) var(--krt-section-padding-x, 2rem);
    }

    .krt-logoCarousel__inner {
        max-width: var(--krt-section-max-width, 1200px);
        margin: 0 auto;
        text-align: center;
    }

    .krt-logoCarousel__heading {
        color: var(--krt-logoCarousel-heading, #1a1a1a);
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0 0 2rem 0;
        outline: none;
    }

    .krt-logoCarousel__container {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .krt-logoCarousel__arrow {
        flex-shrink: 0;
        width: 40px;
        height: 40px;
        border: 1px solid #e5e7eb;
        border-radius: 50%;
        background: #fff;
        color: var(--krt-logoCarousel-arrow, #1a1a1a);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
    }

    .krt-logoCarousel__arrow:hover:not(:disabled) {
        background: #f3f4f6;
    }

    .krt-logoCarousel__arrow:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    .krt-logoCarousel__track {
        flex: 1;
        display: flex;
        gap: 2rem;
        overflow-x: auto;
        scroll-behavior: smooth;
        scrollbar-width: none;
        -ms-overflow-style: none;
        padding: 1rem 0;
    }

    .krt-logoCarousel__track::-webkit-scrollbar {
        display: none;
    }

    .krt-logoCarousel__track--static {
        justify-content: center;
        flex-wrap: wrap;
    }

    .krt-logoCarousel__logo {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 120px;
        height: 60px;
        text-decoration: none;
        transition: transform 0.2s;
    }

    .krt-logoCarousel__logo:hover {
        transform: scale(1.05);
    }

    .krt-logoCarousel__logo img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        filter: grayscale(100%);
        opacity: 0.7;
        transition: all 0.2s;
    }

    .krt-logoCarousel__logo:hover img {
        filter: grayscale(0%);
        opacity: 1;
    }

    .krt-logoCarousel__placeholder {
        width: 120px;
        height: 60px;
        background: #f3f4f6;
        border: 1px dashed #d1d5db;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #9ca3af;
        font-size: 0.75rem;
        border-radius: 4px;
    }

    /* Drawer styles */
    .krt-logoCarouselDrawer {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .krt-logoCarouselDrawer__section {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .krt-logoCarouselDrawer__section h3 {
        font-size: 0.875rem;
        font-weight: 600;
        margin: 0;
        color: #374151;
    }

    .krt-logoCarouselDrawer__grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.75rem;
    }

    .krt-logoCarouselDrawer__field {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .krt-logoCarouselDrawer__field span {
        font-size: 0.75rem;
        color: #6b7280;
    }

    .krt-logoCarouselDrawer__field input[type="color"] {
        width: 100%;
        height: 32px;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        cursor: pointer;
    }

    .krt-logoCarouselDrawer__field input[type="url"] {
        padding: 0.5rem;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        font-size: 0.875rem;
    }

    .krt-logoCarouselDrawer__list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .krt-logoCarouselDrawer__item {
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        overflow: hidden;
    }

    .krt-logoCarouselDrawer__itemHeader {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem 0.75rem;
        background: #f9fafb;
    }

    .krt-logoCarouselDrawer__itemHeader span {
        font-size: 0.875rem;
        font-weight: 500;
    }

    .krt-logoCarouselDrawer__itemActions {
        display: flex;
        gap: 0.5rem;
    }

    .krt-logoCarouselDrawer__itemActions button {
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        background: #e5e7eb;
    }

    .krt-logoCarouselDrawer__itemActions button:hover {
        background: #d1d5db;
    }

    .krt-logoCarouselDrawer__itemEdit {
        padding: 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        border-top: 1px solid #e5e7eb;
    }

    .krt-logoCarouselDrawer__addBtn {
        width: 100%;
        padding: 0.5rem;
        border: 1px dashed #d1d5db;
        border-radius: 6px;
        background: transparent;
        color: #6b7280;
        cursor: pointer;
        font-size: 0.875rem;
    }

    .krt-logoCarouselDrawer__addBtn:hover {
        border-color: #9ca3af;
        color: #374151;
    }

    @media (max-width: 640px) {
        .krt-logoCarousel__arrow {
            display: none;
        }

        .krt-logoCarousel__track {
            padding: 0.5rem 0;
        }
    }
</style>
