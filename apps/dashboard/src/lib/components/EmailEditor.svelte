<script lang="ts">
  import { Editor, blocksToHtml, type BlockSnapshot, type EditorState } from '@kuratchi/editor';
  
  interface Props {
    /** Initial HTML content - will be converted to blocks if possible */
    content?: string;
    /** Initial blocks - preferred over content */
    blocks?: BlockSnapshot[];
    /** Callback when content changes - receives HTML string */
    onChange?: (html: string) => void;
    /** Callback when blocks change - receives raw blocks */
    onBlocksChange?: (blocks: BlockSnapshot[]) => void;
  }

  let { content = '', blocks, onChange, onBlocksChange }: Props = $props();

  // Convert initial HTML to blocks if no blocks provided
  // For now, if we have HTML content but no blocks, create a simple paragraph block
  const initialBlocks: BlockSnapshot[] = blocks || (content ? htmlToBasicBlocks(content) : []);
  
  // Simple HTML to blocks converter for basic content
  function htmlToBasicBlocks(html: string): BlockSnapshot[] {
    if (!html || html.trim() === '') return [];
    
    const blocks: BlockSnapshot[] = [];
    const parser = typeof DOMParser !== 'undefined' ? new DOMParser() : null;
    
    if (!parser) {
      // Server-side or no DOMParser - return as single paragraph
      return [{
        type: 'paragraph',
        paragraph: html
      }];
    }
    
    const doc = parser.parseFromString(html, 'text/html');
    const elements = doc.body.children;
    
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const tagName = el.tagName.toLowerCase();
      
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        blocks.push({
          type: 'heading',
          heading: el.innerHTML,
          metadata: { size: tagName }
        });
      } else if (tagName === 'p') {
        blocks.push({
          type: 'paragraph',
          paragraph: el.innerHTML
        });
      } else if (tagName === 'ul') {
        const items = Array.from(el.querySelectorAll('li')).map(li => li.textContent || '');
        blocks.push({
          type: 'list',
          metadata: { listType: 'ul', items }
        });
      } else if (tagName === 'ol') {
        const items = Array.from(el.querySelectorAll('li')).map(li => li.textContent || '');
        blocks.push({
          type: 'list',
          metadata: { listType: 'ol', items }
        });
      } else if (tagName === 'hr') {
        blocks.push({ type: 'divider' });
      } else if (el.textContent?.trim()) {
        // Fallback: wrap unknown elements as paragraph
        blocks.push({
          type: 'paragraph',
          paragraph: el.innerHTML || el.textContent
        });
      }
    }
    
    return blocks.length > 0 ? blocks : [{
      type: 'paragraph',
      paragraph: '<p>Start typing your email content...</p>'
    }];
  }

  // Handle editor state changes - use EditorState type directly
  function handleStateUpdate(state: EditorState) {
    // Cast content to BlockSnapshot[] - the type definition is looser than actual runtime values
    const contentBlocks = (state.page.content || []) as BlockSnapshot[];
    
    // Notify parent of blocks change
    onBlocksChange?.(contentBlocks);
    
    // Convert to HTML and notify parent
    const html = blocksToHtml(contentBlocks);
    onChange?.(html);
  }
</script>

<div class="email-editor">
  <Editor
    pageData={{
      title: 'Email Content',
      seoTitle: '',
      seoDescription: '',
      slug: '',
      content: initialBlocks
    }}
    editable={true}
    isWebpage={false}
    layoutsEnabled={false}
    showUI={false}
    enabledPlugins={[]}
    onStateUpdate={handleStateUpdate}
  />
</div>

<style>
  .email-editor {
    border: 1px solid var(--kui-color-border, #e5e7eb);
    border-radius: var(--kui-radius-md, 0.5rem);
    overflow: hidden;
    background: var(--kui-color-surface, #ffffff);
    min-height: 200px;
  }

  .email-editor :global(.krt-editor) {
    min-height: 200px;
  }

  .email-editor :global(.krt-canvas) {
    padding: 1rem;
  }
</style>
