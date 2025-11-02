<script lang="ts">
    import { LayoutBlock, SearchImage } from '../shell/index.js';
        
    interface Props {
        id?: any;
        heading?: string;
        body?: any;
        image?: Object;
        type?: string;
        metadata?: any;
    }

    let {
        id = crypto.randomUUID(),
        heading = 'About Us',
        body = `Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.`,
        image = { src: 'https://fakeimg.pl/650x500/?text=World&font=lobster"', alt: 'Hero Image', title: 'Hero Image' },
        type = 'about-us-card',
        metadata = {
        backgroundColor: '#575757',
        textColor: '#ffffff',
        reverseOrder: false
    }
    }: Props = $props();

    // Reactive statements to update metadata properties
    let reverseOrder = $state(metadata.reverseOrder);
    let backgroundColor = $state(metadata.backgroundColor);
    let textColor = $state(metadata.textColor);

    // extract card body from the content and the card title
    let content = $derived({
        id,
        type,
        heading,
        body,
        image,
        metadata : {
            backgroundColor,
            reverseOrder,
            textColor
        }
    })
</script>

<LayoutBlock {id} {type}>
    {#snippet drawerContent()}
        <div class="space-y-6">
            <fieldset class="fieldset">
                <legend class="fieldset-legend">Layout Options</legend>
                <div class="form-control">
                    <label class="label cursor-pointer">
                        <span class="label-text">Reverse Order</span>
                        <input type="checkbox" class="checkbox checkbox-accent ml-4" bind:checked={reverseOrder} />
                    </label>
                </div>
            </fieldset>

            <fieldset class="fieldset">
                <legend class="fieldset-legend">Text Content</legend>
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
        <div class="flex justify-evenly gap-8 p-12 w-full flex-row flex-wrap xl:flex-nowrap" style:background-color={backgroundColor} data-type={type}>
            {#if reverseOrder}
                <div class="flex flex-wrap md:flex-nowrap px-0 md:px-12 mt-4 gap-6 justify-around w-full min-w-full">
                    <figure class="my-0 rounded-x">
                        <img src={image.src} alt={image.alt} title={image.title} class="rounded-3xl"  />
                    </figure>
                    <div class="space-y-8" style:color={textColor}>
                        <h1 class="text-4xl font-extrabold md:text-5xl mt-6" style:color={textColor}>{heading}</h1>
                        <p class="text-xs max-w-96">{body}</p>
                    </div>
                </div>
            {:else}
                <div class="flex flex-wrap md:flex-nowrap px-0 md:px-12 mt-4 gap-6 justify-around w-full min-w-full">
                    <div class="space-y-8" style:color={textColor}>
                        <h1 class="text-4xl font-extrabold md:text-5xl mt-6" style:color={textColor}>{heading}</h1>
                        <p class="text-xs max-w-96">{body}</p>
                    </div>
                
                    <figure class="my-0 rounded-x">
                        <img src={image.src} alt={image.alt} title={image.title} class="rounded-3xl"  />
                    </figure>
                </div>
            {/if}
        </div>
    {/snippet}
</LayoutBlock>
