<script lang="ts">
    import type { PluginContext, NavigationExtension } from '../context';
    import { EXT } from '../context';
    import { Plus, Home, ChevronDown, ChevronUp, X, Loader2 } from '@lucide/svelte';

    let { ctx }: { ctx: PluginContext } = $props();

    const pages = $derived(ctx.pages);
    const currentPageId = $derived(ctx.currentPageId);
    const currentPage = $derived(ctx.currentPage);
    const nav = $derived(ctx.ext<NavigationExtension>(EXT.NAVIGATION));

    let localTitle = $state('');
    let localSlug = $state('');
    let localSeoTitle = $state('');
    let localSeoDescription = $state('');
    let settingsExpanded = $state(true);

    // Create page modal state
    let showCreateModal = $state(false);
    let newPageTitle = $state('');
    let newPageSlug = $state('');
    let creating = $state(false);
    let createError = $state<string | null>(null);

    $effect(() => {
        if (currentPage) {
            localTitle = currentPage.title ?? '';
            localSlug = currentPage.slug ?? '';
            localSeoTitle = currentPage.seoTitle ?? '';
            localSeoDescription = currentPage.seoDescription ?? '';
        }
    });

    // Auto-generate slug from title
    $effect(() => {
        if (newPageTitle && !newPageSlug) {
            newPageSlug = generateSlug(newPageTitle);
        }
    });

    function generateSlug(title: string): string {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function openCreateModal() {
        newPageTitle = '';
        newPageSlug = '';
        createError = null;
        showCreateModal = true;
    }

    function closeCreateModal() {
        showCreateModal = false;
        newPageTitle = '';
        newPageSlug = '';
        createError = null;
    }

    async function handleCreatePage() {
        if (!newPageTitle.trim() || !newPageSlug.trim() || creating) return;

        creating = true;
        createError = null;

        try {
            const result = await ctx.createPage({ 
                title: newPageTitle.trim(), 
                slug: newPageSlug.trim() 
            });

            if (result) {
                // Auto-add to header menu
                if (nav) {
                    nav.addPageToMenu('header', { 
                        id: result.id, 
                        name: result.title, 
                        slug: result.slug 
                    });
                }

                // Switch to the new page
                ctx.switchPage(result.id);
                closeCreateModal();
            } else {
                createError = 'Failed to create page. Please try again.';
            }
        } catch (err) {
            console.error('Failed to create page:', err);
            createError = 'Failed to create page. The slug might already exist.';
        } finally {
            creating = false;
        }
    }

    const handleTitleChange = () => ctx.updatePageTitle(localTitle);
    const handleSEOChange = () => ctx.updatePageSEO({ seoTitle: localSeoTitle, seoDescription: localSeoDescription, slug: localSlug });
</script>

<div class="pages-plugin">
    {#if currentPage}
        <div class="pages-plugin__settings">
            <button class="pages-plugin__settingsHeader" onclick={() => settingsExpanded = !settingsExpanded}>
                <h3>Page Settings</h3>
                {#if settingsExpanded}<ChevronUp />{:else}<ChevronDown />{/if}
            </button>
            
            {#if settingsExpanded}
                <div class="pages-plugin__settingsBody">
                    <label>
                        <span>Page Title</span>
                        <input type="text" placeholder="Page title" bind:value={localTitle} onchange={handleTitleChange} />
                    </label>

                    <div class="pages-plugin__divider"></div>
                    <h4>SEO Settings</h4>

                    <label>
                        <span>Meta Title</span>
                        <input type="text" bind:value={localSeoTitle} placeholder="Meta title" onchange={handleSEOChange} />
                    </label>

                    <label>
                        <span>Meta Description</span>
                        <textarea bind:value={localSeoDescription} placeholder="Meta description" rows="3" onchange={handleSEOChange}></textarea>
                    </label>

                    <label>
                        <span>Page Slug</span>
                        <input type="text" bind:value={localSlug} placeholder="page-slug" onchange={handleSEOChange} />
                    </label>
                </div>
            {/if}
        </div>
        <div class="pages-plugin__divider"></div>
    {/if}

    <div class="pages-plugin__header">
        <h3>All Pages</h3>
        <button class="pages-plugin__newButton" onclick={openCreateModal} title="Create new page">
            <Plus /><span>New</span>
        </button>
    </div>

    {#if pages.length > 0}
        <div class="pages-plugin__list">
            {#each pages as page (page.id)}
                <div class="pages-plugin__item" class:is-active={currentPageId === page.id}>
                    <button class="pages-plugin__itemMain" onclick={() => ctx.switchPage(page.id)} title={page.name}>
                        <div class="pages-plugin__itemTitle">
                            <span>{page.name}</span>
                            {#if page.slug === '/' || page.slug === 'home'}<Home />{/if}
                        </div>
                        <span class="pages-plugin__itemSlug">/{page.slug}</span>
                    </button>
                    {#if nav}
                        <div class="pages-plugin__itemActions">
                            <button class="pages-plugin__actionButton" onclick={() => nav.addPageToMenu('header', page)}>+ Header</button>
                            <button class="pages-plugin__actionButton" onclick={() => nav.addPageToMenu('footer', page)}>+ Footer</button>
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    {:else}
        <div class="pages-plugin__empty">
            <p>No pages yet</p>
            <button class="pages-plugin__createButton" onclick={openCreateModal}>
                <Plus />Create First Page
            </button>
        </div>
    {/if}
</div>

<!-- Create Page Modal -->
{#if showCreateModal}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="pages-plugin__modalOverlay" onclick={closeCreateModal}>
        <div class="pages-plugin__modal" onclick={(e) => e.stopPropagation()}>
            <div class="pages-plugin__modalHeader">
                <h3>Create New Page</h3>
                <button class="pages-plugin__modalClose" onclick={closeCreateModal} aria-label="Close">
                    <X />
                </button>
            </div>

            <div class="pages-plugin__modalBody">
                {#if createError}
                    <div class="pages-plugin__error">{createError}</div>
                {/if}

                <label class="pages-plugin__formGroup">
                    <span>Page Title</span>
                    <input
                        type="text"
                        placeholder="About Us"
                        bind:value={newPageTitle}
                        disabled={creating}
                    />
                </label>

                <label class="pages-plugin__formGroup">
                    <span>URL Slug</span>
                    <input
                        type="text"
                        placeholder="about-us"
                        bind:value={newPageSlug}
                        disabled={creating}
                    />
                    <span class="pages-plugin__helper">URL: /{newPageSlug || 'page-slug'}</span>
                </label>
            </div>

            <div class="pages-plugin__modalActions">
                <button 
                    class="pages-plugin__cancelButton" 
                    onclick={closeCreateModal} 
                    disabled={creating}
                >
                    Cancel
                </button>
                <button
                    class="pages-plugin__submitButton"
                    onclick={handleCreatePage}
                    disabled={!newPageTitle.trim() || !newPageSlug.trim() || creating}
                >
                    {#if creating}
                        <Loader2 class="animate-spin" />
                        Creating...
                    {:else}
                        Create Page
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .pages-plugin {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 1rem;
    }

    .pages-plugin__settings {
        display: flex;
        flex-direction: column;
        background: var(--krt-editor-surface, #f8fafc);
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-md, 0.5rem);
        overflow: hidden;
    }

    .pages-plugin__settingsHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem;
        border: none;
        background: transparent;
        cursor: pointer;
        transition: background 0.15s ease;
    }

    .pages-plugin__settingsHeader:hover {
        background: var(--krt-editor-surface-hover, #f1f5f9);
    }

    .pages-plugin__settingsHeader h3 {
        margin: 0;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--krt-editor-text-primary, #0f172a);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .pages-plugin__settingsHeader :global(svg) {
        width: 1rem;
        height: 1rem;
        color: var(--krt-editor-text-secondary, #64748b);
    }

    .pages-plugin__settingsBody {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 0 0.75rem 0.75rem;
    }

    .pages-plugin__settingsBody h4 {
        margin: 0;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--krt-editor-text-secondary, #64748b);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .pages-plugin__settingsBody label {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .pages-plugin__settingsBody label span {
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--krt-editor-text-secondary, #64748b);
    }

    .pages-plugin__settingsBody input,
    .pages-plugin__settingsBody textarea {
        padding: 0.5rem 0.625rem;
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        font-size: 0.8125rem;
        color: var(--krt-editor-text-primary, #0f172a);
        background: var(--krt-editor-bg, #ffffff);
        transition: all 0.2s ease;
    }

    .pages-plugin__settingsBody input:focus,
    .pages-plugin__settingsBody textarea:focus {
        outline: none;
        border-color: var(--krt-editor-accent, #3b82f6);
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .pages-plugin__settingsBody textarea {
        resize: vertical;
        min-height: 60px;
        font-family: inherit;
    }

    .pages-plugin__divider {
        height: 1px;
        background: var(--krt-editor-border, #e2e8f0);
        margin: 0.25rem 0;
    }

    .pages-plugin__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 0.25rem;
    }

    .pages-plugin__header h3 {
        margin: 0;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--krt-editor-text-primary, #0f172a);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .pages-plugin__newButton {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.375rem 0.625rem;
        border: none;
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        background: transparent;
        color: var(--krt-editor-text-secondary, #64748b);
        font-size: 0.8125rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .pages-plugin__newButton:hover {
        background: var(--krt-editor-surface-hover, #f1f5f9);
        color: var(--krt-editor-text-primary, #0f172a);
    }

    .pages-plugin__newButton :global(svg) {
        width: 0.875rem;
        height: 0.875rem;
    }

    .pages-plugin__list {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
    }

    .pages-plugin__item {
        border-radius: var(--krt-editor-radius-md, 0.5rem);
        background: transparent;
        transition: background 0.15s ease;
    }

    .pages-plugin__item:hover {
        background: var(--krt-editor-surface, #f8fafc);
    }

    .pages-plugin__item.is-active {
        background: rgba(59, 130, 246, 0.08);
    }

    .pages-plugin__item.is-active .pages-plugin__itemMain {
        color: var(--krt-editor-accent, #3b82f6);
    }

    .pages-plugin__itemMain {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
        width: 100%;
        padding: 0.625rem 0.75rem;
        border: none;
        background: transparent;
        text-align: left;
        cursor: pointer;
        color: var(--krt-editor-text-primary, #0f172a);
        font-family: inherit;
    }

    .pages-plugin__itemTitle {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        font-size: 0.875rem;
        font-weight: 500;
    }

    .pages-plugin__itemTitle :global(svg) {
        width: 0.75rem;
        height: 0.75rem;
        color: var(--krt-editor-text-muted, #94a3b8);
    }

    .pages-plugin__itemSlug {
        font-size: 0.75rem;
        color: var(--krt-editor-text-muted, #94a3b8);
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    .pages-plugin__itemActions {
        display: flex;
        gap: 0.25rem;
        padding: 0 0.75rem 0.625rem;
    }

    .pages-plugin__actionButton {
        padding: 0.25rem 0.5rem;
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        background: var(--krt-editor-bg, #ffffff);
        font-size: 0.6875rem;
        color: var(--krt-editor-text-secondary, #64748b);
        cursor: pointer;
        transition: all 0.15s ease;
        font-family: inherit;
    }

    .pages-plugin__actionButton:hover {
        border-color: var(--krt-editor-accent, #3b82f6);
        background: var(--krt-editor-surface, #f8fafc);
        color: var(--krt-editor-accent, #3b82f6);
    }

    .pages-plugin__empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        padding: 2rem 1rem;
        text-align: center;
    }

    .pages-plugin__empty p {
        margin: 0;
        font-size: 0.875rem;
        color: var(--krt-editor-text-muted, #94a3b8);
    }

    .pages-plugin__createButton {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.625rem 1rem;
        border: none;
        border-radius: var(--krt-editor-radius-md, 0.5rem);
        background: var(--krt-editor-accent, #3b82f6);
        color: #ffffff;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: var(--krt-editor-shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05));
        font-family: inherit;
    }

    .pages-plugin__createButton:hover {
        background: var(--krt-editor-accent-hover, #2563eb);
        transform: translateY(-1px);
        box-shadow: var(--krt-editor-shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1));
    }

    .pages-plugin__createButton:active {
        transform: translateY(0);
    }

    .pages-plugin__createButton :global(svg) {
        width: 1rem;
        height: 1rem;
    }

    /* Modal Styles */
    .pages-plugin__modalOverlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        display: grid;
        place-items: center;
        z-index: 1000;
        padding: 1rem;
    }

    .pages-plugin__modal {
        background: var(--krt-editor-bg, #ffffff);
        border-radius: var(--krt-editor-radius-lg, 0.75rem);
        width: min(400px, 95vw);
        box-shadow: 0 20px 50px rgba(15, 23, 42, 0.2);
        overflow: hidden;
    }

    .pages-plugin__modalHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.25rem;
        border-bottom: 1px solid var(--krt-editor-border, #e2e8f0);
    }

    .pages-plugin__modalHeader h3 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        color: var(--krt-editor-text-primary, #0f172a);
    }

    .pages-plugin__modalClose {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        border: none;
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        background: transparent;
        color: var(--krt-editor-text-secondary, #64748b);
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .pages-plugin__modalClose:hover {
        background: var(--krt-editor-surface, #f8fafc);
        color: var(--krt-editor-text-primary, #0f172a);
    }

    .pages-plugin__modalClose :global(svg) {
        width: 1rem;
        height: 1rem;
    }

    .pages-plugin__modalBody {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 1.25rem;
    }

    .pages-plugin__error {
        padding: 0.75rem 1rem;
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #dc2626;
        font-size: 0.8125rem;
    }

    .pages-plugin__formGroup {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
    }

    .pages-plugin__formGroup span:first-child {
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--krt-editor-text-primary, #0f172a);
    }

    .pages-plugin__formGroup input {
        padding: 0.625rem 0.75rem;
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        font-size: 0.875rem;
        color: var(--krt-editor-text-primary, #0f172a);
        background: var(--krt-editor-bg, #ffffff);
        transition: all 0.2s ease;
    }

    .pages-plugin__formGroup input:focus {
        outline: none;
        border-color: var(--krt-editor-accent, #3b82f6);
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
    }

    .pages-plugin__formGroup input:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .pages-plugin__helper {
        font-size: 0.75rem;
        color: var(--krt-editor-text-muted, #94a3b8);
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    .pages-plugin__modalActions {
        display: flex;
        justify-content: flex-end;
        gap: 0.625rem;
        padding: 1rem 1.25rem;
        border-top: 1px solid var(--krt-editor-border, #e2e8f0);
        background: var(--krt-editor-surface, #f8fafc);
    }

    .pages-plugin__cancelButton {
        padding: 0.5rem 1rem;
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        background: var(--krt-editor-bg, #ffffff);
        color: var(--krt-editor-text-secondary, #64748b);
        font-size: 0.8125rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        font-family: inherit;
    }

    .pages-plugin__cancelButton:hover:not(:disabled) {
        background: var(--krt-editor-surface-hover, #f1f5f9);
    }

    .pages-plugin__cancelButton:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .pages-plugin__submitButton {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.5rem 1rem;
        border: none;
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        background: var(--krt-editor-accent, #3b82f6);
        color: #ffffff;
        font-size: 0.8125rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        font-family: inherit;
    }

    .pages-plugin__submitButton:hover:not(:disabled) {
        background: var(--krt-editor-accent-hover, #2563eb);
    }

    .pages-plugin__submitButton:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .pages-plugin__submitButton :global(svg) {
        width: 0.875rem;
        height: 0.875rem;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    .pages-plugin__submitButton :global(.animate-spin) {
        animation: spin 1s linear infinite;
    }
</style>
