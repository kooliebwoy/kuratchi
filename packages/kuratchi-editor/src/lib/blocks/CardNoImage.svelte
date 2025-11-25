<script lang="ts">
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
    import { onMount } from 'svelte';
    import { BlockActions } from '../utils/index.js';

    interface Props {
        id?: string;
        type?: string;
        heading?: string;
        body?: string;
        button?: string;
        link?: string;
        backgroundColor?: string;
        buttonColor?: string;
        headingColor?: string;
        contentColor?: string;
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        type = 'card-no-image',
        heading = $bindable('Hi there'),
        body = $bindable('Provident cupiditate voluptatem et in. Quaerat fugiat ut assumenda excepturi exercitationem quasi. In deleniti eaque aut repudiandae et a id nisi.'),
        button = $bindable('Read more'),
        link = '#',
        backgroundColor = '#575757',
        buttonColor = '#d1d5db',
        headingColor = '#374151',
        contentColor = '#374151',
        editable = true
    }: Props = $props();

    let content = $derived({
        id,
        type,
        heading,
        body,
        button,
        link,
        backgroundColor,
        buttonColor,
        headingColor,
        contentColor
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
                    <div class="krt-cardDrawer">
                        <section class="krt-cardDrawer__section">
                            <h3>Content</h3>
                            <div class="krt-cardDrawer__fields">
                                <label class="krt-cardDrawer__field">
                                    <span>Heading</span>
                                    <input type="text" bind:value={heading} placeholder="Enter heading" />
                                </label>
                                <label class="krt-cardDrawer__field">
                                    <span>Body</span>
                                    <textarea rows="3" bind:value={body} placeholder="Enter body"></textarea>
                                </label>
                                <label class="krt-cardDrawer__field">
                                    <span>Button text</span>
                                    <input type="text" bind:value={button} placeholder="Button text" />
                                </label>
                                <label class="krt-cardDrawer__field">
                                    <span>Link</span>
                                    <input type="url" bind:value={link} placeholder="Enter link" />
                                </label>
                            </div>
                        </section>

                        <section class="krt-cardDrawer__section">
                            <h3>Styles</h3>
                            <div class="krt-cardDrawer__fields">
                                <label class="krt-cardDrawer__field">
                                    <span>Background color</span>
                                    <input type="color" bind:value={backgroundColor} />
                                </label>
                                <label class="krt-cardDrawer__field">
                                    <span>Button color</span>
                                    <input type="color" bind:value={buttonColor} />
                                </label>
                                <label class="krt-cardDrawer__field">
                                    <span>Heading color</span>
                                    <input type="color" bind:value={headingColor} />
                                </label>
                                <label class="krt-cardDrawer__field">
                                    <span>Content color</span>
                                    <input type="color" bind:value={contentColor} />
                                </label>
                            </div>
                        </section>
                    </div>
                {/snippet}
            </BlockActions>
        {/if}
        <section {id} data-type={type} class="krt-card krt-card--stacked" style:background-color={backgroundColor}>
            <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
            <div class="krt-card__body krt-card__body--stacked">
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
                        href={link}
                        style:background-color={buttonColor}
                        style:color={contentColor}
                        id="button"
                    >
                        {button}
                    </a>
                </div>
            </div>
        </section>
    </div>
{:else}
    <section id={id} data-type={type} class="krt-card krt-card--stacked" style:background-color={backgroundColor}>
        <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
        <div class="krt-card__body krt-card__body--stacked">
            <h2 class="krt-card__title" style:color={headingColor}>{heading}</h2>
            <p class="krt-card__copy" style:color={contentColor}>{body}</p>
            <div class="krt-card__actions">
                <a class="krt-card__cta" href={link} style:background-color={buttonColor} style:color={contentColor}>
                    {button}
                </a>
            </div>
        </div>
    </section>
{/if}

<style>
    .krt-card {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-lg, 1rem);
        border-radius: var(--krt-radius-xl, 1rem);
        box-shadow: 0 24px 48px rgba(15, 23, 42, 0.08);
        background: var(--krt-color-surface, #ffffff);
        color: var(--krt-color-text, #111827);
    }

    .krt-card__metadata {
        display: none;
    }

    .krt-card__body {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-md, 0.75rem);
        padding: var(--krt-space-2xl, 2rem);
    }

    .krt-card__body--stacked {
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
        font-size: 0.85rem;
        font-weight: 600;
    }

    .krt-cardDrawer__field span {
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--krt-color-muted, #6b7280);
        font-size: 0.8rem;
    }

    .krt-cardDrawer__field input,
    .krt-cardDrawer__field textarea {
        border-radius: var(--krt-radius-sm, 0.375rem);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        padding: 0.5rem 0.65rem;
        background: #f8fafc;
        font-family: inherit;
        font-size: 0.95rem;
    }

    .krt-cardDrawer__field textarea {
        resize: vertical;
        min-height: 5.5rem;
    }
</style>
