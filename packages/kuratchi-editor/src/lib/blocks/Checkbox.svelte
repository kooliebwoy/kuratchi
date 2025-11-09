<script lang="ts">
    interface Props {
        label?: string;
        checked?: boolean;
        editable?: boolean;
    }

    let {
        label = 'List Item',
        checked = false,
        editable = true
    }: Props = $props();
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