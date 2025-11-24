<script lang="ts">
    import { onMount } from 'svelte';
    import { BlockActions } from "../utils/index.js";
    import { ImagePicker } from "../plugins/index.js";
	import CardNoImage from '../blocks/CardNoImage.svelte';
	import NoMarginCarousel from '../blocks/NoMarginCarousel.svelte';
    
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
        heading = 'Noteworthy technology acquisitions 2021',
        body = 'Here are the biggest enterprise technology acquisitions of 2021 so far, in reverse chronological order.',
        button = $bindable({ label: 'Read more', link: '#' }),
        images = $bindable<CarouselImage[]>([]),
        type = 'hero-with-slider',
        metadata = {
            backgroundColor: '#f4f4f5',
            cardBackgroundColor: '#ffffff',
            reverseOrder: false,
            buttonColor: '#111827',
            headingColor: '#111827',
            contentColor: '#4b5563'
        },
        editable = true
    }: Props = $props();


    // Reactive statements to update metadata properties
    let reverseOrder = $state(metadata.reverseOrder);
    let backgroundColor = $state(metadata.backgroundColor);
    let cardBackgroundColor = $state(metadata.cardBackgroundColor);
    let buttonColor = $state(metadata.buttonColor);
    let headingColor = $state(metadata.headingColor);
    let contentColor = $state(metadata.contentColor);

    // extract card body from the content and the card title
    const normalizedImages = $derived(images.map((image) => ({
        url: image?.key ? `/api/bucket/${image.key}` : image?.url ?? image?.src ?? '',
        alt: image?.alt ?? ''
    })));

    let content = $derived({
        id,
        type,
        heading,
        body,
        button,
        images: normalizedImages,
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
    let mounted = $state(false);

    onMount(() => {
        mounted = true;
    });
</script>

{#if editable}
<div class="editor-item krt-cardWithSlider__editor" bind:this={component}>
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
                <CardNoImage
                    bind:heading={heading}
                    bind:body={body}
                    link={button.link}
                    bind:button={button.label}
                    backgroundColor={cardBackgroundColor}
                    buttonColor={buttonColor}
                    {headingColor}
                    {contentColor}
                />
            </div>
            <div class="krt-sliderLayout__carousel">
                <NoMarginCarousel bind:images={images} />
            </div>
        </div>
    </section>
</div>
{:else}
    <section id={id} data-type={type} class="krt-sliderLayout" style:background-color={backgroundColor}>
        <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
        <div class={`krt-sliderLayout__inner ${reverseOrder ? 'krt-sliderLayout__inner--reverse' : ''}`}>
            <div class="krt-sliderLayout__card">
                <CardNoImage
                    heading={heading}
                    body={body}
                    link={button.link}
                    button={button.label}
                    backgroundColor={cardBackgroundColor}
                    buttonColor={buttonColor}
                    {headingColor}
                    {contentColor}
                    editable={false}
                />
            </div>
            <div class="krt-sliderLayout__carousel">
                <NoMarginCarousel images={normalizedImages} editable={false} />
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
</style>
