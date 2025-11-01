<script lang="ts">
    import { ArrowRight, Plus } from "@lucide/svelte";
    import { LayoutBlock } from '$lib/shell';

    interface Props {
        id?: string;
        type?: string;
        heading?: string;
        body?: string;
        buttonText?: string;
        buttonLink?: string;
        products?: Array<{
            name: string;
            price: string;
            image: string;
        }>;
        backgroundColor?: string;
        textColor?: string;
        buttonColor?: string;
    }

    let {
        id = crypto.randomUUID(),
        type = 'product-carousel',
        heading = 'Latest Arrivals',
        body = 'Deliver great service experiences fast - without the complexity of traditional ITSM solutions.',
        buttonText = 'All Products',
        buttonLink = '#',
        products = [
            { name: 'Product A', price: '$149', image: 'https://fakeimg.pl/250x250/?text=CMS&font=lobster' },
            { name: 'Product B', price: '$199', image: 'https://fakeimg.pl/250x250/?text=CMS&font=lobster' },
            { name: 'Product C', price: '$299', image: 'https://fakeimg.pl/250x250/?text=CMS&font=lobster' },
            { name: 'Product D', price: '$399', image: 'https://fakeimg.pl/250x250/?text=CMS&font=lobster' }
        ],
        backgroundColor = '#f3f4f6',
        textColor = '#1f2937',
        buttonColor = '#3b82f6'
    }: Props = $props();

    let content = $derived({
        id,
        type,
        heading,
        body,
        buttonText,
        buttonLink,
        products,
        backgroundColor,
        textColor,
        buttonColor
    })
</script>

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
                <legend class="fieldset-legend">Products</legend>
                {#each products as product, index}
                    <div class="border-b pb-4 mb-4">
                        <h4 class="font-medium mb-2">Product {index + 1}</h4>
                        <label class="form-control w-full">
                            <div class="label">
                                <span class="label-text">Name</span>
                            </div>
                            <input type="text" class="input input-bordered w-full" bind:value={product.name} />
                        </label>
                        <label class="form-control w-full">
                            <div class="label">
                                <span class="label-text">Price</span>
                            </div>
                            <input type="text" class="input input-bordered w-full" bind:value={product.price} />
                        </label>
                        <label class="form-control w-full">
                            <div class="label">
                                <span class="label-text">Image URL</span>
                            </div>
                            <input type="url" class="input input-bordered w-full" bind:value={product.image} />
                        </label>
                    </div>
                {/each}
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
        <div class="card border-none shadow-none w-full max-w-full rounded-3xl px-4" style:background-color={backgroundColor}>
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

            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 p-2 md:p-8 mt-2">
                {#each products as product}
                    <div class="flex flex-col space-y-2">
                        <img src={product.image} alt={product.name} class="rounded-3xl" />
                        <div class="flex justify-between px-2">
                            <div class="flex flex-col">
                                <h6 class="text-lg font-bold" style:color={textColor}>{product.name}</h6>
                                <p class="text-gray-500 dark:text-gray-400">{product.price}</p>
                            </div>
                            <div>
                                <button class="btn btn-xs mt-3 px-1" style:background-color={buttonColor}>
                                    <Plus class="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    {/snippet}
</LayoutBlock>
