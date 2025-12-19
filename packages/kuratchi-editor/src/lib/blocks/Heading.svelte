<script lang="ts">
    import { handleEmojis } from "../utils/emojis.js";
    import EditorToolbar from "../widgets/EditorToolbar.svelte";
    import { setupSelectionListener, type SelectionState } from "../utils/editor.svelte.js";
    import { onDestroy, onMount } from "svelte";
    import { BlockActions } from "../utils/index.js";
    import { blockRegistry } from "../stores/editorSignals.svelte.js";
    import SectionLayoutControls from "../sections/SectionLayoutControls.svelte";
    import { 
        type SectionLayout, 
        DEFAULT_SECTION_LAYOUT, 
        getSectionLayoutStyles,
        mergeLayoutWithDefaults 
    } from "../sections/section-layout.js";

    interface Props {
        id?: string;
        heading?: string;
        type?: string;
        metadata?: {
            color?: string;
            size?: string;
            layout?: Partial<SectionLayout>;
        };
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        heading = $bindable('Heading...'),
        type = 'heading',
        metadata = $bindable({
            color: '#000000',
            size: 'h2',
            layout: { ...DEFAULT_SECTION_LAYOUT, horizontalSpacing: 'comfortable', verticalSpacing: 'tight' }
        }),
        editable = true
    }: Props = $props();

    let component: HTMLElement | undefined = $state();
    const componentRef = {};

    // Selection state
    let selectionState: SelectionState = $state({
        showToolbar: false,
        position: { x: 0, y: 0 }
    });

    let color = $state(metadata.color);
    let size = $state(metadata.size ?? 'h2');
    
    // Layout state using section layout system
    let blockLayout = $state<SectionLayout>(mergeLayoutWithDefaults(metadata.layout));
    
    $effect(() => {
        metadata.layout = { ...blockLayout };
    });

    const layoutStyles = $derived(getSectionLayoutStyles(blockLayout));

    // Block context for toolbar
    function getBlockContext() {
        return {
            type: 'heading' as const,
            blockElement: component,
            headingSize: size,
            onHeadingSizeChange: (newSize: string) => { size = newSize; }
        };
    }

    let content = $derived({
        id,
        type,
        heading,
        metadata: {
            color,
            size,
            layout: { ...blockLayout }
        }
    });

    let cleanup: (() => void) | undefined;

    $effect(() => {
        if (!editable) return;
        if (component) {
            if (cleanup) cleanup();
            cleanup = setupSelectionListener(component, selectionState);
        }
    });

    onDestroy(() => {
        if (cleanup) cleanup();
    });

    let mounted = $state(false);
    onMount(() => {
        if (!editable) return;
        mounted = true;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
        return () => blockRegistry.unregister(componentRef);
    });
</script>

{#if editable}
    <div class="editor-item group relative krt-heading-block" style={layoutStyles} bind:this={component}>
        {#if mounted}
            <BlockActions {id} {type} element={component} inspectorTitle="Heading Settings">
                {#snippet inspector()}
                    <div class="krt-blockInspector">
                        <section class="krt-blockInspector__section">
                            <h3>Layout</h3>
                            <SectionLayoutControls bind:layout={blockLayout} />
                        </section>
                        <section class="krt-blockInspector__section">
                            <h3>Style</h3>
                            <label class="krt-blockInspector__field">
                                <span>Text Color</span>
                                <input type="color" bind:value={color} />
                            </label>
                        </section>
                    </div>
                {/snippet}
            </BlockActions>
            <EditorToolbar {component} show={selectionState.showToolbar} position={selectionState.position} blockContext={getBlockContext()} />
        {/if}
        
        <div data-type={type} id={id} class="krt-heading-body">
            <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
            {#if size === 'h1'}
                <h1 class="krt-heading krt-heading--h1 krt-heading--editable" style:color={color || undefined} contenteditable bind:innerHTML={heading} oninput={handleEmojis}></h1>
            {:else if size === 'h2'}
                <h2 class="krt-heading krt-heading--h2 krt-heading--editable" style:color={color || undefined} contenteditable bind:innerHTML={heading} oninput={handleEmojis}></h2>
            {:else if size === 'h3'}
                <h3 class="krt-heading krt-heading--h3 krt-heading--editable" style:color={color || undefined} contenteditable bind:innerHTML={heading} oninput={handleEmojis}></h3>
            {:else if size === 'h4'}
                <h4 class="krt-heading krt-heading--h4 krt-heading--editable" style:color={color || undefined} contenteditable bind:innerHTML={heading} oninput={handleEmojis}></h4>
            {:else if size === 'h5'}
                <h5 class="krt-heading krt-heading--h5 krt-heading--editable" style:color={color || undefined} contenteditable bind:innerHTML={heading} oninput={handleEmojis}></h5>
            {:else}
                <h6 class="krt-heading krt-heading--h6 krt-heading--editable" style:color={color || undefined} contenteditable bind:innerHTML={heading} oninput={handleEmojis}></h6>
            {/if}
        </div>
    </div>
{:else}
    {@const tag = size ?? 'h2'}
    {@const prodLayoutStyles = getSectionLayoutStyles(mergeLayoutWithDefaults(metadata.layout))}
    <div data-type={type} id={id} class="krt-heading-block krt-heading-body" style={prodLayoutStyles}>
        <svelte:element this={tag} style:color={color} class={`krt-heading krt-heading--${tag}`}>
            {@html heading}
        </svelte:element>
    </div>
{/if}

<style>
    .krt-heading-block {
        width: 100%;
        min-width: 100%;
    }

    .krt-heading-body {
        width: 100%;
        min-width: 100%;
    }

    .krt-heading {
        margin: 0;
        font-weight: 700;
        letter-spacing: -0.02em;
    }

    .krt-heading--h1 {
        font-size: 2.5rem;
        line-height: 1.1;
    }

    .krt-heading--h2 {
        font-size: 2rem;
        line-height: 1.15;
    }

    .krt-heading--h3 {
        font-size: 1.5rem;
        line-height: 1.2;
    }

    .krt-heading--h4 {
        font-size: 1.25rem;
        line-height: 1.25;
    }

    .krt-heading--h5 {
        font-size: 1.1rem;
        line-height: 1.3;
    }

    .krt-heading--h6 {
        font-size: 0.95rem;
        line-height: 1.35;
    }

    .krt-heading--editable {
        outline: none;
    }

    .krt-heading--editable:focus-visible {
        outline: 2px solid var(--krt-color-accent, #4f46e5);
        outline-offset: 2px;
    }

    /* Inspector styles */
    .krt-blockInspector {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .krt-blockInspector__section {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .krt-blockInspector__section h3 {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: rgba(15, 23, 42, 0.6);
        margin: 0;
    }

    .krt-blockInspector__field {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
    }

    .krt-blockInspector__field span {
        font-size: 0.875rem;
        color: rgba(15, 23, 42, 0.8);
    }

    .krt-blockInspector__field input[type="color"] {
        width: 2.5rem;
        height: 2rem;
        border: 1px solid rgba(15, 23, 42, 0.2);
        border-radius: 0.375rem;
        cursor: pointer;
    }
</style>
