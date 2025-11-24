<script lang="ts">
    import { onMount } from 'svelte';
    import { BlockActions } from '../utils/index.js';

    type Alignment = 'left' | 'center';

    interface LayoutMetadata {
        align: Alignment;
        backgroundColor: string;
        textColor: string;
    }

    interface Props {
        id?: string;
        type?: string;
        heading?: string;
        body?: string;
        metadata?: LayoutMetadata;
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        type = 'blog-hero',
        heading = $bindable('From the Studio'),
        body = $bindable('Stories, guides, and product updates from the team.'),
        metadata: layoutMetadata = $bindable<LayoutMetadata>({
            align: 'center',
            backgroundColor: '#111827',
            textColor: '#ffffff'
        }) as LayoutMetadata,
        editable = true
    }: Props = $props();

    const layoutStyle = $derived(
        `--krt-blogHero-bg: ${layoutMetadata.backgroundColor}; --krt-blogHero-text: ${layoutMetadata.textColor};`
    );

    const content = $derived({
        id,
        type,
        heading,
        body,
        metadata: { ...layoutMetadata }
    });

    let component = $state<HTMLElement>();
    let mounted = $state(false);

    onMount(() => {
        mounted = true;
    });
</script>

{#if editable}
<div class="editor-item krt-blogHero__editor" bind:this={component}>
    {#if mounted}
        <BlockActions 
            {id} 
            {type} 
            element={component}
            inspectorTitle="Blog hero settings"
        >
            {#snippet inspector()}
                <div class="krt-blogHeroDrawer">
                    <section class="krt-blogHeroDrawer__section">
                        <h3>Content</h3>
                        <label class="krt-blogHeroDrawer__field">
                            <span>Heading</span>
                            <input type="text" placeholder="From the studio" bind:value={heading} />
                        </label>
                        <label class="krt-blogHeroDrawer__field">
                            <span>Body</span>
                            <textarea rows="3" placeholder="Describe the blog" bind:value={body}></textarea>
                        </label>
                        <label class="krt-blogHeroDrawer__field">
                            <span>Alignment</span>
                            <select bind:value={layoutMetadata.align}>
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                            </select>
                        </label>
                    </section>

                    <section class="krt-blogHeroDrawer__section">
                        <h3>Colors</h3>
                        <div class="krt-blogHeroDrawer__grid">
                            <label class="krt-blogHeroDrawer__field">
                                <span>Background</span>
                                <input type="color" aria-label="Background color" bind:value={layoutMetadata.backgroundColor} />
                            </label>
                            <label class="krt-blogHeroDrawer__field">
                                <span>Text</span>
                                <input type="color" aria-label="Text color" bind:value={layoutMetadata.textColor} />
                            </label>
                        </div>
                    </section>
                </div>
            {/snippet}
        </BlockActions>
    {/if}
    <section {id} data-type={type} class="krt-blogHero" style={layoutStyle}>
        <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
        <div class={`krt-blogHero__inner krt-blogHero__inner--${layoutMetadata.align}`}>
            <h1 class="krt-blogHero__heading" contenteditable bind:innerHTML={heading}></h1>
            <p class="krt-blogHero__body" contenteditable bind:innerHTML={body}></p>
        </div>
    </section>

    </div>
{:else}
    <section id={id} data-type={type} class="krt-blogHero" style={layoutStyle}>
        <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
        <div class={`krt-blogHero__inner krt-blogHero__inner--${layoutMetadata.align}`}>
            <h1 class="krt-blogHero__heading">{@html heading}</h1>
            <div class="krt-blogHero__body">{@html body}</div>
        </div>
    </section>
{/if}

<style>
    .krt-blogHeroDrawer {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .krt-blogHeroDrawer__section {
        border: 1px solid var(--krt-color-border-subtle, #e2e8f0);
        border-radius: 1rem;
        padding: 1.25rem;
        background: var(--krt-color-surface, #fff);
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .krt-blogHeroDrawer__section h3 {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
    }

    .krt-blogHeroDrawer__field {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        font-size: 0.85rem;
    }

    .krt-blogHeroDrawer__field input,
    .krt-blogHeroDrawer__field textarea,
    .krt-blogHeroDrawer__field select {
        border: 1px solid var(--krt-color-border-subtle, #e2e8f0);
        border-radius: 0.75rem;
        padding: 0.45rem 0.75rem;
        font: inherit;
        background: #fff;
    }

    .krt-blogHeroDrawer__field textarea {
        resize: vertical;
    }

    .krt-blogHeroDrawer__grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 0.75rem;
    }

    .krt-blogHero {
        position: relative;
        background: var(--krt-blogHero-bg, #111827);
        color: var(--krt-blogHero-text, #ffffff);
        padding: clamp(2rem, 6vw, 5rem) clamp(1.5rem, 4vw, 3rem);
        border-radius: 2rem;
        overflow: hidden;
    }

    .krt-blogHero__metadata {
        position: absolute;
        inset: 1rem auto auto 1rem;
        opacity: 0;
        font-size: 0;
        pointer-events: none;
    }

    .krt-blogHero__inner {
        margin: 0 auto;
        max-width: 56rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .krt-blogHero__inner--left {
        text-align: left;
        align-items: flex-start;
    }

    .krt-blogHero__inner--center {
        text-align: center;
        align-items: center;
    }

    .krt-blogHero__heading {
        margin: 0;
        font-size: clamp(2.5rem, 5vw, 4rem);
        font-weight: 700;
        letter-spacing: -0.02em;
    }

    .krt-blogHero__body {
        margin: 0;
        font-size: 1rem;
        color: color-mix(in srgb, var(--krt-blogHero-text, #fff) 80%, transparent);
        max-width: 38rem;
    }

    .krt-blogHero__editor {
        position: relative;
    }
</style>
