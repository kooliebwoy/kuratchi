<script lang="ts">
    import { onMount } from "svelte";
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
    import { GripVertical, Trash2 } from "@lucide/svelte";
    import { deleteElement } from "../utils/editor.svelte.js";

    interface Props {
        id?: string;
        type?: string;
        metadata?: any;
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        type = 'grid',
        metadata = {},
        editable = true
    }: Props = $props();

    let component = $state<HTMLElement>();
    const componentRef = {};
    let componentEditor = $state<HTMLElement>();

    // extract body from the content and the card title
    let content = $derived({
        id,
        type,
        metadata
    })

    onMount(() => {
        if (typeof editable !== 'undefined' && !editable) return;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
        return () => blockRegistry.unregister(componentRef);
    });
</script>

{#if editable}
    <div class="editor-item group">
        <!-- Edit Popup -->
        <div class="editor-block-controls" bind:this={componentEditor} >
            <div>
                <button class="btn btn-xs btn-naked">
                    <GripVertical class="text-xl text-teal-50" />
                </button>
            </div>
            <div>
                <button class="btn btn-xs btn-naked" onclick={() => deleteElement(component!)}>
                    <Trash2 class="text-xl text-error" />
                </button>
            </div>
        </div>
        
        <div data-type={type} id={id} bind:this={component} class="w-full min-w-full">
            <!-- JSON Data for this component -->
            <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>

            <div class="grid"></div>
        </div>
    </div>
{:else}
    <div data-type={type} id={id} class="w-full min-w-full">
        <div class="grid"></div>
    </div>
{/if}
