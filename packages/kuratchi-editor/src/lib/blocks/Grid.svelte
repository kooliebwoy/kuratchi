<script lang="ts">
    import { GripVertical, Trash2 } from "@lucide/svelte";
    import { deleteElement } from "$lib/utils/editor.svelte";

    interface Props {
        id?: string;
        type?: string;
        metadata?: any;
    }

    let {
        id = crypto.randomUUID(),
        type = 'grid',
        metadata = {}
    }: Props = $props();

    let component: HTMLElement;
    let componentEditor: HTMLElement;

    // extract body from the content and the card title
    let content = $derived({
        id,
        type,
        metadata
    })
</script>

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
        <div class="hidden" id="metadata-{id}">
            {JSON.stringify(content)}
        </div>

        <div class="grid"></div>
    </div>
</div>
