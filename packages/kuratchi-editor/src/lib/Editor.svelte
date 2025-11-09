<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import type { EditorOptions, PageData } from "./types.js";
    import { defaultEditorOptions, defaultPageData } from "./types.js";
    import { blocks, layouts } from "./registry";
    import { headerBlocks } from "./registry/headerBlocks.svelte";
    import { footerBlocks } from "./registry/footerBlocks.svelte";
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
        Tablet,
        PanelTop,
        PanelBottom,
        FileText,
        Plus
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
        autoSaveDelay = defaultEditorOptions.autoSaveDelay,
        siteHeader = $bindable(null),
        siteFooter = $bindable(null),
        siteMetadata = $bindable({}),
        onSiteHeaderUpdate,
        onSiteFooterUpdate,
        onSiteMetadataUpdate,
        currentPageId,
        onPageSwitch,
        onCreatePage
    }: Props = $props();
    
    // Local mutable state for the page data
    let localPageData = $state<PageData>({ ...defaultPageData, ...pageData });
    
    // UI state
    let sidebarOpen = $state(false);
    let activeTab = $state('blocks');
    let browserMockup: HTMLDivElement;
    let activeSize = $state(initialDeviceSize);

    const toggleSidebar = (tab: string) => {
        if (activeTab === tab && sidebarOpen) {
            sidebarOpen = false;
        } else {
            activeTab = tab;
            sidebarOpen = true;
        }
    };

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

    const handleHeaderChange = async (newHeader: Record<string, unknown> | null) => {
        if (!newHeader) {
            siteHeader = null;
        } else {
            // Merge with existing header data or use defaults based on type
            const headerType = newHeader.type as string;
            const baseHeader = {
                ...newHeader,
                id: newHeader.id || crypto.randomUUID(),
                menu: siteHeader?.menu || [],
                icons: siteHeader?.icons || [
                    { icon: 'facebook', link: '#', name: 'Facebook', enabled: true },
                    { icon: 'x', link: '#', name: 'X', enabled: true },
                    { icon: 'instagram', link: '#', name: 'Instagram', enabled: true }
                ]
            };

            // Add type-specific defaults
            if (headerType === 'saige-blake-header') {
                siteHeader = {
                    ...baseHeader,
                    backgroundColor: siteHeader?.backgroundColor || '#ffffff',
                    textColor: siteHeader?.textColor || '#92c8c8',
                    reverseOrder: siteHeader?.reverseOrder || false
                };
            } else if (headerType === 'twig-and-pearl-header') {
                siteHeader = {
                    ...baseHeader,
                    backgroundColor: siteHeader?.backgroundColor || '#212121',
                    textColor: siteHeader?.textColor || '#ffffff',
                    homeIconColor: siteHeader?.homeIconColor || '#575757',
                    searchEnabled: siteHeader?.searchEnabled !== undefined ? siteHeader.searchEnabled : true,
                    reverseOrder: siteHeader?.reverseOrder || false
                };
            } else {
                siteHeader = baseHeader;
            }
        }
        
        if (onSiteHeaderUpdate) {
            await onSiteHeaderUpdate(siteHeader);
        }
    };

    const handleFooterChange = async (newFooter: Record<string, unknown> | null) => {
        if (!newFooter) {
            siteFooter = null;
        } else {
            // Merge with existing footer data or use defaults based on type
            const footerType = newFooter.type as string;
            const baseFooter = {
                ...newFooter,
                id: newFooter.id || crypto.randomUUID(),
                menu: siteFooter?.menu || [],
                icons: siteFooter?.icons || [
                    { icon: 'facebook', link: '#', name: 'Facebook', enabled: true },
                    { icon: 'x', link: '#', name: 'X', enabled: true },
                    { icon: 'instagram', link: '#', name: 'Instagram', enabled: true }
                ]
            };

            // Add type-specific defaults
            if (footerType === 'saige-blake-footer') {
                siteFooter = {
                    ...baseFooter,
                    backgroundColor: siteFooter?.backgroundColor || '#ffffff',
                    textColor: siteFooter?.textColor || '#92c8c8'
                };
            } else if (footerType === 'twig-and-pearl-footer') {
                siteFooter = {
                    ...baseFooter,
                    backgroundColor: siteFooter?.backgroundColor || '#212121',
                    textColor: siteFooter?.textColor || '#ffffff',
                    reverseOrder: siteFooter?.reverseOrder || false,
                    copyrightText: siteFooter?.copyrightText || {
                        href: 'https://yoursite.com',
                        by: 'Your Company'
                    }
                };
            } else {
                siteFooter = baseFooter;
            }
        }
        
        if (onSiteFooterUpdate) {
            await onSiteFooterUpdate(siteFooter);
        }
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

    $effect(() => {
        const incomingId = (pageData as any)?.id ?? null;
        const currentId = (localPageData as any)?.id ?? null;
        const incomingSlug = (pageData as any)?.slug ?? '';
        const currentSlug = (localPageData as any)?.slug ?? '';
        if (incomingId !== currentId || incomingSlug !== currentSlug) {
            localPageData = { ...defaultPageData, ...pageData } as PageData;
        }
    });

    onMount(() => {
        $sideBarStore = false;
    });

    onDestroy(() => {
        $sideBarStore = true;
        if (saveTimeout) clearTimeout(saveTimeout);
    });

    // ----- Site-wide Navigation State Helpers -----
    const navDefaults = {
        header: { visible: true, useMobileMenuOnDesktop: false, items: [] as any[] },
        footer: { visible: true, items: [] as any[] },
        custom: {} as Record<string, any[]>
    };

    function ensureNavigation() {
        const nav = (siteMetadata as any)?.navigation || {};
        const seededHeaderItems = (nav.header?.items && nav.header.items.length > 0)
            ? nav.header.items
            : ((siteHeader as any)?.menu || []);
        const seededFooterItems = (nav.footer?.items && nav.footer.items.length > 0)
            ? nav.footer.items
            : ((siteFooter as any)?.menu || []);
        const next = {
            header: { ...navDefaults.header, ...(nav.header || {}), items: seededHeaderItems },
            footer: { ...navDefaults.footer, ...(nav.footer || {}), items: seededFooterItems },
            custom: { ...(nav.custom || {}) }
        };
        return next;
    }

    let navState = $state(ensureNavigation());

    async function saveNavigation(nextNav: any) {
        siteMetadata = { ...(siteMetadata || {}), navigation: nextNav };
        if (onSiteMetadataUpdate) {
            await onSiteMetadataUpdate(siteMetadata);
        }
    }

    const handleHeaderMenuSave = async ({ items }: { location: string; items: any[] }) => {
        navState.header.items = items;
        await saveNavigation(navState);
    };

    const handleFooterMenuSave = async ({ items }: { location: string; items: any[] }) => {
        navState.footer.items = items;
        await saveNavigation(navState);
    };

    const toggleHeaderVisible = async (value: boolean) => {
        navState.header.visible = value;
        await saveNavigation(navState);
    };

    const toggleFooterVisible = async (value: boolean) => {
        navState.footer.visible = value;
        await saveNavigation(navState);
    };

    const toggleHeaderMobileOnDesktop = async (value: boolean) => {
        navState.header.useMobileMenuOnDesktop = value;
        await saveNavigation(navState);
    };

    // Quick-add a page into a menu location (header/footer)
    const addPageToMenu = async (location: 'header' | 'footer', page: any) => {
        const item = {
            id: crypto.randomUUID(),
            label: page.title,
            slug: page.slug,
            pageId: page.id
        };
        if (location === 'header') navState.header.items = [...(navState.header.items || []), item];
        else navState.footer.items = [...(navState.footer.items || []), item];
        await saveNavigation(navState);
    };
</script>

{#if !showUI}
    <!-- Canvas-only mode for simple embedding -->
    <EditorCanvas 
        bind:editor
        content={localPageData.content}
        backgroundColor={siteMetadata?.backgroundColor || '#000000'}
        header={siteHeader}
        footer={siteFooter}
        {editable}
        {isWebpage}
        {layoutsEnabled}
        imageConfig={editorImageConfig}
        onContentChange={handleContentChange}
        onHeaderChange={handleHeaderChange}
        onFooterChange={handleFooterChange}
        navigation={navState}
    />
{:else}
    <!-- Full editor UI -->
    <div class="flex h-screen bg-base-100">
        <!-- Left Icon Bar -->
        <div class="w-16 bg-base-200 border-r border-base-300 flex flex-col items-center py-4 gap-2 shadow-lg">
            <button 
                class="p-3 rounded-lg transition-all {activeTab === 'blocks' ? 'bg-primary text-primary-content' : 'text-base-content/60 hover:bg-base-300'}"
                onclick={() => toggleSidebar('blocks')}
                title="Blocks"
            >
                <Box class="w-5 h-5" />
            </button>
            <button 
                class="p-3 rounded-lg transition-all {activeTab === 'layouts' ? 'bg-primary text-primary-content' : 'text-base-content/60 hover:bg-base-300'}"
                onclick={() => toggleSidebar('layouts')}
                title="Layouts"
            >
                <LayoutGrid class="w-5 h-5" />
            </button>
            <button 
                class="p-3 rounded-lg transition-all {activeTab === 'site' ? 'bg-primary text-primary-content' : 'text-base-content/60 hover:bg-base-300'}"
                onclick={() => toggleSidebar('site')}
                title="Site"
            >
                <PanelTop class="w-5 h-5" />
            </button>
            <button 
                class="p-3 rounded-lg transition-all {activeTab === 'navigation' ? 'bg-primary text-primary-content' : 'text-base-content/60 hover:bg-base-300'}"
                onclick={() => toggleSidebar('navigation')}
                title="Navigation"
            >
                <Navigation class="w-5 h-5" />
            </button>
            <button 
                class="p-3 rounded-lg transition-all {activeTab === 'settings' ? 'bg-primary text-primary-content' : 'text-base-content/60 hover:bg-base-300'}"
                onclick={() => toggleSidebar('settings')}
                title="Settings"
            >
                <Settings class="w-5 h-5" />
            </button>
            <button 
                class="p-3 rounded-lg transition-all {activeTab === 'pages' ? 'bg-primary text-primary-content' : 'text-base-content/60 hover:bg-base-300'}"
                onclick={() => toggleSidebar('pages')}
                title="Pages"
            >
                <FileText class="w-5 h-5" />
            </button>
        </div>

        <!-- Collapsible Sidebar -->
        <div class="{sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-base-200 border-r border-base-300 flex flex-col overflow-hidden shadow-lg">
            <div class="flex items-center justify-between p-3 border-b border-base-300 flex-shrink-0">
                <h2 class="text-sm font-medium text-base-content">
                    {activeTab === 'blocks' ? 'Blocks' : 
                     activeTab === 'layouts' ? 'Layouts' : 
                     activeTab === 'site' ? 'Site' : 
                     activeTab === 'navigation' ? 'Navigation' : 
                     activeTab === 'settings' ? 'Settings' : 
                     activeTab === 'pages' ? 'Pages' : 'Page Builder'}
                </h2>
                <button 
                    class="p-1 hover:bg-base-300 rounded transition-colors"
                    onclick={() => sidebarOpen = false}
                >
                    <ChevronLeft class="w-4 h-4" />
                </button>
            </div>

            <div class="flex-1 overflow-y-auto">
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
                    {:else if activeTab === 'site'}
                        <div class="p-3 space-y-4">
                            <!-- Header Selection -->
                            <div>
                                <div class="flex items-center gap-2 px-2 py-1 mb-2">
                                    <PanelTop class="w-4 h-4 text-base-content/60" />
                                    <span class="text-xs font-medium text-base-content/60 uppercase tracking-wide">Header</span>
                                </div>
                                <div class="space-y-2">
                                    {#each headerBlocks as headerBlock}
                                        <button
                                            class="w-full bg-base-100 rounded shadow hover:ring-2 transition {siteHeader?.type === headerBlock.type ? 'ring-2 ring-primary' : 'hover:ring-primary/50'}"
                                            onclick={() => handleHeaderChange({ type: headerBlock.type, id: crypto.randomUUID() })}
                                        >
                                            <img src={headerBlock.image} alt="Header" class="w-full aspect-video object-cover rounded-t" />
                                            <div class="text-xs text-center py-1">{headerBlock.type}</div>
                                        </button>
                                    {/each}
                                </div>
                            </div>

                            <!-- Footer Selection -->
                            <div>
                                <div class="flex items-center gap-2 px-2 py-1 mb-2">
                                    <PanelBottom class="w-4 h-4 text-base-content/60" />
                                    <span class="text-xs font-medium text-base-content/60 uppercase tracking-wide">Footer</span>
                                </div>
                                <div class="space-y-2">
                                    {#each footerBlocks as footerBlock}
                                        <button
                                            class="w-full bg-base-100 rounded shadow hover:ring-2 transition {siteFooter?.type === footerBlock.type ? 'ring-2 ring-primary' : 'hover:ring-primary/50'}"
                                            onclick={() => handleFooterChange({ type: footerBlock.type, id: crypto.randomUUID() })}
                                        >
                                            <img src={footerBlock.image} alt="Footer" class="w-full aspect-video object-cover rounded-t" />
                                            <div class="text-xs text-center py-1">{footerBlock.type}</div>
                                        </button>
                                    {/each}
                                </div>
                            </div>
                        </div>
                    {:else if activeTab === 'navigation'}
                        <div class="p-3 space-y-4">
                            <!-- Header Menu Section -->
                            <div class="rounded-lg border border-base-300 bg-base-100 overflow-hidden">
                                <div class="flex items-center justify-between px-3 py-2 bg-base-200 border-b border-base-300">
                                    <div class="flex items-center gap-2">
                                        <PanelTop class="w-4 h-4 text-primary" />
                                        <span class="text-sm font-semibold text-base-content">Header</span>
                                    </div>
                                    <label class="flex items-center gap-1.5 cursor-pointer">
                                        <input type="checkbox" class="toggle toggle-xs" checked={navState.header.visible} onchange={(e) => toggleHeaderVisible((e.currentTarget as HTMLInputElement).checked)} />
                                        <span class="text-xs text-base-content/70">Show</span>
                                    </label>
                                </div>
                                <div class="px-3 py-2 space-y-2">
                                    <label class="flex items-center gap-2 cursor-pointer text-xs">
                                        <input type="checkbox" class="checkbox checkbox-xs" checked={navState.header.useMobileMenuOnDesktop} onchange={(e) => toggleHeaderMobileOnDesktop((e.currentTarget as HTMLInputElement).checked)} />
                                        <span class="text-base-content/70">Mobile menu on desktop</span>
                                    </label>
                                    <div class="pt-1">
                                        <MenuWidget 
                                            menuItems={navState.header.items}
                                            pages={pages || []}
                                            reservedPages={reservedPages || []}
                                            menuLocation="header"
                                            onSave={handleHeaderMenuSave}
                                        />
                                    </div>
                                </div>
                            </div>

                            <!-- Footer Menu Section -->
                            <div class="rounded-lg border border-base-300 bg-base-100 overflow-hidden">
                                <div class="flex items-center justify-between px-3 py-2 bg-base-200 border-b border-base-300">
                                    <div class="flex items-center gap-2">
                                        <PanelBottom class="w-4 h-4 text-secondary" />
                                        <span class="text-sm font-semibold text-base-content">Footer</span>
                                    </div>
                                    <label class="flex items-center gap-1.5 cursor-pointer">
                                        <input type="checkbox" class="toggle toggle-xs" checked={navState.footer.visible} onchange={(e) => toggleFooterVisible((e.currentTarget as HTMLInputElement).checked)} />
                                        <span class="text-xs text-base-content/70">Show</span>
                                    </label>
                                </div>
                                <div class="px-3 py-2">
                                    <MenuWidget 
                                        menuItems={navState.footer.items}
                                        pages={pages || []}
                                        reservedPages={reservedPages || []}
                                        menuLocation="footer"
                                        onSave={handleFooterMenuSave}
                                    />
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
                    {:else if activeTab === 'pages'}
                        <div class="p-3 space-y-3">
                            <div class="flex items-center justify-between mb-3">
                                <h3 class="text-sm font-semibold text-base-content">Pages</h3>
                                <button
                                    class="btn btn-primary btn-xs gap-1"
                                    onclick={onCreatePage}
                                    title="Create a new page"
                                >
                                    <Plus class="w-3 h-3" />
                                    <span class="hidden sm:inline">New</span>
                                </button>
                            </div>
                            
                            {#if pages && pages.length > 0}
                                <div class="space-y-1">
                                    {#each pages as page (page.id)}
                                        <div class="px-3 py-2 rounded-lg transition-all {currentPageId === page.id 
                                                ? 'bg-primary text-primary-content shadow-md' 
                                                : 'bg-base-200 text-base-content hover:bg-base-300'}">
                                            <div class="flex items-center justify-between gap-2">
                                                <button class="flex-1 text-left" onclick={() => onPageSwitch?.(page.id)} title={page.title}>
                                                    <div class="flex items-center justify-between">
                                                        <span class="font-medium text-sm truncate">{page.title}</span>
                                                        {#if page.isSpecialPage}
                                                            <span class="text-xs opacity-75">🏠</span>
                                                        {/if}
                                                    </div>
                                                    <span class="text-xs opacity-75 truncate">/{page.slug}</span>
                                                </button>
                                                <div class="flex gap-1">
                                                    <button class="btn btn-ghost btn-xs" title="Add to Header" onclick={() => addPageToMenu('header', page)}>+ Header</button>
                                                    <button class="btn btn-ghost btn-xs" title="Add to Footer" onclick={() => addPageToMenu('footer', page)}>+ Footer</button>
                                                </div>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            {:else}
                                <div class="text-center py-6 text-base-content/60">
                                    <p class="text-sm mb-3">No pages yet</p>
                                    <button
                                        class="btn btn-primary btn-sm gap-2"
                                        onclick={onCreatePage}
                                    >
                                        <Plus class="w-4 h-4" />
                                        Create First Page
                                    </button>
                                </div>
                            {/if}
                        </div>
                    {/if}
            </div>
        </div>

        <!-- Main Content Area with Canvas and Right Sidebar -->
        <div class="flex-1 flex flex-col min-w-0">
            <!-- Header Toolbar -->
            <div class="border-b border-base-300 bg-base-100 flex justify-between items-center px-6 py-3 shadow-sm">
                <!-- Left: Page Info -->
                <div class="flex gap-4 items-center min-w-0">
                    <div class="flex flex-col gap-0.5">
                        <span class="text-sm font-semibold text-base-content truncate">{localPageData.title}</span>
                        <span class="text-xs text-base-content/60">{localPageData.domain}</span>
                    </div>
                </div>

                <!-- Center: Device Size Toggle -->
                <div class="flex gap-2 bg-base-200 rounded-lg p-1.5 border border-base-300">
                    <button 
                        class="px-3 py-1.5 rounded-md text-sm font-medium transition-all {activeSize==='phone' ? 'bg-primary text-primary-content shadow-md' : 'text-base-content/60 hover:text-base-content hover:bg-base-300'}"
                        onclick={() => adjustBrowserSize('phone')}
                        title="Mobile (390px)"
                    >
                        <Smartphone class="w-4 h-4" />
                    </button>
                    <button 
                        class="px-3 py-1.5 rounded-md text-sm font-medium transition-all {activeSize==='tablet' ? 'bg-primary text-primary-content shadow-md' : 'text-base-content/60 hover:text-base-content hover:bg-base-300'}"
                        onclick={() => adjustBrowserSize('tablet')}
                        title="Tablet (768px)"
                    >
                        <Tablet class="w-4 h-4" />
                    </button>
                    <button 
                        class="px-3 py-1.5 rounded-md text-sm font-medium transition-all {activeSize==='desktop' ? 'bg-primary text-primary-content shadow-md' : 'text-base-content/60 hover:text-base-content hover:bg-base-300'}"
                        onclick={() => adjustBrowserSize('desktop')}
                        title="Desktop (1440px)"
                    >
                        <Monitor class="w-4 h-4" />
                    </button>
                </div>

                <!-- Right: Action Buttons -->
                <div class="flex gap-2">
                    <div class="flex items-center gap-2 text-xs text-base-content/60">
                        <div class="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                        <span>Auto-saving</span>
                    </div>
                </div>
            </div>

            <!-- Canvas and Right Sidebar Container -->
            <div class="flex-1 flex min-w-0 min-h-0">
                <!-- Canvas -->
                <div class="flex-1 bg-slate-100 overflow-auto min-h-0">
                    <div
                        class="mx-auto w-full"
                        style:max-width={activeSize === 'phone' ? '390px' : activeSize === 'tablet' ? '768px' : '1440px'}
                        bind:this={browserMockup}
                    >
                        {#key `${(pageData?.id || pageData?.slug || 'noid')}-${siteHeader?.type || 'none'}-${siteFooter?.type || 'none'}`}
                            <EditorCanvas 
                                bind:editor
                                content={localPageData.content}
                                backgroundColor={siteMetadata?.backgroundColor || '#000000'}
                                header={siteHeader}
                                footer={siteFooter}
                                {editable}
                                {isWebpage}
                                {layoutsEnabled}
                                imageConfig={editorImageConfig}
                                onContentChange={handleContentChange}
                                onHeaderChange={handleHeaderChange}
                                onFooterChange={handleFooterChange}
                                navigation={navState}
                            />
                        {/key}
                    </div>
                </div>

                <!-- Right Sidebar -->
                <div class="{$rightPanel.open ? 'w-80' : 'w-0'} transition-all duration-300 bg-base-200 border-l border-base-300 flex flex-col overflow-hidden shrink-0 shadow-lg">
                    {#if $rightPanel.open}
                        <div class="flex items-center justify-between px-4 py-3 border-b border-base-300 bg-base-100 flex-shrink-0">
                            <div class="flex items-center gap-2">
                                <div class="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                                <h2 class="text-sm font-semibold text-base-content">{$rightPanel.title}</h2>
                            </div>
                            <button 
                                class="p-1.5 hover:bg-base-300 rounded-lg transition-colors group text-base-content/60 hover:text-base-content"
                                onclick={closeRightPanel}
                            >
                                <ChevronRight class="w-4 h-4" />
                            </button>
                        </div>
                        <div class="flex-1 overflow-y-auto p-4 space-y-6">
                            {#if $rightPanel.content}
                                {@render $rightPanel.content()}
                            {/if}
                        </div>
                        <div class="p-3 border-t border-base-300 bg-base-100 flex-shrink-0">
                            <div class="text-xs text-base-content/60 text-center">Auto-saving...</div>
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    </div>

{/if}
