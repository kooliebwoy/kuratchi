/**
 * Plugin Manager - Creates and manages plugin context
 */
import type { Component } from 'svelte';
import type {
    PluginContext,
    EditorPlugin,
    EditorEvent,
    CurrentPageData,
    PageItem,
    SEOUpdate,
    NavigationState,
    NavMenuItem,
    NavigationExtension,
    SiteLayoutExtension,
    SitePresetItem,
    ThemesExtension,
    ThemeOption,
    ThemeSettings
} from './context';
import { EXT } from './context';

type EventHandler = (data: unknown) => void;

export interface PluginManagerOptions {
    // Core getters
    getCurrentPage: () => CurrentPageData;
    getPages: () => PageItem[];
    getReservedPages: () => string[];
    getCurrentPageId: () => string | null;
    getSiteMetadata: () => Record<string, unknown>;
    getEditor: () => HTMLElement | null;

    // Core actions
    updatePageTitle: (title: string) => void;
    updatePageSEO: (seo: SEOUpdate) => void;
    updateSiteMetadata: (updates: Record<string, unknown>) => void;
    switchPage: (pageId: string) => void;
    createPage: (data: { title: string; slug: string }) => Promise<{ id: string; title: string; slug: string } | null>;
    addBlock: (type: string, props?: Record<string, unknown>) => void;

    // Navigation
    navigation?: {
        getState: () => NavigationState;
        save: (nav: NavigationState) => void;
        genId: () => string;
    };

    // Site Layout
    siteLayout?: {
        headerPresets: SitePresetItem[];
        footerPresets: SitePresetItem[];
        getHeaderType: () => string | null;
        getFooterType: () => string | null;
        mountHeader: (c: Component, props?: Record<string, unknown>) => void;
        mountFooter: (c: Component, props?: Record<string, unknown>) => void;
    };

    // Themes
    themes?: {
        list: ThemeOption[];
        getSelectedId: () => string;
        getSettings: () => ThemeSettings;
        apply: (id: string) => void;
        switch: (id: string, options?: { updateHeaderFooter?: boolean }) => void;
        updateSettings: (settings: Partial<ThemeSettings>) => void;
        resetSettings: () => void;
    };
}

export function createPluginManager(opts: PluginManagerOptions) {
    const events = new Map<EditorEvent, Set<EventHandler>>();
    const extensions = new Map<string, unknown>();

    // Event system
    const on = <T = unknown>(event: EditorEvent, handler: (data: T) => void): (() => void) => {
        if (!events.has(event)) events.set(event, new Set());
        events.get(event)!.add(handler as EventHandler);
        return () => events.get(event)?.delete(handler as EventHandler);
    };

    const emit = <T = unknown>(event: EditorEvent, data: T): void => {
        events.get(event)?.forEach(h => {
            try { h(data); } catch (e) { console.error(`[Plugin] Event error "${event}":`, e); }
        });
    };

    // Extension registry
    const ext = <T>(key: string): T | undefined => extensions.get(key) as T | undefined;
    const register = (key: string, value: unknown) => extensions.set(key, value);

    // Register built-in extensions
    if (opts.navigation) {
        const n = opts.navigation;
        register(EXT.NAVIGATION, {
            get state() { return n.getState(); },
            updateHeaderMenu: (items: NavMenuItem[]) => { 
                console.log('[NavigationExtension] updateHeaderMenu called with items:', items);
                const s = n.getState(); 
                s.header.items = items; 
                console.log('[NavigationExtension] calling save with state:', s);
                n.save(s); 
            },
            updateFooterMenu: (items: NavMenuItem[]) => { 
                console.log('[NavigationExtension] updateFooterMenu called with items:', items);
                const s = n.getState(); 
                s.footer.items = items; 
                console.log('[NavigationExtension] calling save with state:', s);
                n.save(s); 
            },
            setHeaderVisible: (v: boolean) => { const s = n.getState(); s.header.visible = v; n.save(s); },
            setFooterVisible: (v: boolean) => { const s = n.getState(); s.footer.visible = v; n.save(s); },
            setHeaderMobileOnDesktop: (v: boolean) => { const s = n.getState(); s.header.useMobileMenuOnDesktop = v; n.save(s); },
            addPageToMenu: (loc: 'header' | 'footer', page: PageItem) => {
                const s = n.getState();
                const item: NavMenuItem = { id: n.genId(), label: page.name, url: `/${page.slug}`, pageId: page.id };
                if (loc === 'header') s.header.items = [...s.header.items, item];
                else s.footer.items = [...s.footer.items, item];
                n.save(s);
            }
        } satisfies NavigationExtension);
    }

    if (opts.siteLayout) {
        const l = opts.siteLayout;
        register(EXT.SITE_LAYOUT, {
            get headerPresets() { return l.headerPresets; },
            get footerPresets() { return l.footerPresets; },
            get currentHeaderType() { return l.getHeaderType(); },
            get currentFooterType() { return l.getFooterType(); },
            mountHeader: l.mountHeader,
            mountFooter: l.mountFooter
        } satisfies SiteLayoutExtension);
    }

    if (opts.themes) {
        const t = opts.themes;
        register(EXT.THEMES, {
            get themes() { return t.list; },
            get selectedThemeId() { return t.getSelectedId(); },
            get themeSettings() { return t.getSettings(); },
            applyTheme: t.apply,
            switchTheme: t.switch,
            updateThemeSettings: t.updateSettings,
            resetThemeSettings: t.resetSettings
        } satisfies ThemesExtension);
    }

    // Build context
    const ctx: PluginContext = {
        get currentPage() { return opts.getCurrentPage(); },
        get pages() { return opts.getPages(); },
        get reservedPages() { return opts.getReservedPages(); },
        get currentPageId() { return opts.getCurrentPageId(); },
        get siteMetadata() { return opts.getSiteMetadata(); },
        get editor() { return opts.getEditor(); },
        updatePageTitle: opts.updatePageTitle,
        updatePageSEO: opts.updatePageSEO,
        updateSiteMetadata: opts.updateSiteMetadata,
        switchPage: opts.switchPage,
        createPage: opts.createPage,
        addBlock: opts.addBlock,
        on,
        emit,
        ext
    };

    return {
        ctx,
        emit,
        init: (plugins: EditorPlugin[]) => plugins.forEach(p => p.onInit?.(ctx)),
        destroy: (plugins: EditorPlugin[]) => {
            plugins.forEach(p => p.onDestroy?.());
            events.clear();
            extensions.clear();
        }
    };
}

export type PluginManager = ReturnType<typeof createPluginManager>;
