/**
 * Plugin Context - Single source of truth for plugin types
 */
import type { Component } from 'svelte';

// ============================================
// Core Types
// ============================================

export interface PageItem {
    id: string;
    name: string;
    slug: string;
}

export interface CurrentPageData {
    title: string;
    slug: string;
    seoTitle?: string;
    seoDescription?: string;
    content: Array<Record<string, unknown>>;
}

export interface SEOUpdate {
    seoTitle?: string;
    seoDescription?: string;
    slug?: string;
}

// ============================================
// Navigation Types
// ============================================

export interface NavMenuItem {
    id: string;
    label: string;
    slug: string;
    pageId?: string;
}

export interface NavRegionState {
    visible: boolean;
    useMobileMenuOnDesktop?: boolean;
    items: NavMenuItem[];
}

export interface NavigationState {
    header: NavRegionState;
    footer: NavRegionState;
    custom?: Record<string, NavMenuItem[]>;
}

// ============================================
// Site Layout Types
// ============================================

export interface SitePresetItem {
    type: string;
    name: string;
    component: Component;
}

// ============================================
// Theme Types
// ============================================

export interface ThemeOption {
    metadata: {
        id: string;
        name: string;
        description: string;
    };
    header?: Component;
    footer?: Component;
    defaultHomepage?: {
        title: string;
        slug: string;
        seoTitle?: string;
        seoDescription?: string;
        content: Component[];
    };
    siteMetadata?: Record<string, unknown>;
}

/**
 * Theme settings for live style customization.
 * These settings override theme defaults without replacing content.
 */
export interface ThemeSettings {
    /** Layout max width: 'full' | 'wide' (1440px) | 'medium' (1200px) | 'narrow' (960px) */
    maxWidth: 'full' | 'wide' | 'medium' | 'narrow';
    /** Section spacing: 'none' | 'small' | 'medium' | 'large' */
    sectionSpacing: 'none' | 'small' | 'medium' | 'large';
    /** Site background color */
    backgroundColor: string;
    /** Primary accent color */
    primaryColor: string;
    /** Secondary accent color */
    secondaryColor: string;
    /** Text color */
    textColor: string;
    /** Border radius style: 'none' | 'small' | 'medium' | 'large' */
    borderRadius: 'none' | 'small' | 'medium' | 'large';
}

/** Default theme settings */
export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
    maxWidth: 'full',
    sectionSpacing: 'medium',
    backgroundColor: '#ffffff',
    primaryColor: '#3b82f6',
    secondaryColor: '#64748b',
    textColor: '#0f172a',
    borderRadius: 'medium'
};

// ============================================
// Extension Interfaces
// ============================================

export interface NavigationExtension {
    readonly state: NavigationState;
    updateHeaderMenu: (items: NavMenuItem[]) => void;
    updateFooterMenu: (items: NavMenuItem[]) => void;
    setHeaderVisible: (visible: boolean) => void;
    setFooterVisible: (visible: boolean) => void;
    setHeaderMobileOnDesktop: (enabled: boolean) => void;
    addPageToMenu: (location: 'header' | 'footer', page: PageItem) => void;
}

export interface SiteLayoutExtension {
    readonly headerPresets: SitePresetItem[];
    readonly footerPresets: SitePresetItem[];
    readonly currentHeaderType: string | null;
    readonly currentFooterType: string | null;
    mountHeader: (component: Component, props?: Record<string, unknown>) => void;
    mountFooter: (component: Component, props?: Record<string, unknown>) => void;
}

export interface ThemesExtension {
    readonly themes: ThemeOption[];
    readonly selectedThemeId: string;
    readonly themeSettings: ThemeSettings;
    /** Apply a new theme (replaces content with theme defaults - use for initial setup) */
    applyTheme: (themeId: string) => void;
    /** Switch theme without replacing content (only updates styles and optionally header/footer) */
    switchTheme: (themeId: string, options?: { updateHeaderFooter?: boolean }) => void;
    /** Update individual theme settings */
    updateThemeSettings: (settings: Partial<ThemeSettings>) => void;
    /** Reset theme settings to defaults */
    resetThemeSettings: () => void;
}

// ============================================
// Extension Keys
// ============================================

export const EXT = {
    NAVIGATION: 'navigation',
    SITE_LAYOUT: 'site-layout',
    THEMES: 'themes',
    FORMS: 'forms',
    BLOG: 'blog',
} as const;

// ============================================
// Events
// ============================================

export type EditorEvent =
    | 'page:changed'
    | 'page:saved'
    | 'content:changed'
    | 'metadata:changed'
    | 'header:changed'
    | 'footer:changed'
    | 'theme:applied'
    | 'navigation:changed'
    | string;

// ============================================
// Plugin Context
// ============================================

export interface PluginContext {
    // State (read-only)
    readonly currentPage: CurrentPageData;
    readonly pages: PageItem[];
    readonly reservedPages: string[];
    readonly currentPageId: string | null;
    readonly siteMetadata: Record<string, unknown>;
    readonly editor: HTMLElement | null;

    // Actions
    updatePageTitle: (title: string) => void;
    updatePageSEO: (seo: SEOUpdate) => void;
    updateSiteMetadata: (updates: Record<string, unknown>) => void;
    switchPage: (pageId: string) => void;
    createPage: () => void;
    addBlock: (type: string, props?: Record<string, unknown>) => void;

    // Events
    on: <T = unknown>(event: EditorEvent, handler: (data: T) => void) => () => void;
    emit: <T = unknown>(event: EditorEvent, data: T) => void;

    // Extensions
    ext: <T>(key: string) => T | undefined;
}

// ============================================
// Plugin Definition
// ============================================

export interface EditorPlugin {
    id: string;
    name: string;
    icon: Component;
    sidebar: Component<{ ctx: PluginContext }>;
    railButton?: {
        title?: string;
        order?: number;
    };
    onInit?: (ctx: PluginContext) => void;
    onDestroy?: () => void;
}
