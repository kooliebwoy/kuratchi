<script lang="ts">
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
    import { BlockActions } from "../utils/index.js";
    import { onMount } from "svelte";

    interface Props {
        id?: string;
        type?: string;
        metadata?: any;
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        type = 'divider',
        metadata = {},
        editable = true
    }: Props = $props();

    let component = $state<HTMLElement>();
    const componentRef = {};

    // extract body from the content and the card title
    let content = $derived({
        id,
        type,
        metadata
    })

    let mounted = $state(false);
    onMount(() => {
        if (!editable) return;
        mounted = true;
    });

    onMount(() => {
        if (typeof editable !== 'undefined' && !editable) return;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
        return () => blockRegistry.unregister(componentRef);
    });
</script>

{#if editable}
    <div class="editor-item group relative" bind:this={component}>
        {#if mounted}
            <BlockActions {component} />
        {/if}

        <div data-type={type} id={id} class="w-full min-w-full">
            <!-- JSON Data for this component -->
            <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
            <div class="divider"></div>
        </div>
    </div>
{:else}
    <div data-type={type} id={id} class="w-full min-w-full">
        <div class="divider"></div>
    </div>
{/if}
