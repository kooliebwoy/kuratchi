import type { EditorPlugin } from '../context';
import { Layers } from '@lucide/svelte';
import ModalsPluginSidebar from './ModalsPluginSidebar.svelte';

/**
 * Modals Plugin
 * Provides a modal management system for forms, lead capture, and custom content
 */
export const modalsPlugin: EditorPlugin = {
    id: 'modals',
    name: 'Modals',
    icon: Layers,
    sidebar: ModalsPluginSidebar,
    railButton: {
        title: 'Modals',
        order: 45
    }
};
