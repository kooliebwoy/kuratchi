<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import type { EditorOptions, PageData } from "./types.js";
    import { defaultEditorOptions, defaultPageData } from "./types.js";
    import { blocks, layouts } from "./registry";
    import { addComponentToEditor } from "./utils/editor.svelte";
    import { rightPanel, closeRightPanel } from "./stores/right-panel";
    import { headingStore, sideBarStore } from "./stores/ui";
    import { MenuWidget } from "./shell";
    import EditorCanvas from "./EditorCanvas.svelte";
    import {
        Box,
        ChevronLeft,
        ChevronRight,
        Eye,
        LayoutGrid,
        Monitor,
        Navigation,
        Pencil,
        Settings,
        Smartphone,
        Tablet
    } from "@lucide/svelte";

    type Props = EditorOptions;

    let { 
        editor = $bindable(defaultEditorOptions.editor),
        pageData = $bindable(defaultPageData),
        editable = defaultEditorOptions.editable,
        isWebpage = defaultEditorOptions.isWebpage,
        layoutsEnabled = defaultEditorOptions.layoutsEnabled,
        imageConfig: editorImageConfig = defaultEditorOptions.imageConfig,
        showUI = defaultEditorOptions.showUI,
        initialDeviceSize = defaultEditorOptions.initialDeviceSize,
        pages = defaultEditorOptions.pages,
        reservedPages = defaultEditorOptions.reservedPages,
        onUpdate = defaultEditorOptions.onUpdate,
        autoSaveDelay = defaultEditorOptions.autoSaveDelay
    }: Props = $props();
    
    // Local mutable state for the page data
    let localPageData = $state<PageData>({ ...defaultPageData, ...pageData });
    
    // UI state
    let sidebarCollapsed = $state(false);
    let activeTab = $state('blocks');
    let browserMockup: HTMLDivElement;
    let activeSize = $state(initialDeviceSize);

    // Autosave timeout
    let saveTimeout: ReturnType<typeof setTimeout> | undefined;

    // Debounced save function
    const triggerSave = () => {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            if (onUpdate) {
                await onUpdate(localPageData);
            }
        }, autoSaveDelay);
    };

    // Handle changes from EditorCanvas
    const handleContentChange = (content: Array<Record<string, unknown>>) => {
        localPageData.content = content;
        triggerSave();
    };

    const handleHeaderChange = (header: Record<string, unknown> | null) => {
        localPageData.header = header;
        triggerSave();
    };

    const handleFooterChange = (footer: Record<string, unknown> | null) => {
        localPageData.footer = footer;
        triggerSave();
    };

    const adjustBrowserSize = (size: 'phone' | 'tablet' | 'desktop') => {
        activeSize = size;
    }

    const handleSave = async () => {
        if (onUpdate) {
            await onUpdate(localPageData);
        }
    }

    const handleTitleEdit = async (title: string) => {
        localPageData.title = title;
        triggerSave();
    }

    const handleSEOEdit = async (seo: { seoTitle: string; seoDescription: string; slug: string }) => {
        localPageData = { ...localPageData, ...seo };
        triggerSave();
    }

    $effect(() => {
        $headingStore = localPageData.title || '';
    });

    onMount(() => {
        $sideBarStore = false;
    });

    onDestroy(() => {
        $sideBarStore = true;
        if (saveTimeout) clearTimeout(saveTimeout);
    });
</script>

{#if !showUI}
    <!-- Canvas-only mode for simple embedding -->
    <EditorCanvas 
        bind:editor
        content={localPageData.content}
        backgroundColor={localPageData.metadata?.backgroundColor || '#000000'}
        header={localPageData.header}
        footer={localPageData.footer}
        {editable}
        {isWebpage}
        {layoutsEnabled}
        imageConfig={editorImageConfig}
        onContentChange={handleContentChange}
        onHeaderChange={handleHeaderChange}
        onFooterChange={handleFooterChange}
    />
{:else}
    <!-- Full editor UI -->
    <div class="flex h-screen bg-base-100">
        <!-- Left Sidebar -->
        <div class="{sidebarCollapsed ? 'w-12' : 'w-84'} transition-all duration-300 bg-base-200 border-r border-base-300 flex flex-col">
            <div class="flex items-center justify-between p-3 border-b border-base-300">
                {#if !sidebarCollapsed}
                    <h2 class="text-sm font-medium text-base-content">Page Builder</h2>
                {/if}
                <button 
                    class="p-1 hover:bg-base-300 rounded transition-colors"
                    onclick={() => sidebarCollapsed = !sidebarCollapsed}
                >
                    {#if sidebarCollapsed}
                        <ChevronRight class="w-4 h-4" />
                    {:else}
                        <ChevronLeft class="w-4 h-4" />
                    {/if}
                </button>
            </div>

            {#if !sidebarCollapsed}
                <div class="flex border-b border-base-300 mb-2">
                    <button 
                        class="flex-1 px-3 py-2 text-xs font-medium text-center border-b-2 transition-colors {activeTab === 'blocks' ? 'border-primary text-primary' : 'border-transparent text-base-content/60 hover:text-base-content'}"
                        onclick={() => activeTab = 'blocks'}
                    >
                        <Box class="w-4 h-4 mx-auto mb-1" />
                        Blocks
                    </button>
                    <button 
                        class="flex-1 px-3 py-2 text-xs font-medium text-center border-b-2 transition-colors {activeTab === 'layouts' ? 'border-primary text-primary' : 'border-transparent text-base-content/60 hover:text-base-content'}"
                        onclick={() => activeTab = 'layouts'}
                    >
                        <LayoutGrid class="w-4 h-4 mx-auto mb-1" />
                        Layouts
                    </button>
                    <button 
                        class="flex-1 px-3 py-2 text-xs font-medium text-center border-b-2 transition-colors {activeTab === 'navigation' ? 'border-primary text-primary' : 'border-transparent text-base-content/60 hover:text-base-content'}"
                        onclick={() => activeTab = 'navigation'}
                    >
                        <Navigation class="w-4 h-4 mx-auto mb-1" />
                        Nav
                    </button>
                    <button 
                        class="flex-1 px-3 py-2 text-xs font-medium text-center border-b-2 transition-colors {activeTab === 'settings' ? 'border-primary text-primary' : 'border-transparent text-base-content/60 hover:text-base-content'}"
                        onclick={() => activeTab = 'settings'}
                    >
                        <Settings class="w-4 h-4 mx-auto mb-1" />
                        Settings
                    </button>
                </div>
            {/if}

            <div class="flex-1 overflow-y-auto">
                {#if !sidebarCollapsed}
                    {#if activeTab === 'blocks'}
                        {#if editor}
                            <div class="flex flex-col gap-1 p-2">
                                {#each blocks as block}
                                    <button
                                        class="flex items-center gap-2 px-2 py-1 rounded hover:bg-base-300 transition"
                                        onclick={() => addComponentToEditor(editor, block.component)}
                                    >
                                        <block.icon class="text-base text-base-content/70" />
                                        <span class="text-sm">{block.name}</span>
                                    </button>
                                {/each}
                            </div>
                        {:else}
                            <div class="p-4 text-center text-base-content/60 text-sm">Editor loading...</div>
                        {/if}
                    {:else if activeTab === 'layouts'}
                        {#if editor}
                            <div class="flex flex-wrap gap-2 p-2">
                                {#each layouts as block}
                                    <button
                                        class="bg-base-100 rounded shadow hover:ring-2 hover:ring-primary transition"
                                        onclick={() => addComponentToEditor(editor, block.component)}
                                    >
                                        <img src={block.image} alt={block.name} class="w-full aspect-video object-cover rounded-t" />
                                        <div class="text-xs text-center py-1">{block.name}</div>
                                    </button>
                                {/each}
                            </div>
                        {:else}
                            <div class="p-4 text-center text-base-content/60 text-sm">Editor loading...</div>
                        {/if}
                    {:else if activeTab === 'navigation'}
                        <div class="p-3">
                            <div class="mb-4">
                                <div class="flex items-center gap-2 px-2 py-1 mb-2">
                                    <Navigation class="w-4 h-4 text-base-content/60" />
                                    <span class="text-xs font-medium text-base-content/60 uppercase tracking-wide">Navigation</span>
                                </div>
                                <div class="space-y-1">
                                    <div class="p-2 bg-base-300 rounded text-sm text-base-content">Header Menu</div>
                                    {#if pages && reservedPages}
                                        <div class="pl-4">
                                            <MenuWidget 
                                                menuItems={(localPageData.header?.menu as any[]) || []}
                                                {pages}
                                                {reservedPages}
                                                menuLocation="header"
                                            />
                                        </div>
                                    {/if}
                                </div>
                            </div>
                            <div class="mb-4">
                                <div class="flex items-center gap-2 px-2 py-1 mb-2">
                                    <LayoutGrid class="w-4 h-4 text-base-content/60" />
                                    <span class="text-xs font-medium text-base-content/60 uppercase tracking-wide">Footer</span>
                                </div>
                                <div class="space-y-1">
                                    <div class="p-2 bg-base-300 rounded text-sm text-base-content">Footer Menu</div>
                                    {#if pages && reservedPages}
                                        <div class="pl-4">
                                            <MenuWidget 
                                                menuItems={(localPageData.footer?.menu as any[]) || []}
                                                {pages}
                                                {reservedPages}
                                                menuLocation="footer"
                                            />
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    {:else if activeTab === 'settings'}
                        <div class="p-3 space-y-4">
                            <div>
                                <h3 class="text-sm font-semibold text-base-content mb-3">Page Information</h3>
                                <label class="form-control w-full">
                                    <div class="label">
                                        <span class="label-text text-xs">Page Title</span>
                                    </div>
                                    <input 
                                        type="text" 
                                        placeholder="Page title here.." 
                                        class="input input-sm input-bordered w-full" 
                                        bind:value={localPageData.title}
                                        onchange={() => handleTitleEdit(localPageData.title)}
                                    />
                                </label>
                            </div>

                            <div class="divider my-2"></div>

                            <div>
                                <h3 class="text-sm font-semibold text-base-content mb-3">SEO Settings</h3>
                                <div class="space-y-3">
                                    <label class="form-control w-full">
                                        <div class="label">
                                            <span class="label-text text-xs">Meta Title</span>
                                        </div>
                                        <input 
                                            type="text" 
                                            bind:value={localPageData.seoTitle}
                                            placeholder="Meta title here.." 
                                            class="input input-sm input-bordered w-full" 
                                            onchange={() => handleSEOEdit({
                                                seoTitle: localPageData.seoTitle,
                                                seoDescription: localPageData.seoDescription,
                                                slug: localPageData.slug
                                            })}
                                        />
                                    </label>

                                    <label class="form-control w-full">
                                        <div class="label">
                                            <span class="label-text text-xs">Meta Description</span>
                                        </div>
                                        <textarea 
                                            class="textarea textarea-sm textarea-bordered" 
                                            bind:value={localPageData.seoDescription}
                                            placeholder="Meta Description here..."
                                            rows="3"
                                            onchange={() => handleSEOEdit({
                                                seoTitle: localPageData.seoTitle,
                                                seoDescription: localPageData.seoDescription,
                                                slug: localPageData.slug
                                            })}
                                        ></textarea>
                                    </label>

                                    <label class="form-control w-full">
                                        <div class="label">
                                            <span class="label-text text-xs">Page Slug</span>
                                        </div>
                                        <input 
                                            type="text" 
                                            bind:value={localPageData.slug}
                                            placeholder="page-slug-here" 
                                            class="input input-sm input-bordered w-full" 
                                            onchange={() => handleSEOEdit({
                                                seoTitle: localPageData.seoTitle,
                                                seoDescription: localPageData.seoDescription,
                                                slug: localPageData.slug
                                            })}
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>
                    {/if}
                {/if}
            </div>
        </div>

        <!-- Main Content Area -->
        <div class="flex-1 flex flex-col min-w-0">
            <!-- Header Toolbar -->
            <div class="border-b border-base-300 bg-base-100 text-base-content flex justify-between items-center px-4 py-2">
                <div class="flex gap-3 items-center">
                    <span class="text-sm font-medium">{localPageData.title}</span>
                    <span class="text-xs text-base-content/50">{localPageData.domain}</span>
                </div>

                <div class="flex gap-1">
                    <button 
                        class="px-2 py-1 rounded text-sm hover:bg-base-200 transition-colors {activeSize==='phone' ? 'bg-base-200' : ''}"
                        onclick={() => adjustBrowserSize('phone')}
                    >
                        <Smartphone class="text-base" />
                    </button>
                    <button 
                        class="px-2 py-1 rounded text-sm hover:bg-base-200 transition-colors {activeSize==='tablet' ? 'bg-base-200' : ''}"
                        onclick={() => adjustBrowserSize('tablet')}
                    >
                        <Tablet class="text-base" />
                    </button>
                    <button 
                        class="px-2 py-1 rounded text-sm hover:bg-base-200 transition-colors {activeSize==='desktop' ? 'bg-base-200' : ''}"
                        onclick={() => adjustBrowserSize('desktop')}
                    >
                        <Monitor class="text-base" />
                    </button>
                </div>

                <div class="flex gap-2">
                    <button class="px-3 py-1 bg-base-200 hover:bg-base-300 rounded text-sm transition-colors">
                        <Eye class="text-base" />
                    </button>
                    <button class="px-3 py-1 bg-primary hover:bg-primary-focus rounded text-sm text-primary-content transition-colors" onclick={handleSave}>
                        Publish
                    </button>
                </div>
            </div>

            <!-- Canvas -->
            <div class="flex-1 bg-base-content text-base-100 overflow-auto">
                <div
                    class="mx-auto w-full"
                    style:max-width={activeSize === 'phone' ? '390px' : activeSize === 'tablet' ? '768px' : '1440px'}
                    bind:this={browserMockup}
                >
                    <EditorCanvas 
                        bind:editor
                        content={localPageData.content}
                        backgroundColor={localPageData.metadata?.backgroundColor || '#000000'}
                        header={localPageData.header}
                        footer={localPageData.footer}
                        {editable}
                        {isWebpage}
                        {layoutsEnabled}
                        imageConfig={editorImageConfig}
                        onContentChange={handleContentChange}
                        onHeaderChange={handleHeaderChange}
                        onFooterChange={handleFooterChange}
                    />
                </div>
            </div>
        </div>

        <!-- Right Sidebar -->
        <div class="{$rightPanel.open ? 'w-84' : 'w-0'} transition-all duration-300 bg-base-200 border-l-2 border-primary/20 flex flex-col overflow-hidden shrink-0 shadow-lg">
            {#if $rightPanel.open}
                <div class="flex items-center justify-between p-3 border-b border-base-300 bg-gradient-to-r from-primary/5 to-transparent">
                    <div class="flex items-center gap-2">
                        <div class="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                        <h2 class="text-sm font-semibold text-base-content">{$rightPanel.title}</h2>
                    </div>
                    <button 
                        class="p-1.5 hover:bg-base-300 rounded-md transition-colors group"
                        onclick={closeRightPanel}
                    >
                        <ChevronRight class="w-4 h-4 group-hover:text-primary transition-colors" />
                    </button>
                </div>
                <div class="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-base-100/50 to-base-200">
                    {#if $rightPanel.content}
                        {@render $rightPanel.content()}
                    {/if}
                </div>
                <div class="p-3 border-t border-base-300 bg-base-100/80">
                    <div class="text-xs text-base-content/60 text-center">Changes are saved automatically</div>
                </div>
            {/if}
        </div>
    </div>

{/if}
