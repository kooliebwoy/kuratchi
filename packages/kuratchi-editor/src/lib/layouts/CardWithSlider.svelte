<script lang="ts">
    import CardNoImage from "./CardNoImage.svelte";
    import NoMarginCarousel from "./NoMarginCarousel.svelte";
    import { SearchImages, LayoutBlock } from "../shell/index.js";
    
    interface Props {
        id?: any;
        heading?: string;
        body?: string;
        button?: any;
        images?: Object[];
        type?: string;
        metadata?: any;
    }

    let {
        id = crypto.randomUUID(),
        heading = 'Noteworthy technology acquisitions 2021',
        body = 'Here are the biggest enterprise technology acquisitions of 2021 so far, in reverse chronological order.',
        button = { label: 'Read more', link: '#' },
        images = [],
        type = 'hero-with-slider',
        metadata = {
            backgroundColor: '#575757',
            cardBackgroundColor: '#212121',
            reverseOrder: false,
            buttonColor: '#212121',
            headingColor: 'text-content',
            contentColor: 'text-content'
        }
    }: Props = $props();


    // Reactive statements to update metadata properties
    let reverseOrder = $state(metadata.reverseOrder);
    let backgroundColor = $state(metadata.backgroundColor);
    let cardBackgroundColor = $state(metadata.cardBackgroundColor);
    let buttonColor = $state(metadata.buttonColor);
    let headingColor = $state(metadata.headingColor);
    let contentColor = $state(metadata.contentColor);

    // extract card body from the content and the card title
    let content = $derived({
        id,
        type,
        heading,
        body,
        button,
        images,
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
