<script lang="ts">
    import { Plus, Check, GripVertical, Pencil, CornerDownRight, Trash2, X } from '@lucide/svelte';

    interface Props {
        menuItems: any[];
        pages: any[];
        reservedPages: any[];
        menuLocation: string;
        onSave?: (args: { location: string; items: any[] }) => void;
    }

    let { 
        menuItems = [],
        pages = [],
        reservedPages = [],
        menuLocation = 'header',
        onSave
    }: Props = $props();

    let formLoading = $state(false);
    let editingItem: any = $state(null) as any | null; // { kind: 'item' | 'sub', id: string, parentId?: string }
    let addingSubmenuTo: any = $state(null) as any | null;
    let showPageSelector = $state(false);
    let activeTab = $state('pages');
    let draggingMenuItemId = $state<string | null>(null);

    function addMenuItem(page: any, isReservedPage: boolean = false) {
        menuItems = [...menuItems, {
            id: crypto.randomUUID(),
            label: isReservedPage ? page.name : page.title,
            slug: isReservedPage ? page.path : page.slug,
            pageId: isReservedPage ? undefined : page.id,
            isReservedPage
        }];
        showPageSelector = false;
    }

    function addSubMenuItem(parentId: string, page: any, isReservedPage: boolean = false) {
        menuItems = menuItems.map(item => {
            if (item.id === parentId) {
                if (!item.items) item.items = [];
                return {
                    ...item,
                    items: [...item.items, {
                        id: crypto.randomUUID(),
                        label: isReservedPage ? page.name : page.title,
                        slug: isReservedPage ? page.path : page.slug,
                        pageId: isReservedPage ? undefined : page.id,
                        isReservedPage
                    }]
                };
            }
            return item;
        });
        addingSubmenuTo = null;
    }

    function removeMenuItem(id: string) {
        menuItems = menuItems.filter(item => item.id !== id);
    }

    function removeSubMenuItem(parentId: string, subItemId: string) {
        menuItems = menuItems.map(item => {
            if (item.id === parentId) {
                return {
                    ...item,
                    items: item.items.filter(subItem => subItem.id !== subItemId)
                };
            }
            return item;
        });
    }

    function updateMenuItem(item: any, updates: any) {
        menuItems = menuItems.map(menuItem => 
            menuItem.id === item.id ? { ...menuItem, ...updates } : menuItem
        );
        editingItem = null;
    }

    function updateSubMenuItem(parentId: string, subItem: any, updates: any) {
        menuItems = menuItems.map(item => {
            if (item.id === parentId) {
                return {
                    ...item,
                    items: item.items.map(sub => 
                        sub.id === subItem.id ? { ...sub, ...updates } : sub
                    )
                };
            }
            return item;
        });
        editingItem = null;
    }

    function startEditItem(item: any) {
        editingItem = { kind: 'item', id: item.id };
    }
    function startEditSubItem(parentId: string, subItem: any) {
        editingItem = { kind: 'sub', id: subItem.id, parentId };
    }
    function stopEditing() {
        editingItem = null;
    }

    const moveMenuItem = (draggedId: string, targetId: string | null, placeBefore = true) => {
        const updated = [...menuItems];
        const draggedIndex = updated.findIndex((item) => item.id === draggedId);
        if (draggedIndex === -1) return;

        const [draggedItem] = updated.splice(draggedIndex, 1);
        let insertIndex = targetId ? updated.findIndex((item) => item.id === targetId) : updated.length;
        if (insertIndex === -1) insertIndex = updated.length;
        if (!placeBefore && targetId) insertIndex += 1;
        updated.splice(insertIndex, 0, draggedItem);
        menuItems = updated;
    };

    function handleMenuDragStart(event: DragEvent, itemId: string) {
        draggingMenuItemId = itemId;
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', itemId);
            const itemElement = (event.currentTarget as HTMLElement).closest('.menu-item');
            if (itemElement) {
                event.dataTransfer.setDragImage(itemElement, itemElement.clientWidth / 2, itemElement.clientHeight / 2);
            }
        }
    }

    function concludeMenuDrag() {
        draggingMenuItemId = null;
    }

    function handleMenuItemDragOver(event: DragEvent) {
        if (!draggingMenuItemId) return;
        event.preventDefault();
    }

    function handleMenuItemDrop(event: DragEvent, targetId: string) {
        if (!draggingMenuItemId || draggingMenuItemId === targetId) return;
        event.preventDefault();
        event.stopPropagation();
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const placeBefore = event.clientY < rect.top + rect.height / 2;
        moveMenuItem(draggingMenuItemId, targetId, placeBefore);
        concludeMenuDrag();
    }

    function handleMenuListDragOver(event: DragEvent) {
        if (!draggingMenuItemId) return;
        event.preventDefault();
    }

    function handleMenuListDrop(event: DragEvent) {
        if (!draggingMenuItemId) return;
        event.preventDefault();
        moveMenuItem(draggingMenuItemId, null);
        concludeMenuDrag();
    }
</script>

<div class="menu-widget">
    <div class="menu-widget__header">
        <button type="button" class="menu-widget__addBtn" onclick={() => showPageSelector = true}>
            <Plus />
            <span>Add</span>
        </button>
        {#if onSave}
            <button type="button" class="menu-widget__saveBtn" disabled={formLoading} onclick={() => onSave({ location: menuLocation, items: menuItems })}>
                <Check />
                <span>Save</span>
            </button>
        {/if}
    </div>

    <!-- Menu Items -->
    <div class="menu-widget__list">
        <ul class="menu-widget__items" ondragover={handleMenuListDragOver} ondrop={handleMenuListDrop}>
            {#each menuItems as item, i (item.id || item.slug || item.label || i)}
                <li 
                    class="menu-widget__item"
                    class:is-dragging={draggingMenuItemId === item.id}
                    ondragover={handleMenuItemDragOver}
                    ondrop={(event) => handleMenuItemDrop(event, item.id)}
                >
                    <div class="menu-widget__itemContent">
                        <div class="menu-widget__itemRow">
                            <div class="menu-widget__itemMain">
                                <button 
                                    type="button" 
                                    class="menu-widget__dragHandle"
                                    draggable="true"
                                    ondragstart={(event) => handleMenuDragStart(event, item.id)}
                                    ondragend={concludeMenuDrag}
                                >
                                    <GripVertical />
                                </button>
                                {#if editingItem?.kind === 'item' && editingItem?.id === item.id}
                                    <input 
                                        class="menu-widget__input"
                                        value={item.label}
                                        onkeydown={(e) => e.key === 'Escape' ? stopEditing() : (e.key === 'Enter' ? (updateMenuItem(item, { label: (e.currentTarget as HTMLInputElement).value })) : null)}
                                        onblur={(e) => updateMenuItem(item, { label: (e.currentTarget as HTMLInputElement).value })}
                                    />
                                    <input 
                                        class="menu-widget__input"
                                        value={item.slug}
                                        onkeydown={(e) => e.key === 'Escape' ? stopEditing() : (e.key === 'Enter' ? (updateMenuItem(item, { slug: (e.currentTarget as HTMLInputElement).value })) : null)}
                                        onblur={(e) => updateMenuItem(item, { slug: (e.currentTarget as HTMLInputElement).value })}
                                    />
                                {:else}
                                    <div class="menu-widget__itemInfo">
                                        <div class="menu-widget__itemLabel">{item.label}</div>
                                        <div class="menu-widget__itemSlug">{item.slug}</div>
                                    </div>
                                {/if}
                            </div>
                            <div class="menu-widget__itemActions">
                                <button type="button" class="menu-widget__iconBtn" onclick={() => startEditItem(item)} title="Edit">
                                    <Pencil />
                                </button>
                                <button type="button" class="menu-widget__iconBtn" onclick={() => addingSubmenuTo = item} title="Add submenu">
                                    <CornerDownRight />
                                </button>
                                <button type="button" class="menu-widget__iconBtn menu-widget__iconBtn--danger" onclick={() => removeMenuItem(item.id)} title="Delete">
                                    <Trash2 />
                                </button>
                            </div>
                        </div>

                        {#if item.items?.length > 0}
                            <ul class="menu-widget__subItems">
                                {#each item.items as subItem, j (subItem.id || subItem.slug || subItem.label || `${i}-${j}`)}
                                    <li class="menu-widget__subItem">
                                        <div class="menu-widget__subItemInfo">
                                            {#if editingItem?.kind === 'sub' && editingItem?.id === subItem.id}
                                                <input 
                                                    class="menu-widget__input menu-widget__input--small"
                                                    value={subItem.label}
                                                    onkeydown={(e) => e.key === 'Escape' ? stopEditing() : (e.key === 'Enter' ? (updateSubMenuItem(item.id, subItem, { label: (e.currentTarget as HTMLInputElement).value })) : null)}
                                                    onblur={(e) => updateSubMenuItem(item.id, subItem, { label: (e.currentTarget as HTMLInputElement).value })}
                                                />
                                                <input 
                                                    class="menu-widget__input menu-widget__input--small"
                                                    value={subItem.slug}
                                                    onkeydown={(e) => e.key === 'Escape' ? stopEditing() : (e.key === 'Enter' ? (updateSubMenuItem(item.id, subItem, { slug: (e.currentTarget as HTMLInputElement).value })) : null)}
                                                    onblur={(e) => updateSubMenuItem(item.id, subItem, { slug: (e.currentTarget as HTMLInputElement).value })}
                                                />
                                            {:else}
                                                <div class="menu-widget__subItemLabel">{subItem.label}</div>
                                                <div class="menu-widget__subItemSlug">{subItem.slug}</div>
                                            {/if}
                                        </div>
                                        <div class="menu-widget__subItemActions">
                                            <button type="button" class="menu-widget__iconBtn menu-widget__iconBtn--small" onclick={() => startEditSubItem(item.id, subItem)} title="Edit">
                                                <Pencil />
                                            </button>
                                            <button type="button" class="menu-widget__iconBtn menu-widget__iconBtn--small menu-widget__iconBtn--danger" onclick={() => removeSubMenuItem(item.id, subItem.id)} title="Delete">
                                                <Trash2 />
                                            </button>
                                        </div>
                                    </li>
                                {/each}
                            </ul>
                        {/if}
                    </div>
                </li>
            {/each}
        </ul>
    </div>

    <!-- Page Selector Modal -->
    {#if showPageSelector || addingSubmenuTo}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="menu-widget__modalBackdrop" onclick={() => { showPageSelector = false; addingSubmenuTo = null; }}>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="menu-widget__modal" onclick={(e) => e.stopPropagation()}>
                <div class="menu-widget__modalHeader">
                    <h3>{addingSubmenuTo ? `Add to ${addingSubmenuTo.label}` : 'Add Page'}</h3>
                    <button class="menu-widget__iconBtn" onclick={() => { showPageSelector = false; addingSubmenuTo = null; }}>
                        <X />
                    </button>
                </div>
                
                <div class="menu-widget__tabs">
                    <button 
                        class="menu-widget__tab"
                        class:is-active={activeTab === 'pages'}
                        onclick={() => activeTab = 'pages'}
                    >
                        Pages
                    </button>
                    <button 
                        class="menu-widget__tab"
                        class:is-active={activeTab === 'reserved'}
                        onclick={() => activeTab = 'reserved'}
                    >
                        Reserved
                    </button>
                </div>

                <div class="menu-widget__pageList">
                    {#if activeTab === 'pages'}
                        {#each pages as page}
                            <div class="menu-widget__pageItem">
                                <div class="menu-widget__pageInfo">
                                    <div class="menu-widget__pageTitle">{page.title}</div>
                                    <div class="menu-widget__pageSlug">{page.slug}</div>
                                </div>
                                <button 
                                    type="button" 
                                    class="menu-widget__addPageBtn" 
                                    onclick={() => addingSubmenuTo ? addSubMenuItem(addingSubmenuTo.id, page) : addMenuItem(page)}
                                >
                                    Add
                                </button>
                            </div>
                        {/each}
                    {:else}
                        {#each reservedPages as page}
                            <div class="menu-widget__pageItem">
                                <div class="menu-widget__pageInfo">
                                    <div class="menu-widget__pageTitle">{page.name}</div>
                                    <div class="menu-widget__pageSlug">{page.path}</div>
                                </div>
                                <button 
                                    type="button" 
                                    class="menu-widget__addPageBtn" 
                                    onclick={() => addingSubmenuTo ? addSubMenuItem(addingSubmenuTo.id, page, true) : addMenuItem(page, true)}
                                >
                                    Add
                                </button>
                            </div>
                        {/each}
                    {/if}
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
    .menu-widget {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .menu-widget__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
    }

    .menu-widget__addBtn,
    .menu-widget__saveBtn {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.375rem 0.625rem;
        font-size: 0.75rem;
        font-weight: 500;
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        cursor: pointer;
        transition: all 0.15s ease;
        font-family: inherit;
    }

    .menu-widget__addBtn {
        background: transparent;
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        color: var(--krt-editor-text-secondary, #64748b);
    }

    .menu-widget__addBtn:hover {
        background: var(--krt-editor-surface-hover, #f1f5f9);
        color: var(--krt-editor-text-primary, #0f172a);
        border-color: var(--krt-editor-accent, #3b82f6);
    }

    .menu-widget__saveBtn {
        background: var(--krt-editor-accent, #3b82f6);
        border: 1px solid var(--krt-editor-accent, #3b82f6);
        color: #ffffff;
    }

    .menu-widget__saveBtn:hover:not(:disabled) {
        background: var(--krt-editor-accent-hover, #2563eb);
        border-color: var(--krt-editor-accent-hover, #2563eb);
    }

    .menu-widget__saveBtn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .menu-widget__addBtn :global(svg),
    .menu-widget__saveBtn :global(svg) {
        width: 0.75rem;
        height: 0.75rem;
    }

    .menu-widget__list {
        display: flex;
        flex-direction: column;
    }

    .menu-widget__items {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .menu-widget__item {
        background: var(--krt-editor-bg, #ffffff);
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-md, 0.5rem);
        overflow: hidden;
        transition: all 0.15s ease;
    }

    .menu-widget__item:hover {
        border-color: var(--krt-editor-accent, #3b82f6);
        box-shadow: var(--krt-editor-shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05));
    }

    .menu-widget__item.is-dragging {
        opacity: 0.5;
    }

    .menu-widget__itemContent {
        padding: 0.5rem;
    }

    .menu-widget__itemRow {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
    }

    .menu-widget__itemMain {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        flex: 1;
        min-width: 0;
    }

    .menu-widget__dragHandle {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.25rem;
        background: transparent;
        border: none;
        color: var(--krt-editor-text-muted, #94a3b8);
        cursor: grab;
        touch-action: none;
        flex-shrink: 0;
    }

    .menu-widget__dragHandle :global(svg) {
        width: 0.75rem;
        height: 0.75rem;
    }

    .menu-widget__input {
        flex: 1;
        min-width: 0;
        padding: 0.375rem 0.5rem;
        font-size: 0.8125rem;
        color: var(--krt-editor-text-primary, #0f172a);
        background: var(--krt-editor-bg, #ffffff);
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        font-family: inherit;
    }

    .menu-widget__input:focus {
        outline: none;
        border-color: var(--krt-editor-accent, #3b82f6);
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
    }

    .menu-widget__input--small {
        padding: 0.25rem 0.375rem;
        font-size: 0.75rem;
    }

    .menu-widget__itemInfo {
        flex: 1;
        min-width: 0;
    }

    .menu-widget__itemLabel {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--krt-editor-text-primary, #0f172a);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .menu-widget__itemSlug {
        font-size: 0.75rem;
        color: var(--krt-editor-text-muted, #94a3b8);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .menu-widget__itemActions {
        display: flex;
        gap: 0.125rem;
        flex-shrink: 0;
    }

    .menu-widget__iconBtn {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.25rem;
        background: transparent;
        border: none;
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        color: var(--krt-editor-text-secondary, #64748b);
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .menu-widget__iconBtn:hover {
        background: var(--krt-editor-surface-hover, #f1f5f9);
        color: var(--krt-editor-text-primary, #0f172a);
    }

    .menu-widget__iconBtn--danger {
        color: #dc2626;
    }

    .menu-widget__iconBtn--danger:hover {
        background: rgba(220, 38, 38, 0.1);
        color: #dc2626;
    }

    .menu-widget__iconBtn :global(svg) {
        width: 0.75rem;
        height: 0.75rem;
    }

    .menu-widget__iconBtn--small :global(svg) {
        width: 0.625rem;
        height: 0.625rem;
    }

    .menu-widget__subItems {
        list-style: none;
        margin: 0.25rem 0 0 0;
        padding: 0 0 0 1.25rem;
        border-left: 1px solid var(--krt-editor-border, #e2e8f0);
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
    }

    .menu-widget__subItem {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        padding: 0.375rem 0.5rem;
        background: var(--krt-editor-surface, #f8fafc);
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        transition: background 0.15s ease;
    }

    .menu-widget__subItem:hover {
        background: var(--krt-editor-surface-hover, #f1f5f9);
    }

    .menu-widget__subItemInfo {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.0625rem;
    }

    .menu-widget__subItemLabel {
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--krt-editor-text-primary, #0f172a);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .menu-widget__subItemSlug {
        font-size: 0.6875rem;
        color: var(--krt-editor-text-muted, #94a3b8);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .menu-widget__subItemActions {
        display: flex;
        gap: 0.0625rem;
        flex-shrink: 0;
    }

    /* Modal Styles */
    .menu-widget__modalBackdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1rem;
    }

    .menu-widget__modal {
        background: var(--krt-editor-bg, #ffffff);
        border-radius: var(--krt-editor-radius-lg, 0.75rem);
        box-shadow: var(--krt-editor-shadow-lg, 0 10px 15px -3px rgb(0 0 0 / 0.1));
        max-width: 24rem;
        width: 100%;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .menu-widget__modalHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1rem 0.75rem;
        border-bottom: 1px solid var(--krt-editor-border, #e2e8f0);
    }

    .menu-widget__modalHeader h3 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        color: var(--krt-editor-text-primary, #0f172a);
    }

    .menu-widget__tabs {
        display: flex;
        gap: 0.25rem;
        padding: 0.75rem 1rem 0;
        background: var(--krt-editor-surface, #f8fafc);
    }

    .menu-widget__tab {
        padding: 0.5rem 1rem;
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--krt-editor-text-secondary, #64748b);
        background: transparent;
        border: none;
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        cursor: pointer;
        transition: all 0.15s ease;
        font-family: inherit;
    }

    .menu-widget__tab:hover {
        background: var(--krt-editor-surface-hover, #f1f5f9);
        color: var(--krt-editor-text-primary, #0f172a);
    }

    .menu-widget__tab.is-active {
        background: var(--krt-editor-bg, #ffffff);
        color: var(--krt-editor-accent, #3b82f6);
        box-shadow: var(--krt-editor-shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05));
    }

    .menu-widget__pageList {
        flex: 1;
        overflow-y: auto;
        padding: 0.75rem 1rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .menu-widget__pageItem {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 0.75rem;
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        transition: background 0.15s ease;
    }

    .menu-widget__pageItem:hover {
        background: var(--krt-editor-surface-hover, #f1f5f9);
    }

    .menu-widget__pageInfo {
        flex: 1;
        min-width: 0;
    }

    .menu-widget__pageTitle {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--krt-editor-text-primary, #0f172a);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .menu-widget__pageSlug {
        font-size: 0.75rem;
        color: var(--krt-editor-text-muted, #94a3b8);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .menu-widget__addPageBtn {
        padding: 0.375rem 0.75rem;
        font-size: 0.75rem;
        font-weight: 500;
        color: #ffffff;
        background: var(--krt-editor-accent, #3b82f6);
        border: none;
        border-radius: var(--krt-editor-radius-sm, 0.375rem);
        cursor: pointer;
        transition: all 0.15s ease;
        flex-shrink: 0;
        font-family: inherit;
    }

    .menu-widget__addPageBtn:hover {
        background: var(--krt-editor-accent-hover, #2563eb);
    }
</style>
