<script lang="ts">
    import { onDestroy, onMount } from "svelte";
	import { handleEmojis, setupSelectionListener, type SelectionState } from "../utils/index.js";
	import EditorToolbar from "../plugins/EditorToolbar.svelte";
	import { BlockActions } from "../utils/index.js";

    interface Props {
        id?: string;
        paragraph?: string;
        type?: string;
        metadata?: {
            color?: string;
        };
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        paragraph = 'Hello world. This is some big testing.',
        type = 'paragraph',
        metadata = {
            color: '#000000',
        },
        editable = true
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
        }
    });

    let mounted = $state(false);
    onMount(() => {
        if (!editable) return;
        mounted = true;
    });
</script>

{#if editable}
    <div class="editor-item group relative krt-paragraph-block" bind:this={component}>
        {#if mounted}
            <EditorToolbar {component} show={selectionState.showToolbar} position={selectionState.position} />
        {/if}

        {#if mounted}
            <BlockActions {component} />
        {/if}
        
        <div data-type={type} id={id} class="krt-paragraph-body">
            <!-- JSON Data for this component -->
            <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
            <p contenteditable bind:innerHTML={paragraph} oninput={handleEmojis} class="krt-paragraph krt-paragraph--editable"></p>
        </div>
    </div>
{:else}
    <div data-type={type} id={id} class="krt-paragraph-block krt-paragraph-body">
        <svelte:element this={'p'} class="krt-paragraph" style:color={color}>
            {@html paragraph}
        </svelte:element>
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
        font-size: 1rem;
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
