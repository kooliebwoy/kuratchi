<script lang="ts" module>
    export interface InspectorSectionProps {
        title: string;
        icon?: string;
        hint?: string;
        collapsed?: boolean;
        primary?: boolean;
    }
</script>

<script lang="ts">
    import { ChevronDown } from '@lucide/svelte';

    interface Props extends InspectorSectionProps {
        children?: import('svelte').Snippet;
    }

    let {
        title,
        icon = '',
        hint = '',
        collapsed = false,
        primary = false,
        children
    }: Props = $props();

    let isCollapsed = $state(collapsed);
</script>

<section 
    class="krt-inspectorSection"
    class:krt-inspectorSection--primary={primary}
    class:krt-inspectorSection--collapsed={isCollapsed}
>
    <button 
        type="button"
        class="krt-inspectorSection__header"
        onclick={() => isCollapsed = !isCollapsed}
    >
        <h3 class="krt-inspectorSection__title">
            {#if icon}
                <span class="krt-inspectorSection__icon">{icon}</span>
            {/if}
            {title}
        </h3>
        <span class="krt-inspectorSection__chevron">
            <ChevronDown />
        </span>
    </button>
    
    {#if hint && !isCollapsed}
        <p class="krt-inspectorSection__hint">{hint}</p>
    {/if}
    
    {#if !isCollapsed}
        <div class="krt-inspectorSection__content">
            {@render children?.()}
        </div>
    {/if}
</section>

<style>
    .krt-inspectorSection {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-sm, 0.5rem);
    }

    .krt-inspectorSection--primary {
        padding-bottom: var(--krt-space-lg, 1rem);
        border-bottom: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        margin-bottom: var(--krt-space-sm, 0.5rem);
    }

    .krt-inspectorSection__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 0;
        margin: 0;
        background: none;
        border: none;
        cursor: pointer;
        text-align: left;
    }

    .krt-inspectorSection__header:hover .krt-inspectorSection__title {
        color: var(--krt-color-text, #1f2937);
    }

    .krt-inspectorSection__title {
        margin: 0;
        display: flex;
        align-items: center;
        gap: var(--krt-space-xs, 0.25rem);
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--krt-color-text-secondary, #374151);
        transition: color 150ms ease;
    }

    .krt-inspectorSection__icon {
        font-size: 1rem;
    }

    .krt-inspectorSection__chevron {
        display: inline-flex;
        color: var(--krt-color-muted, #6b7280);
        transition: transform 200ms ease;
    }

    .krt-inspectorSection__chevron :global(svg) {
        width: 1rem;
        height: 1rem;
    }

    .krt-inspectorSection--collapsed .krt-inspectorSection__chevron {
        transform: rotate(-90deg);
    }

    .krt-inspectorSection__hint {
        margin: 0;
        font-size: 0.75rem;
        color: var(--krt-color-muted, #6b7280);
        line-height: 1.4;
    }

    .krt-inspectorSection__content {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-sm, 0.5rem);
        margin-top: var(--krt-space-xs, 0.25rem);
    }
</style>
