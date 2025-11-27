import type { EditorPlugin } from '../context';
import { Palette } from '@lucide/svelte';
import ThemesPluginSidebar from './ThemesPluginSidebar.svelte';

/**
 * Themes Plugin
 * Provides theme selection and application for the editor
 */
export const themesPlugin: EditorPlugin = {
    id: 'themes',
    name: 'Themes',
    icon: Palette,
    sidebar: ThemesPluginSidebar,
    railButton: {
        title: 'Themes',
        order: 40 // After site layout
    }
};
