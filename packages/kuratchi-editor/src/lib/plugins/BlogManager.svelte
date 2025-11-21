<script lang="ts">
    import { Plus } from '@lucide/svelte';
    import type { BlogData, BlogPost, BlogSettings } from '../types';
    import type { BlogTheme } from '../blog/themes';

    interface Props {
        blogData: BlogData;
        selectedPageForBlog: string | null;
        selectedPostId: string | null;
        addCustomNavItem: (location: 'header' | 'footer', label: string, slug: string) => void;
        addCategory: () => void | Promise<void>;
        updateCategoryField: (index: number, field: 'name' | 'slug', value: string) => void | Promise<void>;
        removeCategory: (index: number) => void | Promise<void>;
        addTag: () => void | Promise<void>;
        updateTagField: (index: number, field: 'name' | 'slug', value: string) => void | Promise<void>;
        removeTag: (index: number) => void | Promise<void>;
        addPostFromPageId: (pageId: string | null | undefined) => void | Promise<void>;
        updatePost: (postId: string, mutate: (post: BlogPost) => void) => void | Promise<void>;
        removePost: (postId: string) => void | Promise<void>;
        togglePostCategory: (postId: string, slug: string) => void | Promise<void>;
        togglePostTag: (postId: string, slug: string) => void | Promise<void>;
        setFeaturedPost: (postId: string | null) => void | Promise<void>;
        updateBlogSetting: (field: keyof BlogSettings, value: string | boolean | number | null) => void | Promise<void>;
        slugify: (value: string) => string;
        toDateInputValue: (value?: string) => string;
        getPageList: () => any[];
        onSelectPageForBlog?: (pageId: string | null) => void;
        onSelectPost?: (postId: string | null) => void;
        blogThemes?: BlogTheme[];
        onApplyTheme?: (themeId: string) => void | Promise<void>;
    }

    let {
        blogData,
        selectedPageForBlog = null,
        selectedPostId = null,
        addCustomNavItem,
        addCategory,
        updateCategoryField,
        removeCategory,
        addTag,
        updateTagField,
        removeTag,
        addPostFromPageId,
        updatePost,
        removePost,
        togglePostCategory,
        togglePostTag,
        setFeaturedPost,
        updateBlogSetting,
        slugify,
        toDateInputValue,
        getPageList,
        onSelectPageForBlog,
        onSelectPost,
        blogThemes = [],
        onApplyTheme
    }: Props = $props();

    let selectedPost: BlogPost | null = null;

    $effect(() => {
        selectedPost = blogData.posts.find((post) => post.id === selectedPostId) ?? null;
    });

    function handleSelectPageForBlog(pageId: string | null) {
        selectedPageForBlog = pageId;
        if (onSelectPageForBlog) {
            onSelectPageForBlog(pageId);
        }
    }

    function handleSelectPost(postId: string | null) {
        selectedPostId = postId;
        if (onSelectPost) {
            onSelectPost(postId);
        }
    }
</script>

<div class="p-3 space-y-4">
    <div class="rounded-lg border border-base-300 bg-base-100 overflow-hidden">
        <div class="flex items-center justify-between px-3 py-2 bg-base-200 border-b border-base-300">
            <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-base-content/80">Blog Settings</p>
                <p class="text-xs text-base-content/60">Manage blog appearance and navigation</p>
            </div>

    {#if blogThemes.length > 0}
        <div class="rounded-lg border border-base-300 bg-base-100 overflow-hidden">
            <div class="flex items-center justify-between px-3 py-2 bg-base-200 border-b border-base-300">
                <span class="text-xs font-semibold uppercase tracking-wide text-base-content/80">Blog Themes</span>
            </div>
            <div class="p-3 space-y-2">
                {#each blogThemes as theme}
                    <button
                        class="w-full flex flex-col items-start gap-1 px-3 py-2 rounded-lg hover:bg-base-200 text-left text-sm border border-base-300"
                        onclick={() => onApplyTheme && onApplyTheme(theme.id)}
                    >
                        <span class="font-medium">{theme.name}</span>
                        <span class="text-xs text-base-content/70">{theme.description}</span>
                    </button>
                {/each}
            </div>
        </div>
    {/if}
            <div class="flex gap-1">
                <button
                    class="btn btn-ghost btn-xs"
                    onclick={() =>
                        addCustomNavItem('header', 'Blog', blogData.settings.indexSlug ?? 'blog')}
                >
                    + Header
                </button>
                <button
                    class="btn btn-ghost btn-xs"
                    onclick={() =>
                        addCustomNavItem('footer', 'Blog', blogData.settings.indexSlug ?? 'blog')}
                >
                    + Footer
                </button>
            </div>
        </div>
        <div class="p-3 space-y-3">
            <label class="form-control">
                <span class="label-text text-xs">Blog Home Page</span>
                <select
                    class="select select-sm select-bordered"
                    value={blogData.settings.indexPageId ?? ''}
                    onchange={(e) => {
                        const pageId = (e.currentTarget as HTMLSelectElement).value || null;
                        updateBlogSetting('indexPageId', pageId);
                    }}
                >
                    <option value="">(None)</option>
                    {#each getPageList() as page}
                        <option value={page.id}>
                            {page.title || 'Untitled'} ({page.slug || 'no slug'})
                        </option>
                    {/each}
                </select>
            </label>
            <label class="form-control">
                <span class="label-text text-xs">Blog URL Slug</span>
                <input
                    type="text"
                    class="input input-sm input-bordered"
                    value={blogData.settings.indexSlug ?? 'blog'}
                    oninput={(e) =>
                        updateBlogSetting(
                            'indexSlug',
                            (e.currentTarget as HTMLInputElement).value || 'blog'
                        )}
                />
            </label>
            <label class="form-control">
                <span class="label-text text-xs">Layout Style</span>
                <select
                    class="select select-sm select-bordered"
                    value={blogData.settings.layout ?? 'classic'}
                    onchange={(e) =>
                        updateBlogSetting('layout', (e.currentTarget as HTMLSelectElement).value as BlogSettings['layout'])
                    }
                >
                    <option value="classic">Classic</option>
                    <option value="grid">Grid</option>
                    <option value="minimal">Minimal</option>
                </select>
            </label>
            <label class="form-control">
                <span class="label-text text-xs">Hero Style</span>
                <select
                    class="select select-sm select-bordered"
                    value={blogData.settings.heroStyle ?? 'cover'}
                    onchange={(e) =>
                        updateBlogSetting('heroStyle', (e.currentTarget as HTMLSelectElement).value)
                    }
                >
                    <option value="cover">Cover</option>
                    <option value="split">Split</option>
                </select>
            </label>
            <label class="form-control">
                <span class="label-text text-xs">Posts Per Page</span>
                <input
                    type="number"
                    min="1"
                    class="input input-sm input-bordered"
                    value={blogData.settings.postsPerPage ?? 6}
                    oninput={(e) => {
                        const raw = (e.currentTarget as HTMLInputElement).value;
                        const parsed = parseInt(raw, 10);
                        updateBlogSetting('postsPerPage', Number.isNaN(parsed) ? null : parsed);
                    }}
                />
            </label>
            <label class="form-control">
                <span class="label-text text-xs">Sort Order</span>
                <select
                    class="select select-sm select-bordered"
                    value={blogData.settings.sortOrder ?? 'newest'}
                    onchange={(e) =>
                        updateBlogSetting('sortOrder', (e.currentTarget as HTMLSelectElement).value)
                    }
                >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="manual">Manual</option>
                </select>
            </label>
            <label class="label cursor-pointer justify-start gap-2 text-sm">
                <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    checked={blogData.settings.showAuthor ?? true}
                    onchange={(e) => updateBlogSetting('showAuthor', (e.currentTarget as HTMLInputElement).checked)}
                />
                <span class="label-text">Display author information</span>
            </label>
        </div>
    </div>

    <div class="rounded-lg border border-base-300 bg-base-100 overflow-hidden">
        <div class="flex items-center justify-between px-3 py-2 bg-base-200 border-b border-base-300">
            <span class="text-xs font-semibold uppercase tracking-wide text-base-content/80">Categories</span>
            <button class="btn btn-primary btn-xs" onclick={addCategory}>Add</button>
        </div>
        <div class="p-3 space-y-2 max-h-48 overflow-y-auto">
            {#if blogData.categories.length > 0}
                {#each blogData.categories as category, index (category.id)}
                    <div class="bg-base-100 border border-base-300 rounded-lg p-2 space-y-1">
                        <input
                            type="text"
                            class="input input-xs input-bordered w-full"
                            value={category.name}
                            oninput={(e) =>
                                updateCategoryField(index, 'name', (e.currentTarget as HTMLInputElement).value)}
                            placeholder="Category name"
                        />
                        <input
                            type="text"
                            class="input input-xs input-bordered w-full"
                            value={category.slug}
                            oninput={(e) =>
                                updateCategoryField(index, 'slug', (e.currentTarget as HTMLInputElement).value)}
                            placeholder="Slug"
                        />
                        <button class="btn btn-ghost btn-xs text-error" onclick={() => removeCategory(index)}>
                            Remove
                        </button>
                    </div>
                {/each}
            {:else}
                <p class="text-xs text-base-content/60 text-center py-4">No categories yet.</p>
            {/if}
        </div>
    </div>

    <div class="rounded-lg border border-base-300 bg-base-100 overflow-hidden">
        <div class="flex items-center justify-between px-3 py-2 bg-base-200 border-b border-base-300">
            <span class="text-xs font-semibold uppercase tracking-wide text-base-content/80">Tags</span>
            <button class="btn btn-primary btn-xs" onclick={addTag}>Add</button>
        </div>
        <div class="p-3 space-y-2 max-h-40 overflow-y-auto">
            {#if blogData.tags.length > 0}
                {#each blogData.tags as tag, index (tag.id)}
                    <div class="bg-base-100 border border-base-300 rounded-lg p-2 space-y-1">
                        <input
                            type="text"
                            class="input input-xs input-bordered w-full"
                            value={tag.name}
                            oninput={(e) => updateTagField(index, 'name', (e.currentTarget as HTMLInputElement).value)}
                            placeholder="Tag name"
                        />
                        <input
                            type="text"
                            class="input input-xs input-bordered w-full"
                            value={tag.slug}
                            oninput={(e) => updateTagField(index, 'slug', (e.currentTarget as HTMLInputElement).value)}
                            placeholder="Slug"
                        />
                        <button class="btn btn-ghost btn-xs text-error" onclick={() => removeTag(index)}>
                            Remove
                        </button>
                    </div>
                {/each}
            {:else}
                <p class="text-xs text-base-content/60 text-center py-4">No tags yet.</p>
            {/if}
        </div>
    </div>

    <div class="rounded-lg border border-base-300 bg-base-100 overflow-hidden">
        <div class="flex items-center justify-between px-3 py-2 bg-base-200 border-b border-base-300">
            <span class="text-xs font-semibold uppercase tracking-wide text-base-content/80">Posts</span>
            <div class="flex items-center gap-2">
                <select
                    class="select select-xs select-bordered"
                    value={selectedPageForBlog ?? ''}
                    onchange={(e) => {
                        const pageId = (e.currentTarget as HTMLSelectElement).value || null;
                        handleSelectPageForBlog(pageId);
                    }}
                >
                    {#if getPageList().length > 0}
                        {#each getPageList() as page}
                            <option value={page.id}>
                                {page.title || 'Untitled'} ({page.slug || 'no slug'})
                            </option>
                        {/each}
                    {:else}
                        <option disabled selected>No pages available</option>
                    {/if}
                </select>
                <button class="btn btn-primary btn-xs gap-1" onclick={() => addPostFromPageId(selectedPageForBlog)}>
                    <Plus class="w-3 h-3" />
                    <span>Link Page</span>
                </button>
            </div>
        </div>
        <div class="p-3 bg-base-200 rounded-b-lg">
            <div class="grid grid-cols-1 md:grid-cols-[180px,1fr] gap-3">
                <div class="space-y-1 max-h-64 overflow-y-auto">
                    {#if blogData.posts.length > 0}
                        {#each blogData.posts as post (post.id)}
                            <button
                                class="w-full rounded-lg px-2 py-1 text-left transition {selectedPostId === post.id ? 'bg-primary text-primary-content' : 'bg-base-100 hover:bg-base-300'}"
                                onclick={() => handleSelectPost(post.id)}
                            >
                                <span class="text-sm font-semibold truncate">{post.title}</span>
                                <span class="block text-xs opacity-70 truncate">/{post.slug}</span>
                            </button>
                        {/each}
                    {:else}
                        <p class="text-xs text-base-content/60 text-center py-6">
                            No posts yet. Create one above.
                        </p>
                    {/if}
                </div>
                <div class="bg-base-100 rounded-lg p-3 space-y-2">
                    {#if selectedPost}
                        <div class="space-y-2">
                            <label class="form-control">
                                <span class="label-text text-xs">Linked Page</span>
                                <select
                                    class="select select-sm select-bordered"
                                    value={selectedPost.pageId}
                                    onchange={(e) => {
                                        const pageId = (e.currentTarget as HTMLSelectElement).value;
                                        const page = getPageList().find((entry) => entry.id === pageId);
                                        if (!page) return;
                                        updatePost(selectedPost.id, (post) => {
                                            post.pageId = page.id;
                                            post.title = page.title ?? post.title;
                                            post.slug = page.slug ?? slugify(post.title);
                                        });
                                    }}
                                >
                                    {#each getPageList() as page}
                                        <option value={page.id}>
                                            {page.title || 'Untitled'} ({page.slug || 'no slug'})
                                        </option>
                                    {/each}
                                </select>
                            </label>
                            <div>
                                <p class="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                                    Title
                                </p>
                                <p class="text-sm">{selectedPost.title}</p>
                            </div>
                            <div>
                                <p class="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                                    Slug
                                </p>
                                <p class="text-sm text-base-content/70">/{selectedPost.slug}</p>
                            </div>
                            <button
                                class="btn btn-outline btn-xs"
                                onclick={() => {
                                    const page = getPageList().find((entry) => entry.id === selectedPost.pageId);
                                    if (!page) return;
                                    updatePost(selectedPost.id, (post) => {
                                        post.title = page.title ?? post.title;
                                        post.slug = page.slug ?? slugify(post.title);
                                    });
                                }}
                            >
                                Sync title & slug from page
                            </button>
                            <label class="form-control">
                                <span class="label-text text-xs">Excerpt</span>
                                <textarea
                                    class="textarea textarea-sm textarea-bordered"
                                    rows="3"
                                    value={selectedPost.excerpt}
                                    oninput={(e) =>
                                        updatePost(selectedPost.id, (post) => {
                                            post.excerpt = (e.currentTarget as HTMLTextAreaElement).value;
                                        })}
                                ></textarea>
                            </label>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <label class="form-control">
                                    <span class="label-text text-xs">Cover Image URL</span>
                                    <input
                                        type="text"
                                        class="input input-sm input-bordered"
                                        value={selectedPost.coverImage?.url ?? ''}
                                        oninput={(e) =>
                                            updatePost(selectedPost.id, (post) => {
                                                post.coverImage = {
                                                    ...(post.coverImage ?? {}),
                                                    url: (e.currentTarget as HTMLInputElement).value
                                                };
                                            })}
                                    />
                                </label>
                                <label class="form-control">
                                    <span class="label-text text-xs">Image Alt Text</span>
                                    <input
                                        type="text"
                                        class="input input-sm input-bordered"
                                        value={selectedPost.coverImage?.alt ?? ''}
                                        oninput={(e) =>
                                            updatePost(selectedPost.id, (post) => {
                                                post.coverImage = {
                                                    ...(post.coverImage ?? {}),
                                                    alt: (e.currentTarget as HTMLInputElement).value
                                                };
                                            })}
                                    />
                                </label>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <label class="form-control">
                                    <span class="label-text text-xs">Author</span>
                                    <input
                                        type="text"
                                        class="input input-sm input-bordered"
                                        value={selectedPost.author ?? ''}
                                        oninput={(e) =>
                                            updatePost(selectedPost.id, (post) => {
                                                post.author = (e.currentTarget as HTMLInputElement).value;
                                            })}
                                    />
                                </label>
                                <label class="form-control">
                                    <span class="label-text text-xs">Publish Date</span>
                                    <input
                                        type="date"
                                        class="input input-sm input-bordered"
                                        value={selectedPost.publishedOn ?? toDateInputValue()}
                                        onchange={(e) =>
                                            updatePost(selectedPost.id, (post) => {
                                                post.publishedOn = (e.currentTarget as HTMLInputElement).value;
                                            })}
                                    />
                                </label>
                            </div>
                            <div class="space-y-1">
                                <span class="text-xs font-semibold uppercase tracking-wide">Categories</span>
                                <div class="flex flex-wrap gap-1">
                                    {#each blogData.categories as category}
                                        <label
                                            class="badge badge-lg gap-1 cursor-pointer {selectedPost?.categories?.includes(category.slug) ? 'badge-primary' : 'badge-outline'}"
                                        >
                                            <input
                                                type="checkbox"
                                                class="hidden"
                                                checked={selectedPost?.categories?.includes(category.slug) ?? false}
                                                onchange={() =>
                                                    selectedPost &&
                                                    togglePostCategory(selectedPost.id, category.slug)}
                                            />
                                            {category.name}
                                        </label>
                                    {/each}
                                    {#if blogData.categories.length === 0}
                                        <span class="text-xs text-base-content/60">
                                            No categories defined.
                                        </span>
                                    {/if}
                                </div>
                            </div>
                            <div class="space-y-1">
                                <span class="text-xs font-semibold uppercase tracking-wide">Tags</span>
                                <div class="flex flex-wrap gap-1">
                                    {#each blogData.tags as tag}
                                        <label
                                            class="badge badge-sm gap-1 cursor-pointer {selectedPost?.tags?.includes(tag.slug) ? 'badge-secondary' : 'badge-outline'}"
                                        >
                                            <input
                                                type="checkbox"
                                                class="hidden"
                                                checked={selectedPost?.tags?.includes(tag.slug) ?? false}
                                                onchange={() =>
                                                    selectedPost &&
                                                    togglePostTag(selectedPost.id, tag.slug)}
                                            />
                                            {tag.name}
                                        </label>
                                    {/each}
                                    {#if blogData.tags.length === 0}
                                        <span class="text-xs text-base-content/60">
                                            No tags defined.
                                        </span>
                                    {/if}
                                </div>
                            </div>
                            <div class="flex items-center justify-between">
                                <button
                                    class="btn btn-error btn-sm"
                                    onclick={() => removePost(selectedPost.id)}
                                >
                                    Delete Post
                                </button>
                                <button
                                    class={`btn btn-sm ${blogData.settings.featuredPostId === selectedPost.id ? 'btn-primary text-primary-content' : 'btn-outline'}`}
                                    onclick={() => setFeaturedPost(selectedPost.id)}
                                >
                                    {blogData.settings.featuredPostId === selectedPost.id ? 'Featured' : 'Set as Featured'}
                                </button>
                            </div>
                        </div>
                    {:else}
                        <div class="text-sm text-base-content/60 text-center py-6">
                            Select a post to edit its details.
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    </div>
</div>
