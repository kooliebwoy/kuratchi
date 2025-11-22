import type { EditorPlugin } from '../types';
import { FileInput } from '@lucide/svelte';
import FormsPluginSidebar from './FormsPluginSidebar.svelte';

/**
 * Forms Plugin
 * Provides form builder functionality for creating and managing forms
 */
export const formsPlugin: EditorPlugin = {
    id: 'forms',
    name: 'Forms',
    icon: FileInput,
    sidebar: FormsPluginSidebar,
    railButton: {
        title: 'Forms',
        order: 40
    }
};
