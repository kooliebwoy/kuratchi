<script lang="ts">
    import { ArrowRight } from "@lucide/svelte";
    import { LayoutBlock } from '../shell/index.js';
    import { blogStore } from '../stores/blog';

    interface Props {
        id?: string;
        type?: string;
        heading?: string;
        body?: string;
        buttonText?: string;
        buttonLink?: string;
        backgroundColor?: string;
        textColor?: string;
        buttonColor?: string;
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        type = 'featured-blogs',
        heading = 'Our Blog',
        body = 'Lorem Ipsum Thingy. Lorem Ipsum Thingy.Lorem Ipsum Thingy. Lorem Ipsum.Lorem Ipsum Thingy. Lorem Ipsum',
        buttonText = 'Read More',
        buttonLink = '#',
        backgroundColor = '#1f2937',
        textColor = '#ffffff',
        buttonColor = '#3b82f6',
        editable = true
    }: Props = $props();

    const blog = blogStore;

    let content = $derived({
        id,
        type,
        heading,
        body,
        buttonText,
        buttonLink,
        backgroundColor,
        textColor,
        buttonColor
    })
</script>

{#if editable}
<LayoutBlock {id} {type}>
    {#snippet drawerContent()}
        <div class="space-y-6">
            <fieldset class="fieldset">
                <legend class="fieldset-legend">Content</legend>
                <label class="form-control w-full">
                    <div class="label">
                        <span class="label-text">Heading</span>
                    </div>
                    <input type="text" class="input input-bordered w-full" bind:value={heading} />
                </label>
                <label class="form-control w-full">
                    <div class="label">
                        <span class="label-text">Body Text</span>
                    </div>
                    <textarea class="textarea textarea-bordered w-full" rows="3" bind:value={body}></textarea>
                </label>
                <label class="form-control w-full">
                    <div class="label">
                        <span class="label-text">Button Text</span>
                    </div>
                    <input type="text" class="input input-bordered w-full" bind:value={buttonText} />
                </label>
                <label class="form-control w-full">
                    <div class="label">
                        <span class="label-text">Button Link</span>
                    </div>
                    <input type="url" class="input input-bordered w-full" bind:value={buttonLink} />
                </label>
            </fieldset>

            <fieldset class="fieldset">
                <legend class="fieldset-legend">Colors</legend>
                <div class="form-control">
                    <label class="label cursor-pointer">
                        <span class="label-text">Background Color</span>
                        <input type="color" class="input-color ml-4" bind:value={backgroundColor} />
                    </label>
                </div>
                <div class="form-control">
                    <label class="label cursor-pointer">
                        <span class="label-text">Text Color</span>
                        <input type="color" class="input-color ml-4" bind:value={textColor} />
                    </label>
                </div>
                <div class="form-control">
                    <label class="label cursor-pointer">
                        <span class="label-text">Button Color</span>
                        <input type="color" class="input-color ml-4" bind:value={buttonColor} />
                    </label>
                </div>
            </fieldset>
        </div>
    {/snippet}

    {#snippet metadata()}
        {JSON.stringify(content)}
    {/snippet}

    {#snippet children()}
        <div style:background-color={backgroundColor} class="p-8">
            <div class="flex flex-wrap lg:flex-nowrap gap-4 my-12 items-center px-0 md:px-12">
                <div>
                    <h1 class="uppercase text-4xl font-extrabold md:text-5xl !w-auto" style:color={textColor}>{heading}</h1>
                </div>
                <div class="grow ml-0 pr-2 md:ml-16">
                    <p class="text-wrap text-xs max-w-64" style:color={textColor}>{body}</p>
                </div>
                <div class="!mt-0">
                    <a href={buttonLink} class="btn" style:background-color={buttonColor} style:color={textColor}>
                        {buttonText}
                        <ArrowRight />
                    </a>
                </div>
            </div>

            <div class="space-y-14 pb-20 px-0 md:px-12">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {#if $blog?.posts?.length}
                        {#each $blog.posts.slice(0, 4) as post (post.id)}
                            <article class="bg-base-100 rounded-2xl border border-base-300 shadow-sm overflow-hidden flex flex-col">
                                {#if post.coverImage?.url}
                                    <div class="h-48 w-full overflow-hidden">
                                        <img src={post.coverImage.url} alt={post.coverImage.alt ?? post.title} class="w-full h-full object-cover" />
                                    </div>
                                {/if}
                                <div class="p-5 flex flex-col gap-2 flex-1">
                                    <div class="flex flex-wrap gap-1 text-xs uppercase tracking-wide text-base-content/60">
                                        {#if post.categories.length > 0}
                                            {#each post.categories as categorySlug}
                                                {@const category = ($blog?.categories ?? []).find((entry) => entry.slug === categorySlug)}
                                                <span class="badge badge-ghost">{category?.name ?? categorySlug}</span>
                                            {/each}
                                        {:else}
                                            <span class="badge badge-ghost">Blog</span>
                                        {/if}
                                    </div>
                                    <h4 class="text-lg font-semibold">{post.title}</h4>
                                    <p class="text-sm text-base-content/70 line-clamp-3">{post.excerpt}</p>
                                    <div class="mt-auto flex items-center justify-between pt-2">
                                        <span class="text-xs text-base-content/50">{post.publishedOn}</span>
                                        <a class="btn btn-link btn-sm text-primary" href={`/blog/${post.slug}`}>
                                            Read article
                                            <ArrowRight class="w-4 h-4" />
                                        </a>
                                    </div>
                                </div>
                            </article>
                        {/each}
                    {:else}
                        <p class="text-base-content/60 text-sm">No posts yet. Add a blog post to populate this section.</p>
                    {/if}
                </div>
            </div>
        </div>
    {/snippet}
</LayoutBlock>
{:else}
    <section id={id} data-type={type} class="p-8" style:background-color={backgroundColor}>
        <div class="hidden" data-metadata>{JSON.stringify(content)}</div>
        <div class="flex flex-wrap lg:flex-nowrap gap-4 my-12 items-center px-0 md:px-12">
            <div>
                <h1 class="uppercase text-4xl font-extrabold md:text-5xl !w-auto" style:color={textColor}>
                    {@html heading}
                </h1>
            </div>
            <div class="grow ml-0 pr-2 md:ml-16">
                <div class="text-wrap text-xs max-w-64" style:color={textColor}>
                    {@html body}
                </div>
            </div>
            <div class="!mt-0">
                {#if buttonText}
                    <a href={buttonLink} class="btn" style:background-color={buttonColor} style:color={textColor}>
                        {buttonText}
                        <ArrowRight />
                    </a>
                {/if}
            </div>
        </div>

        <div class="space-y-14 pb-20 px-0 md:px-12">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                {#if $blog?.posts?.length}
                    {#each $blog.posts.slice(0, 4) as post (post.id)}
                        <article class="bg-base-100 rounded-2xl border border-base-300 shadow-sm overflow-hidden flex flex-col">
                            {#if post.coverImage?.url}
                                <div class="h-48 w-full overflow-hidden">
                                    <img src={post.coverImage.url} alt={post.coverImage.alt ?? post.title} class="w-full h-full object-cover" />
                                </div>
                            {/if}
                            <div class="p-5 flex flex-col gap-2 flex-1">
                                <div class="flex flex-wrap gap-1 text-xs uppercase tracking-wide text-base-content/60">
                                    {#if post.categories.length > 0}
                                        {#each post.categories as categorySlug}
                                            {@const category = ($blog?.categories ?? []).find((entry) => entry.slug === categorySlug)}
                                            <span class="badge badge-ghost">{category?.name ?? categorySlug}</span>
                                        {/each}
                                    {:else}
                                        <span class="badge badge-ghost">Blog</span>
                                    {/if}
                                </div>
                                <h4 class="text-lg font-semibold">{post.title}</h4>
                                <p class="text-sm text-base-content/70 line-clamp-3">{post.excerpt}</p>
                                <div class="mt-auto flex items-center justify-between pt-2">
                                    <span class="text-xs text-base-content/50">{post.publishedOn}</span>
                                    <a class="btn btn-link btn-sm text-primary" href={`/blog/${post.slug}`}>
                                        Read article
                                        <ArrowRight class="w-4 h-4" />
                                    </a>
                                </div>
                            </div>
                        </article>
                    {/each}
                {:else}
                    <p class="text-base-content/60 text-sm">No posts yet. Add a blog post to populate this section.</p>
                {/if}
            </div>
        </div>
    </section>
{/if}
