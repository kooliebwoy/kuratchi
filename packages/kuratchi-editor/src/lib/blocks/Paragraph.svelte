<script lang="ts">
    import { onDestroy, onMount } from "svelte";
	import { handleEmojis, setupSelectionListener, type SelectionState } from "../utils/index.js";
	import EditorToolbar from "../plugins/EditorToolbar.svelte";
	import SideActions from "../shell/components/SideActions.svelte";

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
{:else}
    <div data-type={type} id={id} class="w-full min-w-full">
        <svelte:element this={'p'} class="outline-none" style:color={color}>
            {@html paragraph}
        </svelte:element>
    </div>
{/if}
