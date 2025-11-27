<script lang="ts">
    import { onMount } from 'svelte';
    import { BlockActions } from '../utils/index.js';
    import { ImagePicker } from '../widgets/index.js';
    import { blockRegistry } from '../stores/editorSignals.svelte.js';

    interface CardImage {
        url?: string;
        alt?: string;
        title?: string;
        key?: string;
        src?: string;
    }

    interface LayoutMetadata {
        backgroundColor: string;
        textColor: string;
        reverseOrder: boolean;
    }

    interface Props {
        id?: string;
        heading?: string;
        body?: string;
        image?: CardImage;
        type?: string;
        metadata?: LayoutMetadata;
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        heading = $bindable('About our studio'),
        body = $bindable(
            'We blend strategy, curiosity, and craftsmanship to craft experiences people love. Collaborate with our team to uncover your brand story and translate it into beautiful outcomes.'
        ),
        image = $bindable<CardImage>({
            url: 'https://fakeimg.pl/650x500/?text=Team&font=lobster',
            alt: 'Studio team collaborating',
            title: 'Studio team photograph'
        }),
        type = 'about-us-card',
        metadata: layoutMetadata = $bindable<LayoutMetadata>({
            backgroundColor: '#f3f4f680',
            textColor: '#111827',
            reverseOrder: false
        }) as LayoutMetadata,
        editable = true
    }: Props = $props();

    // Initialize defaults once
    if (!layoutMetadata.backgroundColor) layoutMetadata.backgroundColor = '#f3f4f680';
    if (!layoutMetadata.textColor) layoutMetadata.textColor = '#111827';
    if (layoutMetadata.reverseOrder === undefined) layoutMetadata.reverseOrder = false;
    if (!image.alt) image.alt = 'About us image';
    if (!image.title) image.title = image.alt ?? 'About us image';

    // Use url directly (already contains full cloud URL from upload), fallback to src for legacy
    const imageUrl = $derived(image?.url ?? image?.src ?? '');

    let content = $derived({
        id,
        type,
        heading,
        body,
        image,
        metadata: { ...layoutMetadata }
    });

    let component = $state<HTMLElement>();
    let mounted = $state(false);
    const componentRef = {};

    onMount(() => {
        if (!editable) return;
        mounted = true;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
        return () => blockRegistry.unregister(componentRef);
    });
</script>

{#if editable}
<div class="editor-item krt-aboutCard__editor" bind:this={component}>
    {#if mounted}
        <BlockActions
            {id}
            {type}
            element={component}
            inspectorTitle="About card settings"
        >
            {#snippet inspector()}
                <div class="krt-aboutCardDrawer">
                    <section class="krt-aboutCardDrawer__section">
                        <h3>Content</h3>
                        <div class="krt-aboutCardDrawer__fields">
                            <label class="krt-aboutCardDrawer__field">
                                <span>Heading</span>
                                <input type="text" bind:value={heading} placeholder="Heading" />
                            </label>
                            <label class="krt-aboutCardDrawer__field">
                                <span>Body</span>
                                <textarea rows="4" bind:value={body} placeholder="Tell your brand story"></textarea>
                            </label>
                        </div>
                    </section>

                    <section class="krt-aboutCardDrawer__section">
                        <h3>Layout</h3>
                        <label class="krt-aboutCardDrawer__toggle">
                            <input type="checkbox" bind:checked={layoutMetadata.reverseOrder} />
                            <span>Swap image and copy</span>
                        </label>
                    </section>

                    <section class="krt-aboutCardDrawer__section">
                        <h3>Colors</h3>
                        <div class="krt-aboutCardDrawer__grid">
                            <label class="krt-aboutCardDrawer__field">
                                <span>Background</span>
                                <input type="color" bind:value={layoutMetadata.backgroundColor} />
                            </label>
                            <label class="krt-aboutCardDrawer__field">
                                <span>Text</span>
                                <input type="color" bind:value={layoutMetadata.textColor} />
                            </label>
                        </div>
                    </section>

                    <section class="krt-aboutCardDrawer__section">
                        <h3>Image</h3>
                        <ImagePicker bind:selectedImage={image} mode="single" />
                    </section>
                </div>
            {/snippet}
        </BlockActions>
    {/if}
    <section
        {id}
        data-type={type}
        class={`krt-aboutCard ${layoutMetadata.reverseOrder ? 'krt-aboutCard--reverse' : ''}`}
        style:background-color={layoutMetadata.backgroundColor}
    >
        <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
        <div class="krt-aboutCard__inner">
            <div class="krt-aboutCard__copy">
                <h2 class="krt-aboutCard__heading" style:color={layoutMetadata.textColor} contenteditable bind:innerHTML={heading}></h2>
                <p class="krt-aboutCard__body" style:color={layoutMetadata.textColor} contenteditable bind:innerHTML={body}></p>
            </div>
            <figure class="krt-aboutCard__media">
                {#if imageUrl}
                    <img src={imageUrl} alt={image.alt} title={image.title} />
                {:else}
                    <div class="krt-aboutCard__placeholder" aria-hidden="true">Add image</div>
                {/if}
            </figure>
        </div>
    </section>

    <BlockActions
        {id}
        {type}
        element={component}
        inspectorTitle="About card settings"
    >
        {#snippet inspector()}
            <div class="krt-aboutCardDrawer">
                <section class="krt-aboutCardDrawer__section">
                    <h3>Content</h3>
                    <div class="krt-aboutCardDrawer__fields">
                        <label class="krt-aboutCardDrawer__field">
                            <span>Heading</span>
                            <input type="text" bind:value={heading} placeholder="Heading" />
                        </label>
                        <label class="krt-aboutCardDrawer__field">
                            <span>Body</span>
                            <textarea rows="4" bind:value={body} placeholder="Tell your brand story"></textarea>
                        </label>
                    </div>
                </section>

                <section class="krt-aboutCardDrawer__section">
                    <h3>Layout</h3>
                    <label class="krt-aboutCardDrawer__toggle">
                        <input type="checkbox" bind:checked={layoutMetadata.reverseOrder} />
                        <span>Swap image and copy</span>
                    </label>
                </section>

                <section class="krt-aboutCardDrawer__section">
                    <h3>Colors</h3>
                    <div class="krt-aboutCardDrawer__grid">
                        <label class="krt-aboutCardDrawer__field">
                            <span>Background</span>
                            <input type="color" bind:value={layoutMetadata.backgroundColor} />
                        </label>
                        <label class="krt-aboutCardDrawer__field">
                            <span>Text</span>
                            <input type="color" bind:value={layoutMetadata.textColor} />
                        </label>
                    </div>
                </section>

                <section class="krt-aboutCardDrawer__section">
                    <h3>Image</h3>
                    <ImagePicker bind:selectedImage={image} mode="single" />
                </section>
            </div>
        {/snippet}
    </BlockActions>
</div>
{:else}
    <section
        id={id}
        data-type={type}
        class={`krt-aboutCard ${layoutMetadata.reverseOrder ? 'krt-aboutCard--reverse' : ''}`}
        style:background-color={layoutMetadata.backgroundColor}
    >
        <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
        <div class="krt-aboutCard__inner">
            <div class="krt-aboutCard__copy">
                <h2 class="krt-aboutCard__heading" style:color={layoutMetadata.textColor}>
                    {@html heading}
                </h2>
                <div class="krt-aboutCard__body" style:color={layoutMetadata.textColor}>
                    {@html body}
                </div>
            </div>
            {#if imageUrl}
                <figure class="krt-aboutCard__media">
                    <img src={imageUrl} alt={image?.alt ?? ''} title={image?.title ?? ''} />
                </figure>
            {/if}
        </div>
    </section>
{/if}

<style>
    .krt-aboutCard {
        position: relative;
        isolation: isolate;
        border-radius: var(--krt-radius-2xl, 1.5rem);
        padding: clamp(2.5rem, 5vw + 1rem, 5rem);
        box-shadow: 0 32px 64px rgba(15, 23, 42, 0.12);
        overflow: hidden;
    }

    .krt-aboutCard__metadata {
        display: none;
    }

    .krt-aboutCard__inner {
        display: flex;
        flex-direction: column;
        gap: clamp(1.5rem, 4vw, 3rem);
        align-items: center;
    }

    .krt-aboutCard__copy {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-lg, 1rem);
        max-width: 44ch;
        text-align: center;
    }

    .krt-aboutCard__heading {
        margin: 0;
        font-size: clamp(2rem, 3vw + 1rem, 3rem);
        font-weight: 800;
        letter-spacing: -0.02em;
    }

    .krt-aboutCard__body {
        margin: 0;
        font-size: clamp(1rem, 0.4vw + 0.95rem, 1.125rem);
        line-height: 1.7;
    }

    .krt-aboutCard__media {
        width: min(520px, 100%);
        border-radius: var(--krt-radius-2xl, 1.5rem);
        overflow: hidden;
        aspect-ratio: 5 / 4;
        background: color-mix(in srgb, var(--krt-color-surface, #ffffff) 82%, transparent);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .krt-aboutCard__media img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    .krt-aboutCard__placeholder {
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
        font-size: 0.95rem;
        font-weight: 500;
        color: color-mix(in srgb, var(--krt-color-text, #111827) 55%, transparent);
        background: repeating-linear-gradient(
            45deg,
            color-mix(in srgb, var(--krt-color-border, #d1d5db) 40%, transparent) 0,
            color-mix(in srgb, var(--krt-color-border, #d1d5db) 40%, transparent) 12px,
            transparent 12px,
            transparent 24px
        );
    }

    .krt-aboutCard--reverse .krt-aboutCard__inner {
        flex-direction: column-reverse;
    }

    @media (min-width: 900px) {
        .krt-aboutCard__inner {
            flex-direction: row;
            align-items: stretch;
            justify-content: space-between;
            text-align: left;
        }

        .krt-aboutCard--reverse .krt-aboutCard__inner {
            flex-direction: row-reverse;
        }

        .krt-aboutCard__copy {
            text-align: left;
            justify-content: center;
        }

        .krt-aboutCard__media {
            flex: 1 1 45%;
            max-width: none;
        }
    }

    .krt-aboutCard__heading,
    .krt-aboutCard__body {
        outline: none;
    }

    .krt-aboutCardDrawer {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-lg, 1rem);
    }

    .krt-aboutCardDrawer__section {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-md, 0.75rem);
        padding: var(--krt-space-lg, 1rem);
        border-radius: var(--krt-radius-lg, 0.9rem);
        border: 1px solid color-mix(in srgb, var(--krt-color-border, #d1d5db) 78%, transparent);
        background: color-mix(in srgb, var(--krt-color-surface, #ffffff) 94%, transparent);
    }

    .krt-aboutCardDrawer__section h3 {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
    }

    .krt-aboutCardDrawer__fields {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-md, 0.75rem);
    }

    .krt-aboutCardDrawer__field {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        font-size: 0.9rem;
    }

    .krt-aboutCardDrawer__field span {
        font-weight: 500;
        color: color-mix(in srgb, var(--krt-color-text, #111827) 80%, transparent);
    }

    .krt-aboutCardDrawer__field input[type='text'],
    .krt-aboutCardDrawer__field textarea {
        appearance: none;
        width: 100%;
        font: inherit;
        padding: 0.55rem 0.7rem;
        border-radius: var(--krt-radius-md, 0.75rem);
        border: 1px solid color-mix(in srgb, var(--krt-color-border, #d1d5db) 82%, transparent);
        background: color-mix(in srgb, var(--krt-color-surface, #ffffff) 96%, transparent);
        outline: none;
        transition: border-color 120ms ease, box-shadow 120ms ease;
        resize: vertical;
    }

    .krt-aboutCardDrawer__field input[type='text']:focus,
    .krt-aboutCardDrawer__field textarea:focus {
        border-color: color-mix(in srgb, var(--krt-color-primary, #2563eb) 55%, transparent);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--krt-color-primary, #2563eb) 25%, transparent);
    }

    .krt-aboutCardDrawer__field input[type='color'] {
        appearance: none;
        width: 100%;
        min-height: 2.5rem;
        border: 1px solid color-mix(in srgb, var(--krt-color-border, #d1d5db) 82%, transparent);
        border-radius: var(--krt-radius-md, 0.75rem);
        padding: 0.25rem;
        background: color-mix(in srgb, var(--krt-color-surface, #ffffff) 96%, transparent);
    }

    .krt-aboutCardDrawer__grid {
        display: grid;
        gap: var(--krt-space-md, 0.75rem);
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    }

    .krt-aboutCardDrawer__toggle {
        display: inline-flex;
        align-items: center;
        gap: var(--krt-space-sm, 0.5rem);
        font-size: 0.9rem;
        font-weight: 500;
    }

    .krt-aboutCardDrawer__toggle input {
        margin: 0;
    }

    .krt-aboutCard__editor {
        position: relative;
    }
</style>
