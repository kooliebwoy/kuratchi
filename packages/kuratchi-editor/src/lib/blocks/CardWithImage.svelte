<script lang="ts">
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
    import { ArrowRight } from '@lucide/svelte';
    import { onMount } from 'svelte';
    import { ImagePicker } from '../widgets/index.js';
    import { BlockActions } from '../utils/index.js';

    interface CardImage {
        url: string;
        alt: string;
        title?: string;
        key?: string;
        src?: string;
    }

    interface Props {
        id?: string;
        type?: string;
        image?: CardImage;
        heading?: string;
        body?: string;
        button?: string;
        link?: string;
        backgroundColor?: string;
        buttonColor?: string;
        headingColor?: string;
        contentColor?: string;
        cardContentColor?: string;
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        type = 'card-with-image',
        image = $bindable<CardImage>({ url: 'https://fakeimg.pl/500x500', alt: 'Noteworthy technology acquisitions 2021', title: 'Card Image' }),
        heading = $bindable('Noteworthy technology acquisitions 2021'),
        body = $bindable('Here are the biggest enterprise technology acquisitions of 2021 so far, in reverse chronological order.'),
        button = $bindable('Read more'),
        link = $bindable('#'),
        backgroundColor = $bindable('#ffffff'),
        buttonColor = $bindable('#111827'),
        headingColor = $bindable('#111827'),
        contentColor = $bindable('#6b7280'),
        cardContentColor = $bindable('#ffffff'),
        editable = true
    }: Props = $props();

    const imageUrl = $derived(image?.key ? `/api/bucket/${image.key}` : image?.url ?? image?.src ?? '');

    let content = $derived({
        id,
        type,
        image,
        heading,
        body,
        button,
        link
    });

    let component: HTMLElement;
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
<div class="editor-item group relative" bind:this={component}>
    {#if mounted}
        <BlockActions
            {id}
            {type}
            element={component}
            inspectorTitle="Card settings"
        >
            {#snippet inspector()}
                <div class="krt-cardWithImageDrawer">
                    <section class="krt-cardWithImageDrawer__section">
                        <h3>Content</h3>
                        <div class="krt-cardWithImageDrawer__fields">
                            <label class="krt-cardWithImageDrawer__field">
                                <span>Heading</span>
                                <input type="text" bind:value={heading} placeholder="Enter heading" />
                            </label>
                            <label class="krt-cardWithImageDrawer__field">
                                <span>Body</span>
                                <textarea rows="3" bind:value={body} placeholder="Enter body"></textarea>
                            </label>
                            <label class="krt-cardWithImageDrawer__field">
                                <span>Button text</span>
                                <input type="text" bind:value={button} placeholder="Button text" />
                            </label>
                            <label class="krt-cardWithImageDrawer__field">
                                <span>Link</span>
                                <input type="url" bind:value={link} placeholder="Enter link" />
                            </label>
                        </div>
                    </section>

                    <section class="krt-cardWithImageDrawer__section">
                        <h3>Styles</h3>
                        <div class="krt-cardWithImageDrawer__grid">
                            <label class="krt-cardWithImageDrawer__field">
                                <span>Background</span>
                                <input type="color" bind:value={backgroundColor} />
                            </label>
                            <label class="krt-cardWithImageDrawer__field">
                                <span>Button</span>
                                <input type="color" bind:value={buttonColor} />
                            </label>
                            <label class="krt-cardWithImageDrawer__field">
                                <span>Heading</span>
                                <input type="color" bind:value={headingColor} />
                            </label>
                            <label class="krt-cardWithImageDrawer__field">
                                <span>Content</span>
                                <input type="color" bind:value={contentColor} />
                            </label>
                            <label class="krt-cardWithImageDrawer__field">
                                <span>Card body</span>
                                <input type="color" bind:value={cardContentColor} />
                            </label>
                        </div>
                    </section>

                    <section class="krt-cardWithImageDrawer__section">
                        <h3>Image</h3>
                        <ImagePicker bind:selectedImage={image} mode="single" />
                    </section>
                </div>
            {/snippet}
        </BlockActions>
    {/if}
        <section {id} data-type={type} class="krt-card krt-card--horizontal">
            <div class="krt-card__metadata">{JSON.stringify(content)}</div>
            <figure class="krt-card__media">
                <img src={imageUrl} alt={image.alt} title={image.title} />
            </figure>
            <div class="krt-card__body">
                <h2 class="krt-card__title">{heading}</h2>
                <p class="krt-card__copy">{body}</p>
                <div class="krt-card__actions">
                    <a href={link} class="krt-card__cta">
                        {button}
                        <ArrowRight aria-hidden="true" />
                    </a>
                </div>
            </div>
        </section>
    </div>

    
{:else}
    <section id={id} data-type={type} class="krt-card krt-card--horizontal">
        <div class="krt-card__metadata">{JSON.stringify(content)}</div>
        <figure class="krt-card__media">
            <img src={imageUrl} alt={image?.alt ?? ''} title={image?.title ?? ''} />
        </figure>
        <div class="krt-card__body">
            <h2 class="krt-card__title">{heading}</h2>
            <p class="krt-card__copy">{body}</p>
            <div class="krt-card__actions">
                <a href={link} class="krt-card__cta">
                    {button}
                    <ArrowRight aria-hidden="true" />
                </a>
            </div>
        </div>
    </section>
{/if}

<style>
    .krt-card {
        display: flex;
        flex-direction: column;
        background: var(--krt-color-surface, #ffffff);
        color: var(--krt-color-text, #111827);
        border-radius: var(--krt-radius-xl, 1rem);
        box-shadow: 0 24px 48px rgba(15, 23, 42, 0.08);
        overflow: hidden;
        gap: var(--krt-space-lg, 1rem);
    }

    .krt-card--horizontal {
        display: grid;
        grid-template-columns: 1fr;
    }

    @media (min-width: 56rem) {
        .krt-card--horizontal {
            grid-template-columns: 1.05fr 1fr;
        }
    }

    .krt-card__metadata {
        display: none;
    }

    .krt-card__media {
        position: relative;
        isolation: isolate;
        display: block;
        overflow: hidden;
        background: rgba(15, 23, 42, 0.06);
    }

    .krt-card__media img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .krt-card__body {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-md, 0.75rem);
        padding: var(--krt-space-2xl, 2rem);
    }

    .krt-card__title {
        margin: 0;
        font-size: clamp(1.5rem, 2vw + 1rem, 2.1rem);
        font-weight: 700;
        letter-spacing: -0.01em;
    }

    .krt-card__copy {
        margin: 0;
        font-size: 1rem;
        line-height: 1.7;
        color: var(--krt-color-muted, #6b7280);
    }

    .krt-card__actions {
        margin-top: auto;
    }

    .krt-card__cta {
        display: inline-flex;
        align-items: center;
        gap: var(--krt-space-sm, 0.5rem);
        padding: 0.65rem 1.4rem;
        border-radius: var(--krt-radius-pill, 999px);
        border: none;
        background: var(--krt-color-primary, #111827);
        color: #f8fafc;
        font-weight: 600;
        text-decoration: none;
        transition: transform 150ms ease, box-shadow 150ms ease, background 150ms ease;
    }

    .krt-card__cta:hover {
        transform: translateY(-2px);
        background: color-mix(in srgb, var(--krt-color-primary, #111827) 85%, white 15%);
        box-shadow: 0 18px 30px rgba(17, 24, 39, 0.2);
    }

    .krt-card__cta:focus-visible {
        outline: 2px solid var(--krt-color-accent, #4f46e5);
        outline-offset: 2px;
    }

    .krt-card__cta :global(svg) {
        width: 1rem;
        height: 1rem;
    }

    .krt-cardDrawer {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-xl, 1.25rem);
    }

    .krt-cardDrawer__section {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-md, 0.75rem);
    }

    .krt-cardDrawer__section h3 {
        margin: 0;
        font-size: 0.95rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--krt-color-muted, #6b7280);
    }

    .krt-cardDrawer__fields {
        display: grid;
        gap: var(--krt-space-md, 0.75rem);
    }

    .krt-cardDrawer__field {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-xs, 0.25rem);
        padding: var(--krt-space-sm, 0.5rem) var(--krt-space-md, 0.75rem);
        border-radius: var(--krt-radius-md, 0.5rem);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        background: var(--krt-color-surface, #ffffff);
    }

    .krt-cardDrawer__field span {
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--krt-color-muted, #6b7280);
    }

    .krt-cardDrawer__field input,
    .krt-cardDrawer__field textarea {
        border-radius: var(--krt-radius-sm, 0.375rem);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        padding: 0.5rem 0.65rem;
        font-size: 0.95rem;
        background: #f8fafc;
        font-family: inherit;
    }

    .krt-cardDrawer__field textarea {
        resize: vertical;
        min-height: 6rem;
    }
</style>

