<script lang="ts">
    import { handleEmojis } from "../utils/emojis.js";
    import EditorToolbar from "../plugins/EditorToolbar.svelte";
    import { deleteElement, sanitizeContent, setupSelectionListener, type SelectionState } from "../utils/editor.svelte.js";
    import { onDestroy, onMount } from "svelte";
    import { BlockActions } from "../shell/index.js";

    interface Props {
        id?: string;
        heading?: string;
        type?: string;
        metadata?: {
            color?: string;
            size?: string;
        };
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        heading = 'Heading...',
        type = 'heading',
        metadata = {
            color: '#000000',
            size: 'h2'
        },
        editable = true
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
    });
</script>

{#if editable}
    <div class="editor-item group relative krt-heading-block" bind:this={component}>
        {#if mounted}
            <EditorToolbar {component} show={selectionState.showToolbar} position={selectionState.position} />
        {/if}
        
        {#if mounted}
            <BlockActions {component}>
                <li><button class="btn btn-sm btn-ghost" onclick={() => size = 'h2'}>H2</button></li>
                <li><button class="btn btn-sm btn-ghost" onclick={() => size = 'h3'}>H3</button></li>
                <li><button class="btn btn-sm btn-ghost" onclick={() => size = 'h4'}>H4</button></li>
                <li><button class="btn btn-sm btn-ghost" onclick={() => size = 'h5'}>H5</button></li>
                <li><button class="btn btn-sm btn-ghost" onclick={() => size = 'h6'}>H6</button></li>
            </BlockActions>
        {/if}
        
        <div data-type={type} id={id} class="krt-heading-body">
            <!-- JSON Data for this component -->
            <div class="hidden" id="metadata-{id}">
                {JSON.stringify(content)}
            </div>
            {#if size === 'h1'}
                <h1 id="heading" class="krt-heading krt-heading--h1 krt-heading--editable" contenteditable bind:innerHTML={heading} oninput={handleEmojis}></h1>
            {:else if size === 'h2'}
                <h2 id="heading" class="krt-heading krt-heading--h2 krt-heading--editable" contenteditable bind:innerHTML={heading} oninput={handleEmojis}></h2>
            {:else if size === 'h3'}
                <h3 id="heading" class="krt-heading krt-heading--h3 krt-heading--editable" contenteditable bind:innerHTML={heading} oninput={handleEmojis}></h3>
            {:else if size === 'h4'}
                <h4 id="heading" class="krt-heading krt-heading--h4 krt-heading--editable" contenteditable bind:innerHTML={heading} oninput={handleEmojis}></h4>
            {:else if size === 'h5'}
                <h5 id="heading" class="krt-heading krt-heading--h5 krt-heading--editable" contenteditable bind:innerHTML={heading} oninput={handleEmojis}></h5>
            {:else}
                <h6 id="heading" class="krt-heading krt-heading--h6 krt-heading--editable" contenteditable bind:innerHTML={heading} oninput={handleEmojis}></h6>
            {/if}
        </div>
    </div>
{:else}
    {@const tag = size ?? 'h2'}
    <div data-type={type} id={id} class="krt-heading-block krt-heading-body">
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
</style>