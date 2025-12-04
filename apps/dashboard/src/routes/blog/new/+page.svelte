<script lang="ts">
  import { goto } from '$app/navigation';
  import { ArrowLeft, Save, Eye, Image, X } from '@lucide/svelte';
  import { Editor, blocksToHtml, type BlockSnapshot, type BlogPost, type PageData, type EditorState } from '@kuratchi/editor';

  // Generate unique ID
  const generateId = () => crypto.randomUUID();

  // Post state
  let title = $state('Untitled Post');
  let excerpt = $state('');
  let slug = $state('');
  let coverImage = $state<{ url: string; alt?: string } | null>(null);
  let tags = $state<string[]>([]);
  let newTag = $state('');
  let isSaving = $state(false);
  let lastSaved = $state<Date | null>(null);

  // Editor content as blocks
  let contentBlocks = $state<BlockSnapshot[]>([]);

  // Auto-generate slug from title
  $effect(() => {
    if (title && !slug) {
      slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    }
  });

  // Page data for the editor
  const pageData: PageData = $derived({
    title,
    seoTitle: title,
    seoDescription: excerpt,
    slug,
    content: contentBlocks
  });

  // Handle editor state updates
  function handleEditorUpdate(state: EditorState) {
    contentBlocks = (state.page.content || []) as BlockSnapshot[];
    triggerAutoSave();
  }

  // Auto-save debounce
  let saveTimeout: ReturnType<typeof setTimeout> | undefined;
  function triggerAutoSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => savePost(true), 2000);
  }

  // Save the post
  async function savePost(isAutoSave = false) {
    if (!isAutoSave) isSaving = true;
    
    try {
      // Get existing posts
      const saved = localStorage.getItem('kuratchi_blog_posts');
      const posts: BlogPost[] = saved ? JSON.parse(saved) : [];
      
      // Generate HTML from blocks
      const htmlContent = blocksToHtml(contentBlocks);
      
      // Create the post object
      const post: BlogPost & { content: string; blocks: BlockSnapshot[] } = {
        id: generateId(),
        pageId: generateId(),
        title,
        slug,
        excerpt,
        author: 'You',
        publishedOn: new Date().toISOString().slice(0, 10),
        coverImage: coverImage || undefined,
        categories: [],
        tags,
        featured: false,
        content: htmlContent,
        blocks: contentBlocks
      };
      
      // Add to posts
      posts.unshift(post);
      localStorage.setItem('kuratchi_blog_posts', JSON.stringify(posts));
      
      lastSaved = new Date();
      
      if (!isAutoSave) {
        goto('/blog');
      }
    } catch (error) {
      console.error('Failed to save post:', error);
    } finally {
      isSaving = false;
    }
  }

  function addTag() {
    const tag = newTag.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      tags = [...tags, tag];
    }
    newTag = '';
  }

  function removeTag(tag: string) {
    tags = tags.filter(t => t !== tag);
  }

  function handleTagKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  }
</script>

<div class="kui-post-editor">
  <!-- Header -->
  <header class="kui-post-editor__header">
    <div class="kui-post-editor__header-left">
      <a href="/blog" class="kui-back-btn">
        <ArrowLeft />
        <span>Back to Posts</span>
      </a>
    </div>
    <div class="kui-post-editor__header-right">
      {#if lastSaved}
        <span class="kui-save-status">
          Last saved {lastSaved.toLocaleTimeString()}
        </span>
      {/if}
      <button type="button" class="kui-btn kui-btn--ghost">
        <Eye />
        <span>Preview</span>
      </button>
      <button 
        type="button" 
        class="kui-btn kui-btn--primary"
        onclick={() => savePost()}
        disabled={isSaving}
      >
        <Save />
        <span>{isSaving ? 'Saving...' : 'Save & Publish'}</span>
      </button>
    </div>
  </header>

  <!-- Main Editor Area -->
  <div class="kui-post-editor__body">
    <!-- Sidebar for metadata -->
    <aside class="kui-post-editor__sidebar">
      <div class="kui-post-editor__section">
        <h3>Post Settings</h3>
        
        <label class="kui-form-field">
          <span>Title</span>
          <input 
            type="text" 
            bind:value={title}
            placeholder="Post title"
            class="kui-input"
          />
        </label>

        <label class="kui-form-field">
          <span>Slug</span>
          <input 
            type="text" 
            bind:value={slug}
            placeholder="post-url-slug"
            class="kui-input"
          />
        </label>

        <label class="kui-form-field">
          <span>Excerpt</span>
          <textarea 
            bind:value={excerpt}
            placeholder="Brief description of the post..."
            rows="3"
            class="kui-input kui-textarea"
          ></textarea>
        </label>
      </div>

      <div class="kui-post-editor__section">
        <h3>Cover Image</h3>
        {#if coverImage}
          <div class="kui-cover-preview">
            <img src={coverImage.url} alt={coverImage.alt || 'Cover'} />
            <button 
              type="button" 
              class="kui-cover-remove"
              onclick={() => coverImage = null}
            >
              <X />
            </button>
          </div>
        {:else}
          <label class="kui-cover-upload">
            <Image />
            <span>Add cover image</span>
            <input 
              type="url" 
              placeholder="Enter image URL"
              onchange={(e) => {
                const url = (e.target as HTMLInputElement).value;
                if (url) coverImage = { url };
              }}
            />
          </label>
        {/if}
      </div>

      <div class="kui-post-editor__section">
        <h3>Tags</h3>
        <div class="kui-tags-input">
          <input 
            type="text" 
            bind:value={newTag}
            placeholder="Add a tag..."
            class="kui-input"
            onkeydown={handleTagKeydown}
          />
          <button type="button" class="kui-btn kui-btn--sm" onclick={addTag}>Add</button>
        </div>
        {#if tags.length > 0}
          <div class="kui-tags-list">
            {#each tags as tag}
              <span class="kui-tag">
                {tag}
                <button type="button" onclick={() => removeTag(tag)}>
                  <X />
                </button>
              </span>
            {/each}
          </div>
        {/if}
      </div>
    </aside>

    <!-- Content Editor -->
    <div class="kui-post-editor__content">
      <div class="kui-post-editor__title-input">
        <input 
          type="text"
          bind:value={title}
          placeholder="Post title..."
          class="kui-title-input"
        />
      </div>
      
      <div class="kui-post-editor__canvas">
        <Editor
          pageData={pageData}
          editable={true}
          isWebpage={false}
          layoutsEnabled={false}
          showUI={false}
          enabledPlugins={[]}
          onStateUpdate={handleEditorUpdate}
        />
      </div>
    </div>
  </div>
</div>

<style>
  .kui-post-editor {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 64px);
    margin: calc(var(--kui-spacing-lg) * -1);
    background: var(--kui-color-surface);
  }

  .kui-post-editor__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--kui-spacing-sm) var(--kui-spacing-lg);
    background: var(--kui-color-surface);
    border-bottom: 1px solid var(--kui-color-border);
    flex-shrink: 0;
  }

  .kui-post-editor__header-left {
    display: flex;
    align-items: center;
    gap: var(--kui-spacing-md);
  }

  .kui-post-editor__header-right {
    display: flex;
    align-items: center;
    gap: var(--kui-spacing-sm);
  }

  .kui-back-btn {
    display: flex;
    align-items: center;
    gap: var(--kui-spacing-xs);
    color: var(--kui-color-text-muted);
    text-decoration: none;
    font-size: 0.875rem;
    transition: color 0.15s ease;
  }

  .kui-back-btn:hover {
    color: var(--kui-color-text);
  }

  .kui-back-btn :global(svg) {
    width: 18px;
    height: 18px;
  }

  .kui-save-status {
    font-size: 0.75rem;
    color: var(--kui-color-text-muted);
  }

  .kui-post-editor__body {
    display: grid;
    grid-template-columns: 280px 1fr;
    flex: 1;
    overflow: hidden;
  }

  .kui-post-editor__sidebar {
    background: var(--kui-color-surface-muted);
    border-right: 1px solid var(--kui-color-border);
    padding: var(--kui-spacing-lg);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--kui-spacing-lg);
  }

  .kui-post-editor__section {
    display: flex;
    flex-direction: column;
    gap: var(--kui-spacing-sm);
  }

  .kui-post-editor__section h3 {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--kui-color-text-muted);
    margin: 0;
  }

  .kui-form-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .kui-form-field span {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--kui-color-text);
  }

  .kui-input {
    padding: var(--kui-spacing-sm);
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    font-size: 0.875rem;
    background: var(--kui-color-surface);
    color: var(--kui-color-text);
    transition: border-color 0.15s ease;
  }

  .kui-input:focus {
    outline: none;
    border-color: var(--kui-color-primary);
    box-shadow: 0 0 0 2px var(--kui-color-primary-muted);
  }

  .kui-textarea {
    resize: vertical;
    min-height: 80px;
  }

  .kui-cover-preview {
    position: relative;
    border-radius: var(--kui-radius-md);
    overflow: hidden;
  }

  .kui-cover-preview img {
    width: 100%;
    height: 120px;
    object-fit: cover;
  }

  .kui-cover-remove {
    position: absolute;
    top: var(--kui-spacing-xs);
    right: var(--kui-spacing-xs);
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    border: none;
    border-radius: var(--kui-radius-sm);
    color: white;
    cursor: pointer;
  }

  .kui-cover-remove :global(svg) {
    width: 14px;
    height: 14px;
  }

  .kui-cover-upload {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--kui-spacing-xs);
    padding: var(--kui-spacing-lg);
    border: 2px dashed var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    color: var(--kui-color-text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .kui-cover-upload:hover {
    border-color: var(--kui-color-primary);
    color: var(--kui-color-primary);
  }

  .kui-cover-upload :global(svg) {
    width: 24px;
    height: 24px;
  }

  .kui-cover-upload span {
    font-size: 0.8rem;
    font-weight: 500;
  }

  .kui-cover-upload input {
    width: 100%;
    margin-top: var(--kui-spacing-xs);
    padding: var(--kui-spacing-xs);
    font-size: 0.75rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-sm);
  }

  .kui-tags-input {
    display: flex;
    gap: var(--kui-spacing-xs);
  }

  .kui-tags-input .kui-input {
    flex: 1;
  }

  .kui-tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--kui-spacing-xs);
    margin-top: var(--kui-spacing-xs);
  }

  .kui-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    background: var(--kui-color-primary-muted);
    color: var(--kui-color-primary);
    border-radius: var(--kui-radius-pill);
    font-size: 0.75rem;
  }

  .kui-tag button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    opacity: 0.7;
  }

  .kui-tag button:hover {
    opacity: 1;
  }

  .kui-tag button :global(svg) {
    width: 12px;
    height: 12px;
  }

  .kui-post-editor__content {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--kui-color-surface);
  }

  .kui-post-editor__title-input {
    padding: var(--kui-spacing-lg) var(--kui-spacing-xl);
    border-bottom: 1px solid var(--kui-color-border);
  }

  .kui-title-input {
    width: 100%;
    font-size: 2rem;
    font-weight: 700;
    border: none;
    background: transparent;
    color: var(--kui-color-text);
    outline: none;
  }

  .kui-title-input::placeholder {
    color: var(--kui-color-text-muted);
  }

  .kui-post-editor__canvas {
    flex: 1;
    overflow-y: auto;
    overflow-x: visible;
    padding: var(--kui-spacing-lg) var(--kui-spacing-xl);
  }

  /* Ensure editor dropdown is visible */
  .kui-post-editor__canvas :global(.krt-editorCanvas) {
    overflow: visible;
  }

  .kui-post-editor__canvas :global(.krt-editorCanvas__main) {
    overflow: visible;
  }

  .kui-post-editor__canvas :global(.krt-editorCanvas__container) {
    overflow: visible;
  }

  /* Buttons */
  .kui-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--kui-spacing-xs);
    padding: var(--kui-spacing-sm) var(--kui-spacing-md);
    border-radius: var(--kui-radius-md);
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    border: none;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .kui-btn :global(svg) {
    width: 16px;
    height: 16px;
  }

  .kui-btn--primary {
    background: var(--kui-color-primary);
    color: white;
  }

  .kui-btn--primary:hover:not(:disabled) {
    background: var(--kui-color-primary-hover);
  }

  .kui-btn--primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .kui-btn--ghost {
    background: transparent;
    color: var(--kui-color-text);
    border: 1px solid var(--kui-color-border);
  }

  .kui-btn--ghost:hover {
    background: var(--kui-color-surface-hover);
  }

  .kui-btn--sm {
    padding: var(--kui-spacing-xs) var(--kui-spacing-sm);
    font-size: 0.75rem;
    background: var(--kui-color-primary);
    color: white;
  }

  @media (max-width: 768px) {
    .kui-post-editor__body {
      grid-template-columns: 1fr;
    }

    .kui-post-editor__sidebar {
      display: none;
    }
  }
</style>
