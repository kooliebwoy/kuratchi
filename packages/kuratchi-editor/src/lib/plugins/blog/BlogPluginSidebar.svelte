<script lang="ts">
    import type { PluginContext } from '../context';
    import type { BlogData } from '../../types';
    import { createDefaultBlogData } from '../../types';
    import BlogManager from '../BlogManager.svelte';
    import { blogStore } from '../../stores/blog';
    import { getAllBlogThemes, getBlogTheme } from './blogThemes';

    let { ctx }: { ctx: PluginContext } = $props();

    // Plugin-owned blog state
    let blogData = $state<BlogData>((ctx.siteMetadata.blog as BlogData) ?? createDefaultBlogData());
    let blogSnapshot = JSON.stringify(blogData);
    blogStore.set(blogData);
    
    let selectedPostId = $state<string | null>(null);
    let selectedPageForBlog = $state<string | null>(null);
    
    $effect(() => {
        if (!selectedPostId && blogData.posts.length > 0) {
            selectedPostId = blogData.posts[0].id;
        }
    });
    
    $effect(() => {
        if (!selectedPageForBlog && ctx.pages.length > 0) {
            selectedPageForBlog = ctx.pages[0].id;
        }
    });

    const blogThemeOptions = getAllBlogThemes();

    const randomId = () => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2));

    const slugify = (value: string) =>
        value
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'entry';

    const toDateInputValue = (value?: string) => value ?? new Date().toISOString().slice(0, 10);

    const getPageList = () => ctx.pages;

    const persistBlog = async (next: BlogData) => {
        blogData = next;
        blogSnapshot = JSON.stringify(blogData);
        blogStore.set(blogData);
        await ctx.updateSiteMetadata({ blog: blogData });
    };

    const updateBlog = async (updater: (blog: BlogData) => BlogData) => {
        const updated = updater(structuredClone(blogData));
        await persistBlog(updated);
    };

    // Blog management functions
    const addCategory = async () => {
        await updateBlog((blog) => {
            blog.categories.push({ id: randomId(), name: 'New Category', slug: 'new-category' });
            return blog;
        });
    };

    const updateCategoryField = async (id: string, field: 'name' | 'slug', value: string) => {
        await updateBlog((blog) => {
            const cat = blog.categories.find(c => c.id === id);
            if (cat) cat[field] = value;
            return blog;
        });
    };

    const removeCategory = async (id: string) => {
        await updateBlog((blog) => {
            blog.categories = blog.categories.filter(c => c.id !== id);
            blog.posts.forEach(post => {
                post.categories = post.categories.filter(catId => catId !== id);
            });
            return blog;
        });
    };

    const addTag = async () => {
        await updateBlog((blog) => {
            blog.tags.push({ id: randomId(), name: 'new-tag', slug: 'new-tag' });
            return blog;
        });
    };

    const updateTagField = async (id: string, field: 'name' | 'slug', value: string) => {
        await updateBlog((blog) => {
            const tag = blog.tags.find(t => t.id === id);
            if (tag) tag[field] = value;
            return blog;
        });
    };

    const removeTag = async (id: string) => {
        await updateBlog((blog) => {
            blog.tags = blog.tags.filter(t => t.id !== id);
            blog.posts.forEach(post => {
                post.tags = post.tags.filter(tagId => tagId !== id);
            });
            return blog;
        });
    };

    const addPostFromPageId = async (pageId: string) => {
        const page = ctx.pages.find(p => p.id === pageId);
        if (!page) return;

        await updateBlog((blog) => {
            const newPost = {
                id: randomId(),
                pageId,
                title: page.name,
                slug: page.slug,
                excerpt: '',
                categories: [],
                tags: []
            };
            blog.posts.push(newPost);
            return blog;
        });
    };

    const updatePost = async (postId: string, updates: Partial<any>) => {
        await updateBlog((blog) => {
            const post = blog.posts.find(p => p.id === postId);
            if (post) Object.assign(post, updates);
            return blog;
        });
    };

    const removePost = async (postId: string) => {
        await updateBlog((blog) => {
            blog.posts = blog.posts.filter(p => p.id !== postId);
            if (blog.settings.featuredPostId === postId) {
                blog.settings.featuredPostId = null;
            }
            return blog;
        });
    };

    const togglePostCategory = async (postId: string, categoryId: string) => {
        await updateBlog((blog) => {
            const post = blog.posts.find(p => p.id === postId);
            if (post) {
                const idx = post.categories.indexOf(categoryId);
                if (idx > -1) {
                    post.categories.splice(idx, 1);
                } else {
                    post.categories.push(categoryId);
                }
            }
            return blog;
        });
    };

    const togglePostTag = async (postId: string, tagSlug: string) => {
        await updateBlog((blog) => {
            const post = blog.posts.find(p => p.id === postId);
            if (post) {
                const idx = post.tags.indexOf(tagSlug);
                if (idx > -1) {
                    post.tags.splice(idx, 1);
                } else {
                    post.tags.push(tagSlug);
                }
            }
            return blog;
        });
    };

    const setFeaturedPost = async (postId: string | null) => {
        await updateBlog((blog) => {
            blog.settings.featuredPostId = postId;
            return blog;
        });
    };

    const updateBlogSetting = async (field: string, value: any) => {
        await updateBlog((blog) => {
            (blog.settings as any)[field] = value;
            return blog;
        });
    };

    const addCustomNavItem = async () => {
        console.log('addCustomNavItem not yet implemented in plugin');
    };

    const applyBlogTheme = async (themeId: string) => {
        const theme = getBlogTheme(themeId);
        if (theme) {
            await updateBlogSetting('themeId', themeId);
        }
    };
</script>

<BlogManager
    {blogData}
    {selectedPageForBlog}
    {selectedPostId}
    {addCustomNavItem}
    {addCategory}
    {updateCategoryField}
    {removeCategory}
    {addTag}
    {updateTagField}
    {removeTag}
    {addPostFromPageId}
    {updatePost}
    {removePost}
    {togglePostCategory}
    {togglePostTag}
    {setFeaturedPost}
    {updateBlogSetting}
    {slugify}
    {toDateInputValue}
    {getPageList}
    blogThemes={blogThemeOptions}
    onApplyTheme={applyBlogTheme}
/>
