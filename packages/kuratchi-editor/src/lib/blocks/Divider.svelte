<script lang="ts">
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
    import { DragHandle, BLOCK_SPACING_VALUES, type BlockSpacing } from "../utils/index.js";
    import { deleteElement } from "../utils/editor.svelte.js";
    import { onMount } from "svelte";

    interface Props {
        id?: string;
        type?: string;
        metadata?: {
            spacingTop?: BlockSpacing;
            spacingBottom?: BlockSpacing;
        };
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        type = 'divider',
        metadata = {
            spacingTop: 'normal',
            spacingBottom: 'normal'
        },
        editable = true
    }: Props = $props();

    let component: HTMLElement | undefined;
    const componentRef = {};
    let spacingTop = $state<BlockSpacing>(metadata?.spacingTop ?? 'normal');
    let spacingBottom = $state<BlockSpacing>(metadata?.spacingBottom ?? 'normal');

    // Computed spacing styles
    let spacingStyle = $derived(
        `margin-top: ${BLOCK_SPACING_VALUES[spacingTop]}; margin-bottom: ${BLOCK_SPACING_VALUES[spacingBottom]};`
    );

    // extract body from the content and the card title
    let content = $derived({
        id,
        type,
        metadata: {
            spacingTop,
            spacingBottom
        }
    })

    let mounted = $state(false);
    onMount(() => {
        if (!editable) return;
        mounted = true;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
        return () => blockRegistry.unregister(componentRef);
    });
</script>

{#if editable}
    <div class="editor-item group relative krt-divider-block" bind:this={component} style={spacingStyle}>
        {#if mounted}
            <DragHandle />
        {/if}

        <div data-type={type} id={id} class="krt-divider-body">
            <!-- JSON Data for this component -->
            <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
            <hr class="krt-divider" />
        </div>
    </div>
{:else}
    <div data-type={type} id={id} class="krt-divider-block krt-divider-body" style={spacingStyle}>
        <hr class="krt-divider" />
    </div>
{/if}

<style>
    .krt-divider-block {
        width: 100%;
        min-width: 100%;
    }

    .krt-divider-body {
        width: 100%;
        padding: 0.5rem 0;
    }

    .krt-divider {
        border: none;
        border-top: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        margin: 0;
    }
</style>
