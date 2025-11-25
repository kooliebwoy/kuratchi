<script lang="ts">
    import { onMount } from 'svelte';
    import { BlockActions } from '../utils/index.js';
    import { blockRegistry } from '../stores/editorSignals.svelte.js';

    interface ButtonConfig {
        label: string;
        link: string;
    }

    interface LayoutMetadata {
        backgroundColor: string;
        headingColor: string;
        buttonColor: string;
        textColor: string;
    }

    interface Props {
        id?: string;
        heading?: string;
        body?: string;
        button?: ButtonConfig;
        type?: string;
        metadata?: LayoutMetadata;
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        heading = $bindable('About Us'),
        body = $bindable('Random words from the editor Click to edit me'),
        button = $bindable<ButtonConfig>({ label: 'Read more', link: '#' }),
        type = 'about-us-hero',
        metadata: layoutMetadata = $bindable<LayoutMetadata>({
            backgroundColor: '#54545499',
            headingColor: '#212121',
            buttonColor: '#212121',
            textColor: '#ffffff'
        }) as LayoutMetadata,
        editable = true
    }: Props = $props();

    // Initialize defaults once
    if (!layoutMetadata.backgroundColor) layoutMetadata.backgroundColor = '#54545499';
    if (!layoutMetadata.headingColor) layoutMetadata.headingColor = '#212121';
    if (!layoutMetadata.buttonColor) layoutMetadata.buttonColor = '#212121';
    if (!layoutMetadata.textColor) layoutMetadata.textColor = '#ffffff';
    if (!button.label) button.label = 'Read more';
    if (!button.link) button.link = '#';

    let content = $derived({
        id,
        type,
        heading,
        body,
        button,
        metadata: {
            ...layoutMetadata
        }
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
<div class="editor-item krt-aboutHero__editor" bind:this={component}>
    {#if mounted}
        <BlockActions
            {id}
            {type}
            element={component}
            inspectorTitle="About section settings"
        >
            {#snippet inspector()}
                <div class="krt-aboutHeroDrawer">
                    <section class="krt-aboutHeroDrawer__section">
                        <h3>Content</h3>
                        <div class="krt-aboutHeroDrawer__fields">
                            <label class="krt-aboutHeroDrawer__field">
                                <span>Heading</span>
                                <input type="text" bind:value={heading} placeholder="Heading" />
                            </label>
                            <label class="krt-aboutHeroDrawer__field">
                                <span>Body</span>
                                <textarea rows="4" bind:value={body} placeholder="Body copy"></textarea>
                            </label>
                            <label class="krt-aboutHeroDrawer__field">
                                <span>Button label</span>
                                <input type="text" bind:value={button.label} placeholder="Button label" />
                            </label>
                            <label class="krt-aboutHeroDrawer__field">
                                <span>Button link</span>
                                <input type="url" bind:value={button.link} placeholder="https://example.com" />
                            </label>
                        </div>
                    </section>

                    <section class="krt-aboutHeroDrawer__section">
                        <h3>Colors</h3>
                        <div class="krt-aboutHeroDrawer__grid">
                            <label class="krt-aboutHeroDrawer__field">
                                <span>Background</span>
                                <input type="color" bind:value={layoutMetadata.backgroundColor} />
                            </label>
                            <label class="krt-aboutHeroDrawer__field">
                                <span>Heading</span>
                                <input type="color" bind:value={layoutMetadata.headingColor} />
                            </label>
                            <label class="krt-aboutHeroDrawer__field">
                                <span>Copy</span>
                                <input type="color" bind:value={layoutMetadata.textColor} />
                            </label>
                            <label class="krt-aboutHeroDrawer__field">
                                <span>Button</span>
                                <input type="color" bind:value={layoutMetadata.buttonColor} />
                            </label>
                        </div>
                    </section>
                </div>
            {/snippet}
        </BlockActions>
    {/if}
    <section {id} data-type={type} class="krt-aboutHero" style:background-color={layoutMetadata.backgroundColor}>
        <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
        <div class="krt-aboutHero__content">
            <h1 class="krt-aboutHero__heading" style:color={layoutMetadata.headingColor} contenteditable bind:innerHTML={heading}></h1>
            <p class="krt-aboutHero__body" style:color={layoutMetadata.textColor} contenteditable bind:innerHTML={body}></p>
            <a
                class="krt-aboutHero__cta"
                href={button.link}
                style:background-color={layoutMetadata.buttonColor}
                style:color={layoutMetadata.textColor}
                aria-label={button.label || 'Edit button label'}
            >
                <span contenteditable bind:innerHTML={button.label}></span>
            </a>
        </div>
    </section>

</div>
{:else}
    <section id={id} data-type={type} class="krt-aboutHero" style:background-color={layoutMetadata.backgroundColor}>
        <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
        <div class="krt-aboutHero__content">
            <h1 class="krt-aboutHero__heading" style:color={layoutMetadata.headingColor}>
                {@html heading}
            </h1>
            <div class="krt-aboutHero__body" style:color={layoutMetadata.textColor}>
                {@html body}
            </div>
            {#if button?.label}
                <a
                    class="krt-aboutHero__cta"
                    href={button.link ?? '#'}
                    style:background-color={layoutMetadata.buttonColor}
                    style:color={layoutMetadata.textColor}
                >
                    {button.label}
                </a>
            {/if}
        </div>
    </section>
{/if}

<style>
    .krt-aboutHero {
        position: relative;
        isolation: isolate;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: clamp(3rem, 5vw + 1rem, 6rem) clamp(1.75rem, 4vw, 5rem);
        border-radius: var(--krt-radius-2xl, 1.5rem);
        box-shadow: 0 40px 80px rgba(15, 23, 42, 0.12);
        text-align: center;
        overflow: hidden;
        min-height: clamp(420px, 65vh, 640px);
    }

    .krt-aboutHero__metadata {
        display: none;
    }

    .krt-aboutHero__content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--krt-space-lg, 1rem);
        max-width: min(720px, 100%);
    }

    .krt-aboutHero__heading {
        margin: 0;
        font-size: clamp(2.5rem, 3vw + 1.5rem, 3.75rem);
        font-weight: 800;
        letter-spacing: -0.02em;
    }

    .krt-aboutHero__body {
        margin: 0;
        font-size: clamp(1rem, 0.4vw + 0.95rem, 1.125rem);
        line-height: 1.7;
        max-width: 54ch;
    }

    .krt-aboutHero__cta {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.75rem 1.6rem;
        border-radius: var(--krt-radius-pill, 999px);
        border: none;
        font-weight: 600;
        text-decoration: none;
        transition: transform 150ms ease, box-shadow 150ms ease, background 150ms ease;
    }

    .krt-aboutHero__cta:hover {
        transform: translateY(-2px);
        box-shadow: 0 18px 36px rgba(17, 24, 39, 0.18);
    }

    .krt-aboutHero__cta span {
        outline: none;
    }

    .krt-aboutHeroDrawer {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-lg, 1rem);
    }

    .krt-aboutHeroDrawer__section {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-md, 0.75rem);
        padding: var(--krt-space-lg, 1rem);
        border-radius: var(--krt-radius-lg, 0.9rem);
        border: 1px solid color-mix(in srgb, var(--krt-color-border, #d1d5db) 80%, transparent);
        background: color-mix(in srgb, var(--krt-color-surface, #ffffff) 92%, transparent);
    }

    .krt-aboutHeroDrawer__section h3 {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
        letter-spacing: 0.01em;
    }

    .krt-aboutHeroDrawer__fields {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-md, 0.75rem);
    }

    .krt-aboutHeroDrawer__grid {
        display: grid;
        gap: var(--krt-space-md, 0.75rem);
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    }

    .krt-aboutHeroDrawer__field {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        font-size: 0.9rem;
    }

    .krt-aboutHeroDrawer__field span {
        font-weight: 500;
        color: color-mix(in srgb, var(--krt-color-text, #111827) 85%, transparent);
    }

    .krt-aboutHeroDrawer__field input[type='text'],
    .krt-aboutHeroDrawer__field input[type='url'],
    .krt-aboutHeroDrawer__field textarea {
        appearance: none;
        width: 100%;
        font: inherit;
        padding: 0.55rem 0.7rem;
        border-radius: var(--krt-radius-md, 0.75rem);
        border: 1px solid color-mix(in srgb, var(--krt-color-border, #d1d5db) 82%, transparent);
        background: color-mix(in srgb, var(--krt-color-surface, #ffffff) 96%, transparent);
        color: inherit;
        outline: none;
        transition: border-color 120ms ease, box-shadow 120ms ease;
        resize: vertical;
    }

    .krt-aboutHeroDrawer__field input[type='text']:focus,
    .krt-aboutHeroDrawer__field input[type='url']:focus,
    .krt-aboutHeroDrawer__field textarea:focus {
        border-color: color-mix(in srgb, var(--krt-color-primary, #2563eb) 55%, transparent);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--krt-color-primary, #2563eb) 25%, transparent);
    }

    .krt-aboutHeroDrawer__field input[type='color'] {
        appearance: none;
        width: 100%;
        min-height: 2.5rem;
        border: 1px solid color-mix(in srgb, var(--krt-color-border, #d1d5db) 82%, transparent);
        border-radius: var(--krt-radius-md, 0.75rem);
        padding: 0.25rem;
        background: color-mix(in srgb, var(--krt-color-surface, #ffffff) 96%, transparent);
    }

    .krt-aboutHero__heading,
    .krt-aboutHero__body,
    .krt-aboutHero__cta span {
        outline: none;
    }

    .krt-aboutHero__editor {
        position: relative;
    }
</style>
