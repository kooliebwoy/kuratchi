import type { Component } from 'svelte';

/**
 * Context provided to plugins for interacting with the editor
 */
export interface PluginContext {
    /** Current site metadata */
    siteMetadata: Record<string, unknown>;
    /** Update site metadata */
    updateSiteMetadata: (updates: Record<string, unknown>) => void;
    /** Available pages */
    pages: Array<{ id: string; name: string; slug: string }>;
    /** Reserved page slugs */
    reservedPages: string[];
    /** Editor element reference */
    editor: HTMLElement | null;
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
