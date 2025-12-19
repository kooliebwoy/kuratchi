<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import { handleEmojis, setupSelectionListener, type SelectionState, BlockActions } from "../utils/index.js";
    import EditorToolbar from "../widgets/EditorToolbar.svelte";
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
        paragraph?: string;
        type?: string;
        metadata?: {
            color?: string;
            fontSize?: string;
            layout?: Partial<SectionLayout>;
        };
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        paragraph = $bindable('Hello world. This is some big testing.'),
        type = 'paragraph',
        metadata = $bindable({
            color: '#000000',
            fontSize: '1rem',
            layout: { ...DEFAULT_SECTION_LAYOUT, horizontalSpacing: 'comfortable', verticalSpacing: 'tight' }
        }),
        editable = true
    }: Props = $props();

    let component: HTMLElement | undefined = $state();
    const componentRef = {};
    let color = $state(metadata.color);
    let fontSize = $state(metadata.fontSize ?? '1rem');
    
    // Layout state using section layout system
    let blockLayout = $state<SectionLayout>(mergeLayoutWithDefaults(metadata.layout));
    
    $effect(() => {
        metadata.layout = { ...blockLayout };
    });

    const layoutStyles = $derived(getSectionLayoutStyles(blockLayout));

    // Block context for toolbar
    function getBlockContext() {
        return {
            type: 'paragraph' as const,
            blockElement: component,
            fontSize,
            onFontSizeChange: (newSize: string) => { fontSize = newSize; }
        };
    }

    // Selection state
    let selectionState: SelectionState = $state({
        showToolbar: false,
        position: { x: 0, y: 0 }
    });

    let cleanup: (() => void) | undefined;

    // Setup selection listener when component is available
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

    let content = $derived({
        id,
        type,
        paragraph,
        metadata: {
            color,
            fontSize,
            layout: { ...blockLayout }
        }
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
    <div class="editor-item group relative krt-paragraph-block" bind:this={component} style={layoutStyles}>
        {#if mounted}
            <BlockActions {id} {type} element={component} inspectorTitle="Paragraph Settings">
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
        
        <div data-type={type} id={id} class="krt-paragraph-body">
            <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
            <p contenteditable bind:innerHTML={paragraph} oninput={handleEmojis} class="krt-paragraph krt-paragraph--editable" style:font-size={fontSize} style:color={color || undefined}></p>
        </div>
    </div>
{:else}
    {@const prodLayoutStyles = getSectionLayoutStyles(mergeLayoutWithDefaults(metadata.layout))}
    <div data-type={type} id={id} class="krt-paragraph-block krt-paragraph-body" style={prodLayoutStyles}>
        <p class="krt-paragraph" style:color={color} style:font-size={fontSize}>
            {@html paragraph}
        </p>
    </div>
{/if}

<style>
    .krt-paragraph-block {
        width: 100%;
        min-width: 100%;
    }

    .krt-paragraph-body {
        width: 100%;
        min-width: 100%;
    }

    .krt-paragraph {
        margin: 0;
        font-size: inherit;
        line-height: 1.7;
    }

    .krt-paragraph--editable {
        outline: none;
    }

    .krt-paragraph--editable:focus-visible {
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
