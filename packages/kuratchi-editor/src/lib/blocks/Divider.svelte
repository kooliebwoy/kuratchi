<script lang="ts">
    import { SideActions } from "../shell/index.js";
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
</script>

{#if editable}
    <div class="editor-item group relative" bind:this={component}>
        {#if mounted}
            <SideActions {component} />
        {/if}

        <div data-type={type} id={id} class="w-full min-w-full">
            <!-- JSON Data for this component -->
            <div class="hidden" id="metadata-{id}">
                {JSON.stringify(content)}
            </div>

            <div class="divider"></div>
        </div>
    </div>
{:else}
    <div data-type={type} id={id} class="w-full min-w-full">
        <div class="divider"></div>
    </div>
{/if}
