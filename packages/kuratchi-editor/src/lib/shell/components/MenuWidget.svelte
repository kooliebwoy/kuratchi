<script lang="ts">
    import { enhance } from '$app/forms';
    import { Plus, Check, GripVertical, Pencil, CornerDownRight, Trash2 } from '@lucide/svelte';
    import Sortable from 'sortablejs';
    import { onMount } from 'svelte';
    import type { SubmitFunction } from '@sveltejs/kit';

    interface Props {
        menuItems: any[];
        pages: any[];
        reservedPages: any[];
        menuLocation: string;
    }

    let { 
        menuItems = [],
        pages = [],
        reservedPages = [],
        menuLocation = 'header'
    }: Props = $props();

    let menuList: HTMLElement;
    let formLoading = $state(false);
    let editingItem: any = $state(null) as any | null;
    let addingSubmenuTo: any = $state(null) as any | null;
    let showPageSelector = $state(false);
    let activeTab = $state('pages');

    onMount(() => {
        if (menuList) {
            new Sortable(menuList, {
                animation: 150,
                handle: '.drag-handle',
                ghostClass: ['opacity-50', 'bg-primary/10'],
                group: 'menu-items',
                draggable: '.menu-item',
                onEnd: (evt) => {
                    const newIndex = evt.newIndex;
                    const oldIndex = evt.oldIndex;
                    const item = menuItems[oldIndex];
                    menuItems.splice(oldIndex, 1);
                    menuItems.splice(newIndex, 0, item);
                    menuItems = [...menuItems]; // Trigger reactivity
                }
            });
        }
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
</script>

<div class="flex items-center justify-between mb-4">
    <button type="button" class="btn btn-sm btn-ghost gap-2" onclick={() => showPageSelector = true}>
        <Plus />
        Add Page
    </button>
    <form method="POST" action="?/updateSiteMenu" use:enhance={submitHandler} class="contents">
        <input type="hidden" name="menuLocation" value={menuLocation} />
        <input type="hidden" name="menuData" value={JSON.stringify(menuItems)} />
        <button type="submit" class="btn btn-sm btn-success gap-2 min-w-[100px]" disabled={formLoading}>
            {#if formLoading}
                <span class="loading loading-spinner loading-xs"></span>
                Saving...
            {:else}
                <Check />
                Save
            {/if}
        </button>
    </form>
</div>

<!-- Menu Items -->
<div class="space-y-2">
    <ul bind:this={menuList} class="space-y-2">
        {#each menuItems as item (item.id)}
            <li class="menu-item card !bg-base-200 shadow-sm hover:shadow-md transition-shadow">
                {#if editingItem?.id === item.id}
                    <div class="card-body p-4">
                        <div class="space-y-2">
                            <div class="form-control">
                                <label class="label">
                                    <span class="label-text">Display Name</span>
                                </label>
                                <input 
                                    type="text" 
                                    class="input input-sm input-bordered" 
                                    value={item.label}
                                    onchange={(e) => updateMenuItem(item, { label: e.currentTarget.value })}
                                />
                            </div>
                            <div class="form-control">
                                <label class="label">
                                    <span class="label-text">URL Slug</span>
                                </label>
                                <input 
                                    type="text" 
                                    class="input input-sm input-bordered" 
                                    value={item.slug}
                                    onchange={(e) => updateMenuItem(item, { slug: e.currentTarget.value })}
                                />
                            </div>
                            <div class="flex justify-end space-x-2">
                                <button type="button" class="btn btn-sm btn-ghost" onclick={() => editingItem = null}>
                                    Cancel
                                </button>
                                <button type="button" class="btn btn-sm btn-primary" onclick={() => editingItem = null}>
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                {:else}
                    <div class="card-body p-4">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <button type="button" class="drag-handle btn btn-sm btn-ghost btn-square touch-none">
                                    <GripVertical />
                                </button>
                                <span class="font-medium">{item.label}</span>
                                <span class="text-xs opacity-60">{item.slug}</span>
                            </div>
                            <div class="flex space-x-1">
                                <button type="button" class="btn btn-sm btn-ghost btn-square" onclick={() => editingItem = item}>
                                    <Pencil />
                                </button>
                                <button type="button" class="btn btn-sm btn-ghost btn-square" onclick={() => addingSubmenuTo = item}>
                                    <CornerDownRight />
                                </button>
                                <button type="button" class="btn btn-sm btn-ghost btn-square text-error" onclick={() => removeMenuItem(item.id)}>
                                    <Trash2 />
                                </button>
                            </div>
                        </div>

                        {#if item.items?.length > 0}
                            <ul class="pl-8 mt-2 space-y-1 border-l-2 border-primary/20">
                                {#each item.items as subItem (subItem.id)}
                                    <li class="relative">
                                        <div class="absolute -left-[17px] top-1/2 w-3 h-px bg-primary/20"></div>
                                        {#if editingItem?.id === subItem.id}
                                            <div class="bg-base-100 rounded-lg p-2 space-y-2">
                                                <div class="form-control">
                                                    <label class="label">
                                                        <span class="label-text">Display Name</span>
                                                    </label>
                                                    <input 
                                                        type="text" 
                                                        class="input input-sm input-bordered" 
                                                        value={subItem.label}
                                                        onchange={(e) => updateSubMenuItem(item.id, subItem, { label: e.currentTarget.value })}
                                                    />
                                                </div>
                                                <div class="form-control">
                                                    <label class="label">
                                                        <span class="label-text">URL Slug</span>
                                                    </label>
                                                    <input 
                                                        type="text" 
                                                        class="input input-sm input-bordered" 
                                                        value={subItem.slug}
                                                        onchange={(e) => updateSubMenuItem(item.id, subItem, { slug: e.currentTarget.value })}
                                                    />
                                                </div>
                                                <div class="flex justify-end space-x-2">
                                                    <button type="button" class="btn btn-sm btn-ghost" onclick={() => editingItem = null}>
                                                        Cancel
                                                    </button>
                                                    <button type="button" class="btn btn-sm btn-primary" onclick={() => editingItem = null}>
                                                        Done
                                                    </button>
                                                </div>
                                            </div>
                                        {:else}
                                            <div class="flex items-center justify-between bg-base-100 rounded-lg p-2 hover:bg-base-100/80">
                                                <div class="flex items-center gap-2">
                                                    <CornerDownRight class="text-primary/60" />
                                                    <span>{subItem.label}</span>
                                                    <span class="text-xs opacity-60">{subItem.slug}</span>
                                                </div>
                                                <div class="flex space-x-1">
                                                    <button type="button" class="btn btn-xs btn-ghost btn-square" onclick={() => editingItem = subItem}>
                                                        <Pencil />
                                                    </button>
                                                    <button type="button" class="btn btn-xs btn-ghost btn-square text-error" onclick={() => removeSubMenuItem(item.id, subItem.id)}>
                                                        <Trash2 />
                                                    </button>
                                                </div>
                                            </div>
                                        {/if}
                                    </li>
                                {/each}
                            </ul>
                        {/if}
                    </div>
                {/if}
            </li>
        {/each}
    </ul>
</div>

<!-- Page Selector Modal -->
{#if showPageSelector || addingSubmenuTo}
    <div class="modal modal-open">
        <div class="modal-box">
            <h3 class="font-bold text-lg mb-4">
                {addingSubmenuTo ? `Add Submenu to ${addingSubmenuTo.label}` : 'Add Page to Menu'}
            </h3>
            
            <div class="tabs tabs-boxed mb-4">
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

            <div class="space-y-2 max-h-64 overflow-y-auto">
                {#if activeTab === 'pages'}
                    {#each pages as page}
                        <div class="flex justify-between items-center p-2 hover:bg-base-200 rounded-lg">
                            <div>
                                <div class="font-medium">{page.title}</div>
                                <div class="text-xs opacity-60">{page.slug}</div>
                            </div>
                            <button 
                                type="button" 
                                class="btn btn-sm btn-ghost" 
                                onclick={() => addingSubmenuTo ? addSubMenuItem(addingSubmenuTo.id, page) : addMenuItem(page)}
                            >
                                Add
                            </button>
                        </div>
                    {/each}
                {:else}
                    {#each reservedPages as page}
                        <div class="flex justify-between items-center p-2 hover:bg-base-200 rounded-lg">
                            <div>
                                <div class="font-medium">{page.name}</div>
                                <div class="text-xs opacity-60">{page.path}</div>
                            </div>
                            <button 
                                type="button" 
                                class="btn btn-sm btn-ghost" 
                                onclick={() => addingSubmenuTo ? addSubMenuItem(addingSubmenuTo.id, page, true) : addMenuItem(page, true)}
                            >
                                Add
                            </button>
                        </div>
                    {/each}
                {/if}
            </div>

            <div class="modal-action">
                <button type="button" class="btn" onclick={() => { showPageSelector = false; addingSubmenuTo = null; }}>
                    Close
                </button>
            </div>
        </div>
        <div class="modal-backdrop" onclick={() => { showPageSelector = false; addingSubmenuTo = null; }}></div>
    </div>
{/if}