<script lang="ts">
    import { SearchImages, LayoutBlock } from '$lib/shell';

    interface Props {
        id?: any;
        type?: string;
        images?: Object[];
        metadata?: any;
    }

    let {
        id = crypto.randomUUID(),
        type = 'basic-carousel',
        images = $bindable([
            { src: 'https://fakeimg.pl/450x600/?text=World&font=lobster', alt: 'Hero Image' },
            { src: 'https://fakeimg.pl/450x600/?text=World&font=shrimp', alt: 'Hero Image' },
            { src: 'https://fakeimg.pl/450x600/?text=World&font=crab', alt: 'Hero Image' },
        ]),
        metadata = {}
    }: Props = $props();

    let content = $derived({
        id,
        type,
        images,
        metadata,
    })
</script>

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
        <div class="container mx-auto rounded-3xl">
            <div class="overflow-x-auto whitespace-nowrap">
                {#each images as image}
                    <img src='/api/bucket/{image.key}' alt={image?.alt} class="inline-block slide" width="100%" height="360" />
                {/each}
            </div>
        </div>
    {/snippet}
</LayoutBlock>

<style>
.slide {
    width: 100%;
    height: auto;
    object-fit: cover;
}
</style>
