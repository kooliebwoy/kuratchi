<script lang="ts">
    import { LayoutBlock } from '../shell/index.js';
    import { ImagePicker } from '../plugins/index.js';

    interface CarouselImage {
        src?: string;
        key?: string;
        alt?: string;
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
        type = 'basic-carousel',
        images = $bindable<CarouselImage[]>([
            { key: 'carousel-1', src: 'https://fakeimg.pl/600x420/?text=Kuratchi', alt: 'Hero image 1' },
            { key: 'carousel-2', src: 'https://fakeimg.pl/600x420/?text=Editor', alt: 'Hero image 2' },
            { key: 'carousel-3', src: 'https://fakeimg.pl/600x420/?text=Layout', alt: 'Hero image 3' }
        ]),
        metadata: layoutMetadata = $bindable<LayoutMetadata>({
            backgroundColor: '#020617',
            accentColor: '#0f172a',
            borderColor: 'rgba(148, 163, 184, 0.3)',
            textColor: '#f8fafc'
        }) as LayoutMetadata,
        editable = true
    }: Props = $props();

    const normalizedImages = $derived(
        images.map((image, index) => ({
            id: image?.key ?? `basic-carousel-${index}`,
            url: image?.key ? `/api/bucket/${image.key}` : image?.src ?? '',
            alt: image?.alt ?? 'Carousel slide'
        }))
    );

    const layoutStyle = $derived(
        `--krt-basicCarousel-bg: ${layoutMetadata.backgroundColor}; --krt-basicCarousel-accent: ${layoutMetadata.accentColor}; --krt-basicCarousel-border: ${layoutMetadata.borderColor}; --krt-basicCarousel-text: ${layoutMetadata.textColor};`
    );

    const content = $derived({
        id,
        type,
        images: normalizedImages,
        metadata: { ...layoutMetadata }
    });
</script>

{#if editable}
<LayoutBlock {id} {type}>
    {#snippet drawerContent()}
        <div class="krt-basicCarouselDrawer">
            <section class="krt-basicCarouselDrawer__section">
                <div>
                    <p class="krt-basicCarouselDrawer__eyebrow">Gallery</p>
                    <h3>Carousel images</h3>
                </div>
                <ImagePicker bind:selectedImages={images} mode="multiple" />
            </section>

            <section class="krt-basicCarouselDrawer__section">
                <h3>Colors</h3>
                <div class="krt-basicCarouselDrawer__grid">
                    <label class="krt-basicCarouselDrawer__field">
                        <span>Background</span>
                        <input type="color" aria-label="Background color" bind:value={layoutMetadata.backgroundColor} />
                    </label>
                    <label class="krt-basicCarouselDrawer__field">
                        <span>Accent</span>
                        <input type="color" aria-label="Accent color" bind:value={layoutMetadata.accentColor} />
                    </label>
                    <label class="krt-basicCarouselDrawer__field">
                        <span>Border</span>
                        <input type="color" aria-label="Border color" bind:value={layoutMetadata.borderColor} />
                    </label>
                    <label class="krt-basicCarouselDrawer__field">
                        <span>Text</span>
                        <input type="color" aria-label="Text color" bind:value={layoutMetadata.textColor} />
                    </label>
                </div>
            </section>
        </div>
    {/snippet}

    {#snippet metadata()}
        {JSON.stringify(content)}
    {/snippet}

    {#snippet children()}
        <section class="krt-basicCarousel" style={layoutStyle} data-type={type}>
            <div class="krt-basicCarousel__metadata">{JSON.stringify(content)}</div>
            <div class="krt-basicCarousel__rail" tabindex="0" aria-label="Carousel preview">
                {#if normalizedImages.length}
                    {#each normalizedImages as image (image.id)}
                        <figure class="krt-basicCarousel__item">
                            {#if image.url}
                                <img src={image.url} alt={image.alt} loading="lazy" />
                            {:else}
                                <div class="krt-basicCarousel__placeholder">Add image</div>
                            {/if}
                        </figure>
                    {/each}
                {:else}
                    <p class="krt-basicCarousel__empty">No images yet. Use the picker to add content.</p>
                {/if}
            </div>
        </section>
    {/snippet}
</LayoutBlock>
{:else}
    <section id={id} data-type={type} class="krt-basicCarousel" style={layoutStyle}>
        <div class="krt-basicCarousel__metadata" data-type={type}>{JSON.stringify(content)}</div>
        <div class="krt-basicCarousel__rail" tabindex="0" aria-label="Carousel preview">
            {#if normalizedImages.length}
                {#each normalizedImages as image (image.id)}
                    {#if image.url}
                        <figure class="krt-basicCarousel__item">
                            <img src={image.url} alt={image.alt} loading="lazy" />
                        </figure>
                    {/if}
                {/each}
            {:else}
                <p class="krt-basicCarousel__empty">No images yet. Add content in the editor.</p>
            {/if}
        </div>
    </section>
{/if}

<style>
    .krt-basicCarouselDrawer {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }

    .krt-basicCarouselDrawer__section {
        border: 1px solid var(--krt-color-border-subtle, #e2e8f0);
        border-radius: 1rem;
        padding: 1.25rem;
        background: var(--krt-color-surface, #fff);
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .krt-basicCarouselDrawer__section h3 {
        margin: 0;
        font-size: 1rem;
    }

    .krt-basicCarouselDrawer__eyebrow {
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        font-size: 0.7rem;
        color: var(--krt-color-muted, #475569);
    }

    .krt-basicCarouselDrawer__grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 0.75rem;
    }

    .krt-basicCarouselDrawer__field {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        font-size: 0.85rem;
    }

    .krt-basicCarouselDrawer__field input[type='color'] {
        width: 100%;
        min-height: 2.5rem;
        border-radius: 0.75rem;
        border: 1px solid var(--krt-color-border-subtle, #e2e8f0);
        background: #fff;
        cursor: pointer;
    }

    .krt-basicCarousel {
        position: relative;
        padding: clamp(1.5rem, 4vw, 3rem);
        border-radius: 1.5rem;
        background: var(--krt-basicCarousel-bg, #020617);
        border: 1px solid var(--krt-basicCarousel-accent, #0f172a);
        color: var(--krt-basicCarousel-text, #f8fafc);
        overflow: hidden;
    }

    .krt-basicCarousel__metadata {
        position: absolute;
        inset: 1rem auto auto 1rem;
        opacity: 0;
        pointer-events: none;
        font-size: 0;
    }

    .krt-basicCarousel__rail {
        display: flex;
        gap: 1rem;
        overflow-x: auto;
        padding-bottom: 0.5rem;
        scrollbar-width: thin;
        scrollbar-color: var(--krt-basicCarousel-accent, #0f172a) transparent;
    }

    .krt-basicCarousel__rail::-webkit-scrollbar {
        height: 8px;
    }

    .krt-basicCarousel__rail::-webkit-scrollbar-thumb {
        background: var(--krt-basicCarousel-accent, #0f172a);
        border-radius: 999px;
    }

    .krt-basicCarousel__item {
        min-width: clamp(220px, 30vw, 360px);
        border-radius: 1.25rem;
        overflow: hidden;
        border: 1px solid var(--krt-basicCarousel-border, rgba(148, 163, 184, 0.3));
        margin: 0;
        background: rgba(255, 255, 255, 0.04);
    }

    .krt-basicCarousel__item img,
    .krt-basicCarousel__placeholder {
        width: 100%;
        height: clamp(220px, 35vw, 420px);
        object-fit: cover;
        display: block;
    }

    .krt-basicCarousel__placeholder {
        display: grid;
        place-items: center;
        font-size: 0.9rem;
        color: var(--krt-basicCarousel-text, #f8fafc);
        background: repeating-linear-gradient(
            45deg,
            rgba(255, 255, 255, 0.08),
            rgba(255, 255, 255, 0.08) 10px,
            rgba(255, 255, 255, 0.16) 10px,
            rgba(255, 255, 255, 0.16) 20px
        );
    }

    .krt-basicCarousel__empty {
        color: var(--krt-basicCarousel-text, #f8fafc);
        opacity: 0.8;
    }
</style>
