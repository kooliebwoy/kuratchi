<script lang="ts">
    import { onMount } from 'svelte';
    import { Pencil } from 'lucide-svelte';
    import { BlockActions, SideActions } from '../shell/index.js';

    interface HeroButton {
        label?: string;
        link?: string;
    }

    interface HeroImage {
        url?: string;
        alt?: string;
        title?: string;
        key?: string;
    }

    interface LayoutMetadata {
        reverseOrder: boolean;
        backgroundColor: string;
        headingColor: string;
        textColor: string;
        buttonColor: string;
        showBackgroundImage: boolean;
        backgroundImage: string;
    }

    interface Props {
        id?: string;
        type?: string;
        heading?: string;
        body?: string;
        button?: HeroButton;
        metadata?: LayoutMetadata;
        image?: HeroImage;
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        type = 'hero-overlay',
        heading = $bindable('Hello there'),
        body = $bindable(
            'Provident cupiditate voluptatem et in. Quaerat fugiat ut assumenda excepturi exercitationem quasi. In deleniti eaque aut repudiandae et a id nisi.'
        ),
        button = $bindable<HeroButton>({
            link: '#',
            label: 'Read more'
        }),
        metadata: layoutMetadata = $bindable<LayoutMetadata>({
            reverseOrder: false,
            backgroundColor: '#05060a',
            headingColor: '#f8fafc',
            textColor: '#e2e8f0',
            buttonColor: '#f97316',
            showBackgroundImage: true,
            backgroundImage: 'https://fakeimg.pl/1600x900/?text=Hero+Overlay'
        }) as LayoutMetadata,
        image = $bindable<HeroImage>({
            url: 'https://fakeimg.pl/960x1200/?text=Overlay+Hero',
            alt: 'Hero overlay image',
            title: 'Hero overlay image'
        }),
        editable = true
    }: Props = $props();

    const backgroundImageValue = $derived(
        layoutMetadata.showBackgroundImage && layoutMetadata.backgroundImage
            ? `url(${layoutMetadata.backgroundImage})`
            : 'none'
    );

    const backgroundOpacity = $derived(layoutMetadata.showBackgroundImage ? 1 : 0);

    const layoutStyle = $derived(
        `--krt-heroOverlay-bg: ${layoutMetadata.backgroundColor}; --krt-heroOverlay-heading: ${layoutMetadata.headingColor}; --krt-heroOverlay-text: ${layoutMetadata.textColor}; --krt-heroOverlay-button: ${layoutMetadata.buttonColor}; --krt-heroOverlay-bgImage: ${backgroundImageValue}; --krt-heroOverlay-bgOpacity: ${backgroundOpacity};`
    );

    const content = $derived({
        id,
        type,
        heading,
        body,
        button,
        image,
        metadata: { ...layoutMetadata }
    });

    let component: HTMLElement;
    let mounted = $state(false);
    const sideActionsId = `side-actions-${id}`;

    onMount(() => {
        mounted = true;
    });
</script>
  
{#if editable}
<div class="editor-item" bind:this={component}>
    {#if mounted}
        <BlockActions {id} {type} element={component} />
    {/if}
    <section
        {id}
        data-type={type}
        class={`krt-heroOverlay ${layoutMetadata.reverseOrder ? 'krt-heroOverlay--reverse' : ''}`}
        style={layoutStyle}
    >
        <div class="krt-heroOverlay__metadata">{JSON.stringify(content)}</div>
        <div class="krt-heroOverlay__background" aria-hidden="true"></div>
        <div class="krt-heroOverlay__overlay" aria-hidden="true"></div>
        <div class="krt-heroOverlay__content">
            <div class="krt-heroOverlay__copy">
                <h1 class="krt-heroOverlay__heading" contenteditable bind:innerHTML={heading}></h1>
                <p class="krt-heroOverlay__body" contenteditable bind:innerHTML={body}></p>
                <a
                    class="krt-heroOverlay__cta"
                    href={button?.link ?? '#'}
                    aria-label={button?.label ?? 'Edit hero button label'}
                >
                    <span contenteditable bind:innerHTML={button.label}></span>
                </a>
            </div>
        </div>
    </section>
</div>

<SideActions triggerId={sideActionsId}>
    {#snippet label()}
        <button
            id={sideActionsId}
            class="krt-editButton"
            aria-label="Edit hero overlay settings"
        >
            <Pencil size={16} />
            <span>Edit Settings</span>
        </button>
    {/snippet}
    {#snippet content()}
        <div class="krt-heroOverlayDrawer">
            <section class="krt-heroOverlayDrawer__section">
                <h3>Layout</h3>
                <label class="krt-heroOverlayDrawer__toggle">
                    <input type="checkbox" bind:checked={layoutMetadata.reverseOrder} />
                    <span>Flip content alignment</span>
                </label>
                <label class="krt-heroOverlayDrawer__toggle">
                    <input type="checkbox" bind:checked={layoutMetadata.showBackgroundImage} />
                    <span>Show background image</span>
                </label>
                {#if layoutMetadata.showBackgroundImage}
                    <label class="krt-heroOverlayDrawer__field">
                        <span>Background image URL</span>
                        <input type="text" bind:value={layoutMetadata.backgroundImage} />
                    </label>
                {/if}
            </section>

            <section class="krt-heroOverlayDrawer__section">
                <h3>Colors</h3>
                <div class="krt-heroOverlayDrawer__grid">
                    <label class="krt-heroOverlayDrawer__field">
                        <span>Section background</span>
                        <input type="color" bind:value={layoutMetadata.backgroundColor} />
                    </label>
                    <label class="krt-heroOverlayDrawer__field">
                        <span>Heading</span>
                        <input type="color" bind:value={layoutMetadata.headingColor} />
                    </label>
                    <label class="krt-heroOverlayDrawer__field">
                        <span>Body text</span>
                        <input type="color" bind:value={layoutMetadata.textColor} />
                    </label>
                    <label class="krt-heroOverlayDrawer__field">
                        <span>Button</span>
                        <input type="color" bind:value={layoutMetadata.buttonColor} />
                    </label>
                </div>
            </section>
        </div>
    {/snippet}
</SideActions>
{:else}
    <section
        id={id}
        data-type={type}
        class={`krt-heroOverlay ${layoutMetadata.reverseOrder ? 'krt-heroOverlay--reverse' : ''}`}
        style={layoutStyle}
    >
        <div class="krt-heroOverlay__metadata">{JSON.stringify(content)}</div>
        <div class="krt-heroOverlay__background" aria-hidden="true"></div>
        <div class="krt-heroOverlay__overlay" aria-hidden="true"></div>
        <div class="krt-heroOverlay__content">
            <div class="krt-heroOverlay__copy">
                <h1 class="krt-heroOverlay__heading">{heading}</h1>
                <p class="krt-heroOverlay__body">{body}</p>
                <a class="krt-heroOverlay__cta" href={button?.link ?? '#'}>
                    {button?.label ?? 'Read more'}
                </a>
            </div>
        </div>
    </section>
{/if}

<style>
    .krt-heroOverlay {
        position: relative;
        overflow: hidden;
        border-radius: var(--krt-radius-2xl, 1.75rem);
        min-height: 24rem;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: clamp(2.5rem, 6vw, 5rem);
        background: var(--krt-heroOverlay-bg, #05060a);
    }

    .krt-heroOverlay--reverse .krt-heroOverlay__copy {
        align-items: flex-end;
        text-align: right;
    }

    .krt-heroOverlay__metadata {
        display: none;
    }

    .krt-heroOverlay__background {
        position: absolute;
        inset: 0;
        background-size: cover;
        background-position: center;
        opacity: var(--krt-heroOverlay-bgOpacity, 0);
        background-image: var(--krt-heroOverlay-bgImage, none);
        transition: opacity 200ms ease;
    }

    .krt-heroOverlay__overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, rgba(17, 24, 39, 0.72), rgba(30, 41, 59, 0.55));
        mix-blend-mode: multiply;
        pointer-events: none;
    }

    .krt-heroOverlay__content {
        position: relative;
        z-index: 1;
        width: min(40rem, 100%);
        display: flex;
        justify-content: center;
    }

    .krt-heroOverlay__copy {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-lg, 1rem);
        text-align: left;
        align-items: flex-start;
    }

    .krt-heroOverlay__heading {
        margin: 0;
        font-size: clamp(2.5rem, 5vw, 3.75rem);
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--krt-heroOverlay-heading, #f8fafc);
    }

    .krt-heroOverlay__body {
        margin: 0;
        font-size: clamp(1rem, 1.2vw + 0.9rem, 1.25rem);
        line-height: 1.8;
        color: var(--krt-heroOverlay-text, #e2e8f0);
    }

    .krt-heroOverlay__cta {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.85rem 2rem;
        border-radius: var(--krt-radius-pill, 999px);
        color: #f8fafc;
        font-weight: 600;
        text-decoration: none;
        box-shadow: 0 18px 38px rgba(15, 23, 42, 0.18);
        transition: transform 150ms ease, box-shadow 150ms ease;
        background: var(--krt-heroOverlay-button, #f97316);
    }

    .krt-heroOverlay__cta:hover {
        transform: translateY(-2px);
        box-shadow: 0 26px 48px rgba(15, 23, 42, 0.25);
    }

    .krt-heroOverlay__cta:focus-visible {
        outline: 2px solid var(--krt-color-accent, #4f46e5);
        outline-offset: 2px;
    }

    .krt-heroOverlayDrawer {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-xl, 1.25rem);
    }

    .krt-heroOverlayDrawer__section {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-md, 0.75rem);
    }

    .krt-heroOverlayDrawer__section h3 {
        margin: 0;
        font-size: 0.95rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--krt-color-muted, #6b7280);
    }

    .krt-heroOverlayDrawer__toggle {
        display: inline-flex;
        align-items: center;
        gap: var(--krt-space-sm, 0.5rem);
        font-weight: 600;
        color: var(--krt-color-text, #111827);
    }

    .krt-heroOverlayDrawer__toggle input[type='checkbox'] {
        width: 1.1rem;
        height: 1.1rem;
        accent-color: var(--krt-color-primary, #111827);
    }

    .krt-heroOverlayDrawer__grid {
        display: grid;
        gap: var(--krt-space-md, 0.75rem);
    }

    .krt-heroOverlayDrawer__field {
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

    .krt-heroOverlayDrawer__field input[type='text'] {
        border-radius: var(--krt-radius-sm, 0.375rem);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        padding: 0.45rem 0.6rem;
        font-size: 0.95rem;
        background: #f8fafc;
    }

    .krt-heroOverlayDrawer__field input[type='color'] {
        width: 2.4rem;
        height: 2.4rem;
        border-radius: var(--krt-radius-sm, 0.375rem);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        padding: 0;
        cursor: pointer;
    }
</style>
