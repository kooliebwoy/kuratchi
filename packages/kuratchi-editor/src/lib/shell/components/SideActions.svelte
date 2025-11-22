<script lang="ts">
    import type { Snippet } from 'svelte';

    interface Props {
        id: string;
        label?: Snippet;
        content?: Snippet;
    }

    let { id, label, content }: Props = $props();
</script>

<!-- Reusable Side Actions Widget -->
<div class="krt-sideActions" data-drawer={id}>
    <input id={id} type="checkbox" class="krt-sideActions__toggle" />
    <div class="krt-sideActions__trigger">
        {@render label?.()}
    </div>
    <div class="krt-sideActions__overlay"></div>
    <aside class="krt-sideActions__panel" aria-label="Side actions panel">
        <div class="krt-sideActions__content">
            {@render content?.()}
        </div>
    </aside>
</div>

<style>
    .krt-sideActions {
        position: relative;
    }

    .krt-sideActions__toggle {
        position: absolute;
        inset: 0;
        width: 0;
        height: 0;
        opacity: 0;
        pointer-events: none;
    }

    .krt-sideActions__trigger {
        display: inline-flex;
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
        box-shadow: -24px 0 60px rgba(15, 23, 42, 0.28);
        transition: transform 200ms ease;
        z-index: 50;
        display: flex;
        flex-direction: column;
    }

    .krt-sideActions__content {
        padding: var(--krt-space-lg, 1rem);
        overflow: auto;
        flex: 1 1 auto;
    }

    .krt-sideActions__toggle:checked ~ .krt-sideActions__overlay {
        opacity: 1;
        pointer-events: auto;
    }

    .krt-sideActions__toggle:checked ~ .krt-sideActions__panel {
        transform: translateX(0%);
    }

    .krt-sideActions__overlay,
    .krt-sideActions__panel {
        pointer-events: none;
    }

    .krt-sideActions__toggle:checked ~ .krt-sideActions__overlay,
    .krt-sideActions__toggle:checked ~ .krt-sideActions__panel {
        pointer-events: auto;
    }
</style>