<script lang="ts">
    import CardNoImage from "./CardNoImage.svelte";
    import NoMarginCarousel from "./NoMarginCarousel.svelte";
    import { SearchImages, LayoutBlock } from "../shell/index.js";
    
    interface CarouselImage {
        key?: string;
        url?: string;
        src?: string;
        alt?: string;
    }

    interface Props {
        id?: string;
        heading?: string;
        body?: string;
        button?: { label: string; link: string };
        images?: CarouselImage[];
        type?: string;
        metadata?: {
            backgroundColor: string;
            cardBackgroundColor: string;
            reverseOrder: boolean;
            buttonColor: string;
            headingColor: string;
            contentColor: string;
        };
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        heading = 'Noteworthy technology acquisitions 2021',
        body = 'Here are the biggest enterprise technology acquisitions of 2021 so far, in reverse chronological order.',
        button = $bindable({ label: 'Read more', link: '#' }),
        images = $bindable<CarouselImage[]>([]),
        type = 'hero-with-slider',
        metadata = {
            backgroundColor: '#575757',
            cardBackgroundColor: '#212121',
            reverseOrder: false,
            buttonColor: '#212121',
            headingColor: 'text-content',
            contentColor: 'text-content'
        },
        editable = true
    }: Props = $props();


    // Reactive statements to update metadata properties
    let reverseOrder = $state(metadata.reverseOrder);
    let backgroundColor = $state(metadata.backgroundColor);
    let cardBackgroundColor = $state(metadata.cardBackgroundColor);
    let buttonColor = $state(metadata.buttonColor);
    let headingColor = $state(metadata.headingColor);
    let contentColor = $state(metadata.contentColor);

    // extract card body from the content and the card title
    const normalizedImages = $derived(images.map((image) => ({
        url: image?.key ? `/api/bucket/${image.key}` : image?.url ?? image?.src ?? '',
        alt: image?.alt ?? ''
    })));

    let content = $derived({
        id,
        type,
        heading,
        body,
        button,
        images: normalizedImages,
        metadata : {
            backgroundColor,
            cardBackgroundColor,
            reverseOrder,
            buttonColor,
            headingColor,
            contentColor
        }
    })
</script>

{#if editable}
<LayoutBlock {id} {type}>
    {#snippet drawerContent()}
        <div class="space-y-6">
            <fieldset class="fieldset">
                <legend class="fieldset-legend">Swap Card and Slider</legend>
                <label class="label cursor-pointer justify-start gap-4">
                    <input type="checkbox" class="checkbox checkbox-accent" bind:checked={reverseOrder} />
                    <span class="label-text">Reverse order</span>
                </label>
            </fieldset>

            <fieldset class="fieldset">
                <legend class="fieldset-legend">Component Background Color</legend>
                <input type="color" class="input input-bordered h-12" bind:value={backgroundColor} />
            </fieldset>

            <fieldset class="fieldset">
                <legend class="fieldset-legend">Card Background Color</legend>
                <input type="color" class="input input-bordered h-12" bind:value={cardBackgroundColor} />
            </fieldset>

            <fieldset class="fieldset">
                <legend class="fieldset-legend">Heading Color</legend>
                <input type="color" class="input input-bordered h-12" bind:value={headingColor} />
            </fieldset>

            <fieldset class="fieldset">
                <legend class="fieldset-legend">Content Color</legend>
                <input type="color" class="input input-bordered h-12" bind:value={contentColor} />
            </fieldset>

            <div class="divider"></div>

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
        <div class="flex justify-evenly gap-8 w-full flex-row flex-wrap xl:flex-nowrap container mx-auto" style:background-color={backgroundColor} data-type={type}>

            {#if reverseOrder}
                <div class="flex-grow">
                    <NoMarginCarousel bind:images={images} />
                </div>
                <div class="flex flex-col flex-1 min-w-[24rem]">
                    <CardNoImage bind:heading={heading} bind:body={body} link={button.link} bind:button={button.label} backgroundColor={cardBackgroundColor} buttonColor={buttonColor} {headingColor} {contentColor} />
                </div>
            {:else}
                <div class="flex flex-col flex-1 min-w-[24rem]">
                    <CardNoImage bind:heading={heading} bind:body={body} link={button.link} bind:button={button.label} backgroundColor={cardBackgroundColor} buttonColor={buttonColor} {headingColor} {contentColor} />
                </div>
                <div class="flex-grow">
                    <NoMarginCarousel bind:images={images} />
                </div>
            {/if}
        </div>
    {/snippet}
</LayoutBlock>
{:else}
    <section id={id} data-type={type} class="container mx-auto">
        <div class="hidden" data-metadata>{JSON.stringify(content)}</div>
        <div class="flex justify-evenly gap-8 w-full flex-row flex-wrap xl:flex-nowrap" style:background-color={backgroundColor}>
            {#if reverseOrder}
                <div class="flex-grow min-w-[20rem]">
                    <NoMarginCarousel images={normalizedImages} editable={false} />
                </div>
                <div class="flex flex-col flex-1 min-w-[24rem]">
                    <CardNoImage heading={heading} body={body} link={button.link} button={button.label} backgroundColor={cardBackgroundColor} buttonColor={buttonColor} {headingColor} {contentColor} editable={false} />
                </div>
            {:else}
                <div class="flex flex-col flex-1 min-w-[24rem]">
                    <CardNoImage heading={heading} body={body} link={button.link} button={button.label} backgroundColor={cardBackgroundColor} buttonColor={buttonColor} {headingColor} {contentColor} editable={false} />
                </div>
                <div class="flex-grow min-w-[20rem]">
                    <NoMarginCarousel images={normalizedImages} editable={false} />
                </div>
            {/if}
        </div>
    </section>
{/if}
