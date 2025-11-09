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
   * Autosave delay in milliseconds (default: 1000)
   */
  autoSaveDelay?: number;
  /**
   * Site-level header block (shared across all pages)
   */
  siteHeader?: Record<string, unknown> | null;
  /**
   * Site-level footer block (shared across all pages)
   */
  siteFooter?: Record<string, unknown> | null;
  /**
   * Site-level metadata (theme, colors, fonts, etc.)
   */
  siteMetadata?: Record<string, unknown>;
  /**
   * Callback when site header changes
   */
  onSiteHeaderUpdate?: (header: Record<string, unknown> | null) => void | Promise<void>;
  /**
   * Callback when site footer changes
   */
  onSiteFooterUpdate?: (footer: Record<string, unknown> | null) => void | Promise<void>;
  /**
   * Callback when site metadata changes
   */
  onSiteMetadataUpdate?: (metadata: Record<string, unknown>) => void | Promise<void>;
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
  autoSaveDelay: 1000
};
