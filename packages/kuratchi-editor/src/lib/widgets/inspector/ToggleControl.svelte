<script lang="ts">
    interface Props {
        label: string;
        checked?: boolean;
    }

    let {
        label,
        checked = $bindable(false)
    }: Props = $props();
</script>

<label class="krt-toggleControl">
    <span class="krt-toggleControl__label">{label}</span>
    <input type="checkbox" class="krt-toggleControl__switch" bind:checked />
</label>

<style>
    .krt-toggleControl {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--krt-space-sm, 0.5rem);
        padding: var(--krt-space-md, 0.75rem) var(--krt-space-lg, 1rem);
        border-radius: var(--krt-radius-md, 0.5rem);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        background: var(--krt-color-surface, #ffffff);
        cursor: pointer;
        width: 100%;
    }

    .krt-toggleControl__label {
        font-size: 0.9rem;
        font-weight: 500;
    }

    .krt-toggleControl__switch {
        inline-size: 2.25rem;
        block-size: 1.25rem;
        border-radius: 999px;
        background: var(--krt-color-border-subtle, #e5e7eb);
        position: relative;
        appearance: none;
        cursor: pointer;
        transition: background 150ms ease;
        flex-shrink: 0;
    }

    .krt-toggleControl__switch::after {
        content: '';
        position: absolute;
        inset-block: 0.1875rem;
        inset-inline-start: 0.1875rem;
        width: 0.875rem;
        border-radius: 50%;
        background: #ffffff;
        box-shadow: 0 1px 3px rgba(15, 23, 42, 0.2);
        transition: transform 150ms ease;
    }

    .krt-toggleControl__switch:checked {
        background: var(--krt-color-primary, #111827);
    }

    .krt-toggleControl__switch:checked::after {
        transform: translateX(1rem);
    }

    .krt-toggleControl__switch:focus-visible {
        outline: 2px solid var(--krt-color-primary, #3b82f6);
        outline-offset: 2px;
    }
</style>
