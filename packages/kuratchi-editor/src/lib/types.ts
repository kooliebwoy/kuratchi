export interface EditorOptions {
  /**
   * Reference to the rendered editor container. Managed internally when omitted.
   */
  editor?: HTMLElement | null;
  /**
   * Serialized block data used to hydrate the editor.
   */
  editorData?: Array<Record<string, unknown>>;
  /**
   * Toggle whether the editor is editable.
   */
  editable?: boolean;
  /**
   * When true, renders header and footer regions in addition to page content.
   */
  isWebpage?: boolean;
  /**
   * Background color applied to the editor canvas.
   */
  backgroundColor?: string;
  /**
   * Serialized header block data.
   */
  headerBlock?: Array<Record<string, unknown>> | Record<string, unknown> | null;
  /**
   * Serialized footer block data.
   */
  footerBlock?: Array<Record<string, unknown>> | Record<string, unknown> | null;
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
}

export const defaultEditorOptions: Required<Pick<EditorOptions, 'editable' | 'isWebpage' | 'backgroundColor' | 'layoutsEnabled'>> &
  Omit<EditorOptions, 'editable' | 'isWebpage' | 'backgroundColor' | 'layoutsEnabled'> = {
  editor: null,
  editorData: [],
  editable: true,
  isWebpage: true,
  backgroundColor: '#000000',
  headerBlock: [],
  footerBlock: [],
  layoutsEnabled: true,
  imageConfig: {}
};
