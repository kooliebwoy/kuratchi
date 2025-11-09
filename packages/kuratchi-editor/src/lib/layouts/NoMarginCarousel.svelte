<script lang="ts">
    import { LayoutBlock, SearchImages } from '../shell/index.js';

    interface CarouselImage {
        key?: string;
        url?: string;
        src?: string;
        alt?: string;
        title?: string;
    }

    interface Props {
        id?: string;
        type?: string;
        images?: CarouselImage[];
        metadata?: Record<string, unknown>;
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        type = 'no-margin-carousel',
        images = $bindable<CarouselImage[]>([
            { src: 'https://fakeimg.pl/450x600/?text=World&font=lobster', alt: 'Hero Image' },
            { src: 'https://fakeimg.pl/450x600/?text=World&font=shrimp', alt: 'Hero Image' },
            { src: 'https://fakeimg.pl/450x600/?text=World&font=crab', alt: 'Hero Image' },
        ]),
        metadata = {},
        editable = true
    }: Props = $props();

    const normalizedImages = $derived(images.map((image) => ({
        url: image?.key ? `/api/bucket/${image.key}` : image?.url ?? image?.src ?? '',
        alt: image?.alt ?? '',
        title: image?.title ?? ''
    })));

    let content = $derived({
        id,
        type,
        images: normalizedImages,
        metadata,
    })
</script>

{#if editable}
<LayoutBlock {id} {type}>
    {#snippet drawerContent()}
        <div class="space-y-6">
            <fieldset class="fieldset">
                <legend class="fieldset-legend">Images</legend>
                <SearchImages bind:selectedImages={images} />
            </fieldset>
        </div>
    {/snippet}

    {#snippet metadata()}
        {JSON.stringify(content)}
    {/snippet}

    {#snippet children()}
        <div class="overflow-x-auto whitespace-nowrap" id={id}>
            {#each images as image}
                <img src='/api/bucket/{image.key}' alt={image?.alt} title={image?.title} class="inline-block slide">
            {/each}
        </div>
    {/snippet}
</LayoutBlock>
{:else}
    <section id={id} data-type={type} class="overflow-x-auto whitespace-nowrap">
        <div class="hidden" data-metadata>{JSON.stringify(content)}</div>
        {#each normalizedImages as image}
            {#if image.url}
                <img src={image.url} alt={image.alt} title={image.title} class="inline-block slide" />
            {/if}
        {/each}
    </section>
{/if}

<style>
.slide {
    width: 100%;
    height: auto;
    object-fit: cover;
}
</style>
