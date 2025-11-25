<script lang="ts">
    import { onMount } from "svelte";
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
    interface Props {
        id?: string;
        label?: string;
        checked?: boolean;
        editable?: boolean;
        type?: string;
    }

    let {
        id = crypto.randomUUID(),
        type = 'checkbox',
        label = 'List Item',
        checked = false,
        editable = true
    }: Props = $props();

    let content = $derived({
        id,
        type,
        label,
        checked
    });
    const componentRef = {};

    onMount(() => {
        if (typeof editable !== 'undefined' && !editable) return;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
        return () => blockRegistry.unregister(componentRef);
    });
</script>

{#if editable}
    <div class="form-control flex flex-row items-center gap-2">
        <label class="label">
            <input type="checkbox" class="checkbox" bind:checked={checked} />
        </label>
        <span class="label-text" contenteditable>{label}</span>
    </div>
{:else}
    <div class="form-control flex flex-row items-center gap-2">
        <label class="label">
            <input type="checkbox" class="checkbox" disabled checked={checked} />
        </label>
        <span class="label-text">{label}</span>
    </div>
{/if}
