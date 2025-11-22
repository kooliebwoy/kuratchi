<script lang="ts">
    import { ArrowRight } from '@lucide/svelte';
    import { onMount } from 'svelte';
    import { Pencil } from 'lucide-svelte';
    import { BlockActions, SideActions } from '../shell/index.js';
    import { blogStore } from '../stores/blog';
    import type { BlogData } from '../types';

    type BlogLayoutStyle = 'grid' | 'list';

    interface LayoutMetadata {
        backgroundColor: string;
        cardBackground: string;
        borderColor: string;
        textColor: string;
        accentColor: string;
    }

    interface NormalizedPost {
        id: string;
        title: string;
        slug: string;
        excerpt?: string;
        publishedOn?: string;
        categories: string[];
        coverImage: {
            url: string;
            alt: string;
        };
    }

    interface Props {
        id?: string;
        type?: string;
        layout?: BlogLayoutStyle;
        showExcerpt?: boolean;
        showDate?: boolean;
        showCategories?: boolean;
        showReadMore?: boolean;
        readMoreLabel?: string;
        posts?: NormalizedPost[];
        metadata?: LayoutMetadata;
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        type = 'blog-post-list',
        layout = $bindable<BlogLayoutStyle>('grid'),
        showExcerpt = $bindable(true),
        showDate = $bindable(true),
        showCategories = $bindable(true),
        showReadMore = $bindable(true),
        readMoreLabel = $bindable('Read article'),
        posts = $bindable<NormalizedPost[]>([]),
        metadata: layoutMetadata = $bindable<LayoutMetadata>({
            backgroundColor: '#f8fafc',
            cardBackground: '#ffffff',
            borderColor: '#e2e8f0',
            textColor: '#0f172a',
            accentColor: '#2563eb'
        }) as LayoutMetadata,
        editable = true
    }: Props = $props();

    const blog = blogStore;

    const getVisiblePosts = (data: BlogData) => {
        const posts = Array.isArray(data.posts) ? [...data.posts] : [];
        const sortOrder = data.settings.sortOrder ?? 'newest';
        posts.sort((a, b) => {
            const aDate = a.publishedOn ?? '';
            const bDate = b.publishedOn ?? '';
            if (!aDate && !bDate) return 0;
            if (!aDate) return 1;
            if (!bDate) return -1;
            return sortOrder === 'oldest' ? aDate.localeCompare(bDate) : bDate.localeCompare(aDate);
        });
        const limit = data.settings.postsPerPage ?? 6;
        return posts.slice(0, limit);
    };

    const normalizePosts = (items: BlogData['posts'] = []) =>
        (items ?? []).map((post) => ({
            id: post.id,
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            publishedOn: post.publishedOn,
            categories: post.categories ?? [],
            coverImage: {
                url: post.coverImage?.url ?? '',
                alt: post.coverImage?.alt ?? post.title ?? 'Blog cover image'
            }
        } satisfies NormalizedPost));

    $effect(() => {
        if (!editable) return;

        const unsubscribe = blog.subscribe(($blog) => {
            if (!$blog) return;
            const visible = getVisiblePosts($blog as BlogData);
            posts = normalizePosts(visible as BlogData['posts']);
        });

        return unsubscribe;
    });

    const layoutStyle = $derived(
        `--krt-blogList-bg: ${layoutMetadata.backgroundColor}; --krt-blogList-card: ${layoutMetadata.cardBackground}; --krt-blogList-border: ${layoutMetadata.borderColor}; --krt-blogList-text: ${layoutMetadata.textColor}; --krt-blogList-accent: ${layoutMetadata.accentColor};`
    );

    const content = $derived({
        id,
        type,
        layout,
        showExcerpt,
        showDate,
        showCategories,
        showReadMore,
        readMoreLabel,
        metadata: { ...layoutMetadata },
        posts
    });

    let component: HTMLElement;
    let mounted = $state(false);
    const sideActionsId = `side-actions-${id}`;

    onMount(() => {
        mounted = true;
    });
</script>

{#if editable}
<div class="editor-item" bind:this={component}>
    {#if mounted}
        <BlockActions {id} {type} element={component} />
    {/if}
    <section {id} data-type={type} class="krt-blogList" style={layoutStyle}>
        <div class="krt-blogList__metadata">{JSON.stringify(content)}</div>
        <div class="krt-blogList__container">
            {#if posts.length}
                <div class={`krt-blogList__grid ${layout === 'list' ? 'krt-blogList__grid--list' : ''}`}>
                    {#each posts as post (post.id)}
                        <article class="krt-blogListCard">
                            {#if post.coverImage?.url}
                                <figure class="krt-blogListCard__media">
                                    <img src={post.coverImage.url} alt={post.coverImage.alt ?? post.title} loading="lazy" />
                                </figure>
                            {/if}
                            <div class="krt-blogListCard__body">
                                {#if showCategories}
                                    <div class="krt-blogListCard__tags">
                                        {#if post.categories?.length}
                                            {#each post.categories as categorySlug}
                                                {@const category = ($blog?.categories ?? []).find((entry) => entry.slug === categorySlug)}
                                                <span class="krt-blogListCard__tag">{category?.name ?? categorySlug}</span>
                                            {/each}
                                        {:else}
                                            <span class="krt-blogListCard__tag">Blog</span>
                                        {/if}
                                    </div>
                                {/if}
                                <h3 class="krt-blogListCard__title">{post.title}</h3>
                                {#if showExcerpt}
                                    <p class="krt-blogListCard__excerpt">{post.excerpt}</p>
                                {/if}
                                <div class="krt-blogListCard__meta">
                                    {#if showDate}
                                        <span>{post.publishedOn}</span>
                                    {/if}
                                    {#if showReadMore}
                                        <a
                                            class="krt-blogListCard__readMore"
                                            href={`/${$blog?.settings?.indexSlug ?? 'blog'}/${post.slug}`}
                                            onclick={(event) => event.preventDefault()}
                                        >
                                            {readMoreLabel}
                                            <ArrowRight aria-hidden="true" />
                                        </a>
                                    {/if}
                                </div>
                            </div>
                        </article>
                    {/each}
                </div>
            {:else}
                <p class="krt-blogList__empty">No posts yet. Add a blog post in the Blog panel to populate this section.</p>
            {/if}
        </div>
    </section>
</div>

<SideActions triggerId={sideActionsId}>
    {#snippet label()}
        <button id={sideActionsId} class="krt-editButton" aria-label="Edit blog post list settings">
            <Pencil size={16} />
            <span>Edit Settings</span>
        </button>
    {/snippet}
    {#snippet content()}
        <div class="krt-blogListDrawer">
            <section class="krt-blogListDrawer__section">
                <h3>Layout</h3>
                <label class="krt-blogListDrawer__field">
                    <span>Layout style</span>
                    <select bind:value={layout}>
                        <option value="grid">Grid</option>
                        <option value="list">List</option>
                    </select>
                </label>
            </section>

            <section class="krt-blogListDrawer__section">
                <h3>Display</h3>
                <div class="krt-blogListDrawer__checks">
                    <label>
                        <input type="checkbox" bind:checked={showExcerpt} />
                        <span>Show excerpt</span>
                    </label>
                    <label>
                        <input type="checkbox" bind:checked={showDate} />
                        <span>Show publish date</span>
                    </label>
                    <label>
                        <input type="checkbox" bind:checked={showCategories} />
                        <span>Show categories</span>
                    </label>
                    <label>
                        <input type="checkbox" bind:checked={showReadMore} />
                        <span>Show read more link</span>
                    </label>
                </div>
                <label class="krt-blogListDrawer__field">
                    <span>Read more label</span>
                    <input type="text" bind:value={readMoreLabel} placeholder="Read article" />
                </label>
            </section>

            <section class="krt-blogListDrawer__section">
                <h3>Colors</h3>
                <div class="krt-blogListDrawer__grid">
                    <label class="krt-blogListDrawer__field">
                        <span>Background</span>
                        <input type="color" bind:value={layoutMetadata.backgroundColor} />
                    </label>
                    <label class="krt-blogListDrawer__field">
                        <span>Card</span>
                        <input type="color" bind:value={layoutMetadata.cardBackground} />
                    </label>
                    <label class="krt-blogListDrawer__field">
                        <span>Border</span>
                        <input type="color" bind:value={layoutMetadata.borderColor} />
                    </label>
                    <label class="krt-blogListDrawer__field">
                        <span>Text</span>
                        <input type="color" bind:value={layoutMetadata.textColor} />
                    </label>
                    <label class="krt-blogListDrawer__field">
                        <span>Accent</span>
                        <input type="color" bind:value={layoutMetadata.accentColor} />
                    </label>
                </div>
            </section>
        </div>
    {/snippet}
</SideActions>
{:else}
    <section id={id} data-type={type} class="krt-blogList" style={layoutStyle}>
        <div class="krt-blogList__metadata">{JSON.stringify(content)}</div>
        <div class="krt-blogList__container">
            {#if content.posts?.length}
                <div class={`krt-blogList__grid ${layout === 'list' ? 'krt-blogList__grid--list' : ''}`}>
                    {#each content.posts as post (post.id)}
                        <article class="krt-blogListCard">
                            {#if post.coverImage.url}
                                <figure class="krt-blogListCard__media">
                                    <img src={post.coverImage.url} alt={post.coverImage.alt} loading="lazy" />
                                </figure>
                            {/if}
                            <div class="krt-blogListCard__body">
                                {#if showCategories}
                                    <div class="krt-blogListCard__tags">
                                        {#if post.categories.length}
                                            {#each post.categories as categorySlug}
                                                {@const category = ($blog?.categories ?? []).find((entry) => entry.slug === categorySlug)}
                                                <span class="krt-blogListCard__tag">{category?.name ?? categorySlug}</span>
                                            {/each}
                                        {:else}
                                            <span class="krt-blogListCard__tag">Blog</span>
                                        {/if}
                                    </div>
                                {/if}
                                <h3 class="krt-blogListCard__title">{post.title}</h3>
                                {#if showExcerpt}
                                    <p class="krt-blogListCard__excerpt">{post.excerpt}</p>
                                {/if}
                                <div class="krt-blogListCard__meta">
                                    {#if showDate}
                                        <span>{post.publishedOn}</span>
                                    {/if}
                                    {#if showReadMore}
                                        <a class="krt-blogListCard__readMore" href={`/${$blog?.settings?.indexSlug ?? 'blog'}/${post.slug}`}>
                                            {readMoreLabel}
                                            <ArrowRight aria-hidden="true" />
                                        </a>
                                    {/if}
                                </div>
                            </div>
                        </article>
                    {/each}
                </div>
            {:else}
                <p class="krt-blogList__empty">No posts yet. Add a blog post in the Blog panel to populate this section.</p>
            {/if}
        </div>
    </section>
{/if}

<style>
    .krt-blogList {
        position: relative;
        isolation: isolate;
        padding: clamp(2.25rem, 6vw, 4rem) clamp(1.25rem, 6vw, 4rem);
        background: var(--krt-blogList-bg, #f8fafc);
        color: var(--krt-blogList-text, #0f172a);
    }

    .krt-blogList__metadata {
        display: none;
    }

    .krt-blogList__container {
        width: min(1120px, 100%);
        margin: 0 auto;
    }

    .krt-blogList__grid {
        display: grid;
        gap: clamp(1.5rem, 4vw, 2.5rem);
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    }

    .krt-blogList__grid--list {
        grid-template-columns: 1fr;
    }

    .krt-blogListCard {
        display: flex;
        flex-direction: column;
        border-radius: var(--krt-radius-xl, 1.1rem);
        overflow: hidden;
        background: var(--krt-blogList-card, #ffffff);
        border: 1px solid color-mix(in srgb, var(--krt-blogList-border, #e2e8f0) 90%, transparent);
        box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
    }

    .krt-blogListCard__media {
        width: 100%;
        aspect-ratio: 16 / 9;
        overflow: hidden;
        background: color-mix(in srgb, var(--krt-blogList-border, #e2e8f0) 45%, transparent);
    }

    .krt-blogListCard__media img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    .krt-blogListCard__body {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: clamp(1.25rem, 1rem + 1vw, 1.75rem);
    }

    .krt-blogListCard__tags {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
    }

    .krt-blogListCard__tag {
        padding: 0.2rem 0.65rem;
        border-radius: var(--krt-radius-pill, 999px);
        font-size: 0.65rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        background: color-mix(in srgb, var(--krt-blogList-accent, #2563eb) 18%, transparent);
        color: color-mix(in srgb, var(--krt-blogList-text, #0f172a) 75%, transparent);
    }

    .krt-blogListCard__title {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 650;
        letter-spacing: -0.01em;
        color: var(--krt-blogList-text, #0f172a);
    }

    .krt-blogListCard__excerpt {
        margin: 0;
        color: color-mix(in srgb, var(--krt-blogList-text, #0f172a) 70%, transparent);
        font-size: 0.95rem;
        line-height: 1.6;
        display: -webkit-box;
        line-clamp: 3;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .krt-blogListCard__meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        font-size: 0.85rem;
        color: color-mix(in srgb, var(--krt-blogList-text, #0f172a) 65%, transparent);
    }

    .krt-blogListCard__readMore {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-weight: 600;
        text-decoration: none;
        color: var(--krt-blogList-accent, #2563eb);
    }

    .krt-blogListCard__readMore svg {
        width: 1rem;
        height: 1rem;
    }

    .krt-blogList__empty {
        margin: 0;
        padding: 1rem;
        border-radius: var(--krt-radius-lg, 0.9rem);
        border: 1px dashed color-mix(in srgb, var(--krt-blogList-border, #e2e8f0) 80%, transparent);
        text-align: center;
        color: color-mix(in srgb, var(--krt-blogList-text, #0f172a) 70%, transparent);
    }

    .krt-blogListDrawer {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-xl, 1.25rem);
    }

    .krt-blogListDrawer__section {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-md, 0.75rem);
        padding: var(--krt-space-lg, 1rem);
        border-radius: var(--krt-radius-lg, 0.9rem);
        border: 1px solid color-mix(in srgb, var(--krt-color-border, #d1d5db) 80%, transparent);
        background: color-mix(in srgb, var(--krt-color-surface, #ffffff) 95%, transparent);
    }

    .krt-blogListDrawer__section h3 {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
        letter-spacing: 0.02em;
    }

    .krt-blogListDrawer__field {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
        font-size: 0.9rem;
        font-weight: 500;
        color: color-mix(in srgb, var(--krt-color-text, #111827) 75%, transparent);
    }

    .krt-blogListDrawer__field input[type='text'],
    .krt-blogListDrawer__field select {
        appearance: none;
        width: 100%;
        font: inherit;
        padding: 0.55rem 0.75rem;
        border-radius: var(--krt-radius-md, 0.75rem);
        border: 1px solid color-mix(in srgb, var(--krt-color-border, #d1d5db) 82%, transparent);
        background: color-mix(in srgb, var(--krt-color-surface, #ffffff) 98%, transparent);
        outline: none;
        transition: border-color 120ms ease, box-shadow 120ms ease;
    }

    .krt-blogListDrawer__field input[type='color'] {
        min-height: 2.5rem;
        padding: 0.2rem;
        border-radius: var(--krt-radius-md, 0.75rem);
        border: 1px solid color-mix(in srgb, var(--krt-color-border, #d1d5db) 82%, transparent);
        background: color-mix(in srgb, var(--krt-color-surface, #ffffff) 98%, transparent);
        cursor: pointer;
    }

    .krt-blogListDrawer__field input:focus,
    .krt-blogListDrawer__field select:focus {
        border-color: color-mix(in srgb, var(--krt-color-primary, #2563eb) 55%, transparent);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--krt-color-primary, #2563eb) 25%, transparent);
    }

    .krt-blogListDrawer__checks {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }

    .krt-blogListDrawer__checks label {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        font-size: 0.9rem;
        font-weight: 500;
        color: color-mix(in srgb, var(--krt-color-text, #111827) 75%, transparent);
    }

    .krt-blogListDrawer__grid {
        display: grid;
        gap: var(--krt-space-md, 0.75rem);
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    }
</style>
