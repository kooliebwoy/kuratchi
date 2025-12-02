import type { ComponentType } from 'svelte';

const uuid = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

/**
 * Serializable snapshot for a block instance. Matches the payload saved in metadata script tags.
 */
export interface BlockSnapshot extends Record<string, unknown> {
	type: string;
}

export interface BlockPresetDefinition {
	id: string;
	name: string;
	description?: string;
	icon?: ComponentType;
	tags?: string[];
	create: () => BlockSnapshot[];
}

export interface SiteRegionState {
	blocks: BlockSnapshot[];
}

export interface EditorState {
  page: PageData;
  header: SiteRegionState | null;
  footer: SiteRegionState | null;
  metadata: Record<string, unknown>;
}

/**
 * Single source of truth for all page data
 */
export interface PageData {
  /**
   * Unique identifier for the page (optional for new pages)
   */
  id?: string;
  /**
   * Page title displayed in the editor and browser
   */
  title: string;
  /**
   * SEO meta title
   */
  seoTitle: string;
  /**
   * SEO meta description
   */
  seoDescription: string;
  /**
   * URL slug for the page
   */
  slug: string;
  /**
   * Domain for the page (display only)
   */
  domain?: string;
  /**
   * Serialized block data for page content
   */
  content: Array<Record<string, unknown>>;
}

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
}

export interface BlogTag {
  id: string;
  name: string;
  slug: string;
}

export interface BlogPost {
  id: string;
  pageId: string;
  title: string;
  slug: string;
  excerpt: string;
  author?: string;
  publishedOn?: string;
  coverImage?: {
    url: string;
    alt?: string;
  };
  categories: string[];
  tags: string[];
  featured?: boolean;
}

export interface BlogSettings {
  layout?: 'classic' | 'grid' | 'minimal';
  showAuthor?: boolean;
  heroStyle?: 'cover' | 'split';
  themeId?: string;
  featuredPostId?: string | null;
  indexPageId?: string | null;
  indexSlug?: string;
  postsPerPage?: number;
  sortOrder?: 'newest' | 'oldest' | 'manual';
}

export interface BlogData {
  categories: BlogCategory[];
  tags: BlogTag[];
  posts: BlogPost[];
  settings: BlogSettings;
}

const createBlogSeed = (): BlogData => ({
  categories: [
    { id: uuid(), name: 'Announcements', slug: 'announcements' },
    { id: uuid(), name: 'Guides', slug: 'guides' },
    { id: uuid(), name: 'Inspiration', slug: 'inspiration' }
  ],
  tags: [
    { id: uuid(), name: 'tips', slug: 'tips' },
    { id: uuid(), name: 'design', slug: 'design' },
    { id: uuid(), name: 'product', slug: 'product' }
  ],
  posts: [
    {
      id: uuid(),
      pageId: 'sample-post-1',
      title: 'Designing immersive brand experiences',
      slug: 'designing-immersive-brand-experiences',
      excerpt: 'Learn how to craft memorable, high-converting landing pages that capture your audience.',
      publishedOn: new Date().toISOString().slice(0, 10),
      coverImage: {
        url: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=1600&q=80',
        alt: 'Creative studio moodboard'
      },
      categories: ['guides'],
      tags: ['design', 'tips'],
      featured: true
    },
    {
      id: uuid(),
      pageId: 'sample-post-2',
      title: 'April product drop: tactile essentials',
      slug: 'april-product-drop',
      excerpt: 'A closer look at our latest release and what inspired the textures behind each piece.',
      publishedOn: new Date().toISOString().slice(0, 10),
      coverImage: {
        url: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1600&q=80',
        alt: 'Product flatlay'
      },
      categories: ['announcements'],
      tags: ['product'],
      featured: false
    },
    {
      id: uuid(),
      pageId: 'sample-post-3',
      title: 'Styling minimalist retail interiors',
      slug: 'styling-minimalist-retail-interiors',
      excerpt: 'Create flexible retail displays using modular blocks you can rearrange overnight.',
      publishedOn: new Date().toISOString().slice(0, 10),
      coverImage: {
        url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80',
        alt: 'Retail interior'
      },
      categories: ['inspiration'],
      tags: ['design'],
      featured: false
    }
  ],
  settings: {
    themeId: 'classic',
    layout: 'classic',
    showAuthor: true,
    heroStyle: 'cover',
    featuredPostId: null,
    indexPageId: null,
    indexSlug: 'blog',
    postsPerPage: 6,
    sortOrder: 'newest'
  }
});

export const createDefaultBlogData = (): BlogData => structuredClone(createBlogSeed());

// Form Builder Types
export type FormFieldType = 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date' | 'file';

export interface FormFieldOption {
  id: string;
  label: string;
  value: string;
}

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  name: string;
  options?: FormFieldOption[];  // For select, radio, checkbox
  defaultValue?: string;
  helpText?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    errorMessage?: string;
  };
  width?: '25' | '33' | '50' | '66' | '75' | '100';  // Percentage width for layout
}

export interface FormSettings {
  formName: string;
  submitButtonText: string;
  successMessage: string;
  errorMessage: string;
  recipients: string[];  // Email addresses to receive submissions
  autoResponder: {
    enabled: boolean;
    subject: string;
    message: string;
    replyTo?: string;
  };
  styling: {
    buttonColor?: string;
    buttonTextColor?: string;
    borderRadius?: string;
    spacing?: 'compact' | 'normal' | 'relaxed';
  };
  redirectUrl?: string;  // Optional redirect after submission
  submitEndpoint?: string;  // Custom endpoint for form submission
}

export interface FormData {
  id: string;
  fields: FormField[];
  settings: FormSettings;
}

const createFormSeed = (): FormData => ({
  id: uuid(),
  fields: [
    {
      id: uuid(),
      type: 'text',
      label: 'Full Name',
      name: 'fullName',
      placeholder: 'Enter your full name',
      required: true,
      width: '100'
    },
    {
      id: uuid(),
      type: 'email',
      label: 'Email Address',
      name: 'email',
      placeholder: 'your@email.com',
      required: true,
      width: '100'
    },
    {
      id: uuid(),
      type: 'textarea',
      label: 'Message',
      name: 'message',
      placeholder: 'Type your message here...',
      required: false,
      width: '100'
    }
  ],
  settings: {
    formName: 'Contact Form',
    submitButtonText: 'Send Message',
    successMessage: 'Thank you! Your message has been sent successfully.',
    errorMessage: 'Sorry, something went wrong. Please try again.',
    recipients: [],
    autoResponder: {
      enabled: false,
      subject: 'Thank you for contacting us',
      message: 'We have received your message and will get back to you soon.'
    },
    styling: {
      buttonColor: '#3b82f6',
      buttonTextColor: '#ffffff',
      borderRadius: '0.375rem',
      spacing: 'normal'
    }
  }
});

export const createDefaultFormData = (): FormData => structuredClone(createFormSeed());

export interface EditorOptions {
  /**
   * Reference to the rendered editor container. Managed internally when omitted.
   */
  editor?: HTMLElement | null;
  /**
   * Complete page data (single source of truth)
   */
  pageData?: PageData;
  /**
   * Toggle whether the editor is editable.
   */
  editable?: boolean;
  /**
   * When true, renders header and footer regions in addition to page content.
   */
  isWebpage?: boolean;
  /**
   * Enable layout presets (hero sections, etc.).
   */
  layoutsEnabled?: boolean;
  /**
   * Configuration passed to image utilities for uploads.
   */
  imageConfig?: {
    uploadEndpoint?: string;
    /**
     * Custom upload handler function
     * @param file - The file to upload
     * @param folder - Optional folder path
     * @returns Promise with upload result containing url, key, etc.
     */
    uploadHandler?: (file: File, folder?: string) => Promise<{
      url: string;
      key?: string;
      filename?: string;
      size?: number;
      contentType?: string;
    }>;
    /**
     * Custom delete handler function
     * @param imageId - The image ID or key to delete
     */
    deleteHandler?: (imageId: string) => Promise<void>;
  };
  /**
   * Show the full editor UI with sidebars and toolbars. When false, shows only the canvas.
   */
  showUI?: boolean;
  /**
   * Initial device preview size: 'phone' | 'tablet' | 'desktop'
   */
  initialDeviceSize?: 'phone' | 'tablet' | 'desktop';
  /**
   * Available pages for menu widget
   */
  pages?: Array<Record<string, unknown>>;
  /**
   * Reserved pages for menu widget
   */
  reservedPages?: Array<Record<string, unknown>>;
  /**
   * Callback when any page data changes (debounced autosave)
   */
  onUpdate?: (pageData: PageData) => void | Promise<void>;
  /**
   * Callback that receives the full editor state (page + header/footer + metadata)
   */
  onStateUpdate?: (state: EditorState) => void | Promise<void>;
  /**
   * Autosave delay in milliseconds (default: 1000)
   */
  autoSaveDelay?: number;
  /**
   * Site-level header region (shared across all pages)
   */
  siteHeader?: SiteRegionState | null;
  /**
   * Site-level footer region (shared across all pages)
   */
  siteFooter?: SiteRegionState | null;
  /**
   * Site-level metadata (theme, colors, fonts, etc.)
   */
  siteMetadata?: Record<string, unknown>;
  /**
   * Blog collections (posts, categories, tags)
   */
  blog?: BlogData;
  /**
   * Callback when site header changes
   */
  onSiteHeaderUpdate?: (header: SiteRegionState | null) => void | Promise<void>;
  /**
   * Callback when site footer changes
   */
  onSiteFooterUpdate?: (footer: SiteRegionState | null) => void | Promise<void>;
  /**
   * Callback when site metadata changes
   */
  onSiteMetadataUpdate?: (metadata: Record<string, unknown>) => void | Promise<void>;
  /**
   * Current page ID for multi-page editing
   */
  currentPageId?: string;
  /**
   * Callback when user switches pages
   */
  onPageSwitch?: (pageId: string) => void;
  /**
   * Callback when user creates a new page
   * Receives the page title and slug, should return the created page with its ID
   */
  onPageCreate?: (data: { title: string; slug: string }) => Promise<{ id: string; title: string; slug: string }>;
  /**
   * List of enabled plugin IDs (e.g., ['forms', 'blog'])
   * If not specified, all registered plugins are enabled
   */
  enabledPlugins?: string[];
}

export const defaultPageData: PageData = {
  title: 'Untitled Page',
  seoTitle: '',
  seoDescription: '',
  slug: '',
  domain: 'example.com',
  content: [] satisfies Array<Record<string, unknown>>
};

export const defaultEditorOptions: Required<Pick<EditorOptions, 'editable' | 'isWebpage' | 'layoutsEnabled' | 'showUI' | 'initialDeviceSize' | 'autoSaveDelay'>> &
  Omit<EditorOptions, 'editable' | 'isWebpage' | 'layoutsEnabled' | 'showUI' | 'initialDeviceSize' | 'autoSaveDelay'> = {
  editor: null,
  pageData: defaultPageData,
  editable: true,
  isWebpage: true,
  layoutsEnabled: true,
  imageConfig: {},
  showUI: true,
  initialDeviceSize: 'desktop',
  pages: undefined,
  reservedPages: undefined,
  onUpdate: undefined,
  autoSaveDelay: 1000,
  siteMetadata: undefined,
  blog: undefined
};
