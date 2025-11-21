import type { BlockSnapshot } from '../presets/types';
import type { BlogSettings } from '../types';

export interface BlogTheme {
  id: string;
  name: string;
  description: string;
  defaultSettings: Partial<BlogSettings>;
  createIndexBlocks: () => BlockSnapshot[];
  createPostBlocks: () => BlockSnapshot[];
}

const clone = <T extends BlockSnapshot>(snapshot: T): T => JSON.parse(JSON.stringify(snapshot));

const classicBlogIndexBlocks: BlockSnapshot[] = [
  {
    type: 'blog-hero',
    heading: 'From the Studio',
    body: 'Stories, guides, and product updates from the team.',
    align: 'center'
  },
  {
    type: 'blog-post-list',
    layout: 'grid',
    showExcerpt: true,
    showDate: true,
    showCategories: true,
    showReadMore: true,
    readMoreLabel: 'Read article'
  }
];

const emptyPostBlocks: BlockSnapshot[] = [];

const blogThemes: Record<string, BlogTheme> = {
  classic: {
    id: 'classic',
    name: 'Classic Blog',
    description: 'Hero plus a grid of recent articles.',
    defaultSettings: {
      layout: 'classic',
      heroStyle: 'cover',
      postsPerPage: 6,
      sortOrder: 'newest'
    },
    createIndexBlocks: () => classicBlogIndexBlocks.map(clone),
    createPostBlocks: () => emptyPostBlocks.map(clone)
  }
};

export const DEFAULT_BLOG_THEME_ID = 'classic';

export const getAllBlogThemes = (): BlogTheme[] => Object.values(blogThemes);

export const getBlogTheme = (themeId?: string | null): BlogTheme => {
  const id = themeId || DEFAULT_BLOG_THEME_ID;
  return blogThemes[id] || blogThemes[DEFAULT_BLOG_THEME_ID];
};
