<script lang="ts">
  import { Plus, FileText, Calendar, Edit, Trash2, Eye, MoreVertical } from '@lucide/svelte';
  import { Button, Card, Badge, Dialog } from '@kuratchi/ui';
  import type { BlogPost } from '@kuratchi/editor';

  // Local state for blog posts (in production, this would come from a database)
  let posts = $state<BlogPost[]>([]);
  let showDeleteConfirm = $state(false);
  let postToDelete = $state<BlogPost | null>(null);

  // Load posts from localStorage on mount
  $effect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kuratchi_blog_posts');
      if (saved) {
        try {
          posts = JSON.parse(saved);
        } catch (e) {
          console.error('Failed to load posts:', e);
        }
      }
    }
  });

  function formatDate(dateString?: string) {
    if (!dateString) return 'Not published';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function handleDeleteClick(post: BlogPost) {
    postToDelete = post;
    showDeleteConfirm = true;
  }

  function confirmDelete() {
    if (postToDelete) {
      posts = posts.filter(p => p.id !== postToDelete!.id);
      savePosts();
      showDeleteConfirm = false;
      postToDelete = null;
    }
  }

  function savePosts() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('kuratchi_blog_posts', JSON.stringify(posts));
    }
  }
</script>

<div class="kui-blog-posts">
  <header class="kui-blog-posts__header">
    <div>
      <h1>All Posts</h1>
      <p>{posts.length} post{posts.length !== 1 ? 's' : ''}</p>
    </div>
    <a href="/blog/new" class="kui-btn kui-btn--primary">
      <Plus />
      <span>New Post</span>
    </a>
  </header>

  {#if posts.length === 0}
    <div class="kui-blog-empty">
      <div class="kui-blog-empty__icon">
        <FileText />
      </div>
      <h2>No posts yet</h2>
      <p>Create your first blog post to get started with the Notion-style editor.</p>
      <a href="/blog/new" class="kui-btn kui-btn--primary">
        <Plus />
        <span>Create First Post</span>
      </a>
    </div>
  {:else}
    <div class="kui-blog-posts__list">
      {#each posts as post}
        <article class="kui-blog-post-card">
          <div class="kui-blog-post-card__content">
            {#if post.coverImage?.url}
              <div class="kui-blog-post-card__image">
                <img src={post.coverImage.url} alt={post.coverImage.alt || post.title} />
              </div>
            {/if}
            <div class="kui-blog-post-card__body">
              <div class="kui-blog-post-card__meta">
                <Badge variant="ghost">{post.featured ? 'Featured' : 'Draft'}</Badge>
                <span class="kui-blog-post-card__date">
                  <Calendar />
                  {formatDate(post.publishedOn)}
                </span>
              </div>
              <h3 class="kui-blog-post-card__title">
                <a href="/blog/{post.id}">{post.title}</a>
              </h3>
              <p class="kui-blog-post-card__excerpt">{post.excerpt}</p>
              {#if post.tags.length > 0}
                <div class="kui-blog-post-card__tags">
                  {#each post.tags.slice(0, 3) as tag}
                    <span class="kui-tag">{tag}</span>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
          <div class="kui-blog-post-card__actions">
            <a href="/blog/{post.id}" class="kui-icon-btn" title="Edit">
              <Edit />
            </a>
            <a href="/blog/{post.id}/preview" class="kui-icon-btn" title="Preview">
              <Eye />
            </a>
            <button 
              type="button" 
              class="kui-icon-btn kui-icon-btn--danger" 
              title="Delete"
              onclick={() => handleDeleteClick(post)}
            >
              <Trash2 />
            </button>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</div>

<!-- Delete Confirmation Dialog -->
{#if showDeleteConfirm && postToDelete}
  <div class="kui-overlay" role="dialog" aria-modal="true">
    <div 
      class="kui-overlay__backdrop" 
      onclick={() => showDeleteConfirm = false}
      onkeydown={(e) => e.key === 'Escape' && (showDeleteConfirm = false)}
      role="button"
      tabindex="0"
      aria-label="Close dialog"
    ></div>
    <div class="kui-dialog kui-dialog--sm">
      <div class="kui-dialog__header">
        <h3>Delete Post</h3>
      </div>
      <div class="kui-dialog__body">
        <p>Are you sure you want to delete "<strong>{postToDelete.title}</strong>"? This action cannot be undone.</p>
      </div>
      <div class="kui-dialog__footer">
        <button 
          type="button" 
          class="kui-btn kui-btn--ghost"
          onclick={() => showDeleteConfirm = false}
        >
          Cancel
        </button>
        <button 
          type="button" 
          class="kui-btn kui-btn--danger"
          onclick={confirmDelete}
        >
          Delete
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .kui-blog-posts {
    max-width: 900px;
    margin: 0 auto;
  }

  .kui-blog-posts__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--kui-spacing-lg);
  }

  .kui-blog-posts__header h1 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
    color: var(--kui-color-text);
  }

  .kui-blog-posts__header p {
    font-size: 0.875rem;
    margin: 0.25rem 0 0;
    color: var(--kui-color-text-muted);
  }

  .kui-blog-empty {
    text-align: center;
    padding: var(--kui-spacing-xl) var(--kui-spacing-lg);
    background: var(--kui-color-surface);
    border-radius: var(--kui-radius-lg);
    border: 2px dashed var(--kui-color-border);
  }

  .kui-blog-empty__icon {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--kui-color-surface-hover);
    border-radius: var(--kui-radius-lg);
    margin: 0 auto var(--kui-spacing-md);
    color: var(--kui-color-text-muted);
  }

  .kui-blog-empty__icon :global(svg) {
    width: 32px;
    height: 32px;
  }

  .kui-blog-empty h2 {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 var(--kui-spacing-xs);
    color: var(--kui-color-text);
  }

  .kui-blog-empty p {
    font-size: 0.875rem;
    margin: 0 0 var(--kui-spacing-md);
    color: var(--kui-color-text-muted);
  }

  .kui-blog-posts__list {
    display: flex;
    flex-direction: column;
    gap: var(--kui-spacing-md);
  }

  .kui-blog-post-card {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--kui-spacing-md);
    background: var(--kui-color-surface);
    border-radius: var(--kui-radius-lg);
    border: 1px solid var(--kui-color-border);
    padding: var(--kui-spacing-md);
    transition: all 0.15s ease;
  }

  .kui-blog-post-card:hover {
    border-color: var(--kui-color-primary);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  }

  .kui-blog-post-card__content {
    display: flex;
    gap: var(--kui-spacing-md);
    flex: 1;
    min-width: 0;
  }

  .kui-blog-post-card__image {
    width: 120px;
    height: 80px;
    border-radius: var(--kui-radius-md);
    overflow: hidden;
    flex-shrink: 0;
  }

  .kui-blog-post-card__image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .kui-blog-post-card__body {
    flex: 1;
    min-width: 0;
  }

  .kui-blog-post-card__meta {
    display: flex;
    align-items: center;
    gap: var(--kui-spacing-sm);
    margin-bottom: var(--kui-spacing-xs);
  }

  .kui-blog-post-card__date {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.75rem;
    color: var(--kui-color-text-muted);
  }

  .kui-blog-post-card__date :global(svg) {
    width: 12px;
    height: 12px;
  }

  .kui-blog-post-card__title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 var(--kui-spacing-xs);
    line-height: 1.3;
  }

  .kui-blog-post-card__title a {
    color: var(--kui-color-text);
    text-decoration: none;
  }

  .kui-blog-post-card__title a:hover {
    color: var(--kui-color-primary);
  }

  .kui-blog-post-card__excerpt {
    font-size: 0.875rem;
    color: var(--kui-color-text-muted);
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .kui-blog-post-card__tags {
    display: flex;
    gap: var(--kui-spacing-xs);
    margin-top: var(--kui-spacing-sm);
  }

  .kui-tag {
    font-size: 0.7rem;
    padding: 2px 8px;
    background: var(--kui-color-surface-hover);
    border-radius: var(--kui-radius-pill);
    color: var(--kui-color-text-muted);
  }

  .kui-blog-post-card__actions {
    display: flex;
    gap: var(--kui-spacing-xs);
    flex-shrink: 0;
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

  .kui-btn--primary:hover {
    background: var(--kui-color-primary-hover);
  }

  .kui-btn--ghost {
    background: transparent;
    color: var(--kui-color-text);
    border: 1px solid var(--kui-color-border);
  }

  .kui-btn--ghost:hover {
    background: var(--kui-color-surface-hover);
  }

  .kui-btn--danger {
    background: var(--kui-color-danger);
    color: white;
  }

  .kui-btn--danger:hover {
    background: var(--kui-color-danger-hover, #dc2626);
  }

  .kui-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: var(--kui-radius-md);
    border: none;
    background: transparent;
    color: var(--kui-color-text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
    text-decoration: none;
  }

  .kui-icon-btn:hover {
    background: var(--kui-color-surface-hover);
    color: var(--kui-color-text);
  }

  .kui-icon-btn--danger:hover {
    background: rgba(239, 68, 68, 0.1);
    color: var(--kui-color-danger, #ef4444);
  }

  .kui-icon-btn :global(svg) {
    width: 16px;
    height: 16px;
  }

  /* Dialog/Overlay */
  .kui-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--kui-spacing-lg);
  }

  .kui-overlay__backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  }

  .kui-dialog {
    position: relative;
    background: var(--kui-color-surface);
    border-radius: var(--kui-radius-lg);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    width: 100%;
    max-width: 400px;
    animation: dialogIn 0.2s ease;
  }

  @keyframes dialogIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .kui-dialog__header {
    padding: var(--kui-spacing-md) var(--kui-spacing-lg);
    border-bottom: 1px solid var(--kui-color-border);
  }

  .kui-dialog__header h3 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
  }

  .kui-dialog__body {
    padding: var(--kui-spacing-lg);
  }

  .kui-dialog__body p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--kui-color-text-muted);
    line-height: 1.5;
  }

  .kui-dialog__footer {
    padding: var(--kui-spacing-md) var(--kui-spacing-lg);
    border-top: 1px solid var(--kui-color-border);
    display: flex;
    justify-content: flex-end;
    gap: var(--kui-spacing-sm);
  }
</style>
