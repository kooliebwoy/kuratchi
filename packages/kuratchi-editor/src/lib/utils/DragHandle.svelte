<script lang="ts">
    import { GripVertical, Trash2 } from '@lucide/svelte';
    import { deleteElement } from './editor.svelte.js';

    interface Props {
        position?: 'left' | 'right';
    }

    let { position = 'left' }: Props = $props();

    function handleDelete(event: MouseEvent) {
        event.stopPropagation();
        // Find the closest editor-item parent and delete it
        const button = event.currentTarget as HTMLElement;
        const editorItem = button.closest('.editor-item, .editor-header-item, .editor-footer-item');
        if (editorItem instanceof HTMLElement) {
            deleteElement(editorItem);
        }
    }
</script>

<div
    class="krt-dragHandle"
    class:krt-dragHandle--left={position === 'left'}
    class:krt-dragHandle--right={position === 'right'}
>
    <button
        class="krt-dragHandle__grip drag-handle handle"
        type="button"
        title="Drag to reorder"
        draggable="true"
    >
        <GripVertical aria-hidden="true" />
    </button>
    <button
        class="krt-dragHandle__delete"
        type="button"
        title="Delete block"
        onclick={handleDelete}
    >
        <Trash2 aria-hidden="true" />
    </button>
</div>

<style>
    .krt-dragHandle {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.25rem;
        opacity: 0;
        transition: opacity 150ms ease;
        z-index: 4;
    }

    .krt-dragHandle--left {
        left: -2rem;
    }

    .krt-dragHandle--right {
        right: -2rem;
    }

    :global(.editor-item:hover) .krt-dragHandle,
    :global(.editor-item:focus-within) .krt-dragHandle,
    :global(.editor-header-item:hover) .krt-dragHandle,
    :global(.editor-header-item:focus-within) .krt-dragHandle,
    :global(.editor-footer-item:hover) .krt-dragHandle,
    :global(.editor-footer-item:focus-within) .krt-dragHandle {
        opacity: 1;
    }

    .krt-dragHandle__grip,
    .krt-dragHandle__delete {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 1.5rem;
        height: 1.5rem;
        border-radius: 0.25rem;
        border: none;
        background: transparent;
        color: rgba(15, 23, 42, 0.4);
        cursor: pointer;
        transition: color 150ms ease, background 150ms ease;
    }

    .krt-dragHandle__grip {
        cursor: grab;
    }

    .krt-dragHandle__grip:active {
        cursor: grabbing;
    }

    .krt-dragHandle__grip:hover {
        color: rgba(99, 102, 241, 0.8);
        background: rgba(99, 102, 241, 0.08);
    }

    .krt-dragHandle__delete:hover {
        color: rgba(239, 68, 68, 0.9);
        background: rgba(239, 68, 68, 0.08);
    }

    .krt-dragHandle__grip :global(svg),
    .krt-dragHandle__delete :global(svg) {
        width: 0.875rem;
        height: 0.875rem;
    }
</style>
