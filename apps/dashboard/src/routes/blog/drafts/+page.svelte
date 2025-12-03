<script lang="ts">
  import { Plus, FileText, Calendar, Edit, Trash2 } from '@lucide/svelte';
  import { Badge } from '@kuratchi/ui';
  import type { BlogPost } from '@kuratchi/editor';

  // Local state for blog posts
  let posts = $state<BlogPost[]>([]);

  // Load posts from localStorage on mount
  $effect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kuratchi_blog_posts');
      if (saved) {
        try {
          // Filter to only show drafts (posts without publishedOn)
          const allPosts: BlogPost[] = JSON.parse(saved);
          posts = allPosts.filter(p => !p.featured);
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
</script>

<div class="kui-blog-posts">
  <header class="kui-blog-posts__header">
    <div>
      <h1>Drafts</h1>
      <p>{posts.length} draft{posts.length !== 1 ? 's' : ''}</p>
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
      <h2>No drafts</h2>
      <p>All your posts are published! Create a new post to start writing.</p>
      <a href="/blog/new" class="kui-btn kui-btn--primary">
        <Plus />
        <span>Create New Post</span>
      </a>
    </div>
  {:else}
    <div class="kui-blog-posts__list">
      {#each posts as post}
        <article class="kui-blog-post-card">
          <div class="kui-blog-post-card__content">
            <div class="kui-blog-post-card__body">
              <div class="kui-blog-post-card__meta">
                <Badge variant="ghost">Draft</Badge>
                <span class="kui-blog-post-card__date">
                  <Calendar />
                  {formatDate(post.publishedOn)}
                </span>
              </div>
              <h3 class="kui-blog-post-card__title">
                <a href="/blog/{post.id}">{post.title}</a>
              </h3>
              <p class="kui-blog-post-card__excerpt">{post.excerpt}</p>
            </div>
          </div>
          <div class="kui-blog-post-card__actions">
            <a href="/blog/{post.id}" class="kui-icon-btn" title="Edit">
              <Edit />
            </a>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</div>

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
    flex: 1;
    min-width: 0;
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

  .kui-blog-post-card__actions {
    display: flex;
    gap: var(--kui-spacing-xs);
    flex-shrink: 0;
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

  .kui-btn--primary:hover {
    background: var(--kui-color-primary-hover);
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

  .kui-icon-btn :global(svg) {
    width: 16px;
    height: 16px;
  }
</style>
