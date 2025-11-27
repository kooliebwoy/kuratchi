import type { EditorPlugin } from '../context';
import { FileText } from '@lucide/svelte';
import PagesPluginSidebar from './PagesPluginSidebar.svelte';

/**
 * Pages Plugin
 * Provides page management functionality for the editor
 */
export const pagesPlugin: EditorPlugin = {
    id: 'pages',
    name: 'Pages',
    icon: FileText,
    sidebar: PagesPluginSidebar,
    railButton: {
        title: 'Pages',
        order: 10 // First in the list
    }
};
