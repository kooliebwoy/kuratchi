<script lang="ts">
    import { enhance } from '$app/forms';
    import { Plus, Check, GripVertical, Pencil, CornerDownRight, Trash2 } from '@lucide/svelte';
    import Sortable from 'sortablejs';
    import { onMount, onDestroy } from 'svelte';
    import type { SubmitFunction } from '@sveltejs/kit';

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

    let menuList: HTMLElement;
    let formLoading = $state(false);
    let editingItem: any = $state(null) as any | null; // { kind: 'item' | 'sub', id: string, parentId?: string }
    let addingSubmenuTo: any = $state(null) as any | null;
    let showPageSelector = $state(false);
    let activeTab = $state('pages');
    let sortableInstance: Sortable | null = null;

    onMount(() => {
        if (menuList) {
            sortableInstance = new Sortable(menuList, {
                animation: 150,
                handle: '.drag-handle',
                ghostClass: ['opacity-50', 'bg-primary/10'],
                group: 'menu-items',
                draggable: '.menu-item',
                onEnd: (evt) => {
                    const newIndex = evt.newIndex;
                    const oldIndex = evt.oldIndex;
                    if (newIndex == null || oldIndex == null) return;
                    const item = menuItems[oldIndex];
                    if (!item) return;
                    menuItems.splice(oldIndex, 1);
                    menuItems.splice(newIndex, 0, item);
                    menuItems = [...menuItems]; // Trigger reactivity
                }
            });
        }

        return () => {
            sortableInstance?.destroy();
            sortableInstance = null;
        };
    });

    onDestroy(() => {
        sortableInstance?.destroy();
        sortableInstance = null;
    });

    const submitHandler: SubmitFunction = () => {
        formLoading = true;
        return async ({ update }) => {
            formLoading = false;
            await update();
        }
    }

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
</script>

<div class="flex items-center justify-between gap-2 mb-2">
    <button type="button" class="btn btn-xs btn-ghost gap-1" onclick={() => showPageSelector = true}>
        <Plus class="w-3 h-3" />
        <span class="text-xs">Add</span>
    </button>
    {#if onSave}
        <button type="button" class="btn btn-xs btn-primary gap-1" disabled={formLoading} onclick={() => onSave({ location: menuLocation, items: menuItems })}>
            <Check class="w-3 h-3" />
            <span class="text-xs">Save</span>
        </button>
    {:else}
        <form method="POST" action="?/updateSiteMenu" use:enhance={submitHandler} class="contents">
            <input type="hidden" name="menuLocation" value={menuLocation} />
            <input type="hidden" name="menuData" value={JSON.stringify(menuItems)} />
            <button type="submit" class="btn btn-xs btn-primary gap-1" disabled={formLoading}>
                {#if formLoading}
                    <span class="loading loading-spinner loading-xs"></span>
                {:else}
                    <Check class="w-3 h-3" />
                {/if}
                <span class="text-xs">Save</span>
            </button>
        </form>
    {/if}
</div>

<!-- Menu Items -->
<div class="space-y-1">
    <ul bind:this={menuList} class="space-y-1">
        {#each menuItems as item, i (item.id || item.slug || item.label || i)}
            <li class="menu-item rounded-lg border border-base-300 bg-base-100 hover:bg-base-100/80 transition-colors overflow-hidden">
                <div class="p-2">
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-1.5 flex-1 min-w-0">
                            <button type="button" class="drag-handle btn btn-xs btn-ghost btn-square touch-none flex-shrink-0">
                                <GripVertical class="w-3 h-3" />
                            </button>
                            {#if editingItem?.kind === 'item' && editingItem?.id === item.id}
                                <input 
                                    class="input input-xs input-bordered flex-1 min-w-0"
                                    value={item.label}
                                    onkeydown={(e) => e.key === 'Escape' ? stopEditing() : (e.key === 'Enter' ? (updateMenuItem(item, { label: (e.currentTarget as HTMLInputElement).value })) : null)}
                                    onblur={(e) => updateMenuItem(item, { label: (e.currentTarget as HTMLInputElement).value })}
                                />
                                <input 
                                    class="input input-xs input-bordered flex-1 min-w-0"
                                    value={item.slug}
                                    onkeydown={(e) => e.key === 'Escape' ? stopEditing() : (e.key === 'Enter' ? (updateMenuItem(item, { slug: (e.currentTarget as HTMLInputElement).value })) : null)}
                                    onblur={(e) => updateMenuItem(item, { slug: (e.currentTarget as HTMLInputElement).value })}
                                />
                            {:else}
                                <div class="flex-1 min-w-0">
                                    <div class="text-sm font-medium truncate">{item.label}</div>
                                    <div class="text-xs text-base-content/50 truncate">{item.slug}</div>
                                </div>
                            {/if}
                        </div>
                        <div class="flex gap-0.5 flex-shrink-0">
                            <button type="button" class="btn btn-xs btn-ghost btn-square" onclick={() => startEditItem(item)} title="Edit">
                                <Pencil class="w-3 h-3" />
                            </button>
                            <button type="button" class="btn btn-xs btn-ghost btn-square" onclick={() => addingSubmenuTo = item} title="Add submenu">
                                <CornerDownRight class="w-3 h-3" />
                            </button>
                            <button type="button" class="btn btn-xs btn-ghost btn-square text-error" onclick={() => removeMenuItem(item.id)} title="Delete">
                                <Trash2 class="w-3 h-3" />
                            </button>
                        </div>
                    </div>

                    {#if item.items?.length > 0}
                        <ul class="mt-1 space-y-0.5 pl-5 border-l border-base-300">
                            {#each item.items as subItem, j (subItem.id || subItem.slug || subItem.label || `${i}-${j}`)}
                                <li class="flex items-center justify-between gap-2 p-1.5 rounded bg-base-200/50 hover:bg-base-200 transition-colors text-xs">
                                    <div class="flex-1 min-w-0">
                                        {#if editingItem?.kind === 'sub' && editingItem?.id === subItem.id}
                                            <input 
                                                class="input input-xs input-bordered w-full mb-1"
                                                value={subItem.label}
                                                onkeydown={(e) => e.key === 'Escape' ? stopEditing() : (e.key === 'Enter' ? (updateSubMenuItem(item.id, subItem, { label: (e.currentTarget as HTMLInputElement).value })) : null)}
                                                onblur={(e) => updateSubMenuItem(item.id, subItem, { label: (e.currentTarget as HTMLInputElement).value })}
                                            />
                                            <input 
                                                class="input input-xs input-bordered w-full"
                                                value={subItem.slug}
                                                onkeydown={(e) => e.key === 'Escape' ? stopEditing() : (e.key === 'Enter' ? (updateSubMenuItem(item.id, subItem, { slug: (e.currentTarget as HTMLInputElement).value })) : null)}
                                                onblur={(e) => updateSubMenuItem(item.id, subItem, { slug: (e.currentTarget as HTMLInputElement).value })}
                                            />
                                        {:else}
                                            <div class="font-medium truncate">{subItem.label}</div>
                                            <div class="text-base-content/50 truncate">{subItem.slug}</div>
                                        {/if}
                                    </div>
                                    <div class="flex gap-0.5 flex-shrink-0">
                                        <button type="button" class="btn btn-xs btn-ghost btn-square" onclick={() => startEditSubItem(item.id, subItem)} title="Edit">
                                            <Pencil class="w-2.5 h-2.5" />
                                        </button>
                                        <button type="button" class="btn btn-xs btn-ghost btn-square text-error" onclick={() => removeSubMenuItem(item.id, subItem.id)} title="Delete">
                                            <Trash2 class="w-2.5 h-2.5" />
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
    <div class="modal modal-open">
        <div class="modal-box max-w-sm">
            <h3 class="font-semibold text-base mb-3">
                {addingSubmenuTo ? `Add to ${addingSubmenuTo.label}` : 'Add Page'}
            </h3>
            
            <div class="tabs tabs-boxed tabs-sm mb-3">
                <button 
                    class="tab {activeTab === 'pages' ? 'tab-active' : ''}" 
                    onclick={() => activeTab = 'pages'}
                >
                    Pages
                </button>
                <button 
                    class="tab {activeTab === 'reserved' ? 'tab-active' : ''}" 
                    onclick={() => activeTab = 'reserved'}
                >
                    Reserved
                </button>
            </div>

            <div class="space-y-1 max-h-72 overflow-y-auto pr-2">
                {#if activeTab === 'pages'}
                    {#each pages as page}
                        <div class="flex justify-between items-center p-2 rounded hover:bg-base-200 transition-colors text-sm">
                            <div class="flex-1 min-w-0">
                                <div class="font-medium truncate">{page.title}</div>
                                <div class="text-xs text-base-content/50 truncate">{page.slug}</div>
                            </div>
                            <button 
                                type="button" 
                                class="btn btn-xs btn-primary ml-2 flex-shrink-0" 
                                onclick={() => addingSubmenuTo ? addSubMenuItem(addingSubmenuTo.id, page) : addMenuItem(page)}
                            >
                                Add
                            </button>
                        </div>
                    {/each}
                {:else}
                    {#each reservedPages as page}
                        <div class="flex justify-between items-center p-2 rounded hover:bg-base-200 transition-colors text-sm">
                            <div class="flex-1 min-w-0">
                                <div class="font-medium truncate">{page.name}</div>
                                <div class="text-xs text-base-content/50 truncate">{page.path}</div>
                            </div>
                            <button 
                                type="button" 
                                class="btn btn-xs btn-primary ml-2 flex-shrink-0" 
                                onclick={() => addingSubmenuTo ? addSubMenuItem(addingSubmenuTo.id, page, true) : addMenuItem(page, true)}
                            >
                                Add
                            </button>
                        </div>
                    {/each}
                {/if}
            </div>

            <div class="modal-action mt-4">
                <button type="button" class="btn btn-sm" onclick={() => { showPageSelector = false; addingSubmenuTo = null; }}>
                    Close
                </button>
            </div>
        </div>
        <div class="modal-backdrop" onclick={() => { showPageSelector = false; addingSubmenuTo = null; }}></div>
    </div>
{/if}