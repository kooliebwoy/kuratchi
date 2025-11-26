<script lang="ts">
    import type { PluginContext } from '../types';
    import { Plus, Home, ExternalLink } from '@lucide/svelte';

    interface Props {
        context: PluginContext;
    }

    let { context }: Props = $props();

    const pages = $derived(context.pages);
    const currentPageId = $derived(context.currentPageId);

    function handlePageClick(pageId: string) {
        context.onPageSwitch?.(pageId);
    }

    function handleCreatePage() {
        context.onCreatePage?.();
    }

    function handleAddToHeader(page: { id: string; name: string; slug: string }) {
        context.addPageToMenu?.('header', page);
    }

    function handleAddToFooter(page: { id: string; name: string; slug: string }) {
        context.addPageToMenu?.('footer', page);
    }
</script>

<div class="pages-plugin">
    <div class="pages-plugin__header">
        <h3>Pages</h3>
        <button
            class="pages-plugin__newButton"
            onclick={handleCreatePage}
            title="Create a new page"
        >
            <Plus />
            <span>New</span>
        </button>
    </div>

    {#if pages && pages.length > 0}
        <div class="pages-plugin__list">
            {#each pages as page (page.id)}
                <div class="pages-plugin__item" class:is-active={currentPageId === page.id}>
                    <button 
                        class="pages-plugin__itemMain"
                        onclick={() => handlePageClick(page.id)} 
                        title={page.name}
                    >
                        <div class="pages-plugin__itemTitle">
                            <span>{page.name}</span>
                            {#if page.slug === '/' || page.slug === 'home'}
                                <Home />
                            {/if}
                        </div>
                        <span class="pages-plugin__itemSlug">/{page.slug}</span>
                    </button>
                    <div class="pages-plugin__itemActions">
                        <button 
                            class="pages-plugin__actionButton"
                            onclick={() => handleAddToHeader(page)}
                            title="Add to header menu"
                        >
                            + Header
                        </button>
                        <button 
                            class="pages-plugin__actionButton"
                            onclick={() => handleAddToFooter(page)}
                            title="Add to footer menu"
                        >
                            + Footer
                        </button>
                    </div>
                </div>
            {/each}
        </div>
    {:else}
        <div class="pages-plugin__empty">
            <p>No pages yet</p>
            <button
                class="pages-plugin__createButton"
                onclick={handleCreatePage}
            >
                <Plus />
                Create First Page
            </button>
        </div>
    {/if}
</div>

<style>
    .pages-plugin {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .pages-plugin__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 4px;
    }

    .pages-plugin__header h3 {
        margin: 0;
        font-size: 13px;
        font-weight: 600;
        color: #374151;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .pages-plugin__newButton {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 6px 10px;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: #6b7280;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .pages-plugin__newButton:hover {
        background: #f3f4f6;
        color: #374151;
    }

    .pages-plugin__newButton :global(svg) {
        width: 14px;
        height: 14px;
    }

    .pages-plugin__list {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .pages-plugin__item {
        border-radius: 8px;
        background: transparent;
        transition: all 0.15s ease;
    }

    .pages-plugin__item:hover {
        background: #f9fafb;
    }

    .pages-plugin__item.is-active {
        background: #eff6ff;
    }

    .pages-plugin__item.is-active .pages-plugin__itemMain {
        color: #2563eb;
    }

    .pages-plugin__itemMain {
        display: flex;
        flex-direction: column;
        gap: 2px;
        width: 100%;
        padding: 10px 12px;
        border: none;
        background: transparent;
        text-align: left;
        cursor: pointer;
        color: #374151;
    }

    .pages-plugin__itemTitle {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
        font-weight: 500;
    }

    .pages-plugin__itemTitle :global(svg) {
        width: 12px;
        height: 12px;
        color: #9ca3af;
    }

    .pages-plugin__itemSlug {
        font-size: 12px;
        color: #9ca3af;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    .pages-plugin__itemActions {
        display: flex;
        gap: 4px;
        padding: 0 12px 10px;
    }

    .pages-plugin__actionButton {
        padding: 4px 8px;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        background: #ffffff;
        font-size: 11px;
        color: #6b7280;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .pages-plugin__actionButton:hover {
        border-color: #d1d5db;
        background: #f9fafb;
        color: #374151;
    }

    .pages-plugin__empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 32px 16px;
        text-align: center;
    }

    .pages-plugin__empty p {
        margin: 0;
        font-size: 14px;
        color: #9ca3af;
    }

    .pages-plugin__createButton {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 10px 16px;
        border: none;
        border-radius: 8px;
        background: #3b82f6;
        color: #ffffff;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .pages-plugin__createButton:hover {
        background: #2563eb;
    }

    .pages-plugin__createButton :global(svg) {
        width: 16px;
        height: 16px;
    }
</style>
