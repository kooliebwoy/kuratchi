<script lang="ts">
  import { page } from '$app/state';
  import { BookOpen, Plus, FileText, Settings, FolderOpen } from '@lucide/svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  const activeSelection = $derived(page.url.pathname);

  const navItems = [
    { label: 'All Posts', href: '/blog', icon: FileText },
    { label: 'Drafts', href: '/blog/drafts', icon: FolderOpen },
    { label: 'Settings', href: '/blog/settings', icon: Settings }
  ];
</script>

<div class="kui-blog-layout">
  <!-- Sidebar -->
  <aside class="kui-blog-sidebar">
    <div class="kui-blog-sidebar__header">
      <div class="kui-blog-sidebar__icon">
        <BookOpen />
      </div>
      <div>
        <h2>Blog</h2>
        <p>Manage your posts</p>
      </div>
    </div>

    <a href="/blog/new" class="kui-blog-sidebar__new-post">
      <Plus />
      <span>New Post</span>
    </a>

    <nav class="kui-blog-sidebar__nav">
      {#each navItems as item}
        <a 
          href={item.href} 
          class="kui-blog-sidebar__link"
          class:active={activeSelection === item.href}
        >
          <item.icon />
          <span>{item.label}</span>
        </a>
      {/each}
    </nav>
  </aside>

  <!-- Main Content -->
  <main class="kui-blog-main">
    {@render children()}
  </main>
</div>

<style>
  .kui-blog-layout {
    display: grid;
    grid-template-columns: 260px 1fr;
    min-height: calc(100vh - 64px);
    margin: calc(var(--kui-spacing-lg) * -1);
    background: var(--kui-color-surface);
  }

  .kui-blog-sidebar {
    background: var(--kui-color-surface);
    border-right: 1px solid var(--kui-color-border);
    padding: var(--kui-spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--kui-spacing-md);
  }

  .kui-blog-sidebar__header {
    display: flex;
    align-items: center;
    gap: var(--kui-spacing-sm);
    padding-bottom: var(--kui-spacing-md);
    border-bottom: 1px solid var(--kui-color-border);
  }

  .kui-blog-sidebar__icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--kui-color-primary-muted);
    border-radius: var(--kui-radius-md);
    color: var(--kui-color-primary);
  }

  .kui-blog-sidebar__icon :global(svg) {
    width: 20px;
    height: 20px;
  }

  .kui-blog-sidebar__header h2 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
    color: var(--kui-color-text);
  }

  .kui-blog-sidebar__header p {
    font-size: 0.75rem;
    margin: 0;
    color: var(--kui-color-text-muted);
  }

  .kui-blog-sidebar__new-post {
    display: flex;
    align-items: center;
    gap: var(--kui-spacing-sm);
    padding: var(--kui-spacing-sm) var(--kui-spacing-md);
    background: var(--kui-color-primary);
    color: white;
    border-radius: var(--kui-radius-md);
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .kui-blog-sidebar__new-post:hover {
    background: var(--kui-color-primary-hover);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .kui-blog-sidebar__new-post :global(svg) {
    width: 16px;
    height: 16px;
  }

  .kui-blog-sidebar__nav {
    display: flex;
    flex-direction: column;
    gap: var(--kui-spacing-xs);
    margin-top: var(--kui-spacing-sm);
  }

  .kui-blog-sidebar__link {
    display: flex;
    align-items: center;
    gap: var(--kui-spacing-sm);
    padding: var(--kui-spacing-sm) var(--kui-spacing-md);
    color: var(--kui-color-text-muted);
    border-radius: var(--kui-radius-md);
    font-size: 0.875rem;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .kui-blog-sidebar__link:hover {
    background: var(--kui-color-surface-hover);
    color: var(--kui-color-text);
  }

  .kui-blog-sidebar__link.active {
    background: var(--kui-color-primary-muted);
    color: var(--kui-color-primary);
    font-weight: 500;
  }

  .kui-blog-sidebar__link :global(svg) {
    width: 18px;
    height: 18px;
  }

  .kui-blog-main {
    background: var(--kui-color-surface-muted);
    padding: var(--kui-spacing-lg);
    overflow-y: auto;
  }

  @media (max-width: 768px) {
    .kui-blog-layout {
      grid-template-columns: 1fr;
    }

    .kui-blog-sidebar {
      display: none;
    }
  }
</style>
