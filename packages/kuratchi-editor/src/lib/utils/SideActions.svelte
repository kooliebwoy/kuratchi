<script lang="ts">
    import { browser } from '$app/environment';
    import type { Snippet } from 'svelte';
    import { onDestroy, onMount } from 'svelte';
    import { closeRightPanel, openRightPanel } from '../stores/right-panel.js';

    interface Props {
        id?: string;
        triggerId?: string;
        title?: string;
        label?: Snippet<{ open: () => void; close: () => void }>;
        content?: Snippet<{ close: () => void }>;
    }

    let { id, triggerId, title, label, content }: Props = $props();

    const resolvedId = $derived(triggerId ?? id ?? `side-actions-${crypto.randomUUID()}`);
    const inspectorTitle = $derived(title ?? 'Edit block');
    const inspectorContent = $derived<Snippet | null>(
        content ? (() => content({ close: closeInspector })) : null
    );

    let triggerEl: HTMLElement | null = null;

    function closeInspector() {
        closeRightPanel();
    }

    const openInspector = (event?: Event) => {
        event?.preventDefault();
        if (!inspectorContent) return;
        openRightPanel(inspectorContent, inspectorTitle);
    };

    const handleTriggerKeydown = (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openInspector();
        }

        if (event.key === 'Escape') {
            closeInspector();
        }
    };

    const attachTriggerListener = () => {
        if (!resolvedId) return;
        const trigger = document.getElementById(resolvedId);

        if (!trigger) return;

        const handleTriggerClick = (event: Event) => {
            event.preventDefault();
            openInspector();
        };

        trigger.addEventListener('click', handleTriggerClick);
        trigger.addEventListener('keydown', handleTriggerKeydown);
        return () => {
            trigger.removeEventListener('click', handleTriggerClick);
            trigger.removeEventListener('keydown', handleTriggerKeydown);
        };
    };

    let detachTriggerListener: (() => void) | undefined;

    onMount(() => {
        if (browser) {
            detachTriggerListener = attachTriggerListener();
        }
    });

    onDestroy(() => {
        if (browser) {
            detachTriggerListener?.();
        }
    });
</script>

<div class="krt-sideActions">
    <div
        class="krt-sideActions__trigger"
        role="button"
        tabindex={triggerId ? undefined : 0}
        aria-haspopup="dialog"
        aria-expanded="false"
        bind:this={triggerEl}
        onclick={triggerId ? undefined : openInspector}
        onkeydown={triggerId ? undefined : handleTriggerKeydown}
    >
        {@render label?.({ open: openInspector, close: closeInspector })}
    </div>
</div>

<style>
    .krt-sideActions {
        position: relative;
        z-index: 1;
    }

    .krt-sideActions__trigger {
        display: inline-flex;
    }

    :global(.krt-editButton),
    :global([class*="__editButton"]) {
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
        transition: transform 150ms ease, background 150ms ease, border 150ms ease, opacity 150ms ease;
        opacity: 0;
        position: absolute;
        inset-block-start: 0.5rem;
        inset-inline-end: 0.5rem;
        font-size: 1rem;
        padding: 0;
        z-index: 5;
    }

    :global(.editor-item:hover .krt-editButton),
    :global(.editor-item:focus-within .krt-editButton),
    :global(.editor-item:hover [class*="__editButton"]),
    :global(.editor-item:focus-within [class*="__editButton"]),
    :global(.krt-shellBlock:hover .krt-editButton),
    :global(.krt-shellBlock:focus-within .krt-editButton),
    :global(.krt-shellBlock:hover [class*="__editButton"]),
    :global(.krt-shellBlock:focus-within [class*="__editButton"]) {
        opacity: 1;
    }

    :global(.krt-editButton:hover),
    :global([class*="__editButton"]:hover) {
        transform: translateY(-1px);
        background: rgba(99, 102, 241, 0.08);
        border-color: rgba(99, 102, 241, 0.4);
        color: rgba(99, 102, 241, 0.9);
    }

    :global(.krt-editButton:focus-visible),
    :global([class*="__editButton"]:focus-visible) {
        outline: 2px solid var(--krt-color-primary, #6366f1);
        outline-offset: 2px;
    }

    :global(.krt-editButton svg),
    :global([class*="__editButton"] svg) {
        width: 1rem;
        height: 1rem;
        font-size: 1rem;
    }
</style>
