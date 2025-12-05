export { default as Editor } from './Editor.svelte';
export { defaultPageData, createDefaultBlogData } from './types';
export type { PageData, EditorOptions, EditorState, BlogData, BlogPost, BlogSettings, BlockSnapshot, SiteRegionState } from './types';
export { themes, getTheme, getAllThemes, getThemeMetadata, getThemeHomepage, getThemeTemplate, DEFAULT_THEME_ID } from './themes';
export type { ThemeMetadata, ThemeTemplate } from './themes';
export { DEFAULT_THEME_SETTINGS } from './plugins/context';
export type { ThemeSettings } from './plugins/context';
export { getBlock, blocks } from './registry/blocks.svelte';
export { getSection, sections } from './registry/sections.svelte';
export { getHeader, headers } from './registry/headers.svelte';
export { getFooter, footers } from './registry/footers.svelte';
export { resolveBlockRender } from './render/index';
export { blogStore } from './stores/blog';

// Export functions for converting blocks to HTML/text
export { blocksToHtml, blocksToEmailHtml, blocksToText } from './export';
