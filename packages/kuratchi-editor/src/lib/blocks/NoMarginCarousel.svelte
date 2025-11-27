<script lang="ts">
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
    import { Pencil } from '@lucide/svelte';
    import { onMount } from 'svelte';
    import { ImagePicker } from '../widgets/index.js';
    import { BlockActions, SideActions } from '../utils/index.js';

    interface CarouselImage {
        key?: string;
        url?: string;
        src?: string;
        alt?: string;
        title?: string;
    }

    interface LayoutMetadata {
        backgroundColor: string;
        accentColor: string;
        borderColor: string;
        textColor: string;
    }

    interface Props {
        id?: string;
        type?: string;
        images?: CarouselImage[];
        metadata?: LayoutMetadata;
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        type = 'no-margin-carousel',
        images = $bindable<CarouselImage[]>([
            { key: 'image-1', src: 'https://fakeimg.pl/450x600/?text=World&font=lobster', alt: 'Hero image 1' },
            { key: 'image-2', src: 'https://fakeimg.pl/450x600/?text=World&font=shrimp', alt: 'Hero image 2' },
            { key: 'image-3', src: 'https://fakeimg.pl/450x600/?text=World&font=crab', alt: 'Hero image 3' }
        ]),
        metadata: layoutMetadata = $bindable<LayoutMetadata>({
            backgroundColor: '#020617',
            accentColor: '#0f172a',
            borderColor: 'rgba(148, 163, 184, 0.35)',
            textColor: '#f8fafc'
        }) as LayoutMetadata,
        editable = true
    }: Props = $props();

    const normalizedImages = $derived(
        images.map((image, index) => ({
            id: image?.key ?? `carousel-image-${index}`,
            url: image?.key ? `/api/bucket/${image.key}` : image?.url ?? image?.src ?? '',
            alt: image?.alt ?? 'Carousel image',
            title: image?.title ?? ''
        }))
    );

    const layoutStyle = $derived(
        `--krt-nmCarousel-bg: ${layoutMetadata.backgroundColor}; --krt-nmCarousel-accent: ${layoutMetadata.accentColor}; --krt-nmCarousel-border: ${layoutMetadata.borderColor}; --krt-nmCarousel-text: ${layoutMetadata.textColor};`
    );

    const content = $derived({
        id,
        type,
        images: normalizedImages,
        metadata: { ...layoutMetadata }
    });

    let component: HTMLElement;
    const componentRef = {};
    let mounted = $state(false);
    const sideActionsId = `side-actions-${id}`;

    onMount(() => {
        mounted = true;
    });

    // Explicit export for TypeScript compatibility
    export {};

    onMount(() => {
        if (typeof editable !== 'undefined' && !editable) return;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
        return () => blockRegistry.unregister(componentRef);
    });
</script>

{#if editable}
    <div class="editor-item group relative" bind:this={component}>
        {#if mounted}
            <BlockActions {id} {type} element={component} />
        {/if}
        <section class="krt-nmCarousel" style={layoutStyle} {id} data-type={type}>
            <div class="krt-nmCarousel__metadata">{JSON.stringify(content)}</div>
            <div class="krt-nmCarousel__scroller" aria-label="Carousel preview">
                {#if normalizedImages.length}
                    {#each normalizedImages as image (image.id)}
                        <figure class="krt-nmCarousel__item">
                            {#if image.url}
                                <img src={image.url} alt={image.alt} title={image.title} loading="lazy" />
                            {:else}
                                <div class="krt-nmCarousel__placeholder">Add image</div>
                            {/if}
                        </figure>
                    {/each}
                {:else}
                    <p class="krt-nmCarousel__empty">No images yet. Use the picker to add content.</p>
                {/if}
            </div>
        </section>
    </div>

    <SideActions triggerId={sideActionsId}>
        {#snippet label()}
            <button id={sideActionsId} class="krt-editButton" aria-label="Edit carousel settings" type="button">
                <Pencil size={16} />
                <span>Edit Settings</span>
            </button>
        {/snippet}
        {#snippet content()}
            <div class="krt-nmCarouselDrawer">
                <section class="krt-nmCarouselDrawer__section">
                    <div class="krt-nmCarouselDrawer__header">
                        <div>
                            <p class="krt-nmCarouselDrawer__eyebrow">Gallery</p>
                            <h3>Carousel images</h3>
                        </div>
                        <p>{images.length} selected</p>
                    </div>
                    <ImagePicker bind:selectedImages={images} mode="multiple" />
                </section>

                <section class="krt-nmCarouselDrawer__section">
                    <h3>Colors</h3>
                    <div class="krt-nmCarouselDrawer__grid">
                        <label class="krt-nmCarouselDrawer__field">
                            <span>Background</span>
                            <input type="color" aria-label="Background color" bind:value={layoutMetadata.backgroundColor} />
                        </label>
                        <label class="krt-nmCarouselDrawer__field">
                            <span>Accent</span>
                            <input type="color" aria-label="Accent color" bind:value={layoutMetadata.accentColor} />
                        </label>
                        <label class="krt-nmCarouselDrawer__field">
                            <span>Border</span>
                            <input type="color" aria-label="Border color" bind:value={layoutMetadata.borderColor} />
                        </label>
                        <label class="krt-nmCarouselDrawer__field">
                            <span>Text</span>
                            <input type="color" aria-label="Text color" bind:value={layoutMetadata.textColor} />
                        </label>
                    </div>
                </section>
            </div>
        {/snippet}
    </SideActions>
{:else}
    <section id={id} data-type={type} class="krt-nmCarousel" style={layoutStyle}>
        <div class="krt-nmCarousel__metadata" data-type={type}>{JSON.stringify(content)}</div>
        <div class="krt-nmCarousel__scroller" aria-label="Carousel preview">
            {#if normalizedImages.length}
                {#each normalizedImages as image (image.id)}
                    {#if image.url}
                        <figure class="krt-nmCarousel__item">
                            <img src={image.url} alt={image.alt} title={image.title} loading="lazy" />
                        </figure>
                    {/if}
                {/each}
            {:else}
                <p class="krt-nmCarousel__empty">No images yet. Add content in the editor.</p>
            {/if}
        </div>
    </section>
{/if}

<style>
    .krt-nmCarouselDrawer {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .krt-nmCarouselDrawer__section {
        border: 1px solid var(--krt-color-border-subtle, #e2e8f0);
        border-radius: 1rem;
        padding: 1.25rem;
        background: var(--krt-color-surface, #fff);
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .krt-nmCarouselDrawer__header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: center;
    }

    .krt-nmCarouselDrawer__header h3 {
        margin: 0.1rem 0 0;
        font-size: 1rem;
    }

    .krt-nmCarouselDrawer__header p {
        margin: 0;
        color: var(--krt-color-muted, #475569);
        font-size: 0.85rem;
    }

    .krt-nmCarouselDrawer__eyebrow {
        text-transform: uppercase;
        font-size: 0.7rem;
        letter-spacing: 0.2em;
        margin: 0;
        color: var(--krt-color-muted, #475569);
    }

    .krt-nmCarouselDrawer__grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 0.75rem;
    }

    .krt-nmCarouselDrawer__field {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        font-size: 0.85rem;
    }

    .krt-nmCarouselDrawer__field input[type='color'] {
        cursor: pointer;
        width: 100%;
        min-height: 2.5rem;
        border-radius: 0.75rem;
        border: 1px solid var(--krt-color-border-subtle, #e2e8f0);
        background: #fff;
    }

    .krt-nmCarousel {
        position: relative;
        background: var(--krt-nmCarousel-bg, #040617);
        color: var(--krt-nmCarousel-text, #f8fafc);
        padding: clamp(1.5rem, 4vw, 3rem);
        border-radius: 1.5rem;
        overflow: hidden;
        border: 1px solid var(--krt-nmCarousel-accent, #0f172a);
    }

    .krt-nmCarousel__metadata {
        position: absolute;
        inset: 1rem auto auto 1rem;
        pointer-events: none;
        opacity: 0;
        font-size: 0;
    }

    .krt-nmCarousel__scroller {
        display: flex;
        gap: 1rem;
        overflow-x: auto;
        padding-bottom: 0.5rem;
        scrollbar-width: thin;
        scrollbar-color: var(--krt-nmCarousel-accent, #0f172a) transparent;
    }

    .krt-nmCarousel__scroller::-webkit-scrollbar {
        height: 8px;
    }

    .krt-nmCarousel__scroller::-webkit-scrollbar-track {
        background: transparent;
    }

    .krt-nmCarousel__scroller::-webkit-scrollbar-thumb {
        background: var(--krt-nmCarousel-accent, #0f172a);
        border-radius: 999px;
    }

    .krt-nmCarousel__item {
        min-width: clamp(220px, 30vw, 360px);
        border-radius: 1rem;
        overflow: hidden;
        border: 1px solid var(--krt-nmCarousel-border, rgba(148, 163, 184, 0.35));
        margin: 0;
        position: relative;
    }

    .krt-nmCarousel__item img,
    .krt-nmCarousel__placeholder {
        display: block;
        width: 100%;
        height: clamp(280px, 50vh, 520px);
        object-fit: cover;
    }

    .krt-nmCarousel__placeholder {
        display: grid;
        place-items: center;
        font-size: 0.9rem;
        color: var(--krt-nmCarousel-text, #f8fafc);
        background: repeating-linear-gradient(
            45deg,
            rgba(255, 255, 255, 0.08),
            rgba(255, 255, 255, 0.08) 10px,
            rgba(255, 255, 255, 0.16) 10px,
            rgba(255, 255, 255, 0.16) 20px
        );
    }

    .krt-nmCarousel__empty {
        color: var(--krt-nmCarousel-text, #f8fafc);
        opacity: 0.8;
    }
</style>
