<script lang="ts">
    import { Pencil, GripVertical, X, Trash2 } from '@lucide/svelte';
    import type { Snippet } from 'svelte';
    import { deleteElement } from '../../utils/editor.svelte.js';
    import { isFooterBlockType } from '../../presets/footers.js';
    import { isHeaderBlockType } from '../../presets/headers.js';
    import { openRightPanel } from '../../stores/right-panel.js';

    interface Props {
        id: string;
        type: string;
        drawerContent?: Snippet;
        metadata?: Snippet;
        children?: Snippet;
    }

    let { id, type, drawerContent, metadata, children }: Props = $props();
    let component: HTMLElement;

    const isNotHeaderOrFooter = !isFooterBlockType(type) && !isHeaderBlockType(type);

    let drawerState = $state(false);
</script>

<div
    class="krt-shellBlock"
    bind:this={component}
    class:editor-item={isNotHeaderOrFooter}
    class:editor-header-item={isHeaderBlockType(type)}
    class:editor-footer-item={isFooterBlockType(type)}
>
    <div class="krt-shellBlock__actions">
        <button
            class="krt-shellBlock__iconButton krt-shellBlock__iconButton--drag drag-handle handle"
            type="button"
            title="Drag to reorder"
            draggable="true"
        >
            <GripVertical aria-hidden="true" />
            <span class="krt-shellBlock__sr">Drag to reorder</span>
        </button>
        <button
            class="krt-shellBlock__iconButton"
            type="button"
            onclick={() => drawerContent ? openRightPanel(drawerContent, `Edit ${type}`) : drawerState = true}
            title="Edit component"
        >
            <Pencil aria-hidden="true" />
            <span class="krt-shellBlock__sr">Edit component</span>
        </button>
        {#if isNotHeaderOrFooter}
            <button
                class="krt-shellBlock__iconButton krt-shellBlock__iconButton--danger"
                type="button"
                onclick={() => deleteElement(component!)}
                title="Delete component"
            >
                <Trash2 aria-hidden="true" />
                <span class="krt-shellBlock__sr">Delete component</span>
            </button>
        {/if}
    </div>

    <div class="krt-shellBlock__content" id={id} data-type={type}>
        <div class="krt-shellBlock__metadata" id={`metadata-${id}`}>
            {@render metadata?.()}
        </div>
        {@render children?.()}
    </div>
</div>

<div class="krt-shellDrawer" class:krt-shellDrawer--open={drawerState}>
    <div class="krt-shellDrawer__backdrop" role="presentation" onclick={() => drawerState = false}></div>
    <aside class="krt-shellDrawer__panel" aria-label={`Edit ${type}`}>
        <header class="krt-shellDrawer__header">
            <button
                class="krt-shellDrawer__close"
                type="button"
                onclick={() => drawerState = false}
            >
                <X aria-hidden="true" />
            </button>
        </header>
        <div class="krt-shellDrawer__body">
            {@render drawerContent?.()}
        </div>
    </aside>
</div>

<style>
    .krt-shellBlock {
        position: relative;
    }

    .krt-shellBlock__content {
        position: relative;
        isolation: isolate;
        border-radius: var(--krt-radius-xl, 1rem);
        border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
        background: color-mix(in srgb, currentColor 6%, transparent);
        transition: border-color 150ms ease, background 150ms ease;
    }

    .krt-shellBlock__metadata {
        display: none;
    }

    .krt-shellBlock:hover .krt-shellBlock__content {
        border-color: color-mix(in srgb, currentColor 24%, transparent);
        background: color-mix(in srgb, currentColor 9%, transparent);
    }

    .krt-shellBlock__actions {
        position: absolute;
        inset-block-start: 50%;
        inset-inline-start: calc(-1 * var(--krt-space-5xl, 3.5rem));
        transform: translateY(-50%);
        display: flex;
        gap: var(--krt-space-xs, 0.25rem);
        opacity: 0;
        pointer-events: none;
        transition: opacity 150ms ease;
        z-index: 10;
    }

    .krt-shellBlock:hover .krt-shellBlock__actions,
    .krt-shellBlock:focus-within .krt-shellBlock__actions {
        opacity: 1;
        pointer-events: auto;
    }

    .krt-shellBlock__iconButton {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.25rem;
        height: 2.25rem;
        border-radius: var(--krt-radius-pill, 999px);
        border: 1px solid rgba(15, 23, 42, 0.12);
        background: rgba(15, 23, 42, 0.85);
        color: #f9fafb;
        cursor: pointer;
        transition: transform 150ms ease, background 150ms ease, border 150ms ease;
    }

    .krt-shellBlock__iconButton:hover {
        transform: translateY(-1px);
        background: rgba(15, 23, 42, 0.92);
        border-color: rgba(15, 23, 42, 0.2);
    }

    .krt-shellBlock__iconButton:focus-visible {
        outline: 2px solid var(--krt-color-primary, #6366f1);
        outline-offset: 2px;
    }

    .krt-shellBlock__iconButton--drag {
        cursor: grab;
    }

    .krt-shellBlock__iconButton--drag:active {
        cursor: grabbing;
    }

    .krt-shellBlock__iconButton--danger {
        background: rgba(220, 38, 38, 0.85);
    }

    .krt-shellBlock__iconButton--danger:hover {
        background: rgba(220, 38, 38, 0.95);
        border-color: rgba(220, 38, 38, 0.2);
    }

    .krt-shellBlock__iconButton :global(svg) {
        width: 1.1rem;
        height: 1.1rem;
    }

    .krt-shellBlock__sr {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }

    .krt-shellDrawer {
        position: fixed;
        inset: 0;
        display: grid;
        pointer-events: none;
        z-index: 50;
    }

    .krt-shellDrawer__backdrop {
        grid-area: 1 / 1;
        background: rgba(15, 23, 42, 0.4);
        opacity: 0;
        transition: opacity 180ms ease;
    }

    .krt-shellDrawer__panel {
        grid-area: 1 / 1;
        margin-inline-start: auto;
        width: min(28rem, 100%);
        height: 100%;
        display: flex;
        flex-direction: column;
        background: #f9fafb;
        color: #0f172a;
        transform: translateX(100%);
        transition: transform 200ms ease;
        box-shadow: -24px 0 60px rgba(15, 23, 42, 0.26);
    }

    .krt-shellDrawer__header {
        display: flex;
        justify-content: flex-end;
        padding: var(--krt-space-md, 0.75rem) var(--krt-space-lg, 1rem);
    }

    .krt-shellDrawer__close {
        inline-size: 2.25rem;
        block-size: 2.25rem;
        border-radius: var(--krt-radius-pill, 999px);
        border: 1px solid rgba(15, 23, 42, 0.12);
        background: rgba(15, 23, 42, 0.08);
        color: inherit;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 150ms ease, background 150ms ease;
    }

    .krt-shellDrawer__close:hover {
        transform: translateY(-1px);
        background: rgba(15, 23, 42, 0.12);
    }

    .krt-shellDrawer__close :global(svg) {
        width: 1.35rem;
        height: 1.35rem;
    }

    .krt-shellDrawer__body {
        flex: 1 1 auto;
        overflow: auto;
        padding: var(--krt-space-lg, 1rem);
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-md, 0.75rem);
    }

    .krt-shellDrawer--open {
        pointer-events: auto;
    }

    .krt-shellDrawer--open .krt-shellDrawer__backdrop {
        opacity: 1;
    }

    .krt-shellDrawer--open .krt-shellDrawer__panel {
        transform: translateX(0%);
    }
</style>
