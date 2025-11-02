<script lang="ts">
    import { handleEmojis } from "../utils/emojis.js";
    import EditorToolbar from "../plugins/EditorToolbar.svelte";
    import { deleteElement, sanitizeContent, setupSelectionListener, type SelectionState } from "../utils/editor.svelte.js";
    import { onDestroy, onMount } from "svelte";
    import { SideActions } from "../shell/index.js";

    interface Props {
        id?: string;
        heading?: string;
        type?: string;
        metadata?: {
            color?: string;
            size?: string;
        };
    }

    let {
        id = crypto.randomUUID(),
        heading = 'Heading...',
        type = 'heading',
        metadata = {
            color: '#000000',
            size: 'h2'
        }
    }: Props = $props();

    let component: HTMLElement;

    // Selection state
    let selectionState: SelectionState = $state({
        showToolbar: false,
        position: { x: 0, y: 0 }
    });

    let color = $state(metadata.color);
    let size = $state(metadata.size);

    let content = $derived({
        id,
        type,
        heading: heading,
        metadata : {
            color,
            size
        }
    })

    let cleanup: (() => void) | undefined;

    $effect(() => {
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
        mounted = true;
    });
</script>

<div class="editor-item group relative" bind:this={component}>
    {#if mounted}
        <EditorToolbar {component} show={selectionState.showToolbar} />
    {/if}
    
    {#if mounted}
        <SideActions {component}>
            <li><button class="btn btn-sm btn-ghost" onclick={() => size = 'h2'}>H2</button></li>
            <li><button class="btn btn-sm btn-ghost" onclick={() => size = 'h3'}>H3</button></li>
            <li><button class="btn btn-sm btn-ghost" onclick={() => size = 'h4'}>H4</button></li>
            <li><button class="btn btn-sm btn-ghost" onclick={() => size = 'h5'}>H5</button></li>
            <li><button class="btn btn-sm btn-ghost" onclick={() => size = 'h6'}>H6</button></li>
        </SideActions>
    {/if}
    
    <div data-type={type} id={id} class="w-full min-w-full prose-headings:!mt-0 prose-headings:!mb-0">
        <!-- JSON Data for this component -->
        <div class="hidden" id="metadata-{id}">
            {JSON.stringify(content)}
        </div>

        {#if size === 'h1'}
            <h1 id="heading" contenteditable bind:innerHTML={heading} oninput={handleEmojis}></h1>
        {:else if size === 'h2'}
            <h2 id="heading" contenteditable bind:innerHTML={heading} oninput={handleEmojis}></h2>
        {:else if size === 'h3'}
            <h3 id="heading" contenteditable bind:innerHTML={heading} oninput={handleEmojis}></h3>
        {:else if size === 'h4'}
            <h4 id="heading" contenteditable bind:innerHTML={heading} oninput={handleEmojis}></h4>
        {:else if size === 'h5'}
            <h5 id="heading" contenteditable bind:innerHTML={heading} oninput={handleEmojis}></h5>
        {:else}
            <h6 id="heading" contenteditable bind:innerHTML={heading} oninput={handleEmojis}></h6>
        {/if}
    </div>
</div>