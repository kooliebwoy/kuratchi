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
    ThemeSettings,
    ThemesExtension,
} from './context';

export { EXT, DEFAULT_THEME_SETTINGS } from './context';

// Plugin manager
export { createPluginManager, type PluginManager, type PluginManagerOptions } from './manager';

// Plugins
export { pagesPlugin } from './pages';
export { navigationPlugin } from './navigation';
export { sitePlugin } from './site';
export { themesPlugin } from './themes';
export { formsPlugin } from './forms';
export { catalogPlugin } from './catalog';
export { modalsPlugin } from './modals';

// Modal system
export * from './modals/modal-manager.svelte';
export { default as ModalContainer } from './modals/ModalContainer.svelte';
export { default as FormRenderer } from './modals/FormRenderer.svelte';
export { default as LeadCTAButtons } from './modals/LeadCTAButtons.svelte';

// Shared components
export { default as MenuWidget } from './MenuWidget.svelte';
export { default as FormBuilder } from './FormBuilder.svelte';
