<script lang="ts">
    import { GripVertical, Pencil, Plus, Trash2 } from '@lucide/svelte';
    import type { Snippet } from 'svelte';
    import { closeRightPanel, openRightPanel } from '../stores/right-panel.js';
    import { deleteElement } from './editor.svelte.js';

    interface Props {
        id?: string;
        type?: string;
        element?: HTMLElement;
        component?: HTMLElement;
        children?: Snippet;
        inspector?: Snippet;
        inspectorTitle?: string;
    }

    let {
        id = crypto.randomUUID(),
        type = 'block',
        element,
        component,
        children,
        inspector,
        inspectorTitle
    }: Props = $props();

    const targetElement = $derived(element ?? component);
    const popoverId = $derived(`block-actions-${id}`);
    const anchorName = $derived(`--sizePopover-${id}`);
    const inspectorHeading = $derived(
        inspectorTitle ?? `Edit ${(type ?? 'block').replace(/-/g, ' ')}`
    );

    const openInspector = (event?: Event) => {
        event?.preventDefault();
        if (!inspector) return;
        openRightPanel(inspector, inspectorHeading);
    };

    const handleDelete = () => {
        if (!targetElement) return;
        closeRightPanel();
        deleteElement(targetElement);
    };
</script>

<div class="krt-blockActions" data-type={type}>
    <button
        class="krt-blockActions__button krt-blockActions__button--drag drag-handle handle"
        type="button"
        title="Drag to reorder"
        draggable="true"
    >
        <GripVertical aria-hidden="true" />
    </button>
    {#if inspector}
        <button
            class="krt-blockActions__button krt-blockActions__button--edit"
            type="button"
            onclick={openInspector}
            title={inspectorHeading}
        >
            <Pencil aria-hidden="true" />
        </button>
    {/if}
    <button
        class="krt-blockActions__button"
        type="button"
        style={`anchor-name:${anchorName}`}
        popovertarget={popoverId}
        title="Add block variation"
    >
        <Plus aria-hidden="true" />
    </button>
    <ul
        popover="auto"
        id={popoverId}
        style={`position-anchor:${anchorName}`}
        class="krt-blockActions__menu"
    >
        {@render children?.()}
        <li>
            <button
                class="krt-blockActions__menuItem krt-blockActions__menuItem--danger"
                type="button"
                onclick={handleDelete}
            >
                <Trash2 aria-hidden="true" />
                Delete
            </button>
        </li>
    </ul>
</div>

<style>
    .krt-blockActions {
        position: absolute;
        inset-block-start: 0;
        inset-inline-end: 0;
        transform: translateY(-50%);
        display: flex;
        gap: var(--krt-space-xs, 0.25rem);
        opacity: 0;
        transition: opacity 150ms ease;
        z-index: 4;
        background: #f8fafc;
        padding: 0.35rem;
        border-radius: var(--krt-radius-md, 0.5rem);
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
    }

    :global(.editor-item:hover) .krt-blockActions,
    :global(.editor-item:focus-within) .krt-blockActions,
    :global(.editor-header-item:hover) .krt-blockActions,
    :global(.editor-header-item:focus-within) .krt-blockActions,
    :global(.editor-footer-item:hover) .krt-blockActions,
    :global(.editor-footer-item:focus-within) .krt-blockActions,
    :global(.krt-shellBlock:hover) .krt-blockActions,
    :global(.krt-shellBlock:focus-within) .krt-blockActions {
        opacity: 1;
    }

    .krt-blockActions__button {
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

    .krt-blockActions__button:hover {
        transform: translateY(-1px);
        background: rgba(99, 102, 241, 0.08);
        border-color: rgba(99, 102, 241, 0.4);
        color: rgba(99, 102, 241, 0.9);
    }

    .krt-blockActions__button:focus-visible {
        outline: 2px solid var(--krt-color-primary, #6366f1);
        outline-offset: 2px;
    }

    .krt-blockActions__button--drag {
        cursor: grab;
    }

    .krt-blockActions__button--drag:active {
        cursor: grabbing;
    }

    .krt-blockActions__button--edit {
        background: rgba(15, 23, 42, 0.04);
    }

    .krt-blockActions__button--edit:hover {
        background: rgba(99, 102, 241, 0.08);
    }

    .krt-blockActions__button :global(svg) {
        width: 1rem;
        height: 1rem;
    }

    .krt-blockActions__menu {
        list-style: none;
        margin: 0;
        padding: var(--krt-space-sm, 0.5rem);
        display: none;
        flex-direction: column;
        gap: var(--krt-space-xs, 0.25rem);
        min-width: 14rem;
        border-radius: var(--krt-radius-lg, 0.75rem);
        border: 1px solid rgba(99, 102, 241, 0.2);
        background: #ffffff;
        box-shadow: 0 10px 25px rgba(15, 23, 42, 0.15);
        color: rgba(15, 23, 42, 0.8);
        position: absolute;
        inset: auto;
        bottom: auto;
        top: anchor(bottom);
        left: anchor(center);
        transform: translateX(-50%);
        margin-top: 0.5rem;
    }

    .krt-blockActions__menu:popover-open {
        display: flex;
    }

    .krt-blockActions__menuItem {
        width: 100%;
        display: inline-flex;
        align-items: center;
        gap: var(--krt-space-xs, 0.25rem);
        padding: 0.5rem 0.6rem;
        border-radius: var(--krt-radius-md, 0.5rem);
        border: none;
        background: transparent;
        color: inherit;
        cursor: pointer;
        font-size: 0.85rem;
        font-weight: 500;
        transition: background 150ms ease, color 150ms ease;
    }

    .krt-blockActions__menuItem:hover {
        background: rgba(99, 102, 241, 0.08);
        color: rgba(99, 102, 241, 0.9);
    }

    .krt-blockActions__menuItem:focus-visible {
        outline: 2px solid var(--krt-color-primary, #6366f1);
        outline-offset: 2px;
    }

    .krt-blockActions__menuItem--danger {
        color: #ef4444;
    }

    .krt-blockActions__menuItem--danger:hover {
        background: rgba(239, 68, 68, 0.1);
        color: #dc2626;
    }

    .krt-blockActions__menuItem :global(svg) {
        width: 1rem;
        height: 1rem;
    }
</style>
