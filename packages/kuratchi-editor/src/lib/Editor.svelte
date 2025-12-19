<script lang="ts">
    import { onMount, onDestroy, tick, setContext } from "svelte";
    import type { EditorOptions, EditorState, PageData, SiteRegionState } from "./types.js";
    import { defaultEditorOptions, defaultPageData } from "./types.js";
    import { blocks, getEnabledPlugins } from "./registry";
    import { sections, getSection } from "./registry/sections.svelte";
    import { headers } from "./registry/headers.svelte";
    import { footers } from "./registry/footers.svelte";
    import { saveEditorHeaderBlocks, saveEditorFooterBlocks } from "./utils/editor.svelte";
    import { rightPanel, closeRightPanel } from "./stores/right-panel";
    import { headingStore, sideBarStore } from "./stores/ui";
    import EditorCanvas from "./EditorCanvas.svelte";
    import SectionPreview from "./sections/SectionPreview.svelte";
    import { getAllThemes, getThemeTemplate, DEFAULT_THEME_ID } from "./themes";
    import {
        ChevronLeft,
        ChevronRight,
        Monitor,
        Smartphone,
        Tablet,
        PanelsTopLeft
    } from "@lucide/svelte";
    import { blockRegistry } from "./stores/editorSignals.svelte.js";
    import { createPluginManager, type PluginManager } from "./plugins/manager";
    import type { NavigationState, ThemeSettings } from "./plugins/context";
import { DEFAULT_THEME_SETTINGS } from "./plugins/context";

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
        onStateUpdate,
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
        onPageCreate,
        enabledPlugins
    }: Props = $props();

    console.log('[Editor] Component initialized with callbacks:', {
        onSiteHeaderUpdate: !!onSiteHeaderUpdate,
        onSiteFooterUpdate: !!onSiteFooterUpdate,
        onSiteMetadataUpdate: !!onSiteMetadataUpdate,
        onStateUpdate: !!onStateUpdate
    });

    const getPageList = () => Array.isArray(pages) ? pages : [];

    // Local mutable state for the page data
    let localPageData = $state<PageData>({ ...defaultPageData, ...pageData });

    // UI state
    let sidebarOpen = $state(false);
    let activeTab = $state('sections');
    let sectionSearch = $state('');

    // Filtered sections based on search
    const filteredSections = $derived(
        sectionSearch.trim() === ''
            ? sections
            : sections.filter(s => 
                s.name.toLowerCase().includes(sectionSearch.toLowerCase()) ||
                s.description?.toLowerCase().includes(sectionSearch.toLowerCase())
            )
    );
    let browserMockup: HTMLDivElement;
    let activeSize = $state(initialDeviceSize);
    let headerElement = $state<HTMLElement | undefined>(undefined);
    let footerElement = $state<HTMLElement | undefined>(undefined);
    const themeOptions = getAllThemes();
    let selectedThemeId = $state((siteMetadata as any)?.themeId || DEFAULT_THEME_ID);
    
    // Theme settings state - loaded from siteMetadata or defaults
    let themeSettings = $state<ThemeSettings>({
        ...DEFAULT_THEME_SETTINGS,
        ...((siteMetadata as any)?.themeSettings || {})
    });

    // Provide siteMetadata context for sections that need it (ContactCTA, Modal, Catalog sections, Headers, Footers, etc.)
    // We need to use a reactive getter so sections always get the latest metadata
    const siteMetadataContext = {
        get forms() { return (siteMetadata as any)?.forms || []; },
        get themeId() { return (siteMetadata as any)?.themeId; },
        get backgroundColor() { return (siteMetadata as any)?.backgroundColor; },
        get blog() { return (siteMetadata as any)?.blog; },
        get catalogOems() { return (siteMetadata as any)?.catalogOems || []; },
        get catalogVehicles() { return (siteMetadata as any)?.catalogVehicles || []; },
        get navigation() { return (siteMetadata as any)?.navigation || { header: { visible: true, items: [] }, footer: { visible: true, items: [] } }; }
    };
    setContext('siteMetadata', siteMetadataContext);

    // Plugin system
    const activePlugins = getEnabledPlugins(enabledPlugins);

    const randomId = () => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2));

    /**
     * Add a block or section to the editor via the content array.
     * This prevents the infinite loop bug that occurs when using addComponentToEditor
     * which directly mounts to DOM and triggers observer -> content sync -> re-render loop.
     */
    const addBlockToContent = (type: string, props: Record<string, unknown> = {}) => {
        const newBlock = {
            id: randomId(),
            type,
            ...props
        };
        localPageData.content = [...localPageData.content, newBlock];
        triggerSave();
        triggerStateSave();
    };

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
    let headerSaveTimeout: ReturnType<typeof setTimeout> | undefined;
    let footerSaveTimeout: ReturnType<typeof setTimeout> | undefined;
    let stateSaveTimeout: ReturnType<typeof setTimeout> | undefined;

    // Debounced save function
    const triggerSave = () => {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            if (onUpdate) {
                await onUpdate(localPageData);
            }
        }, autoSaveDelay);
    };

    const triggerStateSave = () => {
        if (!onStateUpdate) return;
        if (stateSaveTimeout) clearTimeout(stateSaveTimeout);
        stateSaveTimeout = setTimeout(async () => {
            const snapshot: EditorState = {
                page: localPageData,
                header: siteHeader,
                footer: siteFooter,
                metadata: siteMetadata
            };
            await onStateUpdate(snapshot);
        }, autoSaveDelay);
    };

    // Debounced header save
    const triggerHeaderSave = () => {
        console.log('[Editor] triggerHeaderSave: debouncing save for', autoSaveDelay, 'ms');
        if (!onSiteHeaderUpdate) {
            console.log('[Editor] triggerHeaderSave: no onSiteHeaderUpdate callback');
            return;
        }
        if (headerSaveTimeout) clearTimeout(headerSaveTimeout);
        headerSaveTimeout = setTimeout(async () => {
            console.log('[Editor] triggerHeaderSave: executing save with siteHeader:', siteHeader);
            console.log('[Editor] triggerHeaderSave: calling onSiteHeaderUpdate');
            await onSiteHeaderUpdate(siteHeader);
            console.log('[Editor] triggerHeaderSave: onSiteHeaderUpdate completed');
        }, autoSaveDelay);
    };

    // Debounced footer save
    const triggerFooterSave = () => {
        console.log('[Editor] triggerFooterSave: debouncing save for', autoSaveDelay, 'ms');
        if (!onSiteFooterUpdate) {
            console.log('[Editor] triggerFooterSave: no onSiteFooterUpdate callback');
            return;
        }
        if (footerSaveTimeout) clearTimeout(footerSaveTimeout);
        footerSaveTimeout = setTimeout(async () => {
            console.log('[Editor] triggerFooterSave: executing save with siteFooter:', siteFooter);
            console.log('[Editor] triggerFooterSave: calling onSiteFooterUpdate');
            await onSiteFooterUpdate(siteFooter);
            console.log('[Editor] triggerFooterSave: onSiteFooterUpdate completed');
        }, autoSaveDelay);
    };

    // Handle changes from EditorCanvas
    const handleContentChange = (content: Array<Record<string, unknown>>) => {
        localPageData.content = content;
        triggerSave();
        triggerStateSave();
    };

    const handleHeaderChange = (next: SiteRegionState | null) => {
        console.log('[Editor] handleHeaderChange called with:', next);
        siteHeader = next;
        console.log('[Editor] handleHeaderChange: updated siteHeader, triggering save');
        triggerHeaderSave();
        triggerStateSave();
    };

    const handleFooterChange = (next: SiteRegionState | null) => {
        console.log('[Editor] handleFooterChange called with:', next);
        siteFooter = next;
        console.log('[Editor] handleFooterChange: updated siteFooter, triggering save');
        triggerFooterSave();
        triggerStateSave();
    };


    const syncHeaderRegion = async () => {
        console.log('[Editor] syncHeaderRegion called');
        if (!headerElement) {
            console.log('[Editor] syncHeaderRegion: no headerElement');
            return;
        }
        // Wait for component to mount and render its metadata div
        await tick();
        await new Promise(resolve => setTimeout(resolve, 100));
        const blocks = await saveEditorHeaderBlocks(headerElement);
        console.log('[Editor] syncHeaderRegion: extracted blocks:', blocks);
        const next = blocks.length > 0 ? ({ blocks: blocks as any } satisfies SiteRegionState) : null;
        console.log('[Editor] syncHeaderRegion: calling handleHeaderChange with:', next);
        handleHeaderChange(next);
    };

    const syncFooterRegion = async () => {
        console.log('[Editor] syncFooterRegion called');
        if (!footerElement) {
            console.log('[Editor] syncFooterRegion: no footerElement');
            return;
        }
        // Wait for component to mount and render its metadata div
        await tick();
        await new Promise(resolve => setTimeout(resolve, 100));
        const blocks = await saveEditorFooterBlocks(footerElement);
        console.log('[Editor] syncFooterRegion: extracted blocks:', blocks);
        const next = blocks.length > 0 ? ({ blocks: blocks as any } satisfies SiteRegionState) : null;
        console.log('[Editor] syncFooterRegion: calling handleFooterChange with:', next);
        handleFooterChange(next);
    };

    const mountHeaderComponent = async (component: any, props: Record<string, unknown> = {}) => {
        console.log('[Editor] mountHeaderComponent called with props:', props);
        if (!headerElement) {
            console.log('[Editor] mountHeaderComponent: no headerElement');
            return;
        }
        
        // Find the header type from registry
        const headerDef = headers.find(h => h.component === component);
        const type = (headerDef?.type ?? props.type ?? 'unknown') as string;
        
        // Update siteHeader state directly - let EditorCanvas #each loop render it
        // This prevents DOM conflicts between replaceRegionComponent and Svelte's rendering
        blockRegistry.clearRegion('header');
        const headerBlock = { type, ...props, editable: true };
        siteHeader = { blocks: [headerBlock as any] };
        
        // Trigger save callbacks
        triggerHeaderSave();
        triggerStateSave();
    };

    const mountFooterComponent = async (component: any, props: Record<string, unknown> = {}) => {
        console.log('[Editor] mountFooterComponent called with props:', props);
        if (!footerElement) {
            console.log('[Editor] mountFooterComponent: no footerElement');
            return;
        }
        
        // Find the footer type from registry
        const footerDef = footers.find(f => f.component === component);
        const type = (footerDef?.type ?? props.type ?? 'unknown') as string;
        
        // Update siteFooter state directly - let EditorCanvas #each loop render it
        // This prevents DOM conflicts between replaceRegionComponent and Svelte's rendering
        blockRegistry.clearRegion('footer');
        const footerBlock = { type, ...props, editable: true };
        siteFooter = { blocks: [footerBlock as any] };
        
        // Trigger save callbacks
        triggerFooterSave();
        triggerStateSave();
    };

    const applyTheme = async (themeId: string) => {
        const template = getThemeTemplate(themeId);
        selectedThemeId = themeId;
        const homepage = template.defaultHomepage;

        // Mount header component (this clears the registry internally)
        if (template.header) {
            await mountHeaderComponent(template.header);
        }

        // Mount footer component (this clears the registry internally)
        if (template.footer) {
            await mountFooterComponent(template.footer);
        }

        // Convert theme components to content blocks
        // Theme templates store component references, so we need to map them to type strings
        if (homepage.content) {
            blockRegistry.clearRegion('content');
            const newContent: Array<Record<string, unknown>> = [];
            
            for (const component of homepage.content) {
                // Try to find the type from sections registry first, then blocks
                const sectionDef = sections.find(s => s.component === component);
                const blockDef = blocks.find(b => b.component === component);
                const type = sectionDef?.type ?? blockDef?.type;
                
                if (type) {
                    newContent.push({
                        id: randomId(),
                        type,
                        editable: true
                    });
                }
            }
            
            localPageData.content = newContent;
        }

        // Update local page data with theme homepage info
        localPageData = {
            ...localPageData,
            title: homepage.title,
            seoTitle: homepage.seoTitle,
            seoDescription: homepage.seoDescription,
            slug: homepage.slug
        };

        // Reset theme settings to defaults when applying a new theme
        themeSettings = { ...DEFAULT_THEME_SETTINGS };
        siteMetadata = { ...(template.siteMetadata || {}), themeId, themeSettings };

        if (onSiteMetadataUpdate) {
            await onSiteMetadataUpdate(siteMetadata);
        }
        triggerSave();
        triggerStateSave();

        navState = ensureNavigation();
    };

    /**
     * Switch theme without replacing content.
     * Only updates styles and optionally header/footer.
     */
    const switchTheme = async (themeId: string, options?: { updateHeaderFooter?: boolean }) => {
        const template = getThemeTemplate(themeId);
        selectedThemeId = themeId;

        // Optionally update header/footer to match new theme
        if (options?.updateHeaderFooter) {
            if (template.header) {
                await mountHeaderComponent(template.header);
            }
            if (template.footer) {
                await mountFooterComponent(template.footer);
            }
        }

        // Update theme ID but preserve existing content and settings
        siteMetadata = { ...siteMetadata, themeId };

        if (onSiteMetadataUpdate) {
            await onSiteMetadataUpdate(siteMetadata);
        }
        triggerStateSave();
    };

    /**
     * Update individual theme settings.
     * These are applied as CSS variables for live preview.
     */
    const updateThemeSettings = async (settings: Partial<ThemeSettings>) => {
        themeSettings = { ...themeSettings, ...settings };
        siteMetadata = { ...siteMetadata, themeSettings };

        if (onSiteMetadataUpdate) {
            await onSiteMetadataUpdate(siteMetadata);
        }
        triggerStateSave();
    };

    /**
     * Reset theme settings to defaults.
     */
    const resetThemeSettings = async () => {
        themeSettings = { ...DEFAULT_THEME_SETTINGS };
        siteMetadata = { ...siteMetadata, themeSettings };

        if (onSiteMetadataUpdate) {
            await onSiteMetadataUpdate(siteMetadata);
        }
        triggerStateSave();
    };

    const adjustBrowserSize = (size: 'phone' | 'tablet' | 'desktop') => {
        activeSize = size;
    }

    const handleSave = async () => {
        if (onUpdate) {
            await onUpdate(localPageData);
        }
        triggerStateSave();
    }

    const handleTitleEdit = async (title: string) => {
        localPageData.title = title;
        $headingStore = title || '';
        triggerSave();
        triggerStateSave();
    }

    const handleSEOEdit = async (seo: { seoTitle: string; seoDescription: string; slug: string }) => {
        localPageData = { ...localPageData, ...seo };
        triggerSave();
        triggerStateSave();
    }

    onMount(() => {
        blockRegistry.clearRegion('header');
        blockRegistry.clearRegion('footer');
        blockRegistry.clearRegion('content');
        $sideBarStore = false;
        $headingStore = localPageData.title || '';
        
        // Initialize plugins with the plugin manager
        pluginManager.init(activePlugins as any);
    });


    onDestroy(() => {
        $sideBarStore = true;
        if (saveTimeout) clearTimeout(saveTimeout);
        if (headerSaveTimeout) clearTimeout(headerSaveTimeout);
        if (footerSaveTimeout) clearTimeout(footerSaveTimeout);
        if (stateSaveTimeout) clearTimeout(stateSaveTimeout);
        
        // Cleanup plugins
        pluginManager.destroy(activePlugins as any);
    });

    // ----- Navigation State -----
    // Navigation state is used by EditorCanvas for rendering
    // Includes both menu items (from Dashboard CRUD) and settings (from Navigation plugin)
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

    function ensureNavigation(): NavigationState {
        const nav = (siteMetadata as any)?.navigation || {};
        const navSettings = (siteMetadata as any)?.navigationSettings || {};
        const seededHeaderItems = (nav.header?.items && nav.header.items.length > 0)
            ? nav.header.items
            : extractMenu(siteHeader);
        const seededFooterItems = (nav.footer?.items && nav.footer.items.length > 0)
            ? nav.footer.items
            : extractMenu(siteFooter);
        
        // Merge navigation settings into header/footer state
        const headerSettings = navSettings.header || {};
        const footerSettings = navSettings.footer || {};
        
        return {
            header: { 
                ...navDefaults.header, 
                ...(nav.header || {}), 
                items: seededHeaderItems,
                // Navigation settings from plugin
                dropdownTrigger: headerSettings.dropdownTrigger,
                dropdownAlign: headerSettings.dropdownAlign,
                submenuDirection: headerSettings.submenuDirection,
                hoverBgColor: headerSettings.hoverBgColor,
                hoverTextColor: headerSettings.hoverTextColor,
                dropdownBgColor: headerSettings.dropdownBgColor,
                dropdownTextColor: headerSettings.dropdownTextColor,
                dropdownHoverBgColor: headerSettings.dropdownHoverBgColor,
                dropdownHoverTextColor: headerSettings.dropdownHoverTextColor,
                mobileNavStyle: headerSettings.mobileNavStyle,
                mobileDrawerPosition: headerSettings.mobileDrawerPosition,
            },
            footer: { 
                ...navDefaults.footer, 
                ...(nav.footer || {}), 
                items: seededFooterItems,
                visible: footerSettings.visible ?? true,
            },
            custom: { ...(nav.custom || {}) }
        };
    }

    // Make navState reactive to siteMetadata changes
    let navState = $derived(ensureNavigation());

    async function saveNavigation(nextNav: NavigationState) {
        console.log('[Editor] saveNavigation called with:', nextNav);
        // Update siteMetadata which will trigger navState to recompute via $derived
        siteMetadata = { ...(siteMetadata || {}), navigation: nextNav };
        console.log('[Editor] siteMetadata updated:', siteMetadata);
        if (onSiteMetadataUpdate) {
            console.log('[Editor] calling onSiteMetadataUpdate');
            await onSiteMetadataUpdate(siteMetadata);
        }
        console.log('[Editor] triggering state save');
        triggerStateSave();
    }

    // ----- Plugin Manager Setup -----
    // Create the plugin manager with all editor capabilities
    const pluginManager: PluginManager = createPluginManager({
        // Core state getters
        getCurrentPage: () => ({
            title: localPageData.title ?? '',
            slug: localPageData.slug ?? '',
            seoTitle: localPageData.seoTitle,
            seoDescription: localPageData.seoDescription,
            content: localPageData.content ?? []
        }),
        getPages: () => getPageList().map(p => ({
            id: (p as any).id ?? '',
            name: (p as any).name ?? (p as any).title ?? '',
            slug: (p as any).slug ?? ''
        })),
        getReservedPages: () => (reservedPages ?? []).map(p => (p as any).slug ?? ''),
        getCurrentPageId: () => currentPageId ?? null,
        getSiteMetadata: () => siteMetadata ?? {},
        getEditor: () => editor ?? null,
        
        // Core actions
        updatePageTitle: handleTitleEdit,
        updatePageSEO: (seo) => handleSEOEdit({
            seoTitle: seo.seoTitle ?? localPageData.seoTitle ?? '',
            seoDescription: seo.seoDescription ?? localPageData.seoDescription ?? '',
            slug: seo.slug ?? localPageData.slug ?? ''
        }),
        updateSiteMetadata: async (updates: Record<string, unknown>) => {
            siteMetadata = { ...siteMetadata, ...updates };
            if (onSiteMetadataUpdate) {
                await onSiteMetadataUpdate(siteMetadata);
            }
            triggerStateSave();
        },
        switchPage: (pageId: string) => onPageSwitch?.(pageId),
        createPage: async (data: { title: string; slug: string }) => {
            if (!onPageCreate) return null;
            try {
                const result = await onPageCreate(data);
                return result;
            } catch (err) {
                console.error('[Editor] Failed to create page:', err);
                return null;
            }
        },
        addBlock: addBlockToContent,
        
        // Navigation extension
        navigation: {
            getState: () => navState,
            save: saveNavigation,
            genId: randomId
        },
        
        // Site layout extension  
        siteLayout: {
            headerPresets: headers.map(h => ({ type: h.type, name: h.name, component: h.component })),
            footerPresets: footers.map(f => ({ type: f.type, name: f.name, component: f.component })),
            getHeaderType: () => (siteHeader?.blocks?.[0] as any)?.type ?? null,
            getFooterType: () => (siteFooter?.blocks?.[0] as any)?.type ?? null,
            mountHeader: mountHeaderComponent,
            mountFooter: mountFooterComponent
        },
        
        // Themes extension
        themes: {
            list: themeOptions,
            getSelectedId: () => selectedThemeId,
            getSettings: () => themeSettings,
            apply: applyTheme,
            switch: switchTheme,
            updateSettings: updateThemeSettings,
            resetSettings: resetThemeSettings
        }
    });

    // Get the plugin context for plugins
    const getPluginContext = () => pluginManager.ctx;


</script>

{#if !showUI}
    <!-- Canvas-only mode for simple embedding -->
    <EditorCanvas
        bind:editor
        bind:headerElement
        bind:footerElement
        content={localPageData.content}
        backgroundColor={(siteMetadata?.backgroundColor as string) || '#000000'}
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
        {themeSettings}
    />
{:else}
    <!-- Full editor UI -->
    <div class="krt-editor">
        <!-- Left Icon Bar -->
        <div class="krt-editor__rail">
            <button
                class={`krt-editor__railButton ${activeTab === 'sections' ? 'is-active' : ''}`}
                onclick={() => toggleSidebar('sections')}
                title="Sections"
            >
                <PanelsTopLeft />
                <span class="krt-editor__railLabel">Sections</span>
            </button>
            {#each activePlugins as plugin}
                <button
                    class={`krt-editor__railButton ${activeTab === plugin.id ? 'is-active' : ''}`}
                    onclick={() => toggleSidebar(plugin.id)}
                    title={plugin.railButton?.title ?? plugin.name}
                >
                    <plugin.icon />
                    <span class="krt-editor__railLabel">{plugin.railButton?.title ?? plugin.name}</span>
                </button>
            {/each}
        </div>

        <!-- Collapsible Sidebar -->
        <div class="krt-editor__sidebar" data-open={sidebarOpen}>
            <div class="krt-editor__sidebarHeader">
                <h2>
                    {activeTab === 'sections' ? 'Sections' :
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
                {#if activeTab === 'sections'}
                        {#if editor}
                            <div class="krt-editor__sidebarSection">
                                <input
                                    type="text"
                                    placeholder="Search sections..."
                                    bind:value={sectionSearch}
                                    class="krt-editor__searchInput"
                                />
                                {#each filteredSections as section}
                                    <button
                                        class="krt-editor__themeButton"
                                        onclick={() => addBlockToContent(section.type, { editable: true })}
                                    >
                                        <SectionPreview component={section.component} scale={0.18} />
                                        <div class="krt-editor__themeDetails">
                                            <div>{section.name}</div>
                                            <p>{section.description}</p>
                                        </div>
                                    </button>
                                {:else}
                                    <div class="krt-editor__emptySearch">No sections match "{sectionSearch}"</div>
                                {/each}
                            </div>
                        {:else}
                            <div class="krt-editor__loadingMessage">Editor loading...</div>
                        {/if}
                    {:else}
                        <!-- Dynamic plugin rendering -->
                        {#each activePlugins as plugin}
                            {#if activeTab === plugin.id}
                                <plugin.sidebar ctx={getPluginContext()} />
                            {/if}
                        {/each}
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
                        {#key `${(pageData?.id || pageData?.slug || 'noid')}-${(siteHeader?.blocks?.[0] as any)?.type || 'none'}-${(siteFooter?.blocks?.[0] as any)?.type || 'none'}`}
                            <EditorCanvas
                                bind:editor
                                bind:headerElement
                                bind:footerElement
                                content={localPageData.content}
                                backgroundColor={(siteMetadata?.backgroundColor as string) || '#000000'}
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
                                {themeSettings}
                                forcedViewport={activeSize}
                            />
                        {/key}
                    </div>
                </div>
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
{/if}

<style>
    .krt-editor {
        --krt-editor-rail-width: 4.25rem;
        --krt-editor-sidebar-width: 24rem;
        --krt-editor-inspector-width: 24rem;

        /* Unified color palette */
        --krt-editor-bg: #ffffff;
        --krt-editor-surface: #f8fafc;
        --krt-editor-surface-hover: #f1f5f9;
        --krt-editor-border: #e2e8f0;
        --krt-editor-border-subtle: #f1f5f9;
        --krt-editor-text-primary: #0f172a;
        --krt-editor-text-secondary: #64748b;
        --krt-editor-text-muted: #94a3b8;
        --krt-editor-accent: #3b82f6;
        --krt-editor-accent-hover: #2563eb;
        --krt-editor-shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
        --krt-editor-shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        --krt-editor-shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
        --krt-editor-radius-sm: 0.375rem;
        --krt-editor-radius-md: 0.5rem;
        --krt-editor-radius-lg: 0.75rem;
        --krt-editor-divider: #d1d5db;

        display: flex;
        height: 100vh;
        overflow: hidden;
        background: var(--krt-editor-bg);
        color: var(--krt-editor-text-primary);
        border: 1px solid var(--krt-editor-divider);
    }

    .krt-editor__rail {
        width: var(--krt-editor-rail-width);
        background: var(--krt-editor-bg);
        border-right: 2px solid var(--krt-editor-divider);
        box-shadow: 1px 0 0 rgba(0, 0, 0, 0.02);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 1rem 0.5rem;
        position: relative;
        z-index: 10;
    }

    .krt-editor__railButton {
        width: 3.5rem;
        min-height: 3.5rem;
        padding: 0.5rem 0.25rem;
        border-radius: var(--krt-editor-radius-md);
        border: 1px solid transparent;
        background: transparent;
        color: var(--krt-editor-text-secondary);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.125rem;
        cursor: pointer;
        transition: all 180ms cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
    }

    .krt-editor__railButton:is(:hover, :focus-visible) {
        background: var(--krt-editor-surface-hover);
        color: var(--krt-editor-text-primary);
        border-color: var(--krt-editor-border);
        transform: translateY(-1px);
        box-shadow: var(--krt-editor-shadow-sm);
    }

    .krt-editor__railButton.is-active {
        background: var(--krt-editor-accent);
        color: #ffffff;
        border-color: var(--krt-editor-accent);
        box-shadow: var(--krt-editor-shadow-md);
        transform: translateY(-1px);
    }

    .krt-editor__railButton.is-active::before {
        content: '';
        position: absolute;
        inset: -2px;
        border-radius: var(--krt-editor-radius-lg);
        background: linear-gradient(135deg, var(--krt-editor-accent), var(--krt-editor-accent-hover));
        opacity: 0.1;
        z-index: -1;
    }

    .krt-editor__railButton :global(svg) {
        width: 20px;
        height: 20px;
    }

    .krt-editor__railLabel {
        font-size: 0.625rem;
        font-weight: 500;
        margin-top: 0.25rem;
        text-align: center;
        line-height: 1.2;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .krt-editor__searchInput {
        width: 100%;
        padding: 0.625rem 0.875rem;
        border: 1px solid var(--krt-editor-border, #e2e8f0);
        border-radius: var(--krt-editor-radius-md, 0.5rem);
        background: var(--krt-editor-surface, #f8fafc);
        font-size: 0.875rem;
        color: var(--krt-editor-text-primary, #0f172a);
        transition: border-color 150ms ease, box-shadow 150ms ease;
        margin-bottom: 0.75rem;
    }

    .krt-editor__searchInput::placeholder {
        color: var(--krt-editor-text-muted, #94a3b8);
    }

    .krt-editor__searchInput:focus {
        outline: none;
        border-color: var(--krt-editor-accent, #3b82f6);
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
    }

    .krt-editor__emptySearch {
        padding: 1.5rem 1rem;
        text-align: center;
        color: var(--krt-editor-text-muted, #94a3b8);
        font-size: 0.875rem;
    }

    .krt-editor__sidebar {
        width: 0;
        background: var(--krt-editor-bg);
        border-right: 2px solid var(--krt-editor-divider);
        box-shadow: 2px 0 4px rgba(0, 0, 0, 0.03);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transition: all 220ms cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        z-index: 5;
    }

    .krt-editor__sidebar[data-open="true"] {
        width: var(--krt-editor-sidebar-width);
    }

    .krt-editor__sidebarHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.5rem;
        border-bottom: 2px solid var(--krt-editor-divider);
        background: #ffffff;
        flex-shrink: 0;
        backdrop-filter: none;
        height: 64px;
        box-sizing: border-box;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.03);
        position: relative;
        z-index: 6;
    }

    .krt-editor__sidebarHeader::before {
        display: none;
    }

    .krt-editor__sidebarHeader h2 {
        font-size: 1rem;
        font-weight: 700;
        margin: 0;
        color: var(--krt-editor-text-primary);
        letter-spacing: -0.025em;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
    }

    .krt-editor__sidebarClose {
        border: none;
        border-radius: var(--krt-editor-radius-sm);
        background: transparent;
        color: var(--krt-editor-text-secondary);
        padding: 0.5rem;
        cursor: pointer;
        transition: all 160ms ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        flex-shrink: 0;
    }

    .krt-editor__sidebarClose:is(:hover, :focus-visible) {
        background: var(--krt-editor-accent);
        color: #ffffff;
        transform: scale(1.05);
        box-shadow: var(--krt-editor-shadow-sm);
    }

    .krt-editor__sidebarClose :global(svg) {
        width: 18px;
        height: 18px;
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

    .krt-editor__sectionTitle {
        font-size: 0.85rem;
        font-weight: 600;
        margin: 0.5rem 0 0.5rem 0;
        color: rgba(17, 24, 39, 0.8);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .krt-editor__blockGrid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.5rem;
    }

    .krt-editor__blockButton {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.3rem;
        padding: 0.5rem;
        border: 1px solid var(--krt-color-border-subtle);
        border-radius: var(--krt-radius-md);
        background: #fff;
        cursor: pointer;
        transition: all 160ms ease;
        font-size: 0.75rem;
        color: rgba(17, 24, 39, 0.7);
    }

    .krt-editor__blockButton:is(:hover, :focus-visible) {
        border-color: var(--krt-color-primary);
        background: rgba(99, 102, 241, 0.05);
        color: var(--krt-color-primary);
    }

    .krt-editor__blockButton :global(svg) {
        width: 18px;
        height: 18px;
    }

    .krt-editor__presetGrid {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .krt-editor__presetButton {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        border: 1px solid var(--krt-color-border-subtle);
        border-radius: var(--krt-radius-md);
        background: #fff;
        cursor: pointer;
        transition: all 160ms ease;
        padding: 0;
        overflow: hidden;
    }

    .krt-editor__presetButton:is(:hover, :focus-visible) {
        border-color: var(--krt-color-primary);
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
        transform: translateY(-2px);
    }

    .krt-editor__presetLabel {
        padding: 0.5rem 0.75rem;
        font-size: 0.8rem;
        font-weight: 500;
        color: rgba(17, 24, 39, 0.8);
        text-align: left;
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
        border: 1px solid var(--krt-editor-border);
        border-radius: var(--krt-editor-radius-md);
        background: var(--krt-editor-surface);
        padding: 0.75rem;
        text-align: left;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        cursor: pointer;
        transition: all 160ms ease;
    }

    .krt-editor__themeButton:is(:hover, :focus-visible) {
        border-color: var(--krt-editor-accent);
        background: var(--krt-editor-surface-hover);
        transform: translateY(-1px);
        box-shadow: var(--krt-editor-shadow-sm);
    }

    .krt-editor__themeButton.is-active {
        border-color: var(--krt-editor-accent);
        background: rgba(59, 130, 246, 0.05);
        box-shadow: 0 0 0 1px var(--krt-editor-accent);
    }

    .krt-editor__themeDetails {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        font-size: 0.85rem;
    }

    .krt-editor__themeDetails > div {
        font-weight: 600;
        color: var(--krt-editor-text-primary);
    }

    .krt-editor__themeButton p {
        margin: 0;
        font-size: 0.8rem;
        color: var(--krt-editor-text-secondary);
    }

    .krt-editor__settingsPanel {
        padding: 0.75rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .krt-editor__settingsPanel h3 {
        font-size: 0.85rem;
        font-weight: 600;
        margin: 0 0 0.5rem 0;
        color: rgba(17, 24, 39, 0.8);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .krt-editor__settingsPanel label {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        font-size: 0.8rem;
        color: rgba(17, 24, 39, 0.7);
    }

    .krt-editor__settingsPanel input,
    .krt-editor__settingsPanel textarea {
        border-radius: var(--krt-radius-sm);
        border: 1px solid var(--krt-color-border-subtle);
        padding: 0.5rem 0.6rem;
        font-size: 0.85rem;
        font-family: inherit;
    }

    .krt-editor__settingsPanel input:focus,
    .krt-editor__settingsPanel textarea:focus {
        outline: none;
        border-color: var(--krt-color-primary);
        box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
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
    .krt-editor__formStack textarea {
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
        padding: 0.4rem 0.7rem;
        cursor: pointer;
        transition: all 160ms ease;
        color: rgba(17, 24, 39, 0.7);
        font-family: inherit;
    }

    .krt-editor__ghostButton:is(:hover, :focus-visible) {
        background: rgba(99, 102, 241, 0.05);
        border-color: var(--krt-color-primary);
        color: var(--krt-color-primary);
    }

    .krt-editor__ghostButton :global(svg) {
        width: 14px;
        height: 14px;
    }

    .krt-editor__emptyState {
        text-align: center;
        padding: 2.5rem 1rem;
        color: rgba(17, 24, 39, 0.6);
        display: flex;
        flex-direction: column;
        gap: 1rem;
        align-items: center;
    }

    .krt-editor__emptyState p {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
    }

    .krt-editor__primaryButton {
        border: none;
        border-radius: var(--krt-radius-pill);
        background: var(--krt-color-primary);
        color: #fff;
        padding: 0.6rem 1.2rem;
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        cursor: pointer;
        font-weight: 600;
        transition: all 160ms ease;
        font-size: 0.9rem;
        font-family: inherit;
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }

    .krt-editor__primaryButton:is(:hover, :focus-visible) {
        background: rgb(88, 76, 217);
        box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
        transform: translateY(-2px);
    }

    .krt-editor__primaryButton:active {
        transform: translateY(0);
    }

    .krt-editor__primaryButton :global(svg) {
        width: 18px;
        height: 18px;
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
        background: transparent;
        border-radius: 6px;
        padding: 0;
        border: none;
        gap: 8px;
    }

    .krt-editor__deviceToggleButton {
        border: 1px solid #e5e7eb;
        background: #ffffff;
        border-radius: 6px;
        width: 32px;
        height: 32px;
        display: grid;
        place-items: center;
        cursor: pointer;
        color: #6b7280;
        transition: all 0.2s ease;
    }

    .krt-editor__deviceToggleButton:hover {
        border-color: #d1d5db;
        background: #f9fafb;
    }

    .krt-editor__deviceToggleButton.is-active {
        background: #3b82f6;
        color: #ffffff;
        border-color: #3b82f6;
    }

    .krt-editor__mainPanel {
        flex: 1;
        display: flex;
        min-height: 0;
        background: var(--krt-editor-surface);
        border-right: 2px solid var(--krt-editor-divider);
    }

    .krt-editor__canvasShell {
        flex: 1;
        background: var(--krt-editor-surface);
        overflow: auto;
        padding: 2rem;
    }

    .krt-editor__canvasFrame {
        margin: 0 auto;
        width: 100%;
        min-height: 100%;
        transition: max-width 200ms cubic-bezier(0.4, 0, 0.2, 1);
        border-radius: var(--krt-editor-radius-lg);
        box-shadow: var(--krt-editor-shadow-lg);
        background: var(--krt-editor-bg);
        overflow: hidden; /* Contain content within frame */
        position: relative; /* Positioning context for mobile menu */
    }

    .krt-editor__inspector {
        width: 0;
        background: var(--krt-editor-bg);
        border-left: 2px solid var(--krt-editor-divider);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transition: all 220ms cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: -2px 0 4px rgba(0, 0, 0, 0.03);
        position: relative;
        z-index: 5;
    }

    .krt-editor__inspector[data-open="true"] {
        width: var(--krt-editor-inspector-width);
    }

    .krt-editor__inspectorHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.5rem;
        border-bottom: 2px solid var(--krt-editor-divider);
        background: #ffffff;
        flex-shrink: 0;
        gap: 0.75rem;
        backdrop-filter: none;
        height: 64px;
        box-sizing: border-box;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.03);
        position: relative;
        z-index: 6;
    }

    .krt-editor__inspectorHeader::before {
        display: none;
    }

    .krt-editor__inspectorHeader > div {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        font-weight: 700;
        color: var(--krt-editor-text-primary);
        letter-spacing: -0.025em;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .krt-editor__inspectorHeader > div div {
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 999px;
        background: #10b981;
        animation: pulse 1.5s ease infinite;
        box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
    }

    .krt-editor__inspectorClose {
        border: none;
        background: transparent;
        border-radius: var(--krt-editor-radius-sm);
        padding: 0.5rem;
        cursor: pointer;
        color: var(--krt-editor-text-secondary);
        transition: all 160ms ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        flex-shrink: 0;
    }

    .krt-editor__inspectorClose:is(:hover, :focus-visible) {
        background: var(--krt-editor-accent);
        color: #ffffff;
        transform: scale(1.05);
        box-shadow: var(--krt-editor-shadow-sm);
    }

    .krt-editor__inspectorClose :global(svg) {
        width: 18px;
        height: 18px;
    }

    .krt-editor__inspectorBody {
        flex: 1;
        overflow-y: auto;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .krt-editor__sidebarItem {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        border: 1px solid var(--krt-editor-border);
        border-radius: var(--krt-editor-radius-md);
        background: var(--krt-editor-bg);
        color: var(--krt-editor-text-primary);
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 160ms ease;
        width: 100%;
        text-align: left;
    }

    .krt-editor__sidebarItem:is(:hover, :focus-visible) {
        background: var(--krt-editor-surface-hover);
        border-color: var(--krt-editor-accent);
        transform: translateY(-1px);
        box-shadow: var(--krt-editor-shadow-sm);
    }

    .krt-editor__sidebarItem :global(svg) {
        width: 18px;
        height: 18px;
        color: var(--krt-editor-text-secondary);
        transition: color 160ms ease;
    }

    .krt-editor__sidebarItem:is(:hover, :focus-visible) :global(svg) {
        color: var(--krt-editor-accent);
    }

    .krt-editor__inspectorFooter {
        padding: 1rem 1.25rem;
        border-top: 1px solid var(--krt-editor-border);
        background: var(--krt-editor-surface);
        flex-shrink: 0;
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.8rem;
        color: var(--krt-editor-text-muted);
    }

    @keyframes pulse {
        0% { opacity: 0.4; }
        50% { opacity: 1; }
        100% { opacity: 0.4; }
    }

    /* Additional cohesive styling for sidebar sections */
    .krt-editor__sidebarSection {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 1rem;
    }

    .krt-editor__sectionTitle {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--krt-editor-text-secondary);
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .krt-editor__themeButton {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
        border: 1px solid var(--krt-editor-border);
        border-radius: var(--krt-editor-radius-md);
        background: var(--krt-editor-bg);
        cursor: pointer;
        transition: all 160ms ease;
        width: 100%;
        text-align: left;
    }

    .krt-editor__themeButton:is(:hover, :focus-visible) {
        background: var(--krt-editor-surface-hover);
        border-color: var(--krt-editor-accent);
        transform: translateY(-1px);
        box-shadow: var(--krt-editor-shadow-sm);
    }

    .krt-editor__themeButton.is-active {
        border-color: var(--krt-editor-accent);
        background: rgba(59, 130, 246, 0.05);
        box-shadow: 0 0 0 1px var(--krt-editor-accent);
    }

    .krt-editor__loadingMessage {
        text-align: center;
        color: var(--krt-editor-text-muted);
        font-size: 0.9rem;
        padding: 2rem;
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
