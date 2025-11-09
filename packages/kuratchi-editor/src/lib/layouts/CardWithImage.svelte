<script lang="ts">
    import { ArrowRight } from '@lucide/svelte';
    import { LayoutBlock, SearchImage } from '../shell/index.js';

    interface CardImage {
        url: string;
        alt: string;
        title?: string;
        key?: string;
        src?: string;
    }

    interface Props {
        id?: string;
        type?: string;
        image?: CardImage;
        heading?: string;
        body?: string;
        button?: string;
        link?: string;
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        type = 'card-with-image',
        image = $bindable<CardImage>({ url: 'https://fakeimg.pl/500x500', alt: 'Noteworthy technology acquisitions 2021', title: 'Card Image' }),
        heading = 'Noteworthy technology acquisitions 2021',
        body = 'Here are the biggest enterprise technology acquisitions of 2021 so far, in reverse chronological order.',
        button = 'Read more',
        link = '#',
        editable = true
    }: Props = $props();

    const imageUrl = $derived(image?.key ? `/api/bucket/${image.key}` : image?.url ?? image?.src ?? '');

    let content = $derived({
        id,
        type,
        image,
        heading,
        body,
        button,
        link
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
                    <textarea class="textarea textarea-bordered w-full" rows="4" bind:value={body}></textarea>
                </label>
                <label class="form-control w-full">
                    <div class="label">
                        <span class="label-text">Button Text</span>
                    </div>
                    <input type="text" class="input input-bordered w-full" bind:value={button} />
                </label>
                <label class="form-control w-full">
                    <div class="label">
                        <span class="label-text">Link URL</span>
                    </div>
                    <input type="url" class="input input-bordered w-full" bind:value={link} />
                </label>
            </fieldset>

            <fieldset class="fieldset">
                <legend class="fieldset-legend">Image</legend>
                <SearchImage bind:selectedImage={image} />
            </fieldset>
        </div>
    {/snippet}

    {#snippet metadata()}
        {JSON.stringify(content)}
    {/snippet}

    {#snippet children()}
        <div class="card lg:card-side">
            <figure>
                <img src={imageUrl} alt={image.alt} title={image.title} />
            </figure>
            <div class="card-body gap-8">
                <h2 class="card-title">{heading}</h2>
                <p>{body}</p>
                
                <div class="card-actions justify-start">
                    <a href={link} class="btn btn-primary rounded-xl">
                        {button}
                        <ArrowRight class="w-3.5 h-3.5 ms-2 text-neutral" />
                    </a>
                </div>
            </div>
        </div>
    {/snippet}
</LayoutBlock>
{:else}
    <section id={id} data-type={type} class="card lg:card-side">
        <div class="hidden" data-metadata>{JSON.stringify(content)}</div>
        <figure>
            <img src={imageUrl} alt={image?.alt ?? ''} title={image?.title ?? ''} />
        </figure>
        <div class="card-body gap-8">
            <h2 class="card-title">{heading}</h2>
            <p>{body}</p>
            <div class="card-actions justify-start">
                <a href={link} class="btn btn-primary rounded-xl">
                    {button}
                    <ArrowRight class="w-3.5 h-3.5 ms-2 text-neutral" />
                </a>
            </div>
        </div>
    </section>
{/if}
