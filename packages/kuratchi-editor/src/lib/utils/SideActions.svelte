<script lang="ts">
	import { browser } from '$app/environment';
    import { X } from '@lucide/svelte';
    import { onDestroy, onMount } from 'svelte';
    import type { Snippet } from 'svelte';

    interface Props {
        id?: string;
        triggerId?: string;
        label?: Snippet<{ open: () => void; close: () => void }>;
        content?: Snippet<{ close: () => void }>;
    }

    let { id, triggerId, label, content }: Props = $props();

    const resolvedId = $derived(triggerId ?? id ?? `side-actions-${crypto.randomUUID()}`);
    let isOpen = $state(false);
    let panel: HTMLElement | null = null;
    let triggerEl: HTMLElement | null = null;

    const openDrawer = (event?: Event) => {
        event?.preventDefault();
        isOpen = true;
        queueMicrotask(() => panel?.focus());
    };

    const closeDrawer = () => {
        isOpen = false;
    };

    const handleKeydown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            closeDrawer();
        }
    };

    const handleTriggerKeydown = (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openDrawer();
        }

        if (event.key === 'Escape') {
            closeDrawer();
        }
    };

    const attachTriggerListener = () => {
        if (!resolvedId) return;
        const trigger = document.getElementById(resolvedId);

        if (!trigger) return;

        const handleTriggerClick = (event: Event) => {
            event.preventDefault();
            openDrawer();
        };

        trigger.addEventListener('click', handleTriggerClick);
        return () => trigger.removeEventListener('click', handleTriggerClick);
    };

    let detachTriggerListener: (() => void) | undefined;
    let detachInternalTrigger: (() => void) | undefined;

    const attachInternalTrigger = () => {
        if (!triggerEl) return;

        triggerEl.addEventListener('click', openDrawer);
        triggerEl.addEventListener('keydown', handleTriggerKeydown);

        return () => {
            triggerEl?.removeEventListener('click', openDrawer);
            triggerEl?.removeEventListener('keydown', handleTriggerKeydown);
        };
    };

    onMount(() => {
        if (browser) {
            document.addEventListener('keydown', handleKeydown);
            detachTriggerListener = attachTriggerListener();
            detachInternalTrigger = triggerId ? undefined : attachInternalTrigger();
        }
    });

    onDestroy(() => {
        if (browser) {
            document.removeEventListener('keydown', handleKeydown);
            detachTriggerListener?.();
            detachInternalTrigger?.();
        }
    });
</script>

<div class="krt-sideActions" data-open={isOpen ? 'true' : 'false'}>
    <div
        class="krt-sideActions__trigger"
        role="button"
        tabindex={triggerId ? undefined : 0}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        bind:this={triggerEl}
        onclick={triggerId ? undefined : openDrawer}
        onkeydown={triggerId ? undefined : handleTriggerKeydown}
    >
        {@render label?.({ open: openDrawer, close: closeDrawer })}
    </div>
    <div
        class="krt-sideActions__overlay"
        role="presentation"
        aria-hidden={!isOpen}
        onclick={closeDrawer}
    ></div>
    <aside
        class="krt-sideActions__panel"
        aria-label="Side actions panel"
        aria-hidden={!isOpen}
        class:open={isOpen}
        tabindex="-1"
        bind:this={panel}
    >
        <header class="krt-sideActions__header">
            <button type="button" class="krt-sideActions__close" onclick={closeDrawer} aria-label="Close panel">
                <X aria-hidden="true" />
            </button>
        </header>
        <div class="krt-sideActions__content">
            {@render content?.({ close: closeDrawer })}
        </div>
    </aside>
</div>

<style>
    .krt-sideActions {
        position: relative;
        z-index: 50;
    }

    .krt-sideActions__trigger {
        display: inline-flex;
        cursor: pointer;
    }

    .krt-sideActions__overlay {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.45);
        opacity: 0;
        pointer-events: none;
        transition: opacity 180ms ease;
        z-index: 40;
    }

    .krt-sideActions__panel {
        position: fixed;
        inset-block: 0;
        inset-inline-end: 0;
        width: min(28rem, 100%);
        transform: translateX(100%);
        background: #f8fafc;
        color: #0f172a;
        transition: transform 200ms ease;
        z-index: 50;
        display: flex;
        flex-direction: column;
        outline: none;
    }

    .krt-sideActions__panel.open {
        transform: translateX(0%);
    }

    .krt-sideActions__header {
        display: flex;
        justify-content: flex-end;
        padding: var(--krt-space-md, 0.75rem);
        border-bottom: 1px solid rgba(15, 23, 42, 0.08);
    }

    .krt-sideActions__close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.25rem;
        height: 2.25rem;
        border-radius: var(--krt-radius-pill, 999px);
        border: 1px solid rgba(15, 23, 42, 0.14);
        background: rgba(15, 23, 42, 0.08);
        color: #0f172a;
        cursor: pointer;
        transition: transform 150ms ease, background 150ms ease, border 150ms ease;
    }

    .krt-sideActions__close:hover {
        transform: translateY(-1px);
        background: rgba(15, 23, 42, 0.12);
        border-color: rgba(15, 23, 42, 0.18);
    }

    .krt-sideActions__close:focus-visible {
        outline: 2px solid var(--krt-color-primary, #6366f1);
        outline-offset: 2px;
    }

    .krt-sideActions__close :global(svg) {
        width: 1.1rem;
        height: 1.1rem;
    }

    .krt-sideActions__content {
        padding: var(--krt-space-lg, 1rem);
        overflow: auto;
        flex: 1 1 auto;
    }

    .krt-sideActions[data-open='true'] .krt-sideActions__overlay {
        opacity: 1;
        pointer-events: auto;
    }

    .krt-sideActions[data-open='true'] .krt-sideActions__panel {
        transform: translateX(0%);
    }

    /* Edit button styling - trigger for side actions */
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
