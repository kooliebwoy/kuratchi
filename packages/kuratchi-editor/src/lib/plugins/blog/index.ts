import type { EditorPlugin } from '../context';
import { BookOpen } from '@lucide/svelte';
import BlogPluginSidebar from './BlogPluginSidebar.svelte';

/**
 * Blog Plugin
 * Provides blog management functionality for posts, categories, and tags
 */
export const blogPlugin: EditorPlugin = {
    id: 'blog',
    name: 'Blog',
    icon: BookOpen,
    sidebar: BlogPluginSidebar,
    railButton: {
        title: 'Blog',
        order: 30
    }
};
