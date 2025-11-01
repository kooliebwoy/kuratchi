<script lang="ts">
    import { handleEmojis } from "$lib/utils/emojis";
    import EditorToolbar from "$lib/plugins/EditorToolbar.svelte";
    import { onDestroy, onMount } from "svelte";
    import { setupSelectionListener, type SelectionState } from "$lib/utils/editor.svelte";
    import { SideActions } from "$lib/shell";

    interface Props {
        id?: string;
        paragraph?: string;
        type?: string;
        metadata?: {
            color?: string;
        }
    }

    let {
        id = crypto.randomUUID(),
        paragraph = 'Hello world. This is some big testing.',
        type = 'paragraph',
        metadata = {
            color: '#000000',
        }
    }: Props = $props();

    let component: HTMLElement;
    let color = metadata.color;

    // Selection state
    let selectionState: SelectionState = $state({
        showToolbar: false,
        position: { x: 0, y: 0 }
    });

    let cleanup: (() => void) | undefined;

    // Setup selection listener when component is available
    $effect(() => {
        if (component) {
            // Clean up previous listener if it exists
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
        }
    });

    let mounted = $state(false);
    onMount(() => {
        mounted = true;
    });
</script>

<div class="editor-item group relative" bind:this={component}>
    {#if mounted}
        <EditorToolbar {component} show={selectionState.showToolbar} />
    {/if}

    {#if mounted}
        <SideActions {component} />
    {/if}
    
    <div data-type={type} id={id} class="w-full min-w-full">
        <!-- JSON Data for this component -->
        <div class="hidden" id="metadata-{id}">
            {JSON.stringify(content)}
        </div>

        <p contenteditable bind:innerHTML={paragraph} oninput={handleEmojis} class="outline-none"></p>
    </div>
</div>
