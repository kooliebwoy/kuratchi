<script lang="ts">
    import { Button, Loading, Card, FormField } from '@kuratchi/ui';
    import { getMenuById, updateMenu, getMenuSites, getSitePages } from '$lib/functions/navigation.remote';
    import { ArrowLeft, Plus, Trash2, GripVertical, ChevronDown, ChevronRight, ExternalLink, Save, X, Link, Globe } from '@lucide/svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { onMount } from 'svelte';

    interface NavigationItem {
        id: string;
        label: string;
        url: string;
        target?: '_self' | '_blank';
        icon?: string;
        children?: NavigationItem[];
        expanded?: boolean;
        linkType?: 'internal' | 'external';
    }

    interface SitePage {
        id: string;
        title: string;
        slug: string;
        url: string;
        pageType: string;
        isSpecialPage: boolean;
    }

    interface AttachedSite {
        id: string;
        name: string;
        subdomain: string;
        region: string;
    }

    interface Menu {
        id: string;
        name: string;
        description: string | null;
        items: NavigationItem[];
        status: boolean;
    }

    // State
    let menu = $state<Menu | null>(null);
    let loading = $state(true);
    let saving = $state(false);
    let error = $state<string | null>(null);
    let successMessage = $state<string | null>(null);
    let hasChanges = $state(false);

    // Edit state
    let editingItem = $state<NavigationItem | null>(null);
    let editLabel = $state('');
    let editUrl = $state('');
    let editTarget = $state<'_self' | '_blank'>('_self');
    let editLinkType = $state<'internal' | 'external'>('external');

    // Site pages for internal linking
    let attachedSites = $state<AttachedSite[]>([]);
    let selectedSiteId = $state<string | null>(null);
    let sitePages = $state<SitePage[]>([]);
    let loadingPages = $state(false);

    // Get menuId reactively from page params
    const menuId = $derived($page.params.id);

    onMount(() => {
        loadMenu();
        loadAttachedSites();
    });

    async function loadAttachedSites() {
        try {
            const sites = await getMenuSites();
            attachedSites = sites || [];
            // Auto-select first site if available
            if (attachedSites.length > 0 && !selectedSiteId) {
                selectedSiteId = attachedSites[0].id;
                await loadSitePages(selectedSiteId);
            }
        } catch (err) {
            console.error('Failed to load attached sites:', err);
        }
    }

    async function loadSitePages(siteId: string) {
        if (!siteId) return;
        loadingPages = true;
        try {
            const pages = await getSitePages({ siteId });
            sitePages = pages || [];
        } catch (err) {
            console.error('Failed to load site pages:', err);
            sitePages = [];
        } finally {
            loadingPages = false;
        }
    }

    async function handleSiteChange(e: Event) {
        const target = e.target as HTMLSelectElement;
        selectedSiteId = target.value;
        if (selectedSiteId) {
            await loadSitePages(selectedSiteId);
        }
    }

    function handlePageSelect(e: Event) {
        const target = e.target as HTMLSelectElement;
        const page = sitePages.find(p => p.url === target.value);
        if (page) {
            editUrl = page.url;
            if (!editLabel || editLabel === 'New Link') {
                editLabel = page.title;
            }
        }
    }

    async function loadMenu() {
        const id = $page.params.id;
        if (!id) {
            error = 'Menu ID is required';
            loading = false;
            return;
        }
        
        loading = true;
        error = null;
        try {
            const result = await getMenuById({ id });
            menu = result;
        } catch (err: any) {
            console.error('Failed to load menu:', err);
            error = err?.body?.message || err?.message || 'Failed to load menu';
        } finally {
            loading = false;
        }
    }

    async function saveMenu() {
        if (!menu) return;

        saving = true;
        error = null;
        try {
            // Clean up expanded property before saving
            const cleanItems = JSON.parse(JSON.stringify(menu.items));
            cleanItemsForSave(cleanItems);

            await updateMenu({
                id: menu.id,
                name: menu.name,
                description: menu.description || undefined,
                items: cleanItems
            });

            successMessage = 'Menu saved successfully!';
            setTimeout(() => successMessage = null, 3000);
            hasChanges = false;
        } catch (err: any) {
            console.error('Failed to save menu:', err);
            error = err?.body?.message || err?.message || 'Failed to save menu';
        } finally {
            saving = false;
        }
    }

    function cleanItemsForSave(items: NavigationItem[]) {
        for (const item of items) {
            delete item.expanded;
            if (item.children) {
                cleanItemsForSave(item.children);
            }
        }
    }

    function addItem(parentItems?: NavigationItem[]) {
        const newItem: NavigationItem = {
            id: crypto.randomUUID(),
            label: 'New Link',
            url: '/',
            target: '_self'
        };

        if (parentItems) {
            parentItems.push(newItem);
        } else if (menu) {
            menu.items = [...menu.items, newItem];
        }

        hasChanges = true;
        startEditing(newItem);
    }

    function removeItem(items: NavigationItem[], itemId: string): boolean {
        const index = items.findIndex(i => i.id === itemId);
        if (index !== -1) {
            items.splice(index, 1);
            hasChanges = true;
            return true;
        }
        
        for (const item of items) {
            if (item.children && removeItem(item.children, itemId)) {
                return true;
            }
        }
        return false;
    }

    function handleRemoveItem(itemId: string) {
        if (!menu) return;
        removeItem(menu.items, itemId);
        menu.items = [...menu.items]; // Trigger reactivity
        if (editingItem?.id === itemId) {
            editingItem = null;
        }
    }

    function startEditing(item: NavigationItem) {
        editingItem = item;
        editLabel = item.label;
        editUrl = item.url;
        editTarget = item.target || '_self';
        // Detect link type based on URL
        editLinkType = item.linkType || (item.url.startsWith('http') ? 'external' : 'internal');
    }

    function saveItemEdit() {
        if (!editingItem) return;

        editingItem.label = editLabel;
        editingItem.url = editUrl;
        editingItem.target = editTarget;
        editingItem.linkType = editLinkType;
        
        hasChanges = true;
        editingItem = null;
        
        if (menu) {
            menu.items = [...menu.items]; // Trigger reactivity
        }
    }

    function cancelEdit() {
        editingItem = null;
    }

    function toggleExpand(item: NavigationItem) {
        item.expanded = !item.expanded;
        if (menu) {
            menu.items = [...menu.items]; // Trigger reactivity
        }
    }

    function addSubItem(item: NavigationItem) {
        if (!item.children) {
            item.children = [];
        }
        item.expanded = true;
        addItem(item.children);
        if (menu) {
            menu.items = [...menu.items]; // Trigger reactivity
        }
    }

    function moveItem(items: NavigationItem[], index: number, direction: 'up' | 'down') {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= items.length) return;
        
        [items[index], items[newIndex]] = [items[newIndex], items[index]];
        hasChanges = true;
        
        if (menu) {
            menu.items = [...menu.items]; // Trigger reactivity
        }
    }
</script>

<svelte:head>
    <title>{menu?.name || 'Edit Menu'} | Navigation | Kuratchi</title>
</svelte:head>

<div class="page">
    <header class="page__header">
        <div class="page__headerLeft">
            <Button variant="ghost" size="sm" onclick={() => goto('/menus')}>
                <ArrowLeft size={16} />
                Back
            </Button>
            {#if menu}
                <div class="page__titleGroup">
                    <input
                        type="text"
                        bind:value={menu.name}
                        class="page__titleInput"
                        oninput={() => hasChanges = true}
                    />
                </div>
            {/if}
        </div>
        <div class="page__headerRight">
            {#if hasChanges}
                <span class="unsaved-badge">Unsaved changes</span>
            {/if}
            <Button variant="primary" onclick={saveMenu} disabled={saving || !hasChanges}>
                <Save size={16} />
                {saving ? 'Saving...' : 'Save Menu'}
            </Button>
        </div>
    </header>

    {#if error}
        <div class="alert alert--error">
            <span>{error}</span>
            <button class="alert__close" onclick={() => error = null}>
                <X size={16} />
            </button>
        </div>
    {/if}

    {#if successMessage}
        <div class="alert alert--success">
            <span>{successMessage}</span>
        </div>
    {/if}

    {#if loading}
        <div class="loading-state">
            <Loading />
            <p>Loading menu...</p>
        </div>
    {:else if !menu}
        <div class="empty-state">
            <p>Menu not found</p>
            <Button variant="ghost" onclick={() => goto('/navigation')}>
                Go back to menus
            </Button>
        </div>
    {:else}
        <div class="editor-layout">
            <!-- Menu Items List -->
            <div class="menu-editor">
                <div class="menu-editor__header">
                    <h2>Menu Items</h2>
                    <Button variant="ghost" size="sm" onclick={() => addItem()}>
                        <Plus size={14} />
                        Add Item
                    </Button>
                </div>

                {#if menu.items.length === 0}
                    <div class="menu-editor__empty">
                        <p>No menu items yet</p>
                        <Button variant="primary" size="sm" onclick={() => addItem()}>
                            <Plus size={14} />
                            Add First Item
                        </Button>
                    </div>
                {:else}
                    <div class="menu-items">
                        {#each menu.items as item, index (item.id)}
                            <div class="menu-item" class:is-editing={editingItem?.id === item.id}>
                                <div class="menu-item__row">
                                    <div class="menu-item__drag">
                                        <button 
                                            class="icon-button" 
                                            onclick={() => moveItem(menu.items, index, 'up')}
                                            disabled={index === 0}
                                        >↑</button>
                                        <button 
                                            class="icon-button" 
                                            onclick={() => moveItem(menu.items, index, 'down')}
                                            disabled={index === menu.items.length - 1}
                                        >↓</button>
                                    </div>
                                    
                                    {#if item.children && item.children.length > 0}
                                        <button class="menu-item__expand" onclick={() => toggleExpand(item)}>
                                            {#if item.expanded}
                                                <ChevronDown size={16} />
                                            {:else}
                                                <ChevronRight size={16} />
                                            {/if}
                                        </button>
                                    {:else}
                                        <div class="menu-item__expand-placeholder"></div>
                                    {/if}
                                    
                                    <div class="menu-item__content" onclick={() => startEditing(item)}>
                                        <span class="menu-item__label">{item.label}</span>
                                        <span class="menu-item__url">{item.url}</span>
                                        {#if item.target === '_blank'}
                                            <ExternalLink size={12} />
                                        {/if}
                                    </div>
                                    
                                    <div class="menu-item__actions">
                                        <button class="icon-button" onclick={() => addSubItem(item)} title="Add sub-item">
                                            <Plus size={14} />
                                        </button>
                                        <button class="icon-button icon-button--danger" onclick={() => handleRemoveItem(item.id)} title="Remove">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>

                                {#if item.children && item.children.length > 0 && item.expanded}
                                    <div class="menu-item__children">
                                        {#each item.children as child, childIndex (child.id)}
                                            <div class="menu-item menu-item--child" class:is-editing={editingItem?.id === child.id}>
                                                <div class="menu-item__row">
                                                    <div class="menu-item__drag">
                                                        <button 
                                                            class="icon-button" 
                                                            onclick={() => moveItem(item.children!, childIndex, 'up')}
                                                            disabled={childIndex === 0}
                                                        >↑</button>
                                                        <button 
                                                            class="icon-button" 
                                                            onclick={() => moveItem(item.children!, childIndex, 'down')}
                                                            disabled={childIndex === item.children!.length - 1}
                                                        >↓</button>
                                                    </div>
                                                    
                                                    <div class="menu-item__expand-placeholder"></div>
                                                    
                                                    <div class="menu-item__content" onclick={() => startEditing(child)}>
                                                        <span class="menu-item__label">{child.label}</span>
                                                        <span class="menu-item__url">{child.url}</span>
                                                        {#if child.target === '_blank'}
                                                            <ExternalLink size={12} />
                                                        {/if}
                                                    </div>
                                                    
                                                    <div class="menu-item__actions">
                                                        <button class="icon-button icon-button--danger" onclick={() => handleRemoveItem(child.id)} title="Remove">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Item Editor Panel -->
            <div class="item-editor">
                {#if editingItem}
                    <div class="item-editor__header">
                        <h3>Edit Item</h3>
                        <button class="icon-button" onclick={cancelEdit}>
                            <X size={16} />
                        </button>
                    </div>
                    <div class="item-editor__form">
                        <FormField label="Label">
                            <input
                                type="text"
                                bind:value={editLabel}
                                class="input"
                                placeholder="Link text"
                            />
                        </FormField>

                        <!-- Link Type Selector -->
                        <FormField label="Link Type">
                            <div class="link-type-selector">
                                <button 
                                    type="button"
                                    class="link-type-btn" 
                                    class:active={editLinkType === 'internal'}
                                    onclick={() => editLinkType = 'internal'}
                                >
                                    <Link size={14} />
                                    Internal Page
                                </button>
                                <button 
                                    type="button"
                                    class="link-type-btn" 
                                    class:active={editLinkType === 'external'}
                                    onclick={() => editLinkType = 'external'}
                                >
                                    <Globe size={14} />
                                    External URL
                                </button>
                            </div>
                        </FormField>

                        {#if editLinkType === 'internal'}
                            <!-- Internal Page Selector -->
                            {#if attachedSites.length === 0}
                                <div class="no-sites-warning">
                                    <p>No sites attached to this menu.</p>
                                    <p class="hint">Attach this menu to a site to select internal pages.</p>
                                </div>
                            {:else}
                                {#if attachedSites.length > 1}
                                    <FormField label="Site">
                                        <select 
                                            class="select" 
                                            value={selectedSiteId} 
                                            onchange={handleSiteChange}
                                        >
                                            {#each attachedSites as site}
                                                <option value={site.id}>{site.name}</option>
                                            {/each}
                                        </select>
                                    </FormField>
                                {/if}
                                <FormField label="Page">
                                    {#if loadingPages}
                                        <div class="loading-pages">Loading pages...</div>
                                    {:else if sitePages.length === 0}
                                        <div class="no-pages">No pages found</div>
                                    {:else}
                                        <select 
                                            class="select" 
                                            value={editUrl}
                                            onchange={handlePageSelect}
                                        >
                                            <option value="">Select a page...</option>
                                            {#each sitePages as sitePage}
                                                <option value={sitePage.url}>
                                                    {sitePage.title} ({sitePage.url})
                                                </option>
                                            {/each}
                                        </select>
                                    {/if}
                                </FormField>
                            {/if}
                        {:else}
                            <!-- External URL Input -->
                            <FormField label="URL">
                                <input
                                    type="text"
                                    bind:value={editUrl}
                                    class="input"
                                    placeholder="https://example.com"
                                />
                            </FormField>
                        {/if}

                        <FormField label="Open in">
                            <select bind:value={editTarget} class="select">
                                <option value="_self">Same window</option>
                                <option value="_blank">New window</option>
                            </select>
                        </FormField>
                        <div class="item-editor__actions">
                            <Button variant="ghost" onclick={cancelEdit}>Cancel</Button>
                            <Button variant="primary" onclick={saveItemEdit}>Apply</Button>
                        </div>
                    </div>
                {:else}
                    <div class="item-editor__empty">
                        <p>Select an item to edit</p>
                        <p class="hint">Click on any menu item to edit its properties</p>
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    .page {
        padding: 1.5rem 2rem;
        max-width: 1400px;
        margin: 0 auto;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
    }

    .page__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        gap: 1rem;
    }

    .page__headerLeft {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .page__headerRight {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .page__titleInput {
        font-size: 1.5rem;
        font-weight: 600;
        color: var(--color-text-primary, #0f172a);
        border: none;
        background: transparent;
        padding: 0.25rem 0.5rem;
        margin: -0.25rem -0.5rem;
        border-radius: 0.375rem;
    }

    .page__titleInput:hover {
        background: var(--color-surface, #f8fafc);
    }

    .page__titleInput:focus {
        outline: none;
        background: var(--color-surface, #f8fafc);
        box-shadow: 0 0 0 2px var(--color-primary, #3b82f6);
    }

    .unsaved-badge {
        font-size: 0.75rem;
        color: #f59e0b;
        background: #fef3c7;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
    }

    .alert {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        border-radius: 0.5rem;
        margin-bottom: 1rem;
    }

    .alert--error {
        background: #fef2f2;
        color: #dc2626;
        border: 1px solid #fecaca;
    }

    .alert--success {
        background: #f0fdf4;
        color: #16a34a;
        border: 1px solid #bbf7d0;
    }

    .alert__close {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.25rem;
        color: inherit;
        opacity: 0.7;
    }

    .loading-state,
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4rem 2rem;
        text-align: center;
        color: var(--color-text-secondary, #64748b);
    }

    .editor-layout {
        display: grid;
        grid-template-columns: 1fr 320px;
        gap: 1.5rem;
        flex: 1;
    }

    .menu-editor {
        background: white;
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: 0.75rem;
        overflow: hidden;
    }

    .menu-editor__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.25rem;
        border-bottom: 1px solid var(--color-border, #e2e8f0);
        background: var(--color-surface, #f8fafc);
    }

    .menu-editor__header h2 {
        font-size: 0.9375rem;
        font-weight: 600;
        margin: 0;
    }

    .menu-editor__empty {
        padding: 3rem 2rem;
        text-align: center;
        color: var(--color-text-secondary, #64748b);
    }

    .menu-editor__empty p {
        margin: 0 0 1rem;
    }

    .menu-items {
        padding: 0.75rem;
    }

    .menu-item {
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: 0.5rem;
        margin-bottom: 0.5rem;
        background: white;
        transition: border-color 0.15s ease;
    }

    .menu-item:last-child {
        margin-bottom: 0;
    }

    .menu-item.is-editing {
        border-color: var(--color-primary, #3b82f6);
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
    }

    .menu-item--child {
        margin-left: 0;
    }

    .menu-item__row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.625rem 0.75rem;
    }

    .menu-item__drag {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .menu-item__expand,
    .menu-item__expand-placeholder {
        width: 1.5rem;
        height: 1.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .menu-item__expand {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--color-text-secondary, #64748b);
        border-radius: 0.25rem;
    }

    .menu-item__expand:hover {
        background: var(--color-surface, #f8fafc);
    }

    .menu-item__content {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        cursor: pointer;
        padding: 0.25rem 0.5rem;
        margin: -0.25rem;
        border-radius: 0.25rem;
    }

    .menu-item__content:hover {
        background: var(--color-surface, #f8fafc);
    }

    .menu-item__label {
        font-weight: 500;
        color: var(--color-text-primary, #0f172a);
    }

    .menu-item__url {
        font-size: 0.8125rem;
        color: var(--color-text-secondary, #64748b);
    }

    .menu-item__actions {
        display: flex;
        gap: 0.25rem;
        opacity: 0;
        transition: opacity 0.15s ease;
    }

    .menu-item:hover .menu-item__actions {
        opacity: 1;
    }

    .menu-item__children {
        padding: 0.5rem 0.75rem 0.75rem 2.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .icon-button {
        width: 1.75rem;
        height: 1.75rem;
        display: flex;
        align-items: center;
        justify-content: center;
        background: none;
        border: 1px solid transparent;
        border-radius: 0.375rem;
        cursor: pointer;
        color: var(--color-text-secondary, #64748b);
        font-size: 0.75rem;
    }

    .icon-button:hover:not(:disabled) {
        background: var(--color-surface, #f8fafc);
        border-color: var(--color-border, #e2e8f0);
        color: var(--color-text-primary, #0f172a);
    }

    .icon-button:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    .icon-button--danger:hover:not(:disabled) {
        background: #fef2f2;
        border-color: #fecaca;
        color: #dc2626;
    }

    /* Item Editor Panel */
    .item-editor {
        background: white;
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: 0.75rem;
        overflow: hidden;
        height: fit-content;
        position: sticky;
        top: 1.5rem;
    }

    .item-editor__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.25rem;
        border-bottom: 1px solid var(--color-border, #e2e8f0);
        background: var(--color-surface, #f8fafc);
    }

    .item-editor__header h3 {
        font-size: 0.9375rem;
        font-weight: 600;
        margin: 0;
    }

    .item-editor__form {
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .item-editor__actions {
        display: flex;
        gap: 0.75rem;
        justify-content: flex-end;
        padding-top: 0.5rem;
    }

    .item-editor__empty {
        padding: 2rem 1.25rem;
        text-align: center;
        color: var(--color-text-secondary, #64748b);
    }

    .item-editor__empty p {
        margin: 0;
    }

    .item-editor__empty .hint {
        font-size: 0.8125rem;
        margin-top: 0.5rem;
        opacity: 0.8;
    }

    .input,
    .select {
        width: 100%;
        padding: 0.625rem 0.875rem;
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: 0.5rem;
        font-size: 0.875rem;
        background: white;
    }

    .input:focus,
    .select:focus {
        outline: none;
        border-color: var(--color-primary, #3b82f6);
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
    }

    /* Link Type Selector */
    .link-type-selector {
        display: flex;
        gap: 0.5rem;
    }

    .link-type-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.625rem 0.875rem;
        border: 1px solid var(--color-border, #e2e8f0);
        border-radius: 0.5rem;
        background: white;
        color: var(--color-text-secondary, #64748b);
        font-size: 0.8125rem;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .link-type-btn:hover {
        border-color: var(--color-primary, #3b82f6);
        color: var(--color-primary, #3b82f6);
    }

    .link-type-btn.active {
        background: var(--color-primary, #3b82f6);
        border-color: var(--color-primary, #3b82f6);
        color: white;
    }

    .no-sites-warning,
    .no-pages,
    .loading-pages {
        padding: 1rem;
        text-align: center;
        color: var(--color-text-secondary, #64748b);
        background: var(--color-surface, #f8fafc);
        border-radius: 0.5rem;
        font-size: 0.8125rem;
    }

    .no-sites-warning p {
        margin: 0;
    }

    .no-sites-warning .hint {
        margin-top: 0.25rem;
        opacity: 0.8;
    }

    @media (max-width: 900px) {
        .editor-layout {
            grid-template-columns: 1fr;
        }

        .item-editor {
            position: static;
        }
    }
</style>
