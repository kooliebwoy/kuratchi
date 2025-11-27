// Plugin types and context
export type {
    PluginContext,
    EditorPlugin,
    EditorEvent,
    PageItem,
    CurrentPageData,
    SEOUpdate,
    NavMenuItem,
    NavRegionState,
    NavigationState,
    NavigationExtension,
    SitePresetItem,
    SiteLayoutExtension,
    ThemeOption,
    ThemesExtension,
} from './context';

export { EXT } from './context';

// Plugin manager
export { createPluginManager, type PluginManager, type PluginManagerOptions } from './manager';

// Plugins
export { pagesPlugin } from './pages';
export { navigationPlugin } from './navigation';
export { sitePlugin } from './site';
export { themesPlugin } from './themes';
export { formsPlugin } from './forms';

// Shared components
export { default as MenuWidget } from './MenuWidget.svelte';
export { default as FormBuilder } from './FormBuilder.svelte';
