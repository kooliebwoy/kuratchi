<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import { handleEmojis, setupSelectionListener, type SelectionState } from "../utils/index.js";
    import EditorToolbar from "../widgets/EditorToolbar.svelte";
    import { BLOCK_SPACING_VALUES, DragHandle, type BlockSpacing } from "../utils/index.js";
    import { blockRegistry } from "../stores/editorSignals.svelte.js";

    interface Props {
        id?: string;
        paragraph?: string;
        type?: string;
        metadata?: {
            color?: string;
            fontSize?: string;
            spacingTop?: BlockSpacing;
            spacingBottom?: BlockSpacing;
        };
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        paragraph = $bindable('Hello world. This is some big testing.'),
        type = 'paragraph',
        metadata = {
            color: '#000000',
            fontSize: '1rem',
            spacingTop: 'normal',
            spacingBottom: 'normal'
        },
        editable = true
    }: Props = $props();

    let component: HTMLElement | undefined = $state();
    const componentRef = {};
    let color = $state(metadata.color);
    let fontSize = $state(metadata.fontSize ?? '1rem');
    let spacingTop = $state<BlockSpacing>(metadata.spacingTop ?? 'normal');
    let spacingBottom = $state<BlockSpacing>(metadata.spacingBottom ?? 'normal');

    // Computed spacing styles
    let spacingStyle = $derived(
        `margin-top: ${BLOCK_SPACING_VALUES[spacingTop]}; margin-bottom: ${BLOCK_SPACING_VALUES[spacingBottom]};`
    );

    // Block context for toolbar
    function getBlockContext() {
        return {
            type: 'paragraph' as const,
            blockElement: component,
            fontSize,
            onFontSizeChange: (newSize: string) => { fontSize = newSize; },
            spacingTop,
            spacingBottom,
            onSpacingTopChange: (s: BlockSpacing) => { spacingTop = s; },
            onSpacingBottomChange: (s: BlockSpacing) => { spacingBottom = s; }
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
            spacingTop,
            spacingBottom
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
    <div class="editor-item group relative krt-paragraph-block" bind:this={component} style={spacingStyle}>
        {#if mounted}
            <DragHandle />
            <EditorToolbar {component} show={selectionState.showToolbar} position={selectionState.position} blockContext={getBlockContext()} />
        {/if}
        
        <div data-type={type} id={id} class="krt-paragraph-body">
            <!-- JSON Data for this component -->
            <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
            <p contenteditable bind:innerHTML={paragraph} oninput={handleEmojis} class="krt-paragraph krt-paragraph--editable" style:font-size={fontSize} style:color={color || undefined}></p>
        </div>
    </div>
{:else}
    <div data-type={type} id={id} class="krt-paragraph-block krt-paragraph-body" style={spacingStyle}>
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
</style>
