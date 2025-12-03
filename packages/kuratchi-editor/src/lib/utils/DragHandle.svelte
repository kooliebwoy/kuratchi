<script lang="ts">
    import { GripVertical } from '@lucide/svelte';

    interface Props {
        position?: 'left' | 'right';
    }

    let { position = 'left' }: Props = $props();
</script>

<button
    class="krt-dragHandle drag-handle handle"
    class:krt-dragHandle--left={position === 'left'}
    class:krt-dragHandle--right={position === 'right'}
    type="button"
    title="Drag to reorder"
    draggable="true"
>
    <GripVertical aria-hidden="true" />
</button>

<style>
    .krt-dragHandle {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 1.5rem;
        height: 2rem;
        border-radius: 0.25rem;
        border: none;
        background: transparent;
        color: rgba(15, 23, 42, 0.3);
        cursor: grab;
        opacity: 0;
        transition: opacity 150ms ease, color 150ms ease, background 150ms ease;
        z-index: 4;
    }

    .krt-dragHandle--left {
        left: -1.75rem;
    }

    .krt-dragHandle--right {
        right: -1.75rem;
    }

    :global(.editor-item:hover) .krt-dragHandle,
    :global(.editor-item:focus-within) .krt-dragHandle,
    :global(.editor-header-item:hover) .krt-dragHandle,
    :global(.editor-header-item:focus-within) .krt-dragHandle,
    :global(.editor-footer-item:hover) .krt-dragHandle,
    :global(.editor-footer-item:focus-within) .krt-dragHandle {
        opacity: 1;
    }

    .krt-dragHandle:hover {
        color: rgba(99, 102, 241, 0.8);
        background: rgba(99, 102, 241, 0.08);
    }

    .krt-dragHandle:active {
        cursor: grabbing;
    }

    .krt-dragHandle :global(svg) {
        width: 1rem;
        height: 1rem;
    }
</style>
