<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import type { EditorOptions, PageData, BlogData, BlogPost, BlogSettings } from "./types.js";
    import type { SiteRegionState } from "./presets/types.js";
    import { defaultEditorOptions, defaultPageData, createDefaultBlogData } from "./types.js";
    import { blocks, getBlock } from "./registry";
    import { addComponentToEditor } from "./utils/editor.svelte";
    import { rightPanel, closeRightPanel } from "./stores/right-panel";
    import { headingStore, sideBarStore } from "./stores/ui";
    import { MenuWidget } from "./plugins";
    import EditorCanvas from "./EditorCanvas.svelte";
    import PresetPreview from "./presets/PresetPreview.svelte";
    import { layoutPresets } from "./presets/layouts.js";
    import { headerPresets, createHeaderRegion } from "./presets/headers.js";
    import { footerPresets, createFooterRegion } from "./presets/footers.js";
    import { blogStore } from "./stores/blog";
    import ThemePreview from "./themes/ThemePreview.svelte";
    import { getAllThemes, getThemeTemplate, DEFAULT_THEME_ID } from "./themes";
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
        Plus,
        Palette,
        BookOpen
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
        onCreatePage
}: Props = $props();

    const getPageList = () => Array.isArray(pages) ? pages : [];
    
    // Local mutable state for the page data
    let localPageData = $state<PageData>({ ...defaultPageData, ...pageData });
    
    // UI state
    let sidebarOpen = $state(false);
    let activeTab = $state('blocks');
    let browserMockup: HTMLDivElement;
    let activeSize = $state(initialDeviceSize);
    const paletteBlocks = blocks.filter((block) => block.showInPalette !== false);
    const themeOptions = getAllThemes();
    let selectedThemeId = $state((siteMetadata as any)?.themeId || DEFAULT_THEME_ID);
    let blogData = $state<BlogData>(blog ?? (siteMetadata as any)?.blog ?? createDefaultBlogData());
    let blogSnapshot = JSON.stringify(blogData);
    blogStore.set(blogData);
    let selectedPostId = $state(blogData.posts[0]?.id ?? null);
    let selectedPageForBlog = $state(getPageList()[0]?.id ?? null);

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

    const persistBlog = async (next: BlogData) => {
        blogData = next;
        blogSnapshot = JSON.stringify(blogData);
        blogStore.set(blogData);
        blog = blogData;
        siteMetadata = { ...(siteMetadata || {}), blog: blogData };
        if (onSiteMetadataUpdate) {
            await onSiteMetadataUpdate(siteMetadata);
        }
    };

    const updateBlog = async (updater: (current: BlogData) => BlogData) => {
        const next = updater(JSON.parse(JSON.stringify(blogData)));
        await persistBlog(next);
        if (!selectedPostId && next.posts.length > 0) {
            selectedPostId = next.posts[0].id;
        }
    };

    const selectedPost = $derived(() => blogData.posts.find((post) => post.id === selectedPostId) ?? null);

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

    const applyHeaderPreset = async (presetId: string) => {
        await handleHeaderChange(createHeaderRegion(presetId));
    };

    const applyFooterPreset = async (presetId: string) => {
        await handleFooterChange(createFooterRegion(presetId));
    };

    const insertLayoutPreset = (presetId: string) => {
        if (!editor) return;
        const preset = layoutPresets.find((candidate) => candidate.id === presetId);
        if (!preset) return;
        preset.create().forEach((snapshot) => {
            const definition = getBlock(snapshot.type);
            if (!definition) return;
            const props = { ...snapshot };
            addComponentToEditor(editor, definition.component, props);
        });
    };

    const applyTheme = async (themeId: string) => {
        const template = getThemeTemplate(themeId);
        selectedThemeId = themeId;
        const homepage = template.defaultHomepage;
        localPageData = { ...localPageData, ...homepage };
        siteMetadata = { ...(template.siteMetadata || {}), themeId };
        if (!(siteMetadata as any)?.blog) {
            (siteMetadata as any).blog = createDefaultBlogData();
        }
        blogData = JSON.parse(JSON.stringify((siteMetadata as any).blog)) as BlogData;
        blogSnapshot = JSON.stringify(blogData);
        blogStore.set(blogData);
        blog = blogData;
        selectedPostId = blogData.posts[0]?.id ?? null;
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
        const incomingBlog = (siteMetadata as any)?.blog;
        if (incomingBlog) {
            const incomingSnapshot = JSON.stringify(incomingBlog);
            if (incomingSnapshot !== blogSnapshot) {
                blogData = JSON.parse(incomingSnapshot) as BlogData;
                blogSnapshot = incomingSnapshot;
                blogStore.set(blogData);
                blog = blogData;
                if (!selectedPostId && blogData.posts.length > 0) {
                    selectedPostId = blogData.posts[0].id;
                }
            }
        }
    });

    $effect(() => {
        const incomingTheme = (siteMetadata as any)?.themeId;
        if (incomingTheme && incomingTheme !== selectedThemeId) {
            selectedThemeId = incomingTheme;
        }
    });

    $effect(() => {
        const firstPage = getPageList()[0];
        if (!selectedPageForBlog && firstPage) {
            selectedPageForBlog = firstPage.id;
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

    const addCategory = async () => {
        await updateBlog((blog) => {
            const name = `Category ${blog.categories.length + 1}`;
            blog.categories.push({
                id: randomId(),
                name,
                slug: slugify(name)
            });
            return blog;
        });
    };

    const updateCategoryField = async (index: number, field: 'name' | 'slug', value: string) => {
        await updateBlog((blog) => {
            const category = blog.categories[index];
            if (!category) return blog;
            if (field === 'name') {
                category.name = value;
            } else {
                category.slug = slugify(value);
            }
            return blog;
        });
    };

    const removeCategory = async (index: number) => {
        await updateBlog((blog) => {
            const removed = blog.categories[index];
            if (!removed) return blog;
            blog.categories.splice(index, 1);
            blog.posts.forEach((post) => {
                post.categories = post.categories.filter((slug) => slug !== removed.slug);
            });
            return blog;
        });
    };

    const addTag = async () => {
        await updateBlog((blog) => {
            const name = `Tag ${blog.tags.length + 1}`;
            blog.tags.push({
                id: randomId(),
                name,
                slug: slugify(name)
            });
            return blog;
        });
    };

    const updateTagField = async (index: number, field: 'name' | 'slug', value: string) => {
        await updateBlog((blog) => {
            const tag = blog.tags[index];
            if (!tag) return blog;
            if (field === 'name') {
                tag.name = value;
            } else {
                tag.slug = slugify(value);
            }
            return blog;
        });
    };

    const removeTag = async (index: number) => {
        await updateBlog((blog) => {
            const removed = blog.tags[index];
            if (!removed) return blog;
            blog.tags.splice(index, 1);
            blog.posts.forEach((post) => {
                post.tags = post.tags.filter((slug) => slug !== removed.slug);
            });
            return blog;
        });
    };

    const addPostFromPageId = async (pageId: string | null | undefined) => {
        if (!pageId) return;
        const page = getPageList().find((entry) => entry.id === pageId);
        if (!page) return;
        const title = page.title ?? 'Untitled Post';
        const slugValue = page.slug ?? slugify(title);
        const newPost: BlogPost = {
            id: randomId(),
            pageId: page.id,
            title,
            slug: slugValue,
            excerpt: 'Add a short description for this article.',
            publishedOn: toDateInputValue(),
            coverImage: undefined,
            categories: [],
            tags: [],
            featured: blogData.posts.length === 0
        };
        await updateBlog((blog) => {
            blog.posts = [newPost, ...blog.posts];
            if (!blog.settings.featuredPostId) {
                blog.settings.featuredPostId = newPost.id;
            }
            return blog;
        });
        selectedPostId = newPost.id;
    };

    const updatePost = async (postId: string, mutate: (post: BlogPost) => void) => {
        await updateBlog((blog) => {
            const post = blog.posts.find((p) => p.id === postId);
            if (post) {
                mutate(post);
            }
            return blog;
        });
    };

    const removePost = async (postId: string) => {
        await updateBlog((blog) => {
            blog.posts = blog.posts.filter((post) => post.id !== postId);
            if (blog.settings.featuredPostId === postId) {
                blog.settings.featuredPostId = blog.posts[0]?.id ?? null;
            }
            return blog;
        });
        if (selectedPostId === postId) {
            selectedPostId = blogData.posts[0]?.id ?? null;
        }
    };

    const togglePostCategory = async (postId: string, slug: string) => {
        await updatePost(postId, (post) => {
            if (post.categories.includes(slug)) {
                post.categories = post.categories.filter((entry) => entry !== slug);
            } else {
                post.categories.push(slug);
            }
        });
    };

    const togglePostTag = async (postId: string, slug: string) => {
        await updatePost(postId, (post) => {
            if (post.tags.includes(slug)) {
                post.tags = post.tags.filter((entry) => entry !== slug);
            } else {
                post.tags.push(slug);
            }
        });
    };

    const setFeaturedPost = async (postId: string | null) => {
        await updateBlog((blog) => {
            blog.settings.featuredPostId = postId;
            return blog;
        });
    };

    const updateBlogSetting = async (field: keyof BlogSettings, value: string | boolean | null) => {
        await updateBlog((blog) => {
            (blog.settings as any)[field] = value;
            return blog;
        });
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
                class="p-3 rounded-lg transition-all {activeTab === 'themes' ? 'bg-primary text-primary-content' : 'text-base-content/60 hover:bg-base-300'}"
                onclick={() => toggleSidebar('themes')}
                title="Themes"
            >
                <Palette class="w-5 h-5" />
            </button>
            <button 
                class="p-3 rounded-lg transition-all {activeTab === 'blog' ? 'bg-primary text-primary-content' : 'text-base-content/60 hover:bg-base-300'}"
                onclick={() => toggleSidebar('blog')}
                title="Blog"
            >
                <BookOpen class="w-5 h-5" />
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
        <div class="{sidebarOpen ? 'w-[24rem]' : 'w-0'} transition-all duration-300 bg-base-200 border-r border-base-300 flex flex-col overflow-hidden shadow-lg">
            <div class="flex items-center justify-between p-3 border-b border-base-300 flex-shrink-0">
                <h2 class="text-sm font-medium text-base-content">
                    {activeTab === 'blocks' ? 'Blocks' : 
                     activeTab === 'layouts' ? 'Layouts' : 
                     activeTab === 'site' ? 'Site' : 
                     activeTab === 'themes' ? 'Themes' :
                     activeTab === 'blog' ? 'Blog' :
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
                                {#each paletteBlocks as block}
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
                            <div class="flex flex-col gap-3 p-3">
                                {#each layoutPresets as preset}
                                    <button
                                        class="flex flex-col gap-2 bg-base-100 rounded-lg shadow hover:ring-2 hover:ring-primary transition text-left p-2"
                                        onclick={() => insertLayoutPreset(preset.id)}
                                    >
                                        <PresetPreview {preset} />
                                        <div class="text-xs font-medium">{preset.name}</div>
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
                                    {#each headerPresets as preset}
                                        <button
                                            class="w-full bg-base-100 rounded shadow hover:ring-2 transition {siteHeader?.presetId === preset.id ? 'ring-2 ring-primary' : 'hover:ring-primary/50'} text-left p-2"
                                            onclick={() => applyHeaderPreset(preset.id)}
                                        >
                                            <PresetPreview {preset} />
                                            <div class="text-xs text-center py-1">{preset.name}</div>
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
                                    {#each footerPresets as preset}
                                        <button
                                            class="w-full bg-base-100 rounded shadow hover:ring-2 transition {siteFooter?.presetId === preset.id ? 'ring-2 ring-primary' : 'hover:ring-primary/50'} text-left p-2"
                                            onclick={() => applyFooterPreset(preset.id)}
                                        >
                                            <PresetPreview {preset} />
                                            <div class="text-xs text-center py-1">{preset.name}</div>
                                        </button>
                                    {/each}
                                </div>
                            </div>
                        </div>
                    {:else if activeTab === 'themes'}
                        <div class="p-3 space-y-3">
                            {#each themeOptions as theme}
                                <button
                                    class="w-full bg-base-100 rounded-lg shadow hover:ring-2 transition text-left p-3 flex flex-col gap-2 {selectedThemeId === theme.metadata.id ? 'ring-2 ring-primary' : 'hover:ring-primary/60'}"
                                    onclick={() => applyTheme(theme.metadata.id)}
                                >
                                    <ThemePreview theme={theme} scale={0.35} />
                                    <div class="space-y-0.5">
                                        <div class="text-sm font-semibold text-base-content">{theme.metadata.name}</div>
                                        <p class="text-xs text-base-content/70">{theme.metadata.description}</p>
                                    </div>
                                </button>
                            {/each}
                        </div>
                    {:else if activeTab === 'blog'}
                        <div class="p-3 space-y-4">
                            <div class="rounded-lg border border-base-300 bg-base-100 overflow-hidden">
                                <div class="flex items-center justify-between px-3 py-2 bg-base-200 border-b border-base-300">
                                    <div>
                                        <p class="text-xs font-semibold uppercase tracking-wide text-base-content/80">Blog Settings</p>
                                        <p class="text-xs text-base-content/60">Manage blog appearance and navigation</p>
                                    </div>
                                    <div class="flex gap-1">
                                        <button class="btn btn-ghost btn-xs" onclick={() => addCustomNavItem('header', 'Blog', 'blog')}>
                                            + Header
                                        </button>
                                        <button class="btn btn-ghost btn-xs" onclick={() => addCustomNavItem('footer', 'Blog', 'blog')}>
                                            + Footer
                                        </button>
                                    </div>
                                </div>
                                <div class="p-3 space-y-3">
                                    <label class="form-control">
                                        <span class="label-text text-xs">Layout Style</span>
                                        <select
                                            class="select select-sm select-bordered"
                                            value={blogData.settings.layout ?? 'classic'}
                                            onchange={(e) => updateBlogSetting('layout', (e.currentTarget as HTMLSelectElement).value as BlogSettings['layout'])}
                                        >
                                            <option value="classic">Classic</option>
                                            <option value="grid">Grid</option>
                                            <option value="minimal">Minimal</option>
                                        </select>
                                    </label>
                                    <label class="form-control">
                                        <span class="label-text text-xs">Hero Style</span>
                                        <select
                                            class="select select-sm select-bordered"
                                            value={blogData.settings.heroStyle ?? 'cover'}
                                            onchange={(e) => updateBlogSetting('heroStyle', (e.currentTarget as HTMLSelectElement).value as BlogSettings['heroStyle'])}
                                        >
                                            <option value="cover">Cover</option>
                                            <option value="split">Split</option>
                                        </select>
                                    </label>
                                    <label class="label cursor-pointer justify-start gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            class="checkbox checkbox-sm"
                                            checked={blogData.settings.showAuthor ?? true}
                                            onchange={(e) => updateBlogSetting('showAuthor', (e.currentTarget as HTMLInputElement).checked)}
                                        />
                                        <span class="label-text">Display author information</span>
                                    </label>
                                </div>
                            </div>

                            <div class="rounded-lg border border-base-300 bg-base-100 overflow-hidden">
                                <div class="flex items-center justify-between px-3 py-2 bg-base-200 border-b border-base-300">
                                    <span class="text-xs font-semibold uppercase tracking-wide text-base-content/80">Categories</span>
                                    <button class="btn btn-primary btn-xs" onclick={addCategory}>Add</button>
                                </div>
                                <div class="p-3 space-y-2 max-h-48 overflow-y-auto">
                                    {#if blogData.categories.length > 0}
                                        {#each blogData.categories as category, index (category.id)}
                                            <div class="bg-base-100 border border-base-300 rounded-lg p-2 space-y-1">
                                                <input
                                                    type="text"
                                                    class="input input-xs input-bordered w-full"
                                                    value={category.name}
                                                    oninput={(e) => updateCategoryField(index, 'name', (e.currentTarget as HTMLInputElement).value)}
                                                    placeholder="Category name"
                                                />
                                                <input
                                                    type="text"
                                                    class="input input-xs input-bordered w-full"
                                                    value={category.slug}
                                                    oninput={(e) => updateCategoryField(index, 'slug', (e.currentTarget as HTMLInputElement).value)}
                                                    placeholder="Slug"
                                                />
                                                <button class="btn btn-ghost btn-xs text-error" onclick={() => removeCategory(index)}>Remove</button>
                                            </div>
                                        {/each}
                                    {:else}
                                        <p class="text-xs text-base-content/60 text-center py-4">No categories yet.</p>
                                    {/if}
                                </div>
                            </div>

                            <div class="rounded-lg border border-base-300 bg-base-100 overflow-hidden">
                                <div class="flex items-center justify-between px-3 py-2 bg-base-200 border-b border-base-300">
                                    <span class="text-xs font-semibold uppercase tracking-wide text-base-content/80">Tags</span>
                                    <button class="btn btn-primary btn-xs" onclick={addTag}>Add</button>
                                </div>
                                <div class="p-3 space-y-2 max-h-40 overflow-y-auto">
                                    {#if blogData.tags.length > 0}
                                        {#each blogData.tags as tag, index (tag.id)}
                                            <div class="bg-base-100 border border-base-300 rounded-lg p-2 space-y-1">
                                                <input
                                                    type="text"
                                                    class="input input-xs input-bordered w-full"
                                                    value={tag.name}
                                                    oninput={(e) => updateTagField(index, 'name', (e.currentTarget as HTMLInputElement).value)}
                                                    placeholder="Tag name"
                                                />
                                                <input
                                                    type="text"
                                                    class="input input-xs input-bordered w-full"
                                                    value={tag.slug}
                                                    oninput={(e) => updateTagField(index, 'slug', (e.currentTarget as HTMLInputElement).value)}
                                                    placeholder="Slug"
                                                />
                                                <button class="btn btn-ghost btn-xs text-error" onclick={() => removeTag(index)}>Remove</button>
                                            </div>
                                        {/each}
                                    {:else}
                                        <p class="text-xs text-base-content/60 text-center py-4">No tags yet.</p>
                                    {/if}
                                </div>
                            </div>

                            <div class="rounded-lg border border-base-300 bg-base-100 overflow-hidden">
                                <div class="flex items-center justify-between px-3 py-2 bg-base-200 border-b border-base-300">
                                    <span class="text-xs font-semibold uppercase tracking-wide text-base-content/80">Posts</span>
                                    <div class="flex items-center gap-2">
                                        <select
                                            class="select select-xs select-bordered"
                                            bind:value={selectedPageForBlog}
                                        >
                                            {#if getPageList().length > 0}
                                                {#each getPageList() as page}
                                                    <option value={page.id}>{page.title || 'Untitled'} ({page.slug || 'no slug'})</option>
                                                {/each}
                                            {:else}
                                                <option disabled selected>No pages available</option>
                                            {/if}
                                        </select>
                                        <button class="btn btn-primary btn-xs gap-1" onclick={() => addPostFromPageId(selectedPageForBlog)}>
                                            <Plus class="w-3 h-3" />
                                            Link Page
                                        </button>
                                    </div>
                                </div>
                                <div class="p-3 bg-base-200 rounded-b-lg">
                                    <div class="grid grid-cols-1 md:grid-cols-[180px,1fr] gap-3">
                                        <div class="space-y-1 max-h-64 overflow-y-auto">
                                            {#if blogData.posts.length > 0}
                                                {#each blogData.posts as post (post.id)}
                                                    <button
                                                        class="w-full rounded-lg px-2 py-1 text-left transition {selectedPostId === post.id ? 'bg-primary text-primary-content' : 'bg-base-100 hover:bg-base-300'}"
                                                        onclick={() => selectedPostId = post.id}
                                                    >
                                                        <span class="text-sm font-semibold truncate">{post.title}</span>
                                                        <span class="block text-xs opacity-70 truncate">/{post.slug}</span>
                                                    </button>
                                                {/each}
                                            {:else}
                                                <p class="text-xs text-base-content/60 text-center py-6">No posts yet. Create one above.</p>
                                            {/if}
                                        </div>
                                        <div class="bg-base-100 rounded-lg p-3 space-y-2">
                                            {#if selectedPost}
                                                <div class="space-y-2">
                                                    <label class="form-control">
                                                        <span class="label-text text-xs">Linked Page</span>
                                                        <select
                                                            class="select select-sm select-bordered"
                                                            value={selectedPost.pageId}
                                                            onchange={(e) => {
                                                                const pageId = (e.currentTarget as HTMLSelectElement).value;
                                                                const page = getPageList().find((entry) => entry.id === pageId);
                                                                if (!page) return;
                                                                updatePost(selectedPost.id, (post) => {
                                                                    post.pageId = page.id;
                                                                    post.title = page.title ?? post.title;
                                                                    post.slug = page.slug ?? slugify(post.title);
                                                                });
                                                            }}
                                                        >
                                                            {#each getPageList() as page}
                                                                <option value={page.id}>{page.title || 'Untitled'} ({page.slug || 'no slug'})</option>
                                                            {/each}
                                                        </select>
                                                    </label>
                                                    <div>
                                                        <p class="text-xs font-semibold uppercase tracking-wide text-base-content/60">Title</p>
                                                        <p class="text-sm">{selectedPost.title}</p>
                                                    </div>
                                                    <div>
                                                        <p class="text-xs font-semibold uppercase tracking-wide text-base-content/60">Slug</p>
                                                        <p class="text-sm text-base-content/70">/{selectedPost.slug}</p>
                                                    </div>
                                                    <button
                                                        class="btn btn-outline btn-xs"
                                                        onclick={() => {
                                                            const page = getPageList().find((entry) => entry.id === selectedPost.pageId);
                                                            if (!page) return;
                                                            updatePost(selectedPost.id, (post) => {
                                                                post.title = page.title ?? post.title;
                                                                post.slug = page.slug ?? slugify(post.title);
                                                            });
                                                        }}
                                                    >
                                                        Sync title & slug from page
                                                    </button>
                                                    <label class="form-control">
                                                        <span class="label-text text-xs">Excerpt</span>
                                                        <textarea
                                                            class="textarea textarea-sm textarea-bordered"
                                                            rows="3"
                                                            value={selectedPost.excerpt}
                                                            oninput={(e) => updatePost(selectedPost.id, (post) => post.excerpt = (e.currentTarget as HTMLTextAreaElement).value)}
                                                        ></textarea>
                                                    </label>
                                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                        <label class="form-control">
                                                            <span class="label-text text-xs">Cover Image URL</span>
                                                            <input
                                                                type="text"
                                                                class="input input-sm input-bordered"
                                                                value={selectedPost.coverImage?.url ?? ''}
                                                                oninput={(e) => updatePost(selectedPost.id, (post) => {
                                                                    post.coverImage = { ...(post.coverImage ?? {}), url: (e.currentTarget as HTMLInputElement).value };
                                                                })}
                                                            />
                                                        </label>
                                                        <label class="form-control">
                                                            <span class="label-text text-xs">Image Alt Text</span>
                                                            <input
                                                                type="text"
                                                                class="input input-sm input-bordered"
                                                                value={selectedPost.coverImage?.alt ?? ''}
                                                                oninput={(e) => updatePost(selectedPost.id, (post) => {
                                                                    post.coverImage = { ...(post.coverImage ?? {}), alt: (e.currentTarget as HTMLInputElement).value };
                                                                })}
                                                            />
                                                        </label>
                                                    </div>
                                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                        <label class="form-control">
                                                            <span class="label-text text-xs">Author</span>
                                                            <input
                                                                type="text"
                                                                class="input input-sm input-bordered"
                                                                value={selectedPost.author ?? ''}
                                                                oninput={(e) => updatePost(selectedPost.id, (post) => post.author = (e.currentTarget as HTMLInputElement).value)}
                                                            />
                                                        </label>
                                                        <label class="form-control">
                                                            <span class="label-text text-xs">Publish Date</span>
                                                            <input
                                                                type="date"
                                                                class="input input-sm input-bordered"
                                                                value={selectedPost.publishedOn ?? toDateInputValue()}
                                                                onchange={(e) => updatePost(selectedPost.id, (post) => post.publishedOn = (e.currentTarget as HTMLInputElement).value)}
                                                            />
                                                        </label>
                                                    </div>
                                                    <div class="space-y-1">
                                                        <span class="text-xs font-semibold uppercase tracking-wide">Categories</span>
                                                        <div class="flex flex-wrap gap-1">
                                                            {#each blogData.categories as category}
                                                                <label class="badge badge-lg gap-1 cursor-pointer {selectedPost?.categories?.includes(category.slug) ? 'badge-primary' : 'badge-outline'}">
                                                                    <input
                                                                        type="checkbox"
                                                                        class="hidden"
                                                                        checked={selectedPost?.categories?.includes(category.slug) ?? false}
                                                                        onchange={() => selectedPost && togglePostCategory(selectedPost.id, category.slug)}
                                                                    />
                                                                    {category.name}
                                                                </label>
                                                            {/each}
                                                            {#if blogData.categories.length === 0}
                                                                <span class="text-xs text-base-content/60">No categories defined.</span>
                                                            {/if}
                                                        </div>
                                                    </div>
                                                    <div class="space-y-1">
                                                        <span class="text-xs font-semibold uppercase tracking-wide">Tags</span>
                                                        <div class="flex flex-wrap gap-1">
                                                            {#each blogData.tags as tag}
                                                                <label class="badge badge-sm gap-1 cursor-pointer {selectedPost?.tags?.includes(tag.slug) ? 'badge-secondary' : 'badge-outline'}">
                                                                    <input
                                                                        type="checkbox"
                                                                        class="hidden"
                                                                        checked={selectedPost?.tags?.includes(tag.slug) ?? false}
                                                                        onchange={() => selectedPost && togglePostTag(selectedPost.id, tag.slug)}
                                                                    />
                                                                    {tag.name}
                                                                </label>
                                                            {/each}
                                                            {#if blogData.tags.length === 0}
                                                                <span class="text-xs text-base-content/60">No tags defined.</span>
                                                            {/if}
                                                        </div>
                                                    </div>
                                                    <div class="flex items-center justify-between">
                                                        <button class="btn btn-error btn-sm" onclick={() => removePost(selectedPost.id)}>
                                                            Delete Post
                                                        </button>
                                                        <button
                                                            class={`btn btn-sm ${blogData.settings.featuredPostId === selectedPost.id ? 'btn-primary text-primary-content' : 'btn-outline'}`}
                                                            onclick={() => setFeaturedPost(selectedPost.id)}
                                                        >
                                                            {blogData.settings.featuredPostId === selectedPost.id ? 'Featured' : 'Set as Featured'}
                                                        </button>
                                                    </div>
                                                </div>
                                            {:else}
                                                <div class="text-sm text-base-content/60 text-center py-6">
                                                    Select a post to edit its details.
                                                </div>
                                            {/if}
                                        </div>
                                    </div>
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
