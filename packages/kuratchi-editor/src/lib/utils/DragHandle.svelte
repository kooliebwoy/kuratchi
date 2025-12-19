<script lang="ts">
    import { GripVertical, Trash2 } from '@lucide/svelte';
    import { deleteElement } from './editor.svelte.js';

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

<div class="krt-dragHandle">
    <button
        class="krt-dragHandle__button krt-dragHandle__button--drag drag-handle handle"
        type="button"
        title="Drag to reorder"
        draggable="true"
    >
        <GripVertical aria-hidden="true" />
    </button>
    <button
        class="krt-dragHandle__button krt-dragHandle__button--delete"
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
        inset-block-start: 0.5rem;
        inset-inline-end: 0.5rem;
        display: flex;
        gap: var(--krt-space-xs, 0.25rem);
        opacity: 0;
        transition: opacity 150ms ease;
        z-index: 10;
        background: #f8fafc;
        padding: 0.35rem;
        border-radius: var(--krt-radius-md, 0.5rem);
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
    }

    :global(.editor-item:hover) .krt-dragHandle,
    :global(.editor-item:focus-within) .krt-dragHandle,
    :global(.editor-header-item:hover) .krt-dragHandle,
    :global(.editor-header-item:focus-within) .krt-dragHandle,
    :global(.editor-footer-item:hover) .krt-dragHandle,
    :global(.editor-footer-item:focus-within) .krt-dragHandle {
        opacity: 1;
    }

    .krt-dragHandle__button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        border-radius: var(--krt-radius-md, 0.5rem);
        border: 1px solid rgba(15, 23, 42, 0.14);
        background: #ffffff;
        color: rgba(15, 23, 42, 0.8);
        cursor: pointer;
        transition: transform 150ms ease, background 150ms ease, border 150ms ease;
    }

    .krt-dragHandle__button:hover {
        transform: translateY(-1px);
        background: rgba(99, 102, 241, 0.08);
        border-color: rgba(99, 102, 241, 0.4);
        color: rgba(99, 102, 241, 0.9);
    }

    .krt-dragHandle__button:focus-visible {
        outline: 2px solid var(--krt-color-primary, #6366f1);
        outline-offset: 2px;
    }

    .krt-dragHandle__button--drag {
        cursor: grab;
    }

    .krt-dragHandle__button--drag:active {
        cursor: grabbing;
    }

    .krt-dragHandle__button--delete:hover {
        background: rgba(239, 68, 68, 0.1);
        border-color: rgba(239, 68, 68, 0.4);
        color: #dc2626;
    }

    .krt-dragHandle__button :global(svg) {
        width: 1rem;
        height: 1rem;
    }
</style>
