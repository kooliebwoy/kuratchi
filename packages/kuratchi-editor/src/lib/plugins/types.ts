import type { Component } from 'svelte';

/**
 * Page item for pages list
 */
export interface PageItem {
    id: string;
    name: string;
    slug: string;
}

/**
 * Navigation menu item
 */
export interface NavMenuItem {
    id: string;
    label: string;
    slug: string;
    pageId?: string;
}

/**
 * Navigation state for header/footer
 */
export interface NavRegionState {
    visible: boolean;
    useMobileMenuOnDesktop?: boolean;
    items: NavMenuItem[];
}

/**
 * Full navigation state
 */
export interface NavigationState {
    header: NavRegionState;
    footer: NavRegionState;
    custom?: Record<string, NavMenuItem[]>;
}

/**
 * Context provided to plugins for interacting with the editor
 */
export interface PluginContext {
    /** Current site metadata */
    siteMetadata: Record<string, unknown>;
    /** Update site metadata */
    updateSiteMetadata: (updates: Record<string, unknown>) => void;
    /** Available pages */
    pages: PageItem[];
    /** Reserved page slugs */
    reservedPages: string[];
    /** Editor element reference */
    editor: HTMLElement | null;
    /** Current page ID */
    currentPageId?: string | null;
    /** Callback to switch to a different page */
    onPageSwitch?: (pageId: string) => void;
    /** Callback to create a new page */
    onCreatePage?: () => void;
    /** Add a page to a menu location (header/footer) */
    addPageToMenu?: (location: 'header' | 'footer', page: PageItem) => void;
    
    // Navigation-related context
    /** Current navigation state */
    navigation?: NavigationState;
    /** Update header menu items */
    onHeaderMenuSave?: (data: { items: NavMenuItem[] }) => void;
    /** Update footer menu items */
    onFooterMenuSave?: (data: { items: NavMenuItem[] }) => void;
    /** Toggle header visibility */
    onToggleHeaderVisible?: (visible: boolean) => void;
    /** Toggle footer visibility */
    onToggleFooterVisible?: (visible: boolean) => void;
    /** Toggle mobile menu on desktop for header */
    onToggleHeaderMobileOnDesktop?: (enabled: boolean) => void;
}

/**
 * Plugin definition interface
 */
export interface EditorPlugin {
    /** Unique plugin identifier */
    id: string;
    /** Display name */
    name: string;
    /** Icon component from lucide-svelte */
    icon: Component;
    /** Sidebar content component */
    sidebar: Component<{ context: PluginContext }>;
    /** Optional rail button configuration */
    railButton?: {
        title?: string;
        order?: number;
    };
    /** Initialize plugin with context */
    onInit?: (context: PluginContext) => void;
    /** Cleanup when plugin is destroyed */
    onDestroy?: () => void;
}
