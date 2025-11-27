<script lang="ts">
    import type { PluginContext, NavigationExtension } from '../context';
    import { EXT } from '../context';
    import { Plus, Home, ChevronDown, ChevronUp } from '@lucide/svelte';

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

    $effect(() => {
        if (currentPage) {
            localTitle = currentPage.title ?? '';
            localSlug = currentPage.slug ?? '';
            localSeoTitle = currentPage.seoTitle ?? '';
            localSeoDescription = currentPage.seoDescription ?? '';
        }
    });

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
        <button class="pages-plugin__newButton" onclick={() => ctx.createPage()} title="Create new page">
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
            <button class="pages-plugin__createButton" onclick={() => ctx.createPage()}>
                <Plus />Create First Page
            </button>
        </div>
    {/if}
</div>

<style>
    .pages-plugin { display: flex; flex-direction: column; gap: 12px; }
    .pages-plugin__settings { display: flex; flex-direction: column; background: #f9fafb; border-radius: 8px; overflow: hidden; }
    .pages-plugin__settingsHeader { display: flex; align-items: center; justify-content: space-between; padding: 12px; border: none; background: transparent; cursor: pointer; transition: background 0.15s; }
    .pages-plugin__settingsHeader:hover { background: #f3f4f6; }
    .pages-plugin__settingsHeader h3 { margin: 0; font-size: 13px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; }
    .pages-plugin__settingsHeader :global(svg) { width: 16px; height: 16px; color: #6b7280; }
    .pages-plugin__settingsBody { display: flex; flex-direction: column; gap: 12px; padding: 0 12px 12px; }
    .pages-plugin__settingsBody h4 { margin: 0; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
    .pages-plugin__settingsBody label { display: flex; flex-direction: column; gap: 4px; }
    .pages-plugin__settingsBody label span { font-size: 12px; font-weight: 500; color: #6b7280; }
    .pages-plugin__settingsBody input, .pages-plugin__settingsBody textarea { padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 13px; color: #374151; background: #fff; }
    .pages-plugin__settingsBody input:focus, .pages-plugin__settingsBody textarea:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
    .pages-plugin__settingsBody textarea { resize: vertical; min-height: 60px; font-family: inherit; }
    .pages-plugin__divider { height: 1px; background: #e5e7eb; margin: 4px 0; }
    .pages-plugin__header { display: flex; align-items: center; justify-content: space-between; padding: 0 4px; }
    .pages-plugin__header h3 { margin: 0; font-size: 13px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; }
    .pages-plugin__newButton { display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; border: none; border-radius: 6px; background: transparent; color: #6b7280; font-size: 13px; font-weight: 500; cursor: pointer; }
    .pages-plugin__newButton:hover { background: #f3f4f6; color: #374151; }
    .pages-plugin__newButton :global(svg) { width: 14px; height: 14px; }
    .pages-plugin__list { display: flex; flex-direction: column; gap: 2px; }
    .pages-plugin__item { border-radius: 8px; background: transparent; transition: background 0.15s; }
    .pages-plugin__item:hover { background: #f9fafb; }
    .pages-plugin__item.is-active { background: #eff6ff; }
    .pages-plugin__item.is-active .pages-plugin__itemMain { color: #2563eb; }
    .pages-plugin__itemMain { display: flex; flex-direction: column; gap: 2px; width: 100%; padding: 10px 12px; border: none; background: transparent; text-align: left; cursor: pointer; color: #374151; }
    .pages-plugin__itemTitle { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 500; }
    .pages-plugin__itemTitle :global(svg) { width: 12px; height: 12px; color: #9ca3af; }
    .pages-plugin__itemSlug { font-size: 12px; color: #9ca3af; font-family: monospace; }
    .pages-plugin__itemActions { display: flex; gap: 4px; padding: 0 12px 10px; }
    .pages-plugin__actionButton { padding: 4px 8px; border: 1px solid #e5e7eb; border-radius: 4px; background: #fff; font-size: 11px; color: #6b7280; cursor: pointer; }
    .pages-plugin__actionButton:hover { border-color: #d1d5db; background: #f9fafb; color: #374151; }
    .pages-plugin__empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 32px 16px; text-align: center; }
    .pages-plugin__empty p { margin: 0; font-size: 14px; color: #9ca3af; }
    .pages-plugin__createButton { display: inline-flex; align-items: center; gap: 6px; padding: 10px 16px; border: none; border-radius: 8px; background: #3b82f6; color: #fff; font-size: 14px; font-weight: 500; cursor: pointer; }
    .pages-plugin__createButton:hover { background: #2563eb; }
    .pages-plugin__createButton :global(svg) { width: 16px; height: 16px; }
</style>
