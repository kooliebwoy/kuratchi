/**
 * Theme Registry
 * 
 * Architecture: Blocks → Sections → Themes
 * - Blocks: atomic components (Button, Heading, Image)
 * - Sections: compositions of blocks (hero-figure, services-grid)
 * - Themes: header + footer + homepage (composed of sections) + metadata
 */

import type { PageData, SiteRegionState } from '../types';
import { createDefaultBlogData } from '../types';

export interface ThemeMetadata {
  id: string;
  name: string;
  description: string;
  author?: string;
  version?: string;
  preview?: string;
}

export interface ThemeTemplate {
  metadata: ThemeMetadata;
  defaultHomepage: Omit<PageData, 'id' | 'domain'>;
  siteHeader: SiteRegionState | null;
  siteFooter: SiteRegionState | null;
  siteMetadata: Record<string, unknown>;
}

/**
 * Minimal Theme - Clean and simple design
 */
const createMinimalTheme = (): ThemeTemplate => ({
  metadata: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean and simple design',
    author: 'Kuratchi',
    version: '1.0.0'
  },
  defaultHomepage: {
    title: 'Welcome',
    seoTitle: 'Welcome to Your Site',
    seoDescription: 'A beautiful minimal website',
    slug: 'homepage',
    content: [
      { type: 'hero-figure' },
      { type: 'icon-bar' },
      { type: 'services-grid' }
    ]
  },
  siteHeader: { blocks: [{ type: 'saige-blake-header' }] },
  siteFooter: { blocks: [{ type: 'saige-blake-footer' }] },
  siteMetadata: {
    backgroundColor: '#ffffff',
    themeId: 'minimal',
    blog: createDefaultBlogData()
  }
});

/**
 * Modern Theme - Contemporary and sleek
 */
const createModernTheme = (): ThemeTemplate => ({
  metadata: {
    id: 'modern',
    name: 'Modern',
    description: 'Contemporary and sleek',
    author: 'Kuratchi',
    version: '1.0.0'
  },
  defaultHomepage: {
    title: 'Modern Design',
    seoTitle: 'Modern Design - Your Site',
    seoDescription: 'A contemporary website with modern aesthetics',
    slug: 'homepage',
    content: [
      { type: 'hero-overlay' },
      { type: 'card-with-slider' },
      { type: 'grid-ctas' }
    ]
  },
  siteHeader: { blocks: [{ type: 'twig-and-pearl-header' }] },
  siteFooter: { blocks: [{ type: 'twig-and-pearl-footer' }] },
  siteMetadata: {
    backgroundColor: '#f8f9fa',
    themeId: 'modern',
    blog: createDefaultBlogData()
  }
});

/**
 * Classic Theme - Timeless and elegant
 */
const createClassicTheme = (): ThemeTemplate => ({
  metadata: {
    id: 'classic',
    name: 'Classic',
    description: 'Timeless and elegant',
    author: 'Kuratchi',
    version: '1.0.0'
  },
  defaultHomepage: {
    title: 'Classic Elegance',
    seoTitle: 'Classic Elegance - Your Site',
    seoDescription: 'A timeless website with elegant design',
    slug: 'homepage',
    content: [
      { type: 'about-us-hero' },
      { type: 'about-us-card' },
      { type: 'grid-ctas' }
    ]
  },
  siteHeader: { blocks: [{ type: 'saige-blake-header' }] },
  siteFooter: { blocks: [{ type: 'twig-and-pearl-footer' }] },
  siteMetadata: {
    backgroundColor: '#fafafa',
    themeId: 'classic',
    blog: createDefaultBlogData()
  }
});

/**
 * Bold Theme - Eye-catching and vibrant
 */
const createBoldTheme = (): ThemeTemplate => ({
  metadata: {
    id: 'bold',
    name: 'Bold',
    description: 'Eye-catching and vibrant',
    author: 'Kuratchi',
    version: '1.0.0'
  },
  defaultHomepage: {
    title: 'Make a Statement',
    seoTitle: 'Make a Statement - Your Site',
    seoDescription: 'A bold and vibrant website that stands out',
    slug: 'homepage',
    content: [
      { type: 'hero-overlay' },
      { type: 'icon-bar' },
      { type: 'services-grid' }
    ]
  },
  siteHeader: { blocks: [{ type: 'twig-and-pearl-header' }] },
  siteFooter: { blocks: [{ type: 'saige-blake-footer' }] },
  siteMetadata: {
    backgroundColor: '#1a1a1a',
    themeId: 'bold',
    blog: createDefaultBlogData()
  }
});

/**
 * Creative Theme - Artistic and unique
 */
const createCreativeTheme = (): ThemeTemplate => ({
  metadata: {
    id: 'creative',
    name: 'Creative',
    description: 'Artistic and unique',
    author: 'Kuratchi',
    version: '1.0.0'
  },
  defaultHomepage: {
    title: 'Creative Expression',
    seoTitle: 'Creative Expression - Your Site',
    seoDescription: 'An artistic website for creative minds',
    slug: 'homepage',
    content: [
      { type: 'hero-overlay' },
      { type: 'card-with-slider' },
      { type: 'grid-ctas' }
    ]
  },
  siteHeader: { blocks: [{ type: 'twig-and-pearl-header' }] },
  siteFooter: { blocks: [{ type: 'twig-and-pearl-footer' }] },
  siteMetadata: {
    backgroundColor: '#f0f4f8',
    themeId: 'creative',
    blog: createDefaultBlogData()
  }
});

/**
 * Professional Theme - Business-focused design
 */
const createProfessionalTheme = (): ThemeTemplate => ({
  metadata: {
    id: 'professional',
    name: 'Professional',
    description: 'Business-focused design',
    author: 'Kuratchi',
    version: '1.0.0'
  },
  defaultHomepage: {
    title: 'Professional Solutions',
    seoTitle: 'Professional Solutions - Your Business',
    seoDescription: 'A professional website for your business',
    slug: 'homepage',
    content: [
      { type: 'hero-overlay' },
      { type: 'services-grid' },
      { type: 'about-us-card' }
    ]
  },
  siteHeader: { blocks: [{ type: 'saige-blake-header' }] },
  siteFooter: { blocks: [{ type: 'saige-blake-footer' }] },
  siteMetadata: {
    backgroundColor: '#ffffff',
    themeId: 'professional',
    blog: createDefaultBlogData()
  }
});

/**
 * Theme registry - all available themes (lazy-loaded)
 */
const themeFactories: Record<string, () => ThemeTemplate> = {
  minimal: createMinimalTheme,
  modern: createModernTheme,
  classic: createClassicTheme,
  bold: createBoldTheme,
  creative: createCreativeTheme,
  professional: createProfessionalTheme
};

const themeCache: Record<string, ThemeTemplate> = {};

export const themes: Record<string, ThemeTemplate> = new Proxy(themeCache, {
  get(target, prop: string) {
    if (typeof prop === 'string' && !target[prop] && themeFactories[prop]) {
      target[prop] = themeFactories[prop]();
    }
    return target[prop];
  },
  ownKeys() {
    return Object.keys(themeFactories);
  },
  has(target, prop) {
    return prop in themeFactories;
  },
  getOwnPropertyDescriptor(target, prop) {
    if (typeof prop === 'string' && prop in themeFactories) {
      // Ensure theme is initialized before returning descriptor
      if (!target[prop]) {
        target[prop] = themeFactories[prop]();
      }
      return {
        enumerable: true,
        configurable: true,
        value: target[prop]
      };
    }
    return undefined;
  }
});

/**
 * Default theme ID
 */
export const DEFAULT_THEME_ID = 'minimal';

/**
 * Get theme by ID with fallback to default
 */
export function getTheme(themeId?: string | null): ThemeTemplate {
  const id = themeId || DEFAULT_THEME_ID;
  return themes[id] || themes[DEFAULT_THEME_ID];
}

/**
 * Get all available themes as array
 */
export function getAllThemes(): ThemeTemplate[] {
  return Object.values(themes);
}

/**
 * Get theme metadata only
 */
export function getThemeMetadata(themeId?: string | null): ThemeMetadata {
  return getTheme(themeId).metadata;
}

/**
 * Get default homepage template for a theme
 */
export function getThemeHomepage(themeId?: string | null): Omit<PageData, 'id' | 'domain'> {
  return getTheme(themeId).defaultHomepage;
}

/**
 * Get full theme template (including site-level data)
 */
export function getThemeTemplate(themeId?: string | null): ThemeTemplate {
  return getTheme(themeId);
}
