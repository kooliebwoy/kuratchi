import type { EditorPlugin } from '../context';
import { Bike } from '@lucide/svelte';
import CatalogPluginSidebar from './CatalogPluginSidebar.svelte';

/**
 * Catalog Plugin
 * Provides vehicle catalog functionality for displaying OEM vehicles on sites
 */
export const catalogPlugin: EditorPlugin = {
    id: 'catalog',
    name: 'Catalog',
    icon: Bike,
    sidebar: CatalogPluginSidebar,
    railButton: {
        title: 'Catalog',
        order: 45
    }
};
