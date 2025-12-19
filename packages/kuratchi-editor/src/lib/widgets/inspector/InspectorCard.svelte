<script lang="ts">
    interface Props {
        variant?: 'default' | 'color' | 'media' | 'icon' | 'logoPreview';
        children?: import('svelte').Snippet;
    }

    let {
        variant = 'default',
        children
    }: Props = $props();
</script>

<div 
    class="krt-inspectorCard"
    class:krt-inspectorCard--color={variant === 'color'}
    class:krt-inspectorCard--media={variant === 'media'}
    class:krt-inspectorCard--icon={variant === 'icon'}
    class:krt-inspectorCard--logoPreview={variant === 'logoPreview'}
>
    {@render children?.()}
</div>

<style>
    .krt-inspectorCard {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--krt-space-sm, 0.5rem);
        padding: var(--krt-space-md, 0.75rem) var(--krt-space-lg, 1rem);
        border-radius: var(--krt-radius-md, 0.5rem);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        background: var(--krt-color-surface, #ffffff);
        font-size: 0.9rem;
    }

    .krt-inspectorCard :global(span) {
        font-weight: 500;
    }

    .krt-inspectorCard--color {
        flex-direction: column;
        align-items: flex-start;
    }

    .krt-inspectorCard--media {
        padding: var(--krt-space-lg, 1rem);
    }

    .krt-inspectorCard--icon {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--krt-space-sm, 0.5rem);
    }

    .krt-inspectorCard--logoPreview {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--krt-space-lg, 1rem);
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        border: 2px dashed var(--krt-color-border-subtle, #e5e7eb);
    }
</style>
