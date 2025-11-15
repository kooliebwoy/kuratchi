<script lang="ts">
    import { LayoutBlock } from '../shell/index.js';
    import { ImagePicker } from '../plugins/index.js';

    interface CarouselImage {
        src?: string;
        key?: string;
        alt?: string;
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
        type = 'basic-carousel',
        images = $bindable<CarouselImage[]>([
            { src: 'https://fakeimg.pl/450x600/?text=World&font=lobster', alt: 'Hero Image' },
            { src: 'https://fakeimg.pl/450x600/?text=World&font=shrimp', alt: 'Hero Image' },
            { src: 'https://fakeimg.pl/450x600/?text=World&font=crab', alt: 'Hero Image' },
        ]),
        metadata = {},
        editable = true
    }: Props = $props();

    let content = $derived({
        id,
        type,
        images,
        metadata,
    })
</script>

{#if editable}
<LayoutBlock {id} {type}>
    {#snippet drawerContent()}
        <div class="space-y-6">
            <fieldset class="fieldset">
                <legend class="fieldset-legend">Images</legend>
                <ImagePicker bind:selectedImages={images} mode="multiple" />
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
                    <img
                        src={image?.key ? `/api/bucket/${image.key}` : image?.src ?? ''}
                        alt={image?.alt ?? ''}
                        class="inline-block slide"
                        width="100%"
                        height="360"
                    />
                {/each}
            </div>
        </div>
    {/snippet}
</LayoutBlock>
{:else}
    <section id={id} data-type={type} class="container mx-auto rounded-3xl">
        <div class="hidden" data-metadata>{JSON.stringify(content)}</div>
        <div class="overflow-x-auto whitespace-nowrap">
            {#each images as image}
                <img
                    src={image?.key ? `/api/bucket/${image.key}` : image?.src ?? ''}
                    alt={image?.alt ?? ''}
                    class="inline-block slide"
                    width="100%"
                    height="360"
                />
            {/each}
        </div>
    </section>
{/if}

<style>
.slide {
    width: 100%;
    height: auto;
    object-fit: cover;
}
</style>
