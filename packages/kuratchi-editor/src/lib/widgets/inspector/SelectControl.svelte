<script lang="ts">
    interface Option {
        value: string;
        label: string;
    }

    interface Props {
        label: string;
        value?: string;
        options: Option[];
    }

    let {
        label,
        value = $bindable(''),
        options = []
    }: Props = $props();
</script>

<label class="krt-selectControl">
    <span class="krt-selectControl__label">{label}</span>
    <select class="krt-selectControl__select" bind:value>
        {#each options as option}
            <option value={option.value}>{option.label}</option>
        {/each}
    </select>
</label>

<style>
    .krt-selectControl {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--krt-space-sm, 0.5rem);
        padding: var(--krt-space-md, 0.75rem) var(--krt-space-lg, 1rem);
        border-radius: var(--krt-radius-md, 0.5rem);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        background: var(--krt-color-surface, #ffffff);
        width: 100%;
    }

    .krt-selectControl__label {
        font-size: 0.9rem;
        font-weight: 500;
    }

    .krt-selectControl__select {
        padding: 0.4rem 0.6rem;
        border-radius: var(--krt-radius-sm, 0.375rem);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        background: var(--krt-color-bg, #fafafa);
        font-size: 0.85rem;
        color: var(--krt-color-text, #1f2937);
        cursor: pointer;
        min-width: 6rem;
    }

    .krt-selectControl__select:focus {
        outline: 2px solid var(--krt-color-primary, #3b82f6);
        outline-offset: 1px;
    }
</style>
