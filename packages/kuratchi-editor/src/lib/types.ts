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
  /**
   * Serialized header block data
   */
  header: Record<string, unknown> | null;
  /**
   * Serialized footer block data
   */
  footer: Record<string, unknown> | null;
  /**
   * Additional metadata (theme settings, etc.)
   */
  metadata?: {
    backgroundColor?: string;
    [key: string]: unknown;
  };
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
}

export const defaultPageData: PageData = {
  title: 'Untitled Page',
  seoTitle: '',
  seoDescription: '',
  slug: '',
  domain: 'example.com',
  content: [] satisfies Array<Record<string, unknown>>,
  header: null,
  footer: null,
  metadata: {
    backgroundColor: '#000000'
  }
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
