<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import type { EditorOptions, PageData, SiteRegionState } from "./types.js";
    import type { PluginContext } from "./plugins/types";
    import { defaultEditorOptions, defaultPageData } from "./types.js";
    import { blocks, getBlock, getEnabledPlugins } from "./registry";
    import { sectionDefaults } from "./registry/sections.svelte";
    import { headers } from "./registry/headers.svelte";
    import { footers } from "./registry/footers.svelte";
    import { addComponentToEditor } from "./utils/editor.svelte";
    import { rightPanel, closeRightPanel } from "./stores/right-panel";
    import { headingStore, sideBarStore } from "./stores/ui";
    import { MenuWidget } from "./plugins";
    import EditorCanvas from "./EditorCanvas.svelte";
    import ThemePreview from "./themes/ThemePreview.svelte";
    import { getAllThemes, getThemeTemplate, DEFAULT_THEME_ID } from "./themes";
    import {
        Box,
        ChevronLeft,
        ChevronRight,
        Eye,
        Monitor,
        Navigation,
        Pencil,
        Settings,
        Smartphone,
        Tablet,
        PanelTop,
        PanelBottom,
        FileText,
        Plus,
        Palette,
        PanelsTopLeft
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
        siteHeader = $bindable<SiteRegionState | null>(null),
        siteFooter = $bindable<SiteRegionState | null>(null),
        siteMetadata = $bindable(defaultEditorOptions.siteMetadata ?? {}),
        blog = $bindable(defaultEditorOptions.blog),
        onSiteHeaderUpdate,
        onSiteFooterUpdate,
        onSiteMetadataUpdate,
        currentPageId,
        onPageSwitch,
        onCreatePage,
        enabledPlugins
    }: Props = $props();

    const getPageList = () => Array.isArray(pages) ? pages : [];
    
    // Local mutable state for the page data
    let localPageData = $state<PageData>({ ...defaultPageData, ...pageData });
    
    // UI state
    let sidebarOpen = $state(false);
    let activeTab = $state('blocks');
    let browserMockup: HTMLDivElement;
    let activeSize = $state(initialDeviceSize);
    let headerElement = $state<HTMLElement | undefined>(undefined);
    let footerElement = $state<HTMLElement | undefined>(undefined);
    const paletteBlocks = blocks.filter((block) => block.showInPalette !== false);
    const themeOptions = getAllThemes();
    let selectedThemeId = $state((siteMetadata as any)?.themeId || DEFAULT_THEME_ID);

    // Plugin system
    const activePlugins = getEnabledPlugins(enabledPlugins);
    
    // Plugin context - provides plugins with editor interaction capabilities
    const pluginContext: PluginContext = {
        siteMetadata,
        updateSiteMetadata: async (updates: Record<string, unknown>) => {
            siteMetadata = { ...siteMetadata, ...updates };
            if (onSiteMetadataUpdate) {
                await onSiteMetadataUpdate(siteMetadata);
            }
        },
        pages: getPageList().map(p => ({
            id: (p as any).id ?? '',
            name: (p as any).name ?? '',
            slug: (p as any).slug ?? ''
        })),
        reservedPages: (reservedPages ?? []).map(p => (p as any).slug ?? ''),
        editor
    };
    
    const randomId = () => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2));

    const slugify = (value: string) =>
        value
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'entry';

    const toDateInputValue = (value?: string) => value ?? new Date().toISOString().slice(0, 10);

    const withLeadingSlash = (slug: string) => (slug.startsWith('/') ? slug : `/${slug}`);

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

    const handleHeaderChange = async (next: SiteRegionState | null) => {
        siteHeader = next;
        if (onSiteHeaderUpdate) {
            await onSiteHeaderUpdate(siteHeader);
        }
    };

    const handleFooterChange = async (next: SiteRegionState | null) => {
        siteFooter = next;
        if (onSiteFooterUpdate) {
            await onSiteFooterUpdate(siteFooter);
        }
    };


    const applyTheme = async (themeId: string) => {
        const template = getThemeTemplate(themeId);
        selectedThemeId = themeId;
        const homepage = template.defaultHomepage;
        localPageData = { ...localPageData, ...homepage };
        siteMetadata = { ...(template.siteMetadata || {}), themeId };
        await handleHeaderChange(template.siteHeader);
        await handleFooterChange(template.siteFooter);
        if (onSiteMetadataUpdate) {
            await onSiteMetadataUpdate(siteMetadata);
        }
        navState = ensureNavigation();
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


    $effect(() => {
        const incomingTheme = (siteMetadata as any)?.themeId;
        if (incomingTheme && incomingTheme !== selectedThemeId) {
            selectedThemeId = incomingTheme;
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

    const extractMenu = (region: SiteRegionState | null | undefined) => {
        const block = region?.blocks?.[0];
        const menu = (block && typeof block === 'object') ? (block as any).menu : undefined;
        return Array.isArray(menu) ? menu : [];
    };

    function ensureNavigation() {
        const nav = (siteMetadata as any)?.navigation || {};
        const seededHeaderItems = (nav.header?.items && nav.header.items.length > 0)
            ? nav.header.items
            : extractMenu(siteHeader);
        const seededFooterItems = (nav.footer?.items && nav.footer.items.length > 0)
            ? nav.footer.items
            : extractMenu(siteFooter);
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
            id: randomId(),
            label: page.title,
            slug: page.slug,
            pageId: page.id
        };
        if (location === 'header') navState.header.items = [...(navState.header.items || []), item];
        else navState.footer.items = [...(navState.footer.items || []), item];
        await saveNavigation(navState);
    };

    const addCustomNavItem = async (location: 'header' | 'footer', label: string, slug: string) => {
        const item = {
            id: randomId(),
            label,
            slug: withLeadingSlash(slug)
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
        bind:headerElement
        bind:footerElement
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
    <div class="krt-editor">
        <!-- Left Icon Bar -->
        <div class="krt-editor__rail">
            <button 
                class={`krt-editor__railButton ${activeTab === 'blocks' ? 'is-active' : ''}`}
                onclick={() => toggleSidebar('blocks')}
                title="Blocks"
            >
                <Box />
            </button>
            <button 
                class={`krt-editor__railButton ${activeTab === 'sections' ? 'is-active' : ''}`}
                onclick={() => toggleSidebar('sections')}
                title="Sections"
            >
                <PanelsTopLeft />
            </button>
            <button 
                class={`krt-editor__railButton ${activeTab === 'site' ? 'is-active' : ''}`}
                onclick={() => toggleSidebar('site')}
                title="Site"
            >
                <PanelTop />
            </button>
            <button 
                class={`krt-editor__railButton ${activeTab === 'themes' ? 'is-active' : ''}`}
                onclick={() => toggleSidebar('themes')}
                title="Themes"
            >
                <Palette />
            </button>
            {#each activePlugins as plugin}
                <button 
                    class={`krt-editor__railButton ${activeTab === plugin.id ? 'is-active' : ''}`}
                    onclick={() => toggleSidebar(plugin.id)}
                    title={plugin.railButton?.title ?? plugin.name}
                >
                    <plugin.icon />
                </button>
            {/each}
            <button 
                class={`krt-editor__railButton ${activeTab === 'navigation' ? 'is-active' : ''}`}
                onclick={() => toggleSidebar('navigation')}
                title="Navigation"
            >
                <Navigation />
            </button>
            <button 
                class={`krt-editor__railButton ${activeTab === 'settings' ? 'is-active' : ''}`}
                onclick={() => toggleSidebar('settings')}
                title="Settings"
            >
                <Settings />
            </button>
            <button 
                class={`krt-editor__railButton ${activeTab === 'pages' ? 'is-active' : ''}`}
                onclick={() => toggleSidebar('pages')}
                title="Pages"
            >
                <FileText />
            </button>
        </div>

        <!-- Collapsible Sidebar -->
        <div class="krt-editor__sidebar" data-open={sidebarOpen}>
            <div class="krt-editor__sidebarHeader">
                <h2>
                    {activeTab === 'blocks' ? 'Blocks' : 
                     activeTab === 'sections' ? 'Sections' : 
                     activeTab === 'site' ? 'Site' : 
                     activeTab === 'themes' ? 'Themes' :
                     activeTab === 'navigation' ? 'Navigation' : 
                     activeTab === 'settings' ? 'Settings' : 
                     activeTab === 'pages' ? 'Pages' : 
                     activePlugins.find(p => p.id === activeTab)?.name ?? 'Page Builder'}
                </h2>
                <button 
                    class="krt-editor__sidebarClose"
                    onclick={() => sidebarOpen = false}
                >
                    <ChevronLeft />
                </button>
            </div>

            <div class="krt-editor__sidebarBody" data-open={sidebarOpen}>
                {#if activeTab === 'blocks'}
                        {#if editor}
                            <div class="krt-editor__paletteList">
                                {#each paletteBlocks as block}
                                    <button
                                        class="krt-editor__sidebarItem"
                                        onclick={() => addComponentToEditor(editor, block.component)}
                                    >
                                        <block.icon />
                                        <span>{block.name}</span>
                                    </button>
                                {/each}
                            </div>
                        {:else}
                            <div class="krt-editor__loadingMessage">Editor loading...</div>
                        {/if}
                    {:else if activeTab === 'sections'}
                        {#if editor}
                            <div class="krt-editor__paletteList">
                                {#each Object.entries(sectionDefaults) as [id, section]}
                                    {@const blockDef = getBlock(section.type)}
                                    {#if blockDef}
                                        <button
                                            class="krt-editor__sidebarItem"
                                            onclick={() => addComponentToEditor(editor, blockDef.component, section)}
                                        >
                                            <blockDef.icon />
                                            <span>{blockDef.name}</span>
                                        </button>
                                    {/if}
                                {/each}
                            </div>
                        {:else}
                            <div class="krt-editor__loadingMessage">Editor loading...</div>
                        {/if}
                    {:else if activeTab === 'site'}
                        <div class="krt-editor__sidebarSection">
                            <h3 class="krt-editor__sectionTitle">Headers</h3>
                            <div class="krt-editor__blockGrid">
                                {#each headers as header}
                                    {@const Icon = header.icon}
                                    <button
                                        class="krt-editor__blockButton"
                                        onclick={() => {
                                            if (headerElement) {
                                                addComponentToEditor(headerElement, header.component, { type: header.type });
                                            }
                                        }}
                                    >
                                        <Icon />
                                        <span>{header.name}</span>
                                    </button>
                                {/each}
                            </div>
                            
                            <h3 class="krt-editor__sectionTitle">Footers</h3>
                            <div class="krt-editor__blockGrid">
                                {#each footers as footer}
                                    {@const Icon = footer.icon}
                                    <button
                                        class="krt-editor__blockButton"
                                        onclick={() => {
                                            if (footerElement) {
                                                addComponentToEditor(footerElement, footer.component, { type: footer.type });
                                            }
                                        }}
                                    >
                                        <Icon />
                                        <span>{footer.name}</span>
                                    </button>
                                {/each}
                            </div>
                        </div>
                    {:else if activeTab === 'themes'}
                        <div class="krt-editor__sidebarSection">
                            {#each themeOptions as theme}
                                <button
                                    class={`krt-editor__themeButton ${selectedThemeId === theme.metadata.id ? 'is-active' : ''}`}
                                    onclick={() => applyTheme(theme.metadata.id)}
                                >
                                    <ThemePreview theme={theme} scale={0.35} />
                                    <div class="krt-editor__themeDetails">
                                        <div>{theme.metadata.name}</div>
                                        <p>{theme.metadata.description}</p>
                                    </div>
                                </button>
                            {/each}
                        </div>
                    {:else}
                        <!-- Dynamic plugin rendering -->
                        {#each activePlugins as plugin}
                            {#if activeTab === plugin.id}
                                <plugin.sidebar context={pluginContext} />
                            {/if}
                        {/each}
                    {/if}
                    
                    {#if activeTab === 'navigation'}
                        <div class="krt-editor__sidebarSection">
                            <!-- Header Menu Section -->
                            <div class="krt-editor__navCard">
                                <div class="krt-editor__navCardHeader">
                                    <div class="krt-editor__navCardTitle">
                                        <PanelTop />
                                        <span>Header</span>
                                    </div>
                                    <label>
                                        <input type="checkbox" checked={navState.header.visible} onchange={(e) => toggleHeaderVisible((e.currentTarget as HTMLInputElement).checked)} />
                                        <span>Show</span>
                                    </label>
                                </div>
                                <div class="krt-editor__navCardBody">
                                    <label>
                                        <input type="checkbox" checked={navState.header.useMobileMenuOnDesktop} onchange={(e) => toggleHeaderMobileOnDesktop((e.currentTarget as HTMLInputElement).checked)} />
                                        <span>Mobile menu on desktop</span>
                                    </label>
                                    <div>
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
                            <div class="krt-editor__navCard">
                                <div class="krt-editor__navCardHeader">
                                    <div class="krt-editor__navCardTitle">
                                        <PanelBottom />
                                        <span>Footer</span>
                                    </div>
                                    <label>
                                        <input type="checkbox" checked={navState.footer.visible} onchange={(e) => toggleFooterVisible((e.currentTarget as HTMLInputElement).checked)} />
                                        <span>Show</span>
                                    </label>
                                </div>
                                <div class="krt-editor__navCardBody">
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
                        <div class="krt-editor__settingsPanel">
                            <div>
                                <h3>Page Information</h3>
                                <label>
                                    <span>Page Title</span>
                                    <input 
                                        type="text" 
                                        placeholder="Page title here.." 
                                        bind:value={localPageData.title}
                                        onchange={() => handleTitleEdit(localPageData.title)}
                                    />
                                </label>
                            </div>

                            <div class="krt-editor__divider"></div>

                            <div>
                                <h3>SEO Settings</h3>
                                <div class="krt-editor__formStack">
                                    <label>
                                        <span>Meta Title</span>
                                        <input 
                                            type="text" 
                                            bind:value={localPageData.seoTitle}
                                            placeholder="Meta title here.." 
                                            onchange={() => handleSEOEdit({
                                                seoTitle: localPageData.seoTitle,
                                                seoDescription: localPageData.seoDescription,
                                                slug: localPageData.slug
                                            })}
                                        />
                                    </label>

                                    <label>
                                        <span>Meta Description</span>
                                        <textarea 
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

                                    <label>
                                        <span>Page Slug</span>
                                        <input 
                                            type="text" 
                                            bind:value={localPageData.slug}
                                            placeholder="page-slug-here" 
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
                        <div class="krt-editor__sidebarSection">
                            <div class="krt-editor__sidebarSectionHeader">
                                <h3>Pages</h3>
                                <button
                                    class="krt-editor__ghostButton"
                                    onclick={onCreatePage}
                                    title="Create a new page"
                                >
                                    <Plus />
                                    <span>New</span>
                                </button>
                            </div>
                            
                            {#if pages && pages.length > 0}
                                <div class="krt-editor__pageList">
                                    {#each pages as page (page.id)}
                                        <div class={`krt-editor__pageListItem ${currentPageId === page.id ? 'is-active' : ''}`}>
                                            <div class="krt-editor__pageListItemInner">
                                                <button onclick={() => onPageSwitch?.(page.id)} title={page.title}>
                                                    <div>
                                                        <span>{page.title}</span>
                                                        {#if page.isSpecialPage}
                                                            <span>🏠</span>
                                                        {/if}
                                                    </div>
                                                    <span>/{page.slug}</span>
                                                </button>
                                                <div>
                                                    <button onclick={() => addPageToMenu('header', page)}>+ Header</button>
                                                    <button onclick={() => addPageToMenu('footer', page)}>+ Footer</button>
                                                </div>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            {:else}
                                <div class="krt-editor__emptyState">
                                    <p>No pages yet</p>
                                    <button
                                        class="krt-editor__primaryButton"
                                        onclick={onCreatePage}
                                    >
                                        <Plus />
                                        Create First Page
                                    </button>
                                </div>
                            {/if}
                        </div>
                    {/if}
            </div>
        </div>

        <!-- Main Content Area with Canvas and Right Sidebar -->
        <div class="krt-editor__workspace">
            <!-- Header Toolbar -->
            <div class="krt-editor__toolbar">
                <!-- Left: Page Info -->
                <div class="krt-editor__toolbarSection krt-editor__toolbarSection--title">
                    <div>
                        <span>{localPageData.title}</span>
                        <span>{localPageData.domain}</span>
                    </div>
                </div>

                <!-- Center: Device Size Toggle -->
                <div class="krt-editor__deviceToggle">
                    <button 
                        class={`krt-editor__deviceToggleButton ${activeSize==='phone' ? 'is-active' : ''}`}
                        onclick={() => adjustBrowserSize('phone')}
                        title="Mobile (390px)"
                    >
                        <Smartphone />
                    </button>
                    <button 
                        class={`krt-editor__deviceToggleButton ${activeSize==='tablet' ? 'is-active' : ''}`}
                        onclick={() => adjustBrowserSize('tablet')}
                        title="Tablet (768px)"
                    >
                        <Tablet />
                    </button>
                    <button 
                        class={`krt-editor__deviceToggleButton ${activeSize==='desktop' ? 'is-active' : ''}`}
                        onclick={() => adjustBrowserSize('desktop')}
                        title="Desktop (1440px)"
                    >
                        <Monitor />
                    </button>
                </div>

                <!-- Right: Action Buttons -->
                <div class="krt-editor__toolbarSection krt-editor__toolbarSection--status">
                    <div>
                        <div></div>
                        <span>Auto-saving</span>
                    </div>
                </div>
            </div>

            <!-- Canvas and Right Sidebar Container -->
            <div class="krt-editor__mainPanel">
                <!-- Canvas -->
                <div class="krt-editor__canvasShell">
                    <div
                        class="krt-editor__canvasFrame"
                        style:max-width={activeSize === 'phone' ? '390px' : activeSize === 'tablet' ? '768px' : '1440px'}
                        bind:this={browserMockup}
                    >
                        {#key `${(pageData?.id || pageData?.slug || 'noid')}-${siteHeader?.type || 'none'}-${siteFooter?.type || 'none'}`}
                            <EditorCanvas 
                                bind:editor
                                bind:headerElement
                                bind:footerElement
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
                <div class="krt-editor__inspector" data-open={$rightPanel.open}>
                    {#if $rightPanel.open}
                        <div class="krt-editor__inspectorHeader">
                            <div>
                                <div></div>
                                <h2>{$rightPanel.title}</h2>
                            </div>
                            <button 
                                class="krt-editor__inspectorClose"
                                onclick={closeRightPanel}
                            >
                                <ChevronRight />
                            </button>
                        </div>
                        <div class="krt-editor__inspectorBody">
                            {#if $rightPanel.content}
                                {@render $rightPanel.content()}
                            {/if}
                        </div>
                        <div class="krt-editor__inspectorFooter">
                            <div>Auto-saving...</div>
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    </div>

{/if}

<style>
    .krt-editor {
        --krt-editor-rail-width: 4.25rem;
        --krt-editor-sidebar-width: 24rem;
        --krt-editor-inspector-width: 20rem;
        display: flex;
        min-height: 100vh;
        background: var(--krt-color-bg);
        color: var(--krt-color-text);
    }

    .krt-editor__rail {
        width: var(--krt-editor-rail-width);
        background: #f1f3f7;
        border-right: 1px solid var(--krt-color-border-subtle);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 1rem 0.5rem;
        box-shadow: inset -1px 0 0 rgba(15, 23, 42, 0.05);
    }

    .krt-editor__railButton {
        width: 2.75rem;
        height: 2.75rem;
        border-radius: var(--krt-radius-md);
        border: none;
        background: transparent;
        color: rgba(17, 24, 39, 0.65);
        display: grid;
        place-items: center;
        cursor: pointer;
        transition: background 160ms ease, color 160ms ease, transform 160ms ease;
    }

    .krt-editor__railButton:is(:hover, :focus-visible) {
        background: rgba(15, 23, 42, 0.08);
        color: var(--krt-color-text);
    }

    .krt-editor__railButton.is-active {
        background: var(--krt-color-primary);
        color: #fff;
        box-shadow: 0 6px 16px rgba(15, 23, 42, 0.25);
    }

    .krt-editor__railButton :global(svg) {
        width: 20px;
        height: 20px;
    }

    .krt-editor__sidebar {
        width: 0;
        background: #f8f9fb;
        border-right: 1px solid var(--krt-color-border-subtle);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transition: width 220ms ease;
    }

    .krt-editor__sidebar[data-open="true"] {
        width: var(--krt-editor-sidebar-width);
    }

    .krt-editor__sidebarHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--krt-color-border-subtle);
        background: #fff;
        flex-shrink: 0;
    }

    .krt-editor__sidebarHeader h2 {
        font-size: 0.9rem;
        margin: 0;
    }

    .krt-editor__sidebarClose {
        border: none;
        border-radius: var(--krt-radius-sm);
        background: transparent;
        color: rgba(17, 24, 39, 0.6);
        padding: 0.25rem;
        cursor: pointer;
    }

    .krt-editor__sidebarClose:is(:hover, :focus-visible) {
        background: rgba(15, 23, 42, 0.08);
        color: var(--krt-color-text);
    }

    .krt-editor__sidebarBody {
        flex: 1;
        overflow-y: auto;
        opacity: 0;
        transition: opacity 200ms ease;
    }

    .krt-editor__sidebarBody[data-open="true"] {
        opacity: 1;
    }

    .krt-editor__sidebarItem {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem;
        border: none;
        width: 100%;
        text-align: left;
        background: transparent;
        color: var(--krt-color-text);
        border-radius: var(--krt-radius-md);
        cursor: pointer;
        transition: background 160ms ease;
    }

    .krt-editor__sidebarItem:is(:hover, :focus-visible) {
        background: rgba(15, 23, 42, 0.08);
    }

    .krt-editor__sidebarItem :global(svg) {
        width: 18px;
        height: 18px;
        color: rgba(17, 24, 39, 0.5);
    }

    .krt-editor__paletteList {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        padding: 0.5rem;
    }

    .krt-editor__loadingMessage {
        padding: 1rem;
        text-align: center;
        font-size: 0.85rem;
        color: rgba(17, 24, 39, 0.55);
    }

    .krt-editor__sidebarList,
    .krt-editor__sidebarSection {
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }


    .krt-editor__sectionLabel {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.75rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(17, 24, 39, 0.55);
    }

    .krt-editor__sectionLabel :global(svg) {
        width: 16px;
        height: 16px;
        color: var(--krt-color-primary);
    }

    .krt-editor__themeButton {
        border: none;
        border-radius: var(--krt-radius-md);
        background: #fff;
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
        padding: 0.75rem;
        text-align: left;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        cursor: pointer;
        transition: transform 160ms ease, box-shadow 160ms ease, border 160ms ease;
    }

    .krt-editor__themeButton.is-active {
        border: 1px solid var(--krt-color-primary);
        box-shadow: 0 10px 25px rgba(15, 23, 42, 0.15);
    }

    .krt-editor__themeDetails {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        font-size: 0.85rem;
    }

    .krt-editor__themeButton p {
        margin: 0;
        font-size: 0.8rem;
        color: rgba(17, 24, 39, 0.6);
    }

    .krt-editor__settingsPanel {
        padding: 0.75rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .krt-editor__navCard {
        border: 1px solid var(--krt-color-border-subtle);
        border-radius: var(--krt-radius-md);
        background: #fff;
    }

    .krt-editor__navCardHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--krt-color-border-subtle);
        background: #f4f6fb;
    }

    .krt-editor__navCardTitle {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        font-weight: 600;
    }

    .krt-editor__navCardHeader label {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.8rem;
        color: rgba(17, 24, 39, 0.65);
    }

    .krt-editor__navCardBody {
        padding: 0.75rem 1rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .krt-editor__navCardBody label {
        display: flex;
        gap: 0.4rem;
        font-size: 0.8rem;
        color: rgba(17, 24, 39, 0.7);
    }

    .krt-editor__divider {
        height: 1px;
        background: var(--krt-color-border-subtle);
        margin: 0.75rem 0;
    }

    .krt-editor__formStack label {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        font-size: 0.8rem;
        color: rgba(17, 24, 39, 0.7);
    }

    .krt-editor__formStack input,
    .krt-editor__formStack textarea,
    .krt-editor__sidebarSection input[type="text"] {
        border-radius: var(--krt-radius-sm);
        border: 1px solid var(--krt-color-border-subtle);
        padding: 0.4rem 0.6rem;
        font-size: 0.85rem;
    }

    .krt-editor__sidebarSectionHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
    }

    .krt-editor__ghostButton {
        border: 1px solid var(--krt-color-border-subtle);
        background: transparent;
        border-radius: var(--krt-radius-sm);
        font-size: 0.8rem;
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.3rem 0.6rem;
        cursor: pointer;
    }

    .krt-editor__ghostButton :global(svg) {
        width: 14px;
        height: 14px;
    }

    .krt-editor__pageList {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .krt-editor__pageListItem {
        background: #f2f4f8;
        border-radius: var(--krt-radius-md);
        padding: 0.6rem;
        transition: background 160ms ease, color 160ms ease;
    }

    .krt-editor__pageListItem.is-active {
        background: var(--krt-color-primary);
        color: #fff;
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.2);
    }

    .krt-editor__pageListItemInner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
    }

    .krt-editor__pageListItemInner button {
        border: none;
        background: transparent;
        text-align: left;
        flex: 1;
        cursor: pointer;
    }

    .krt-editor__pageListItemInner button span:last-child {
        display: block;
        font-size: 0.75rem;
        opacity: 0.7;
    }

    .krt-editor__pageListItemInner > div:last-child {
        display: flex;
        gap: 0.25rem;
    }

    .krt-editor__pageListItemInner > div:last-child button {
        border: 1px dashed rgba(255, 255, 255, 0.4);
        border-radius: var(--krt-radius-pill);
        padding: 0.2rem 0.6rem;
        font-size: 0.7rem;
        color: inherit;
    }

    .krt-editor__emptyState {
        text-align: center;
        padding: 2.5rem 1rem;
        color: rgba(17, 24, 39, 0.6);
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .krt-editor__primaryButton {
        border: none;
        border-radius: var(--krt-radius-pill);
        background: var(--krt-color-primary);
        color: #fff;
        padding: 0.5rem 1rem;
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        cursor: pointer;
    }

    .krt-editor__workspace {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    .krt-editor__toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.85rem 1.5rem;
        border-bottom: 1px solid var(--krt-color-border-subtle);
        background: #fff;
        flex-shrink: 0;
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
    }

    .krt-editor__toolbarSection {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .krt-editor__toolbarSection--title span:first-child {
        font-weight: 600;
        display: block;
    }

    .krt-editor__toolbarSection--title span:last-child {
        font-size: 0.8rem;
        color: rgba(17, 24, 39, 0.6);
    }

    .krt-editor__deviceToggle {
        display: inline-flex;
        background: #f2f4f8;
        border-radius: var(--krt-radius-pill);
        padding: 0.25rem;
        border: 1px solid var(--krt-color-border-subtle);
        gap: 0.25rem;
    }

    .krt-editor__deviceToggleButton {
        border: none;
        background: transparent;
        border-radius: var(--krt-radius-pill);
        width: 2.5rem;
        height: 2rem;
        display: grid;
        place-items: center;
        cursor: pointer;
        color: rgba(17, 24, 39, 0.6);
    }

    .krt-editor__deviceToggleButton.is-active {
        background: var(--krt-color-primary);
        color: #fff;
        box-shadow: 0 8px 18px rgba(15, 23, 42, 0.2);
    }

    .krt-editor__mainPanel {
        flex: 1;
        display: flex;
        min-height: 0;
    }

    .krt-editor__canvasShell {
        flex: 1;
        background: #eef1f6;
        overflow: auto;
        padding: 1.5rem;
    }

    .krt-editor__canvasFrame {
        margin: 0 auto;
        width: 100%;
        transition: max-width 200ms ease;
    }

    .krt-editor__inspector {
        width: 0;
        background: #f8f9fb;
        border-left: 1px solid var(--krt-color-border-subtle);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transition: width 220ms ease;
        box-shadow: inset 1px 0 0 rgba(15, 23, 42, 0.05);
    }

    .krt-editor__inspector[data-open="true"] {
        width: var(--krt-editor-inspector-width);
    }

    .krt-editor__inspectorHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.85rem 1rem;
        border-bottom: 1px solid var(--krt-color-border-subtle);
        background: #fff;
        flex-shrink: 0;
        gap: 0.75rem;
    }

    .krt-editor__inspectorHeader > div {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .krt-editor__inspectorHeader > div div {
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 999px;
        background: #10b981;
        animation: pulse 1.5s ease infinite;
    }

    .krt-editor__inspectorClose {
        border: none;
        background: transparent;
        border-radius: var(--krt-radius-sm);
        padding: 0.35rem;
        cursor: pointer;
        color: rgba(17, 24, 39, 0.6);
    }

    .krt-editor__inspectorBody {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .krt-editor__inspectorFooter {
        padding: 0.75rem;
        border-top: 1px solid var(--krt-color-border-subtle);
        background: #fff;
        text-align: center;
        font-size: 0.8rem;
        color: rgba(17, 24, 39, 0.6);
    }

    @keyframes pulse {
        0% { opacity: 0.4; }
        50% { opacity: 1; }
        100% { opacity: 0.4; }
    }

    /* ===== FORM CONTROLS ===== */
    .krt-editor__formControls {
        padding: 0 1rem 1rem 1rem;
    }

    .krt-editor__formLabel {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        font-size: 0.875rem;
    }

    .krt-editor__formLabel > span {
        font-weight: 500;
        color: rgba(17, 24, 39, 0.8);
        font-size: 0.75rem;
    }

    .krt-editor__select {
        width: 100%;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
        color: #1f2937;
        background: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 0.375rem;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;
    }

    .krt-editor__select:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .krt-editor__dangerButton {
        width: 100%;
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: #dc2626;
        background: transparent;
        border: 1px solid rgba(220, 38, 38, 0.3);
        border-radius: 0.375rem;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;
    }

    .krt-editor__dangerButton:hover {
        background: rgba(220, 38, 38, 0.1);
        border-color: #dc2626;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.1);
    }

    .krt-editor__dangerButton:active {
        transform: translateY(0);
    }
</style>
