import type { EditorPlugin } from '../types';
import { Navigation } from '@lucide/svelte';
import NavigationPluginSidebar from './NavigationPluginSidebar.svelte';

/**
 * Navigation Plugin
 * Provides navigation/menu management for header and footer
 */
export const navigationPlugin: EditorPlugin = {
    id: 'navigation',
    name: 'Navigation',
    icon: Navigation,
    sidebar: NavigationPluginSidebar,
    railButton: {
        title: 'Navigation',
        order: 20
    }
};
