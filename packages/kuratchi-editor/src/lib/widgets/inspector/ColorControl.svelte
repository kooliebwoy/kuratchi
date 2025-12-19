<script lang="ts">
    interface Props {
        label: string;
        value?: string;
        placeholder?: string;
    }

    let {
        label,
        value = $bindable(''),
        placeholder = ''
    }: Props = $props();
</script>

<label class="krt-colorControl">
    <span class="krt-colorControl__label">{label}</span>
    <div class="krt-colorControl__inputs">
        <input 
            type="color" 
            class="krt-colorControl__picker"
            bind:value 
        />
        <input 
            type="text" 
            class="krt-colorControl__text"
            bind:value 
            {placeholder}
        />
    </div>
</label>

<style>
    .krt-colorControl {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--krt-space-sm, 0.5rem);
        padding: var(--krt-space-md, 0.75rem) var(--krt-space-lg, 1rem);
        border-radius: var(--krt-radius-md, 0.5rem);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        background: var(--krt-color-surface, #ffffff);
        width: 100%;
        cursor: pointer;
    }

    .krt-colorControl__label {
        font-size: 0.9rem;
        font-weight: 500;
    }

    .krt-colorControl__inputs {
        display: flex;
        align-items: center;
        gap: var(--krt-space-sm, 0.5rem);
        width: 100%;
    }

    .krt-colorControl__picker {
        width: 2.5rem;
        height: 2.5rem;
        border-radius: var(--krt-radius-md, 0.5rem);
        border: 2px solid var(--krt-color-border-subtle, #e5e7eb);
        background: none;
        padding: 0;
        cursor: pointer;
        flex-shrink: 0;
    }

    .krt-colorControl__picker::-webkit-color-swatch-wrapper {
        padding: 2px;
    }

    .krt-colorControl__picker::-webkit-color-swatch {
        border-radius: calc(var(--krt-radius-md, 0.5rem) - 4px);
        border: none;
    }

    .krt-colorControl__text {
        flex: 1;
        min-width: 0;
        border-radius: var(--krt-radius-md, 0.5rem);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        padding: 0.45rem 0.75rem;
        font-size: 0.8rem;
        font-family: 'SFMono-Regular', ui-monospace, Menlo, Monaco, Consolas, monospace;
        color: var(--krt-color-muted, #6b7280);
        background: #f9fafb;
    }

    .krt-colorControl__text:focus {
        outline: 2px solid var(--krt-color-primary, #3b82f6);
        outline-offset: 1px;
    }
</style>
