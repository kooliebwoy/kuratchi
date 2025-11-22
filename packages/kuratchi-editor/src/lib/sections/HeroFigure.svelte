<script lang="ts">
    import { ArrowRight, Pencil } from '@lucide/svelte';
    import { onMount } from 'svelte';
    import { ImagePicker } from '../plugins/index.js';
    import { BlockActions, SideActions } from '../shell/index.js';

    interface HeroButton {
        label?: string;
        link?: string;
    }

    interface HeroImage {
        url?: string;
        alt?: string;
    }

    interface LayoutMetadata {
        reverseOrder: boolean;
        backgroundColor: string;
        headingColor: string;
        textColor: string;
        buttonColor: string;
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
        type = 'hero-figure',
        heading = $bindable('Hero Heading'),
        body = $bindable(
            'Provident cupiditate voluptatem et in. Quaerat fugiat ut assumenda excepturi exercitationem quasi. In deleniti eaque aut repudiandae et a id nisi.'
        ),
        button = $bindable<HeroButton>({ link: '#', label: 'Read more' }),
        metadata: layoutMetadata = $bindable<LayoutMetadata>({
            reverseOrder: false,
            backgroundColor: '#ffffff',
            headingColor: '#0f172a',
            textColor: '#475569',
            buttonColor: '#0f172a'
        }) as LayoutMetadata,
        image: initialImage = {
            url: 'https://fakeimg.pl/489x600/?text=World&font=lobster',
            alt: 'Hero figure image'
        },
        editable = true
    }: Props = $props();

    let image = $state<HeroImage>(initialImage);

    const layoutStyle = $derived(
        `--krt-heroFigure-bg: ${layoutMetadata.backgroundColor}; --krt-heroFigure-heading: ${layoutMetadata.headingColor}; --krt-heroFigure-text: ${layoutMetadata.textColor}; --krt-heroFigure-button: ${layoutMetadata.buttonColor};`
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
    let component = $state<HTMLElement>();
    let mounted = $state(false);
    const sideActionsId = $derived(`hero-figure-side-actions-${id}`);

    onMount(() => {
        if (!editable) return;
        mounted = true;
    });
</script>
{#if editable}
<div class="editor-item group relative krt-heroFigure__wrapper" bind:this={component}>
    {#if mounted}
        <BlockActions {component}>
            <small>Layout</small>
            <li>
                <button class="btn btn-ghost btn-sm" onclick={() => (layoutMetadata.reverseOrder = !layoutMetadata.reverseOrder)}>
                    {layoutMetadata.reverseOrder ? 'Normal order' : 'Swap layout'}
                </button>
            </li>
        </BlockActions>
    {/if}

    <SideActions id={sideActionsId}>
        {#snippet label()}
            <button class="krt-heroFigure__editButton" type="button">
                <Pencil aria-hidden="true" />
                <span>Edit section</span>
            </button>
        {/snippet}
        {#snippet content()}
            <div class="krt-heroFigureDrawer">
                <section class="krt-heroFigureDrawer__section">
                    <div class="krt-heroFigureDrawer__toggle">
                        <label>
                            <span>Swap hero and media</span>
                            <input type="checkbox" bind:checked={layoutMetadata.reverseOrder} />
                        </label>
                    </div>
                </section>

                <section class="krt-heroFigureDrawer__section">
                    <h3>Colors</h3>
                    <div class="krt-heroFigureDrawer__grid">
                        <label class="krt-heroFigureDrawer__field">
                            <span>Background</span>
                            <input type="color" aria-label="Background color" bind:value={layoutMetadata.backgroundColor} />
                        </label>
                        <label class="krt-heroFigureDrawer__field">
                            <span>Heading</span>
                            <input type="color" aria-label="Heading color" bind:value={layoutMetadata.headingColor} />
                        </label>
                        <label class="krt-heroFigureDrawer__field">
                            <span>Body text</span>
                            <input type="color" aria-label="Body text color" bind:value={layoutMetadata.textColor} />
                        </label>
                        <label class="krt-heroFigureDrawer__field">
                            <span>Button</span>
                            <input type="color" aria-label="Button color" bind:value={layoutMetadata.buttonColor} />
                        </label>
                    </div>
                </section>

                <section class="krt-heroFigureDrawer__section">
                    <h3>Button</h3>
                    <label class="krt-heroFigureDrawer__field">
                        <span>Label</span>
                        <input type="text" placeholder="Read more" bind:value={button.label} />
                    </label>
                    <label class="krt-heroFigureDrawer__field">
                        <span>Link</span>
                        <input type="url" placeholder="https://" bind:value={button.link} />
                    </label>
                </section>

                <section class="krt-heroFigureDrawer__section">
                    <h3>Image</h3>
                    <ImagePicker bind:selectedImage={image} mode="single" />
                </section>
            </div>
        {/snippet}
    </SideActions>

    <section class={`krt-heroFigure ${layoutMetadata.reverseOrder ? 'krt-heroFigure--reverse' : ''}`} style={layoutStyle} data-type={type}>
        <div class="krt-heroFigure__metadata">{JSON.stringify(content)}</div>
        <div class="krt-heroFigure__media">
            {#if image?.url}
                <img src={image.url} alt={image.alt ?? 'Hero figure image'} loading="lazy" />
            {:else}
                <div class="krt-heroFigure__placeholder">Add hero image</div>
            {/if}
        </div>
        <div class="krt-heroFigure__content">
            <h1 class="krt-heroFigure__heading" contenteditable bind:innerHTML={heading}></h1>
            <p class="krt-heroFigure__body" contenteditable bind:innerHTML={body}></p>
            <button class="krt-heroFigure__cta" type="button" onclick={(event) => event.preventDefault()}>
                <span contenteditable bind:innerHTML={button.label}></span>
                <ArrowRight aria-hidden="true" />
            </button>
        </div>
    </section>
</div>
{:else}
    <section
        id={id}
        data-type={type}
        class={`krt-heroFigure ${layoutMetadata.reverseOrder ? 'krt-heroFigure--reverse' : ''}`}
        style={layoutStyle}
    >
        <div class="krt-heroFigure__metadata" data-type={type}>{JSON.stringify(content)}</div>
        <div class="krt-heroFigure__media">
            {#if image?.url}
                <img src={image.url} alt={image.alt ?? 'Hero figure image'} loading="lazy" />
            {/if}
        </div>
        <div class="krt-heroFigure__content">
            <h1 class="krt-heroFigure__heading">{@html heading}</h1>
            <div class="krt-heroFigure__body">{@html body}</div>
            {#if button?.label}
                <a class="krt-heroFigure__cta" href={button.link ?? '#'}>
                    <span>{@html button.label}</span>
                    <ArrowRight aria-hidden="true" />
                </a>
            {/if}
        </div>
    </section>
{/if}

<style>
    .krt-heroFigureDrawer {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .krt-heroFigureDrawer__section {
        border: 1px solid var(--krt-color-border-subtle, #e2e8f0);
        border-radius: 1rem;
        padding: 1.25rem;
        background: var(--krt-color-surface, #fff);
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .krt-heroFigureDrawer__section h3 {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
    }

    .krt-heroFigureDrawer__toggle label {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.75rem;
        font-size: 0.9rem;
        color: var(--krt-color-text, #0f172a);
    }

    .krt-heroFigureDrawer__grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 0.75rem;
    }

    .krt-heroFigureDrawer__field {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        font-size: 0.85rem;
    }

    .krt-heroFigureDrawer__field input[type='color'],
    .krt-heroFigureDrawer__field input[type='text'],
    .krt-heroFigureDrawer__field input[type='url'] {
        border: 1px solid var(--krt-color-border-subtle, #e2e8f0);
        border-radius: 0.75rem;
        padding: 0.45rem 0.75rem;
        font: inherit;
        background: #fff;
    }

    .krt-heroFigureDrawer__field input[type='color'] {
        min-height: 2.5rem;
        cursor: pointer;
    }

    .krt-heroFigure {
        position: relative;
        background: var(--krt-heroFigure-bg, #fff);
        border-radius: 2rem;
        padding: clamp(2rem, 6vw, 4rem);
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: clamp(1.5rem, 4vw, 3rem);
        align-items: center;
    }

    .krt-heroFigure--reverse {
        direction: rtl;
    }

    .krt-heroFigure--reverse > * {
        direction: ltr;
    }

    .krt-heroFigure__metadata {
        position: absolute;
        inset: 1rem auto auto 1rem;
        opacity: 0;
        font-size: 0;
        pointer-events: none;
    }

    .krt-heroFigure__media {
        border-radius: 1.5rem;
        overflow: hidden;
        box-shadow: 0 20px 40px rgba(15, 23, 42, 0.15);
    }

    .krt-heroFigure__media img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .krt-heroFigure__placeholder {
        display: grid;
        place-items: center;
        min-height: 320px;
        background: repeating-linear-gradient(
            45deg,
            rgba(15, 23, 42, 0.05),
            rgba(15, 23, 42, 0.05) 10px,
            rgba(15, 23, 42, 0.12) 10px,
            rgba(15, 23, 42, 0.12) 20px
        );
        color: var(--krt-heroFigure-text, #475569);
        font-weight: 600;
    }

    .krt-heroFigure__content {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .krt-heroFigure__heading {
        margin: 0;
        font-size: clamp(2.5rem, 5vw, 4rem);
        line-height: 1.05;
        font-weight: 700;
        color: var(--krt-heroFigure-heading, #0f172a);
    }

    .krt-heroFigure__body {
        margin: 0;
        font-size: 1rem;
        color: var(--krt-heroFigure-text, #475569);
    }

    .krt-heroFigure__cta {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.85rem 1.5rem;
        border-radius: 999px;
        background: var(--krt-heroFigure-button, #0f172a);
        color: #fff;
        border: none;
        cursor: pointer;
        font-weight: 600;
        text-decoration: none;
    }

    .krt-heroFigure__cta span {
        display: inline-flex;
        align-items: center;
    }
</style>