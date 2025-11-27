<script lang="ts">
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
    import { onMount } from 'svelte';
    import { BlockActions } from "../utils/index.js";
    import { ImagePicker } from "../widgets/index.js";
    
    interface CarouselImage {
        key?: string;
        url?: string;
        src?: string;
        alt?: string;
    }

    interface Props {
        id?: string;
        heading?: string;
        body?: string;
        button?: { label: string; link: string };
        images?: CarouselImage[];
        type?: string;
        metadata?: {
            backgroundColor: string;
            cardBackgroundColor: string;
            reverseOrder: boolean;
            buttonColor: string;
            headingColor: string;
            contentColor: string;
        };
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        heading = $bindable('Noteworthy technology acquisitions 2021'),
        body = $bindable('Here are the biggest enterprise technology acquisitions of 2021 so far, in reverse chronological order.'),
        button = $bindable({ label: 'Read more', link: '#' }),
        images = $bindable<CarouselImage[]>([]),
        type = 'card-with-slider',
        metadata = $bindable({
            backgroundColor: '#f4f4f5',
            cardBackgroundColor: '#ffffff',
            reverseOrder: false,
            buttonColor: '#111827',
            headingColor: '#111827',
            contentColor: '#4b5563'
        }),
        editable = true
    }: Props = $props();


    // Reactive statements to update metadata properties
    let reverseOrder = $state(metadata.reverseOrder);
    let backgroundColor = $state(metadata.backgroundColor);
    let cardBackgroundColor = $state(metadata.cardBackgroundColor);
    let buttonColor = $state(metadata.buttonColor);
    let headingColor = $state(metadata.headingColor);
    let contentColor = $state(metadata.contentColor);

    // Keep original images format for saving, normalized for display
    const normalizedImages = $derived(images.map((image) => ({
        url: image?.url ?? image?.src ?? '',
        alt: image?.alt ?? ''
    })));

    // Save the original images array (not normalized) so it can be reloaded properly
    let content = $derived({
        id,
        type,
        heading,
        body,
        button,
        images, // Save original images, not normalizedImages
        metadata : {
            backgroundColor,
            cardBackgroundColor,
            reverseOrder,
            buttonColor,
            headingColor,
            contentColor
        }
    });

    let component = $state<HTMLElement>();
    const componentRef = {};
    let mounted = $state(false);

    onMount(() => {
        mounted = true;
    });

    onMount(() => {
        if (typeof editable !== 'undefined' && !editable) return;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
        return () => blockRegistry.unregister(componentRef);
    });
</script>

{#if editable}
<div class="editor-item krt-cardWithSlider__editor" bind:this={component} data-krt-serialized={JSON.stringify(content)}>
    {#if mounted}
        <BlockActions
            {id}
            {type}
            element={component}
            inspectorTitle="Card with slider settings"
        >
            {#snippet inspector()}
                <div class="krt-sliderDrawer">
                    <section class="krt-sliderDrawer__section">
                        <h3>Layout</h3>
                        <label class="krt-sliderDrawer__toggle">
                            <input type="checkbox" bind:checked={reverseOrder} />
                            <span>Reverse order</span>
                        </label>
                    </section>

                    <section class="krt-sliderDrawer__section">
                        <h3>Colors</h3>
                        <div class="krt-sliderDrawer__grid">
                            <label class="krt-sliderDrawer__field">
                                <span>Background</span>
                                <input type="color" bind:value={backgroundColor} />
                            </label>
                            <label class="krt-sliderDrawer__field">
                                <span>Card background</span>
                                <input type="color" bind:value={cardBackgroundColor} />
                            </label>
                            <label class="krt-sliderDrawer__field">
                                <span>Heading</span>
                                <input type="color" bind:value={headingColor} />
                            </label>
                            <label class="krt-sliderDrawer__field">
                                <span>Body</span>
                                <input type="color" bind:value={contentColor} />
                            </label>
                            <label class="krt-sliderDrawer__field">
                                <span>Button</span>
                                <input type="color" bind:value={buttonColor} />
                            </label>
                        </div>
                    </section>

                    <section class="krt-sliderDrawer__section">
                        <h3>Images</h3>
                        <ImagePicker bind:selectedImages={images} mode="multiple" />
                    </section>
                </div>
            {/snippet}
        </BlockActions>
    {/if}
    <section {id} data-type={type} class="krt-sliderLayout" style:background-color={backgroundColor}>
        <div class="krt-sliderLayout__inner" class:krt-sliderLayout__inner--reverse={reverseOrder}>
            <div class="krt-sliderLayout__card">
                <div class="krt-card" style:background-color={cardBackgroundColor}>
                    <div class="krt-card__body">
                        <h2
                            class="krt-card__title"
                            style:color={headingColor}
                            id="heading"
                            bind:innerHTML={heading}
                            contenteditable
                        ></h2>
                        <p class="krt-card__copy" style:color={contentColor} id="body" bind:innerHTML={body} contenteditable></p>
                        <div class="krt-card__actions">
                            <a
                                class="krt-card__cta"
                                href={button.link}
                                style:background-color={buttonColor}
                                style:color={contentColor}
                                id="button"
                            >
                                {button.label}
                            </a>
                        </div>
                    </div>
                </div>
            </div>
            <div class="krt-sliderLayout__carousel">
                <div class="krt-nmCarousel" style="--krt-nmCarousel-bg: #020617; --krt-nmCarousel-accent: #0f172a; --krt-nmCarousel-border: rgba(148, 163, 184, 0.35); --krt-nmCarousel-text: #f8fafc;">
                    <div class="krt-nmCarousel__scroller" aria-label="Carousel preview">
                        {#if normalizedImages.length}
                            {#each normalizedImages as image (image.url)}
                                <figure class="krt-nmCarousel__item">
                                    {#if image.url}
                                        <img src={image.url} alt={image.alt} loading="lazy" />
                                    {:else}
                                        <div class="krt-nmCarousel__placeholder">Add image</div>
                                    {/if}
                                </figure>
                            {/each}
                        {:else}
                            <p class="krt-nmCarousel__empty">No images yet. Use the picker to add content.</p>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    </section>
</div>
{:else}
    <section id={id} data-type={type} class="krt-sliderLayout" style:background-color={backgroundColor}>
        <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
        <div class={`krt-sliderLayout__inner ${reverseOrder ? 'krt-sliderLayout__inner--reverse' : ''}`}>
            <div class="krt-sliderLayout__card">
                <div class="krt-card" style:background-color={cardBackgroundColor}>
                    <div class="krt-card__body">
                        <h2 class="krt-card__title" style:color={headingColor}>{heading}</h2>
                        <p class="krt-card__copy" style:color={contentColor}>{body}</p>
                        <div class="krt-card__actions">
                            <a class="krt-card__cta" href={button.link} style:background-color={buttonColor} style:color={contentColor}>
                                {button.label}
                            </a>
                        </div>
                    </div>
                </div>
            </div>
            <div class="krt-sliderLayout__carousel">
                <div class="krt-nmCarousel" style="--krt-nmCarousel-bg: #020617; --krt-nmCarousel-accent: #0f172a; --krt-nmCarousel-border: rgba(148, 163, 184, 0.35); --krt-nmCarousel-text: #f8fafc;">
                    <div class="krt-nmCarousel__scroller" aria-label="Carousel preview">
                        {#if normalizedImages.length}
                            {#each normalizedImages as image (image.url)}
                                <figure class="krt-nmCarousel__item">
                                    {#if image.url}
                                        <img src={image.url} alt={image.alt} loading="lazy" />
                                    {:else}
                                        <div class="krt-nmCarousel__placeholder">Add image</div>
                                    {/if}
                                </figure>
                            {/each}
                        {:else}
                            <p class="krt-nmCarousel__empty">No images yet. Add content in the editor.</p>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    </section>
{/if}

<style>
    .krt-sliderLayout {
        padding: var(--krt-space-3xl, 2.5rem) var(--krt-space-4xl, 3rem);
        display: flex;
        justify-content: center;
    }

    .krt-sliderLayout__metadata {
        display: none;
    }

    .krt-sliderLayout__inner {
        width: min(88rem, 100%);
        display: grid;
        gap: var(--krt-space-2xl, 2rem);
        align-items: stretch;
        grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
    }

    @media (min-width: 64rem) {
        .krt-sliderLayout__inner {
            grid-template-columns: 1fr 1fr;
        }
    }

    .krt-sliderLayout__inner--reverse {
        direction: rtl;
    }

    .krt-sliderLayout__inner--reverse > * {
        direction: ltr;
    }

    .krt-sliderLayout__card,
    .krt-sliderLayout__carousel {
        display: flex;
        flex: 1 1 0;
    }

    .krt-sliderLayout__card {
        min-height: 100%;
    }

    .krt-sliderLayout__carousel {
        border-radius: var(--krt-radius-xl, 1rem);
        overflow: hidden;
    }

    .krt-sliderDrawer {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-xl, 1.25rem);
    }

    .krt-sliderDrawer__section {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-md, 0.75rem);
    }

    .krt-sliderDrawer__section h3 {
        margin: 0;
        font-size: 0.95rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--krt-color-muted, #6b7280);
    }

    .krt-sliderDrawer__toggle {
        display: inline-flex;
        align-items: center;
        gap: var(--krt-space-sm, 0.5rem);
        font-weight: 600;
        color: var(--krt-color-text, #111827);
    }

    .krt-sliderDrawer__toggle input[type='checkbox'] {
        width: 1.2rem;
        height: 1.2rem;
        accent-color: var(--krt-color-primary, #111827);
    }

    .krt-sliderDrawer__grid {
        display: grid;
        gap: var(--krt-space-md, 0.75rem);
    }

    .krt-sliderDrawer__field {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-xs, 0.25rem);
        padding: var(--krt-space-sm, 0.5rem) var(--krt-space-md, 0.75rem);
        border-radius: var(--krt-radius-md, 0.5rem);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        background: var(--krt-color-surface, #ffffff);
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--krt-color-muted, #6b7280);
    }

    .krt-sliderDrawer__field input[type='color'] {
        width: 2.5rem;
        height: 2.5rem;
        border-radius: var(--krt-radius-sm, 0.375rem);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        padding: 0;
        cursor: pointer;
    }

    .krt-cardWithSlider__editor {
        position: relative;
    }

    /* Inlined CardNoImage styles */
    .krt-card {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-lg, 1rem);
        border-radius: var(--krt-radius-xl, 1rem);
        box-shadow: 0 24px 48px rgba(15, 23, 42, 0.08);
        background: var(--krt-color-surface, #ffffff);
        color: var(--krt-color-text, #111827);
        height: 100%;
    }

    .krt-card__body {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-md, 0.75rem);
        padding: var(--krt-space-2xl, 2rem);
        min-height: 100%;
    }

    .krt-card__title {
        margin: 0;
        font-size: clamp(1.8rem, 2.5vw + 1rem, 2.6rem);
        font-weight: 800;
        letter-spacing: -0.015em;
    }

    .krt-card__copy {
        margin: 0;
        font-size: 1rem;
        line-height: 1.7;
    }

    .krt-card__actions {
        margin-top: auto;
    }

    .krt-card__cta {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.65rem 1.4rem;
        border-radius: var(--krt-radius-pill, 999px);
        border: none;
        font-weight: 600;
        text-decoration: none;
        transition: transform 150ms ease, box-shadow 150ms ease, background 150ms ease;
    }

    .krt-card__cta:hover {
        transform: translateY(-2px);
        box-shadow: 0 18px 30px rgba(17, 24, 39, 0.2);
    }

    .krt-card__cta:focus-visible {
        outline: 2px solid var(--krt-color-accent, #4f46e5);
        outline-offset: 2px;
    }

    /* Inlined NoMarginCarousel styles */
    .krt-nmCarousel {
        position: relative;
        background: var(--krt-nmCarousel-bg, #040617);
        color: var(--krt-nmCarousel-text, #f8fafc);
        padding: clamp(1.5rem, 4vw, 3rem);
        border-radius: 1.5rem;
        overflow: hidden;
        border: 1px solid var(--krt-nmCarousel-accent, #0f172a);
        height: 100%;
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
