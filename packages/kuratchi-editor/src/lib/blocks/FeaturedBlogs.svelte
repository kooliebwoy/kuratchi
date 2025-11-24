<script lang="ts">
    import { ArrowRight } from '@lucide/svelte';
    import { onMount } from 'svelte';
    import { blogStore } from '../stores/blog';
    import { BlockActions } from '../utils/index.js';

    interface LayoutMetadata {
        backgroundColor: string;
        headingColor: string;
        textColor: string;
        buttonColor: string;
        cardBackground: string;
    }

    interface Props {
        id?: string;
        type?: string;
        heading?: string;
        body?: string;
        buttonText?: string;
        buttonLink?: string;
        metadata?: LayoutMetadata;
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        type = 'featured-blogs',
        heading = $bindable('Our blog'),
        body = $bindable(
            'Stories about how teams scale their brands, grow audiences, and build trust through thoughtful publishing.'
        ),
        buttonText = $bindable('Read more'),
        buttonLink = $bindable('#'),
        metadata: layoutMetadata = $bindable<LayoutMetadata>({
            backgroundColor: '#0f172a',
            headingColor: '#f8fafc',
            textColor: '#e2e8f0',
            buttonColor: '#22d3ee',
            cardBackground: '#0b1220'
        }) as LayoutMetadata,
        editable = true
    }: Props = $props();

    const blog = blogStore;

    const posts = $derived(($blog?.posts ?? []).slice(0, 4));

    const previewPosts = $derived(
        posts.map((post) => ({
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
        }))
    );

    const layoutStyle = $derived(
        `--krt-featuredBlogs-bg: ${layoutMetadata.backgroundColor}; --krt-featuredBlogs-heading: ${layoutMetadata.headingColor}; --krt-featuredBlogs-text: ${layoutMetadata.textColor}; --krt-featuredBlogs-button: ${layoutMetadata.buttonColor}; --krt-featuredBlogs-card: ${layoutMetadata.cardBackground};`
    );

    const content = $derived({
        id,
        type,
        heading,
        body,
        buttonText,
        buttonLink,
        metadata: { ...layoutMetadata },
        previewPosts
    });

    let component: HTMLElement;
    let mounted = $state(false);

    onMount(() => {
        mounted = true;
    });
</script>

{#if editable}
    <div class="editor-item group relative" bind:this={component}>
        {#if mounted}
            <BlockActions {id} {type} element={component} />
        {/if}
        <section class="krt-featuredBlogs" style={layoutStyle} {id} data-type={type}>
            <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
            <div class="krt-featuredBlogs__hero">
                <div class="krt-featuredBlogs__headingGroup">
                    <p class="krt-featuredBlogs__eyebrow">Featured stories</p>
                    <h2 class="krt-featuredBlogs__heading" contenteditable bind:innerHTML={heading}></h2>
                    <p class="krt-featuredBlogs__body" contenteditable bind:innerHTML={body}></p>
                </div>
                <a
                    class="krt-featuredBlogs__cta"
                    href={buttonLink ?? '#'}
                    onclick={(event) => event.preventDefault()}
                    aria-label={buttonText ? `Edit ${buttonText} label` : 'Edit featured blog button label'}
                >
                    <span contenteditable bind:innerHTML={buttonText}></span>
                    <ArrowRight aria-hidden="true" />
                </a>
            </div>

            <div class="krt-featuredBlogs__grid">
                {#if posts.length}
                    {#each posts as post (post.id)}
                        <article class="krt-featuredBlogs__card">
                            <div class="krt-featuredBlogs__cardMedia">
                                {#if post.coverImage?.url}
                                    <img src={post.coverImage.url} alt={post.coverImage.alt ?? post.title} loading="lazy" />
                                {:else}
                                    <div class="krt-featuredBlogs__placeholder" aria-hidden="true">Add cover image</div>
                                {/if}
                            </div>
                            <div class="krt-featuredBlogs__cardCopy">
                                <div class="krt-featuredBlogs__tags">
                                    {#if post.categories?.length}
                                        {#each post.categories as categorySlug}
                                            {@const category = ($blog?.categories ?? []).find((entry) => entry.slug === categorySlug)}
                                            <span class="krt-featuredBlogs__tag">{category?.name ?? categorySlug}</span>
                                        {/each}
                                    {:else}
                                        <span class="krt-featuredBlogs__tag">Blog</span>
                                    {/if}
                                </div>
                                <h3 class="krt-featuredBlogs__cardTitle">{post.title}</h3>
                                <p class="krt-featuredBlogs__excerpt">{post.excerpt}</p>
                                <div class="krt-featuredBlogs__cardMeta">
                                    <span>{post.publishedOn}</span>
                                    <a class="krt-featuredBlogs__readMore" href={`/blog/${post.slug}`} onclick={(event) => event.preventDefault()}>
                                        Read article
                                        <ArrowRight aria-hidden="true" />
                                    </a>
                                </div>
                            </div>
                        </article>
                    {/each}
                {:else}
                    <p class="krt-featuredBlogs__empty">No posts yet. Add a blog post to populate this section.</p>
                {/if}
            </div>
        </section>
    </div>

    <BlockActions
        {id}
        {type}
        element={component}
        inspectorTitle="Featured blogs settings"
    >
        {#snippet inspector()}
            <div class="krt-featuredBlogsDrawer">
                <section class="krt-featuredBlogsDrawer__section">
                    <h3>Content</h3>
                    <div class="krt-featuredBlogsDrawer__fields">
                        <label class="krt-featuredBlogsDrawer__field">
                            <span>Heading</span>
                            <input type="text" placeholder="Our blog" bind:value={heading} />
                        </label>
                        <label class="krt-featuredBlogsDrawer__field">
                            <span>Body</span>
                            <textarea rows="3" placeholder="Tell readers what the blog covers" bind:value={body}></textarea>
                        </label>
                        <label class="krt-featuredBlogsDrawer__field">
                            <span>Button text</span>
                            <input type="text" placeholder="Read more" bind:value={buttonText} />
                        </label>
                        <label class="krt-featuredBlogsDrawer__field">
                            <span>Button link</span>
                            <input type="url" placeholder="https://" bind:value={buttonLink} />
                        </label>
                    </div>
                </section>

                <section class="krt-featuredBlogsDrawer__section">
                    <h3>Colors</h3>
                    <div class="krt-featuredBlogsDrawer__grid">
                        <label class="krt-featuredBlogsDrawer__field">
                            <span>Background</span>
                            <input type="color" bind:value={layoutMetadata.backgroundColor} />
                        </label>
                        <label class="krt-featuredBlogsDrawer__field">
                            <span>Heading</span>
                            <input type="color" bind:value={layoutMetadata.headingColor} />
                        </label>
                        <label class="krt-featuredBlogsDrawer__field">
                            <span>Body text</span>
                            <input type="color" bind:value={layoutMetadata.textColor} />
                        </label>
                        <label class="krt-featuredBlogsDrawer__field">
                            <span>Button</span>
                            <input type="color" bind:value={layoutMetadata.buttonColor} />
                        </label>
                        <label class="krt-featuredBlogsDrawer__field">
                            <span>Card background</span>
                            <input type="color" bind:value={layoutMetadata.cardBackground} />
                        </label>
                    </div>
                </section>
            </div>
        {/snippet}
    </BlockActions>
{:else}
    <section id={id} data-type={type} class="krt-featuredBlogs" style={layoutStyle}>
        <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
        <div class="krt-featuredBlogs__hero">
            <div class="krt-featuredBlogs__headingGroup">
                <p class="krt-featuredBlogs__eyebrow">Featured stories</p>
                {#if heading}
                    <h2 class="krt-featuredBlogs__heading">{@html heading}</h2>
                {/if}
                {#if body}
                    <div class="krt-featuredBlogs__body">{@html body}</div>
                {/if}
            </div>
            {#if buttonText}
                <a class="krt-featuredBlogs__cta" href={buttonLink ?? '#'} aria-label={buttonText}>
                    <span>{buttonText}</span>
                    <ArrowRight aria-hidden="true" />
                </a>
            {/if}
        </div>

        <div class="krt-featuredBlogs__grid">
            {#if posts.length}
                {#each posts as post (post.id)}
                    <article class="krt-featuredBlogs__card">
                        <div class="krt-featuredBlogs__cardMedia">
                            {#if post.coverImage?.url}
                                <img src={post.coverImage.url} alt={post.coverImage.alt ?? post.title} loading="lazy" />
                            {/if}
                        </div>
                        <div class="krt-featuredBlogs__cardCopy">
                            <div class="krt-featuredBlogs__tags">
                                {#if post.categories?.length}
                                    {#each post.categories as categorySlug}
                                        {@const category = ($blog?.categories ?? []).find((entry) => entry.slug === categorySlug)}
                                        <span class="krt-featuredBlogs__tag">{category?.name ?? categorySlug}</span>
                                    {/each}
                                {:else}
                                    <span class="krt-featuredBlogs__tag">Blog</span>
                                {/if}
                            </div>
                            <h3 class="krt-featuredBlogs__cardTitle">{post.title}</h3>
                            <p class="krt-featuredBlogs__excerpt">{post.excerpt}</p>
                            <div class="krt-featuredBlogs__cardMeta">
                                <span>{post.publishedOn}</span>
                                <a class="krt-featuredBlogs__readMore" href={`/blog/${post.slug}`}>
                                    Read article
                                    <ArrowRight aria-hidden="true" />
                                </a>
                            </div>
                        </div>
                    </article>
                {/each}
            {:else}
                <p class="krt-featuredBlogs__empty">No posts yet. Add a blog post to populate this section.</p>
            {/if}
        </div>
    </section>
{/if}

<style>
    .krt-featuredBlogs {
        position: relative;
        isolation: isolate;
        display: flex;
        flex-direction: column;
        gap: clamp(2rem, 5vw, 4rem);
        padding: clamp(2.5rem, 5vw, 4rem);
        background: var(--krt-featuredBlogs-bg, #0f172a);
        color: var(--krt-featuredBlogs-text, #e2e8f0);
    }

    .krt-featuredBlogs__metadata {
        display: none;
    }

    .krt-featuredBlogs__hero {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    @media (min-width: 960px) {
        .krt-featuredBlogs__hero {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            gap: 2rem;
        }
    }

    .krt-featuredBlogs__headingGroup {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        max-width: 48ch;
    }

    .krt-featuredBlogs__eyebrow {
        margin: 0;
        font-size: 0.85rem;
        letter-spacing: 0.3em;
        text-transform: uppercase;
        color: color-mix(in srgb, var(--krt-featuredBlogs-text, #e2e8f0) 75%, transparent);
    }

    .krt-featuredBlogs__heading {
        margin: 0;
        font-size: clamp(2.25rem, 4vw, 3.75rem);
        font-weight: 750;
        line-height: 1.05;
        color: var(--krt-featuredBlogs-heading, #f8fafc);
        outline: none;
    }

    .krt-featuredBlogs__body {
        margin: 0;
        font-size: clamp(1rem, 0.5vw + 0.95rem, 1.125rem);
        line-height: 1.7;
        color: var(--krt-featuredBlogs-text, #e2e8f0);
        opacity: 0.9;
        outline: none;
    }

    .krt-featuredBlogs__cta {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.6rem;
        padding: 0.75rem 1.8rem;
        border-radius: var(--krt-radius-pill, 999px);
        background: var(--krt-featuredBlogs-button, #22d3ee);
        color: var(--krt-featuredBlogs-bg, #0f172a);
        font-weight: 600;
        text-decoration: none;
        transition: transform 150ms ease, box-shadow 150ms ease;
    }

    .krt-featuredBlogs__cta:hover {
        transform: translateY(-2px);
        box-shadow: 0 18px 32px rgba(6, 182, 212, 0.4);
    }

    .krt-featuredBlogs__cta span {
        outline: none;
    }

    .krt-featuredBlogs__grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: clamp(1.5rem, 3vw, 2.5rem);
    }

    .krt-featuredBlogs__card {
        display: flex;
        flex-direction: column;
        background: color-mix(in srgb, var(--krt-featuredBlogs-card, #0b1220) 90%, transparent);
        border-radius: var(--krt-radius-2xl, 1.5rem);
        overflow: hidden;
        border: 1px solid color-mix(in srgb, var(--krt-featuredBlogs-heading, #f8fafc) 12%, transparent);
        min-height: 100%;
    }

    .krt-featuredBlogs__cardMedia {
        width: 100%;
        aspect-ratio: 16 / 9;
        background: color-mix(in srgb, var(--krt-featuredBlogs-bg, #0f172a) 45%, transparent);
        overflow: hidden;
    }

    .krt-featuredBlogs__cardMedia img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    .krt-featuredBlogs__placeholder {
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
        font-size: 0.9rem;
        color: color-mix(in srgb, var(--krt-featuredBlogs-text, #e2e8f0) 65%, transparent);
    }

    .krt-featuredBlogs__cardCopy {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
        padding: clamp(1.25rem, 1rem + 1vw, 1.75rem);
    }

    .krt-featuredBlogs__tags {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
    }

    .krt-featuredBlogs__tag {
        padding: 0.15rem 0.65rem;
        border-radius: var(--krt-radius-pill, 999px);
        font-size: 0.65rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        background: color-mix(in srgb, var(--krt-featuredBlogs-heading, #f8fafc) 8%, transparent);
        color: color-mix(in srgb, var(--krt-featuredBlogs-text, #e2e8f0) 80%, transparent);
    }

    .krt-featuredBlogs__cardTitle {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 650;
        letter-spacing: -0.015em;
        color: var(--krt-featuredBlogs-heading, #f8fafc);
    }

    .krt-featuredBlogs__excerpt {
        margin: 0;
        font-size: 0.95rem;
        line-height: 1.6;
        color: color-mix(in srgb, var(--krt-featuredBlogs-text, #e2e8f0) 80%, transparent);
        display: -webkit-box;
        line-clamp: 3;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .krt-featuredBlogs__cardMeta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        font-size: 0.85rem;
        color: color-mix(in srgb, var(--krt-featuredBlogs-text, #e2e8f0) 70%, transparent);
    }

    .krt-featuredBlogs__readMore {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-weight: 600;
        text-decoration: none;
        color: var(--krt-featuredBlogs-button, #22d3ee);
    }

    .krt-featuredBlogs__readMore svg {
        width: 1rem;
        height: 1rem;
    }

    .krt-featuredBlogs__empty {
        margin: 0;
        padding: 1.25rem;
        border-radius: var(--krt-radius-lg, 0.9rem);
        border: 1px dashed color-mix(in srgb, var(--krt-featuredBlogs-heading, #f8fafc) 18%, transparent);
        text-align: center;
        color: color-mix(in srgb, var(--krt-featuredBlogs-text, #e2e8f0) 75%, transparent);
    }

    .krt-featuredBlogsDrawer {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-xl, 1.25rem);
    }

    .krt-featuredBlogsDrawer__section {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-md, 0.75rem);
        padding: var(--krt-space-lg, 1rem);
        border-radius: var(--krt-radius-lg, 0.9rem);
        border: 1px solid color-mix(in srgb, var(--krt-color-border, #d1d5db) 78%, transparent);
        background: color-mix(in srgb, var(--krt-color-surface, #ffffff) 95%, transparent);
    }

    .krt-featuredBlogsDrawer__section h3 {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
        letter-spacing: 0.02em;
    }

    .krt-featuredBlogsDrawer__fields {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-md, 0.75rem);
    }

    .krt-featuredBlogsDrawer__grid {
        display: grid;
        gap: var(--krt-space-md, 0.75rem);
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    }

    .krt-featuredBlogsDrawer__field {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
        font-size: 0.9rem;
        font-weight: 500;
        color: color-mix(in srgb, var(--krt-color-text, #111827) 78%, transparent);
    }

    .krt-featuredBlogsDrawer__field input[type='text'],
    .krt-featuredBlogsDrawer__field input[type='url'],
    .krt-featuredBlogsDrawer__field textarea {
        appearance: none;
        width: 100%;
        font: inherit;
        padding: 0.6rem 0.75rem;
        border-radius: var(--krt-radius-md, 0.75rem);
        border: 1px solid color-mix(in srgb, var(--krt-color-border, #d1d5db) 82%, transparent);
        background: color-mix(in srgb, var(--krt-color-surface, #ffffff) 98%, transparent);
        outline: none;
        transition: border-color 120ms ease, box-shadow 120ms ease;
        resize: vertical;
    }

    .krt-featuredBlogsDrawer__field input[type='color'] {
        min-height: 2.5rem;
        padding: 0.2rem;
        border-radius: var(--krt-radius-md, 0.75rem);
        border: 1px solid color-mix(in srgb, var(--krt-color-border, #d1d5db) 82%, transparent);
        background: color-mix(in srgb, var(--krt-color-surface, #ffffff) 98%, transparent);
        cursor: pointer;
    }

    .krt-featuredBlogsDrawer__field input[type='text']:focus,
    .krt-featuredBlogsDrawer__field input[type='url']:focus,
    .krt-featuredBlogsDrawer__field textarea:focus,
    .krt-featuredBlogsDrawer__field input[type='color']:focus {
        border-color: color-mix(in srgb, var(--krt-color-primary, #2563eb) 55%, transparent);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--krt-color-primary, #2563eb) 25%, transparent);
    }
</style>
