<script lang="ts">
  import { Save, Trash2 } from '@lucide/svelte';

  // Settings state
  let blogTitle = $state('My Blog');
  let blogDescription = $state('');
  let postsPerPage = $state(10);
  let showAuthor = $state(true);
  let showDate = $state(true);
  let enableComments = $state(false);
  let isSaving = $state(false);
  let savedMessage = $state('');

  // Load settings on mount
  $effect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kuratchi_blog_settings');
      if (saved) {
        try {
          const settings = JSON.parse(saved);
          blogTitle = settings.blogTitle || 'My Blog';
          blogDescription = settings.blogDescription || '';
          postsPerPage = settings.postsPerPage || 10;
          showAuthor = settings.showAuthor ?? true;
          showDate = settings.showDate ?? true;
          enableComments = settings.enableComments ?? false;
        } catch (e) {
          console.error('Failed to load settings:', e);
        }
      }
    }
  });

  function saveSettings() {
    isSaving = true;
    const settings = {
      blogTitle,
      blogDescription,
      postsPerPage,
      showAuthor,
      showDate,
      enableComments
    };
    localStorage.setItem('kuratchi_blog_settings', JSON.stringify(settings));
    
    setTimeout(() => {
      isSaving = false;
      savedMessage = 'Settings saved!';
      setTimeout(() => savedMessage = '', 3000);
    }, 500);
  }

  function clearAllPosts() {
    if (confirm('Are you sure you want to delete ALL blog posts? This cannot be undone.')) {
      localStorage.removeItem('kuratchi_blog_posts');
      alert('All posts have been deleted.');
    }
  }
</script>

<div class="kui-blog-settings">
  <header class="kui-blog-settings__header">
    <div>
      <h1>Blog Settings</h1>
      <p>Configure your blog preferences</p>
    </div>
    <button 
      type="button" 
      class="kui-btn kui-btn--primary"
      onclick={saveSettings}
      disabled={isSaving}
    >
      <Save />
      <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
    </button>
  </header>

  {#if savedMessage}
    <div class="kui-alert kui-alert--success">
      {savedMessage}
    </div>
  {/if}

  <div class="kui-settings-sections">
    <section class="kui-settings-section">
      <h2>General</h2>
      
      <label class="kui-form-field">
        <span>Blog Title</span>
        <input 
          type="text" 
          bind:value={blogTitle}
          placeholder="My Blog"
          class="kui-input"
        />
      </label>

      <label class="kui-form-field">
        <span>Description</span>
        <textarea 
          bind:value={blogDescription}
          placeholder="A brief description of your blog..."
          rows="3"
          class="kui-input kui-textarea"
        ></textarea>
      </label>

      <label class="kui-form-field">
        <span>Posts per page</span>
        <input 
          type="number" 
          bind:value={postsPerPage}
          min="1"
          max="50"
          class="kui-input kui-input--sm"
        />
      </label>
    </section>

    <section class="kui-settings-section">
      <h2>Display Options</h2>
      
      <label class="kui-checkbox">
        <input type="checkbox" bind:checked={showAuthor} />
        <span>Show author on posts</span>
      </label>

      <label class="kui-checkbox">
        <input type="checkbox" bind:checked={showDate} />
        <span>Show publish date</span>
      </label>

      <label class="kui-checkbox">
        <input type="checkbox" bind:checked={enableComments} />
        <span>Enable comments (coming soon)</span>
      </label>
    </section>

    <section class="kui-settings-section kui-settings-section--danger">
      <h2>Danger Zone</h2>
      <p>These actions are irreversible. Please proceed with caution.</p>
      
      <button 
        type="button" 
        class="kui-btn kui-btn--danger"
        onclick={clearAllPosts}
      >
        <Trash2 />
        <span>Delete All Posts</span>
      </button>
    </section>
  </div>
</div>

<style>
  .kui-blog-settings {
    max-width: 700px;
    margin: 0 auto;
  }

  .kui-blog-settings__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--kui-spacing-lg);
  }

  .kui-blog-settings__header h1 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
    color: var(--kui-color-text);
  }

  .kui-blog-settings__header p {
    font-size: 0.875rem;
    margin: 0.25rem 0 0;
    color: var(--kui-color-text-muted);
  }

  .kui-alert {
    padding: var(--kui-spacing-sm) var(--kui-spacing-md);
    border-radius: var(--kui-radius-md);
    margin-bottom: var(--kui-spacing-lg);
    font-size: 0.875rem;
  }

  .kui-alert--success {
    background: rgba(16, 185, 129, 0.1);
    color: #059669;
    border: 1px solid rgba(16, 185, 129, 0.2);
  }

  .kui-settings-sections {
    display: flex;
    flex-direction: column;
    gap: var(--kui-spacing-lg);
  }

  .kui-settings-section {
    background: var(--kui-color-surface);
    border-radius: var(--kui-radius-lg);
    border: 1px solid var(--kui-color-border);
    padding: var(--kui-spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--kui-spacing-md);
  }

  .kui-settings-section h2 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
    color: var(--kui-color-text);
    padding-bottom: var(--kui-spacing-sm);
    border-bottom: 1px solid var(--kui-color-border);
  }

  .kui-settings-section--danger {
    border-color: rgba(239, 68, 68, 0.3);
  }

  .kui-settings-section--danger h2 {
    color: var(--kui-color-danger, #ef4444);
    border-bottom-color: rgba(239, 68, 68, 0.3);
  }

  .kui-settings-section--danger p {
    font-size: 0.875rem;
    color: var(--kui-color-text-muted);
    margin: 0;
  }

  .kui-form-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .kui-form-field span {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--kui-color-text);
  }

  .kui-input {
    padding: var(--kui-spacing-sm) var(--kui-spacing-md);
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

  .kui-input--sm {
    max-width: 120px;
  }

  .kui-textarea {
    resize: vertical;
    min-height: 80px;
  }

  .kui-checkbox {
    display: flex;
    align-items: center;
    gap: var(--kui-spacing-sm);
    cursor: pointer;
  }

  .kui-checkbox input {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--kui-color-primary);
  }

  .kui-checkbox span {
    font-size: 0.875rem;
    color: var(--kui-color-text);
  }

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

  .kui-btn--danger {
    background: var(--kui-color-danger, #ef4444);
    color: white;
  }

  .kui-btn--danger:hover {
    background: #dc2626;
  }
</style>
