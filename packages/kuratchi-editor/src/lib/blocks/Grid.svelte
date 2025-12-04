<script lang="ts">
    import { onMount } from "svelte";
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
    import { DragHandle, BLOCK_SPACING_VALUES, type BlockSpacing } from "../utils/index.js";

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
        type = 'grid',
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
    <div class="editor-item group relative krt-grid-block" bind:this={component} style={spacingStyle}>
        {#if mounted}
            <DragHandle />
        {/if}
        
        <div data-type={type} id={id} class="krt-grid-body">
            <!-- JSON Data for this component -->
            <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>

            <div class="krt-grid"></div>
        </div>
    </div>
{:else}
    <div data-type={type} id={id} class="krt-grid-block krt-grid-body" style={spacingStyle}>
        <div class="krt-grid"></div>
    </div>
{/if}

<style>
    .krt-grid-block {
        width: 100%;
        min-width: 100%;
    }

    .krt-grid-body {
        width: 100%;
    }

    .krt-grid {
        display: grid;
        gap: 1rem;
    }
</style>
