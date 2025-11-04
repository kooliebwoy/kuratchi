/**
 * Theme Registry
 * Centralized theme definitions with metadata and default templates
 */

import type { PageData } from '../types';

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
}

/**
 * Minimal Theme - Clean and simple design
 */
const minimalTheme: ThemeTemplate = {
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
      {
        type: 'heading',
        level: 1,
        text: 'Welcome to Your Site',
        alignment: 'center'
      },
      {
        type: 'paragraph',
        text: 'Start building your website by adding blocks from the sidebar.',
        alignment: 'center'
      }
    ],
    header: null,
    footer: null,
    metadata: {
      backgroundColor: '#ffffff'
    }
  }
};

/**
 * Modern Theme - Contemporary and sleek
 */
const modernTheme: ThemeTemplate = {
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
      {
        type: 'heading',
        level: 1,
        text: 'Modern Design',
        alignment: 'left'
      },
      {
        type: 'paragraph',
        text: 'Experience contemporary design with clean lines and bold typography.',
        alignment: 'left'
      },
      {
        type: 'divider'
      },
      {
        type: 'paragraph',
        text: 'Add your content here to get started.',
        alignment: 'left'
      }
    ],
    header: null,
    footer: null,
    metadata: {
      backgroundColor: '#f8f9fa'
    }
  }
};

/**
 * Classic Theme - Timeless and elegant
 */
const classicTheme: ThemeTemplate = {
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
      {
        type: 'heading',
        level: 1,
        text: 'Classic Elegance',
        alignment: 'center'
      },
      {
        type: 'paragraph',
        text: 'Timeless design that never goes out of style.',
        alignment: 'center'
      }
    ],
    header: null,
    footer: null,
    metadata: {
      backgroundColor: '#fafafa'
    }
  }
};

/**
 * Bold Theme - Eye-catching and vibrant
 */
const boldTheme: ThemeTemplate = {
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
      {
        type: 'heading',
        level: 1,
        text: 'Make a Statement',
        alignment: 'center'
      },
      {
        type: 'paragraph',
        text: 'Bold design for those who dare to be different.',
        alignment: 'center'
      }
    ],
    header: null,
    footer: null,
    metadata: {
      backgroundColor: '#1a1a1a'
    }
  }
};

/**
 * Creative Theme - Artistic and unique
 */
const creativeTheme: ThemeTemplate = {
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
      {
        type: 'heading',
        level: 1,
        text: 'Creative Expression',
        alignment: 'left'
      },
      {
        type: 'paragraph',
        text: 'Unleash your creativity with unique design elements.',
        alignment: 'left'
      }
    ],
    header: null,
    footer: null,
    metadata: {
      backgroundColor: '#f0f4f8'
    }
  }
};

/**
 * Professional Theme - Business-focused design
 */
const professionalTheme: ThemeTemplate = {
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
      {
        type: 'heading',
        level: 1,
        text: 'Professional Solutions',
        alignment: 'center'
      },
      {
        type: 'paragraph',
        text: 'Business-focused design that builds trust and credibility.',
        alignment: 'center'
      }
    ],
    header: null,
    footer: null,
    metadata: {
      backgroundColor: '#ffffff'
    }
  }
};

/**
 * Theme registry - all available themes
 */
export const themes: Record<string, ThemeTemplate> = {
  minimal: minimalTheme,
  modern: modernTheme,
  classic: classicTheme,
  bold: boldTheme,
  creative: creativeTheme,
  professional: professionalTheme
};

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
