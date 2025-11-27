import type { EditorPlugin } from '../context';
import { PanelTop } from '@lucide/svelte';
import SitePluginSidebar from './SitePluginSidebar.svelte';

/**
 * Site Plugin
 * Provides site layout management (headers/footers) for the editor
 */
export const sitePlugin: EditorPlugin = {
    id: 'site',
    name: 'Site',
    icon: PanelTop,
    sidebar: SitePluginSidebar,
    railButton: {
        title: 'Site Layout',
        order: 30 // After pages and navigation
    }
};
