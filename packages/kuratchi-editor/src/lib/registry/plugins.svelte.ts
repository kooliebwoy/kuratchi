import type { EditorPlugin } from '../plugins/context';
import { pagesPlugin } from '../plugins/pages';
import { sitePlugin } from '../plugins/site';
import { themesPlugin } from '../plugins/themes';

// DEPRECATED - Removed in favor of contract-based architecture
// Navigation settings are now embedded in each header component's inspector
// Menu items are managed in Dashboard CRUD and injected via siteMetadata
// See: src/lib/contracts/ARCHITECTURE.md
// import { navigationPlugin } from '../plugins/navigation';
// import { formsPlugin } from '../plugins/forms';
// import { catalogPlugin } from '../plugins/catalog';
// import { blogPlugin } from '../plugins/blog';

/**
 * Plugin registry - similar to blocks registry
 */
class PluginRegistry {
    private plugins: Map<string, EditorPlugin> = new Map();

    /**
     * Register a plugin
     */
    register(plugin: EditorPlugin): void {
        if (this.plugins.has(plugin.id)) {
            console.warn(`Plugin "${plugin.id}" is already registered. Overwriting.`);
        }
        this.plugins.set(plugin.id, plugin);
    }

    /**
     * Get a plugin by ID
     */
    get(id: string): EditorPlugin | undefined {
        return this.plugins.get(id);
    }

    /**
     * Get all registered plugins
     */
    getAll(): EditorPlugin[] {
        return Array.from(this.plugins.values()).sort((a, b) => {
            const orderA = a.railButton?.order ?? 999;
            const orderB = b.railButton?.order ?? 999;
            return orderA - orderB;
        });
    }

    /**
     * Check if a plugin is registered
     */
    has(id: string): boolean {
        return this.plugins.has(id);
    }

    /**
     * Unregister a plugin
     */
    unregister(id: string): boolean {
        return this.plugins.delete(id);
    }

    /**
     * Clear all plugins
     */
    clear(): void {
        this.plugins.clear();
    }
}

// Singleton instance
const registry = new PluginRegistry();

// Register active plugins only
// Navigation settings are now embedded in each header component's inspector
// DEPRECATED plugins (forms, catalog, blog, navigation) removed - see contracts/ARCHITECTURE.md
registry.register(pagesPlugin);
registry.register(sitePlugin);
registry.register(themesPlugin);

/**
 * Array of all registered plugins (sorted by order)
 */
export const plugins = registry.getAll();

/**
 * Get a specific plugin by ID
 */
export const getPlugin = (id: string): EditorPlugin | undefined => registry.get(id);

/**
 * Get enabled plugins based on IDs
 * If no IDs provided, returns all registered plugins
 */
export const getEnabledPlugins = (pluginIds?: string[]): EditorPlugin[] => {
    if (!pluginIds || pluginIds.length === 0) {
        return plugins;
    }
    
    return pluginIds
        .map(id => registry.get(id))
        .filter((plugin): plugin is EditorPlugin => plugin !== undefined);
};

/**
 * Direct access to registry for advanced use cases
 */
export const pluginRegistry = registry;
