<script lang="ts">
  import { onMount } from 'svelte';
  import { BookOpen, RefreshCw, AlertCircle, CheckCircle2, FilePlus2 } from '@lucide/svelte';
  import { Button, Card, Loading, Badge } from '@kuratchi/ui';
  import BlogManager from '@kuratchi/editor/plugins/BlogManager.svelte';
  import { createDefaultBlogData, type BlogData, type BlogPost } from '@kuratchi/editor';
  import { getAllBlogThemes } from '@kuratchi/editor/plugins/blog/blogThemes';
  import type { PageListItem } from '$lib/functions/editor.remote';
  import { createSitePage } from '$lib/functions/editor.remote';
  import { getSites } from '$lib/functions/sites.remote';
  import { listSitePagesForBlog, loadBlogModule, saveBlogModule } from '$lib/functions/blog.remote';

  type Site = {
    id: string;
    name: string | null;
    subdomain: string | null;
    domain?: string | null;
  };

  const blogThemes = getAllBlogThemes();
  const randomId = () =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'entry';

  const toDateInputValue = (value?: string) => value ?? new Date().toISOString().slice(0, 10);

  let sites = $state<Site[]>([]);
  let selectedSiteId = $state<string | null>(null);
  let pages = $state<PageListItem[]>([]);
  let blog = $state<BlogData>(createDefaultBlogData());
  let selectedPostId = $state<string | null>(null);
  let selectedPageForBlog = $state<string | null>(null);
  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let toast = $state<{ type: 'success' | 'error'; message: string } | null>(null);

  const stats = $derived(() => ({
    posts: blog.posts.length,
    categories: blog.categories.length,
    tags: blog.tags.length
  }));

  const normalizeBlog = (input: unknown): BlogData => {
    const base = createDefaultBlogData();
    if (!input || typeof input !== 'object') return base;

    const data = input as Partial<BlogData>;
    return {
      categories: Array.isArray(data.categories) ? data.categories : base.categories,
      tags: Array.isArray(data.tags) ? data.tags : base.tags,
      posts: Array.isArray(data.posts) ? data.posts : base.posts,
      settings: { ...base.settings, ...(data.settings ?? {}) }
    };
  };

  onMount(() => {
    loadSitesAndBlog();
  });

  async function loadSitesAndBlog(force = false) {
    loading = true;
    error = null;

    try {
      if (force || sites.length === 0) {
        const siteList = await getSites();
        sites = siteList || [];
        if (!selectedSiteId && sites.length > 0) {
          selectedSiteId = sites[0].id;
        }
      }

      if (!selectedSiteId) {
        blog = createDefaultBlogData();
        pages = [];
        return;
      }

      const [blogResult, pageList] = await Promise.all([
        loadBlogModule({ siteId: selectedSiteId }),
        listSitePagesForBlog({ siteId: selectedSiteId })
      ]);

      blog = normalizeBlog(blogResult?.blog);
      pages = pageList || [];
      selectedPostId = blog.posts[0]?.id ?? null;
      selectedPageForBlog = blog.settings.indexPageId ?? pages[0]?.id ?? null;
    } catch (err: any) {
      console.error('[blog] Failed to load blog module', err);
      error = err?.body?.message || err?.message || 'Failed to load blog module';
    } finally {
      loading = false;
    }
  }

  function setToast(type: 'success' | 'error', message: string) {
    toast = { type, message };
    setTimeout(() => (toast = null), 3500);
  }

  async function persist(next: BlogData) {
    if (!selectedSiteId) return;
    saving = true;
    try {
      await saveBlogModule({ siteId: selectedSiteId, blog: next });
      setToast('success', 'Blog saved to site metadata');
    } catch (err: any) {
      console.error('[blog] Failed to save', err);
      setToast('error', err?.body?.message || err?.message || 'Failed to save blog');
    } finally {
      saving = false;
    }
  }

  async function updateBlog(updater: (blog: BlogData) => BlogData) {
    const next = updater(structuredClone(blog));
    blog = next;
    await persist(next);
  }

  async function addCategory() {
    await updateBlog((state) => {
      state.categories.push({ id: randomId(), name: 'New Category', slug: 'new-category' });
      return state;
    });
  }

  async function updateCategoryField(id: string, field: 'name' | 'slug', value: string) {
    await updateBlog((state) => {
      const category = state.categories.find((c) => c.id === id);
      if (category) {
        category[field] = field === 'slug' ? slugify(value) : value;
      }
      return state;
    });
  }

  async function removeCategory(id: string) {
    await updateBlog((state) => {
      state.categories = state.categories.filter((c) => c.id !== id);
      state.posts = state.posts.map((post) => ({
        ...post,
        categories: post.categories.filter((cat) => cat !== id)
      }));
      return state;
    });
  }

  async function addTag() {
    await updateBlog((state) => {
      state.tags.push({ id: randomId(), name: 'new-tag', slug: 'new-tag' });
      return state;
    });
  }

  async function updateTagField(id: string, field: 'name' | 'slug', value: string) {
    await updateBlog((state) => {
      const tag = state.tags.find((t) => t.id === id);
      if (tag) {
        tag[field] = field === 'slug' ? slugify(value) : value;
      }
      return state;
    });
  }

  async function removeTag(id: string) {
    await updateBlog((state) => {
      state.tags = state.tags.filter((t) => t.id !== id);
      state.posts = state.posts.map((post) => ({
        ...post,
        tags: post.tags.filter((tag) => tag !== id)
      }));
      return state;
    });
  }

  async function addPostFromPageId(pageId: string | null | undefined) {
    if (!pageId) return;
    const page = pages.find((p) => p.id === pageId);
    const id = randomId();

    await updateBlog((state) => {
      const newPost: BlogPost = {
        id,
        pageId,
        title: page?.title || 'Untitled Post',
        slug: slugify(page?.slug || page?.title || 'new-post'),
        excerpt: '',
        publishedOn: new Date().toISOString().slice(0, 10),
        categories: [],
        tags: [],
        featured: state.settings.featuredPostId ? false : true
      };
      state.posts.unshift(newPost);
      if (!state.settings.featuredPostId) {
        state.settings.featuredPostId = id;
      }
      selectedPostId = id;
      return state;
    });
  }

  async function updatePost(postId: string, mutate: (post: BlogPost) => void) {
    await updateBlog((state) => {
      const post = state.posts.find((p) => p.id === postId);
      if (post) mutate(post);
      return state;
    });
  }

  async function removePost(postId: string) {
    await updateBlog((state) => {
      state.posts = state.posts.filter((p) => p.id !== postId);
      if (state.settings.featuredPostId === postId) {
        state.settings.featuredPostId = null;
      }
      if (selectedPostId === postId) {
        selectedPostId = state.posts[0]?.id ?? null;
      }
      return state;
    });
  }

  async function togglePostCategory(postId: string, categoryId: string) {
    await updateBlog((state) => {
      const post = state.posts.find((p) => p.id === postId);
      if (post) {
        const idx = post.categories.indexOf(categoryId);
        if (idx > -1) {
          post.categories.splice(idx, 1);
        } else {
          post.categories.push(categoryId);
        }
      }
      return state;
    });
  }

  async function togglePostTag(postId: string, tagId: string) {
    await updateBlog((state) => {
      const post = state.posts.find((p) => p.id === postId);
      if (post) {
        const idx = post.tags.indexOf(tagId);
        if (idx > -1) {
          post.tags.splice(idx, 1);
        } else {
          post.tags.push(tagId);
        }
      }
      return state;
    });
  }

  async function setFeaturedPost(postId: string | null) {
    await updateBlog((state) => {
      state.settings.featuredPostId = postId;
      return state;
    });
  }

  async function updateBlogSetting(field: keyof BlogData['settings'], value: any) {
    await updateBlog((state) => {
      (state.settings as any)[field] = value;
      return state;
    });
  }

  function addCustomNavItem(location: 'header' | 'footer', label: string, slugValue: string) {
    setToast('success', `Add "${label}" to ${location} navigation inside the Site editor`);
  }

  async function handleApplyTheme(themeId: string) {
    await updateBlogSetting('themeId', themeId);
  }

  async function handleCreatePageForPost() {
    if (!selectedSiteId) return;
    const title = `Blog Post ${blog.posts.length + 1}`;
    const slug = slugify(title);
    const result = await createSitePage({ siteId: selectedSiteId, title, slug });
    await loadSitesAndBlog(true);
    await addPostFromPageId(result.id);
  }
</script>

<div class="blog-module">
  <header class="blog-module__header">
    <div class="blog-module__title">
      <div class="blog-module__icon">
        <BookOpen />
      </div>
      <div>
        <h1>Blog</h1>
        <p>Powerful blogging built into your sites and editor</p>
      </div>
    </div>

    <div class="blog-module__actions">
      <label class="blog-module__selector">
        <span>Site</span>
        <select bind:value={selectedSiteId} onchange={() => loadSitesAndBlog()}>
          <option value="" disabled selected={!selectedSiteId}>Select a site</option>
          {#each sites as site}
            <option value={site.id}>
              {site.name || 'Untitled Site'} {site.subdomain ? `(${site.subdomain}.kuratchi.site)` : ''}
            </option>
          {/each}
        </select>
      </label>

      <Button variant="ghost" onclick={() => loadSitesAndBlog(true)}>
        <RefreshCw />
        Refresh
      </Button>
    </div>
  </header>

  {#if toast}
    <div class={`blog-module__toast blog-module__toast--${toast.type}`}>
      {#if toast.type === 'success'}
        <CheckCircle2 />
      {:else}
        <AlertCircle />
      {/if}
      <span>{toast.message}</span>
    </div>
  {/if}

  {#if error}
    <Card class="blog-module__card error">
      <div class="blog-module__error">
        <AlertCircle />
        <div>
          <p class="blog-module__error-title">Unable to load blog</p>
          <p class="blog-module__error-copy">{error}</p>
        </div>
      </div>
    </Card>
  {:else if loading}
    <div class="blog-module__loading">
      <Loading />
    </div>
  {:else if !selectedSiteId}
    <Card class="blog-module__card">
      <div class="blog-module__empty">
        <FilePlus2 />
        <div>
          <p>Select a site to manage its blog</p>
          <p class="blog-module__muted">Blog posts, categories, tags, and settings are stored on each site.</p>
        </div>
      </div>
    </Card>
  {:else}
    <div class="blog-module__grid">
      <Card class="blog-module__card">
        <div class="blog-module__card-header">
          <div>
            <p class="blog-module__eyebrow">Overview</p>
            <h2>Blog health</h2>
          </div>
          {#if saving}
            <Badge variant="ghost">Saving…</Badge>
          {:else}
            <Badge variant="outline">Synced</Badge>
          {/if}
        </div>
        <div class="blog-module__stats">
          <div class="blog-module__stat">
            <p>Posts</p>
            <strong>{stats.posts}</strong>
          </div>
          <div class="blog-module__stat">
            <p>Categories</p>
            <strong>{stats.categories}</strong>
          </div>
          <div class="blog-module__stat">
            <p>Tags</p>
            <strong>{stats.tags}</strong>
          </div>
        </div>
        <div class="blog-module__actions-row">
          <Button variant="ghost" onclick={handleCreatePageForPost}>
            <FilePlus2 />
            New blog page
          </Button>
          <Button variant="primary" onclick={() => persist(blog)}>
            Save blog
          </Button>
        </div>
      </Card>

      <Card class="blog-module__card blog-module__card--manager">
        <BlogManager
          blogData={blog}
          selectedPageForBlog={selectedPageForBlog}
          selectedPostId={selectedPostId}
          addCustomNavItem={addCustomNavItem}
          addCategory={addCategory}
          updateCategoryField={updateCategoryField}
          removeCategory={removeCategory}
          addTag={addTag}
          updateTagField={updateTagField}
          removeTag={removeTag}
          addPostFromPageId={addPostFromPageId}
          updatePost={updatePost}
          removePost={removePost}
          togglePostCategory={togglePostCategory}
          togglePostTag={togglePostTag}
          setFeaturedPost={setFeaturedPost}
          updateBlogSetting={updateBlogSetting}
          slugify={slugify}
          toDateInputValue={toDateInputValue}
          getPageList={() => pages}
          onSelectPageForBlog={(pageId) => (selectedPageForBlog = pageId)}
          onSelectPost={(postId) => (selectedPostId = postId)}
          blogThemes={blogThemes}
          onApplyTheme={handleApplyTheme}
        />
      </Card>
    </div>
  {/if}
</div>

<style>
  .blog-module {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .blog-module__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .blog-module__title {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .blog-module__icon {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border-radius: 12px;
    background: var(--kui-color-primary-muted);
    color: var(--kui-color-primary);
  }

  .blog-module__title h1 {
    margin: 0;
    font-size: 1.2rem;
  }

  .blog-module__title p {
    margin: 2px 0 0;
    color: var(--kui-color-text-muted);
    font-size: 0.9rem;
  }

  .blog-module__actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .blog-module__selector {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.85rem;
    color: var(--kui-color-text-muted);
  }

  .blog-module__selector select {
    min-width: 220px;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid var(--kui-color-border);
    background: var(--kui-color-surface);
    color: var(--kui-color-text);
  }

  .blog-module__toast {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 12px;
    font-size: 0.9rem;
  }

  .blog-module__toast--success {
    background: rgba(22, 163, 74, 0.08);
    color: #15803d;
  }

  .blog-module__toast--error {
    background: rgba(239, 68, 68, 0.1);
    color: #b91c1c;
  }

  .blog-module__card {
    padding: 16px;
    border-radius: 16px;
  }

  .blog-module__card--manager {
    padding: 0;
  }

  .blog-module__grid {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 16px;
  }

  .blog-module__card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .blog-module__eyebrow {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--kui-color-text-muted);
    font-size: 0.75rem;
  }

  .blog-module__stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin: 12px 0;
  }

  .blog-module__stat {
    padding: 12px;
    border: 1px solid var(--kui-color-border);
    border-radius: 12px;
    background: var(--kui-color-surface);
  }

  .blog-module__stat p {
    margin: 0 0 4px;
    color: var(--kui-color-text-muted);
    font-size: 0.85rem;
  }

  .blog-module__stat strong {
    font-size: 1.4rem;
  }

  .blog-module__actions-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .blog-module__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 0;
  }

  .blog-module__error {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .blog-module__error-title {
    margin: 0;
    font-weight: 600;
  }

  .blog-module__error-copy {
    margin: 2px 0 0;
    color: var(--kui-color-text-muted);
  }

  .blog-module__empty {
    display: flex;
    gap: 12px;
    align-items: center;
    color: var(--kui-color-text-muted);
  }

  .blog-module__muted {
    margin: 2px 0 0;
    color: var(--kui-color-text-muted);
  }

  @media (max-width: 1024px) {
    .blog-module__grid {
      grid-template-columns: 1fr;
    }
  }

  /* Scoped fallbacks for BlogManager (no Tailwind/Daisy UI available) */
  .blog-module :global(.p-3) { padding: 12px; }
  .blog-module :global(.space-y-4 > * + *) { margin-top: 16px; }
  .blog-module :global(.space-y-3 > * + *) { margin-top: 12px; }
  .blog-module :global(.px-3) { padding-left: 12px; padding-right: 12px; }
  .blog-module :global(.py-2) { padding-top: 8px; padding-bottom: 8px; }
  .blog-module :global(.rounded-lg) { border-radius: 12px; }
  .blog-module :global(.border) { border: 1px solid var(--kui-color-border); }
  .blog-module :global(.border-base-300) { border-color: var(--kui-color-border); }
  .blog-module :global(.bg-base-100) { background: var(--kui-color-surface); }
  .blog-module :global(.bg-base-200) { background: var(--kui-color-surface-muted, #f5f7fb); }
  .blog-module :global(.text-base-content\/80) { color: rgba(15, 23, 42, 0.8); }
  .blog-module :global(.text-base-content\/60) { color: rgba(15, 23, 42, 0.6); }
  .blog-module :global(.text-base-content\/70) { color: rgba(15, 23, 42, 0.7); }
  .blog-module :global(.text-xs) { font-size: 0.75rem; }
  .blog-module :global(.text-sm) { font-size: 0.875rem; }
  .blog-module :global(.font-semibold) { font-weight: 600; }
  .blog-module :global(.uppercase) { text-transform: uppercase; letter-spacing: 0.08em; }

  /* Buttons */
  .blog-module :global(.btn) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 10px;
    padding: 6px 10px;
    border: 1px solid var(--kui-color-border);
    background: var(--kui-color-surface);
    color: var(--kui-color-text);
    cursor: pointer;
  }
  .blog-module :global(.btn.btn-ghost) {
    background: transparent;
    border-color: transparent;
  }
  .blog-module :global(.btn.btn-outline) {
    background: transparent;
  }
  .blog-module :global(.btn.btn-primary) {
    background: var(--kui-color-primary);
    color: #fff;
    border-color: var(--kui-color-primary);
  }
  .blog-module :global(.btn-xs) { padding: 4px 8px; font-size: 0.75rem; }
  .blog-module :global(.btn-sm) { padding: 5px 10px; font-size: 0.8rem; }

  /* Inputs/selects */
  .blog-module :global(.select),
  .blog-module :global(.input),
  .blog-module :global(.textarea) {
    width: 100%;
    padding: 6px 8px;
    border-radius: 10px;
    border: 1px solid var(--kui-color-border);
    background: var(--kui-color-surface);
    color: var(--kui-color-text);
    font-size: 0.9rem;
  }
  .blog-module :global(.select-sm),
  .blog-module :global(.input-sm) {
    padding: 5px 8px;
    font-size: 0.85rem;
  }
  .blog-module :global(.select-bordered),
  .blog-module :global(.input-bordered) {
    border-color: var(--kui-color-border);
  }

  /* Misc layout utilities */
  .blog-module :global(.flex) { display: flex; }
  .blog-module :global(.items-center) { align-items: center; }
  .blog-module :global(.justify-between) { justify-content: space-between; }
  .blog-module :global(.gap-1) { gap: 4px; }
  .blog-module :global(.gap-2) { gap: 8px; }
  .blog-module :global(.gap-3) { gap: 12px; }
  .blog-module :global(.gap-4) { gap: 16px; }
  .blog-module :global(.w-full) { width: 100%; }
</style>
