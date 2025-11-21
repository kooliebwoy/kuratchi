<script lang="ts">
    import type { Snippet } from 'svelte';

    interface Props {
        id: string;
        label?: Snippet;
        content?: Snippet;
    }

    let { id, label, content }: Props = $props();
</script>

<!-- Reusable Drawer Widget -->
<div class="krt-drawer" data-drawer={id}>
    <input id={id} type="checkbox" class="krt-drawer__toggle" />
    <div class="krt-drawer__trigger">
        {@render label?.()}
    </div>
    <div class="krt-drawer__overlay"></div>
    <aside class="krt-drawer__panel" aria-label="Drawer panel">
        <div class="krt-drawer__content">
            {@render content?.()}
        </div>
    </aside>
</div>

<style>
    .krt-drawer {
        position: relative;
    }

    .krt-drawer__toggle {
        position: absolute;
        inset: 0;
        width: 0;
        height: 0;
        opacity: 0;
        pointer-events: none;
    }

    .krt-drawer__trigger {
        display: inline-flex;
    }

    .krt-drawer__overlay {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.45);
        opacity: 0;
        pointer-events: none;
        transition: opacity 180ms ease;
        z-index: 40;
    }

    .krt-drawer__panel {
        position: fixed;
        inset-block: 0;
        inset-inline-end: 0;
        width: min(28rem, 100%);
        transform: translateX(100%);
        background: #f8fafc;
        color: #0f172a;
        box-shadow: -24px 0 60px rgba(15, 23, 42, 0.28);
        transition: transform 200ms ease;
        z-index: 50;
        display: flex;
        flex-direction: column;
    }

    .krt-drawer__content {
        padding: var(--krt-space-lg, 1rem);
        overflow: auto;
        flex: 1 1 auto;
    }

    .krt-drawer__toggle:checked ~ .krt-drawer__overlay {
        opacity: 1;
        pointer-events: auto;
    }

    .krt-drawer__toggle:checked ~ .krt-drawer__panel {
        transform: translateX(0%);
    }

    .krt-drawer__overlay,
    .krt-drawer__panel {
        pointer-events: none;
    }

    .krt-drawer__toggle:checked ~ .krt-drawer__overlay,
    .krt-drawer__toggle:checked ~ .krt-drawer__panel {
        pointer-events: auto;
    }
</style>