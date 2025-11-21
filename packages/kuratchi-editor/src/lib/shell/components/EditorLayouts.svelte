<script lang="ts">
    import { PanelsTopLeft } from "@lucide/svelte";

    interface Props {
        components?: any;
        addComponent: any;
    }

    let { components = [], addComponent }: Props = $props();

    let drawer: HTMLInputElement;

    const addLayoutComponent = (component: any) => {
        addComponent(component); // add the component to the editor, this is the parent function

        drawer.checked = false; // close the drawer
    }
</script>

<div class="krt-layoutDrawer" data-drawer="editor-layout-drawer">
    <input id="editor-layout-drawer" type="checkbox" class="krt-layoutDrawer__toggle" bind:this={drawer} />
    <div class="krt-layoutDrawer__trigger">
        <label for="editor-layout-drawer" class="krt-layoutDrawer__button">
            <PanelsTopLeft aria-hidden="true" />
            <span>Layouts</span>
        </label>
    </div>
    <label for="editor-layout-drawer" aria-label="Close layouts panel" class="krt-layoutDrawer__overlay"></label>
    <aside class="krt-layoutDrawer__panel" aria-label="Select a layout">
        <section class="krt-layoutDrawer__section">
            <header class="krt-layoutDrawer__header">
                <h3>Select layout</h3>
                <p>Drop ready-made sections into the canvas.</p>
            </header>

            {#each components as component}
                {#if component.name == 'Layouts'}
                    <div class="krt-layoutDrawer__grid">
                        {#each component.items as item}
                            <button class="krt-layoutDrawer__option" type="button" onclick={() => addLayoutComponent(item)}>
                                <img src={item.image} alt={item.name} />
                                <strong>{item.name}</strong>
                            </button>
                        {/each}
                    </div>
                {/if}
            {/each}
        </section>
    </aside>
</div>

<style>
    .krt-layoutDrawer {
        position: relative;
        display: inline-flex;
        align-items: center;
    }

    .krt-layoutDrawer__toggle {
        position: absolute;
        width: 0;
        height: 0;
        opacity: 0;
        pointer-events: none;
    }

    .krt-layoutDrawer__trigger {
        display: inline-flex;
    }

    .krt-layoutDrawer__button {
        display: inline-flex;
        align-items: center;
        gap: var(--krt-space-xs, 0.25rem);
        padding: 0.45rem 0.85rem;
        border-radius: var(--krt-radius-pill, 999px);
        border: 1px solid color-mix(in srgb, currentColor 16%, transparent);
        background: rgba(255, 255, 255, 0.7);
        color: inherit;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 600;
        transition: transform 150ms ease, background 150ms ease, border 150ms ease;
    }

    .krt-layoutDrawer__button:hover {
        transform: translateY(-1px);
        background: rgba(255, 255, 255, 0.9);
        border-color: color-mix(in srgb, currentColor 24%, transparent);
    }

    .krt-layoutDrawer__button:focus-visible {
        outline: 2px solid var(--krt-color-primary, #111827);
        outline-offset: 2px;
    }

    .krt-layoutDrawer__button :global(svg) {
        width: 1.2rem;
        height: 1.2rem;
    }

    .krt-layoutDrawer__overlay {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.4);
        opacity: 0;
        pointer-events: none;
        transition: opacity 180ms ease;
        z-index: 40;
    }

    .krt-layoutDrawer__panel {
        position: fixed;
        inset-block: 0;
        inset-inline-end: 0;
        width: min(28rem, 100%);
        transform: translateX(100%);
        background: #f8fafc;
        color: #0f172a;
        box-shadow: -24px 0 60px rgba(15, 23, 42, 0.32);
        transition: transform 200ms ease;
        z-index: 50;
        display: flex;
        flex-direction: column;
    }

    .krt-layoutDrawer__section {
        padding: var(--krt-space-xl, 1.25rem);
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-lg, 1rem);
        height: 100%;
    }

    .krt-layoutDrawer__header h3 {
        margin: 0;
        font-size: 1.15rem;
        font-weight: 700;
        letter-spacing: 0.02em;
    }

    .krt-layoutDrawer__header p {
        margin: 0.25rem 0 0;
        font-size: 0.85rem;
        color: rgba(15, 23, 42, 0.66);
    }

    .krt-layoutDrawer__grid {
        display: grid;
        gap: var(--krt-space-sm, 0.5rem);
    }

    .krt-layoutDrawer__option {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-xs, 0.25rem);
        border-radius: var(--krt-radius-lg, 0.75rem);
        border: 1px solid rgba(15, 23, 42, 0.12);
        background: #ffffff;
        padding: var(--krt-space-sm, 0.5rem);
        cursor: pointer;
        text-align: left;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
        transition: transform 150ms ease, box-shadow 150ms ease, border 150ms ease;
    }

    .krt-layoutDrawer__option:hover {
        transform: translateY(-2px);
        box-shadow: 0 16px 36px rgba(15, 23, 42, 0.12);
        border-color: rgba(15, 23, 42, 0.2);
    }

    .krt-layoutDrawer__option:focus-visible {
        outline: 2px solid var(--krt-color-primary, #111827);
        outline-offset: 2px;
    }

    .krt-layoutDrawer__option img {
        width: 100%;
        display: block;
        border-radius: calc(var(--krt-radius-lg, 0.75rem) - 0.25rem);
    }

    .krt-layoutDrawer__option strong {
        font-size: 0.9rem;
        font-weight: 600;
        color: rgba(15, 23, 42, 0.82);
    }

    .krt-layoutDrawer__toggle:checked ~ .krt-layoutDrawer__overlay {
        opacity: 1;
        pointer-events: auto;
    }

    .krt-layoutDrawer__toggle:checked ~ .krt-layoutDrawer__panel {
        transform: translateX(0%);
    }

    .krt-layoutDrawer__overlay,
    .krt-layoutDrawer__panel {
        pointer-events: none;
    }

    .krt-layoutDrawer__toggle:checked ~ .krt-layoutDrawer__overlay,
    .krt-layoutDrawer__toggle:checked ~ .krt-layoutDrawer__panel {
        pointer-events: auto;
    }
</style>