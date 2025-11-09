<script lang="ts">
    import { SearchImage, LayoutBlock } from "../shell/index.js";
    import { ArrowRight } from "@lucide/svelte";

    interface Props {
        id?: string;
        type?: string;
        heading?: string;
        body?: string;
        button?: any;
        metadata?: any;
        image?: any;
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        type = 'hero-figure',
        heading = 'Hero Heading',
        body = 'Provident cupiditate voluptatem et in. Quaerat fugiat ut assumenda excepturi exercitationem quasi. In deleniti eaque aut repudiandae et a id nisi.',
        button = { link: '#', label: 'Read more' },
        metadata = {
            reverseOrder: false,
            buttonColor: 'bg-base-200',
            headingColor: 'text-content',
            textColor: 'text-content',
            backgroundColor: '#ffffff'
        },
        image = {
            url: 'https://fakeimg.pl/489x600/?text=World&font=lobster',
            alt: 'Clutch CMS'
        },
        editable = true
    }: Props = $props();

    // Reactive statements to update metadata properties
    let reverseOrder = $state(metadata.reverseOrder);
    let backgroundColor = $state(metadata.backgroundColor);
    let buttonColor = $state(metadata.buttonColor);
    let headingColor = $state(metadata.headingColor);
    let textColor = $state(metadata.textColor);

    let content = $derived({
        id,
        type: type,
        image,
        button,
        heading,
        body,
        metadata : {
            reverseOrder,
            backgroundColor,
            buttonColor,
            headingColor,
            textColor
        }
    })
</script>
{#if editable}
<LayoutBlock {id} {type}>
    {#snippet drawerContent()}
        <div class="flex flex-wrap flex-col justify-between">
            <div class="form-control">
                <label class="label cursor-pointer">
                    <span class="label-text">Swap Hero and Content</span>
                    <input type="checkbox" class="checkbox checkbox-accent ml-4" bind:checked={reverseOrder} />
                </label>
            </div>

            <div class="form-control">
                <label class="label cursor-pointer">
                    <span class="label-text">Component Background Color</span>
                    <input type="color" class="input-color ml-4" bind:value={backgroundColor} />
                </label>
            </div>
            
            <div class="form-control">
                <label class="label cursor-pointer">
                    <span class="label-text">Heading Color</span>
                    <input type="color" class="input-color ml-4" bind:value={headingColor} />
                </label>
            </div>
            <div class="form-control">
                <label class="label cursor-pointer">
                    <span class="label-text">Text Color</span>
                    <input type="color" class="input-color ml-4" bind:value={textColor} />
                </label>
            </div>

            <label class="form-control w-full ">
                <div class="label">
                    <span class="label-text">Button Label</span>
                </div>
                <input type="text" class="input input-bordered w-full " placeholder="button label..." bind:value={button.label} />
            </label>

            <label class="form-control w-full">
                <div class="label">
                    <span class="label-text">Button Link</span>
                </div>
                <input type="text" class="input input-bordered w-full" placeholder="button link..." bind:value={button.link} />
            </label>
            <div class="form-control">
                <label class="label cursor-pointer">
                    <span class="label-text">Button Color</span>
                    <input type="color" class="input-color ml-4" bind:value={buttonColor} />
                </label>
            </div>

            <div class="divider"></div>

            <SearchImage bind:selectedImage={image} />
        </div>
    {/snippet}

    {#snippet metadata()}
        {JSON.stringify(content)}
    {/snippet}

    {#snippet children()}
        {#if reverseOrder}
            <div class="hero bg-base-200 min-h-screen" style:background-color={backgroundColor}>
                <div class="hero-content flex-col lg:flex-row-reverse">
                    <div class="basis-1/2">
                        <h1 class="text-5xl font-extrabold mb-0" style:color={headingColor} contenteditable bind:innerHTML={heading}></h1>
                        <p class="py-6 font-semibold my-0" style:color={textColor} contenteditable bind:innerHTML={body}></p>
                        <button class="btn btn-outline rounded-none min-w-40" disabled style:color={textColor} style:background-color={buttonColor}>
                            {button.label}
                            <ArrowRight />
                        </button>
                    </div>
                    <div class="basis-1/2 justify-center">
                        <img src={image.url} class="rounded-lg shadow-2xl" alt={image.alt} />
                    </div>
                </div>
            </div>
        {:else}
            <div class="hero bg-base-200 min-h-screen" style:background-color={backgroundColor}>
                <div class="hero-content flex-col lg:flex-row-reverse">
                    <div class="basis-1/2 justify-center">
                        <img src={image.url} class="rounded-lg shadow-2xl" alt={image.alt} />
                    </div>
            
                    <div class="basis-1/2">
                        <h1 class="text-5xl font-extrabold mb-0" style:color={headingColor} contenteditable bind:innerHTML={heading}></h1>
                        <p class="py-6 font-semibold my-0" style:color={textColor} contenteditable bind:innerHTML={body}></p>
                        <button class="btn btn-outline rounded-none min-w-40" disabled style:color={textColor} style:background-color={buttonColor}>
                            {button.label}
                            <ArrowRight />
                        </button>
                    </div>
                </div>
            </div>
        {/if}
    {/snippet}
</LayoutBlock>
{:else}
    <section id={id} data-type={type} class="w-full">
        {#if reverseOrder}
            <div class="hero bg-base-200 min-h-screen" style:background-color={backgroundColor}>
                <div class="hero-content flex-col lg:flex-row-reverse">
                    <div class="basis-1/2">
                        <h1 class="text-5xl font-extrabold mb-0" style:color={headingColor}>
                            {@html heading}
                        </h1>
                        <div class="py-6 font-semibold my-0" style:color={textColor}>
                            {@html body}
                        </div>
                        <a class="btn btn-outline rounded-none min-w-40" style:color={textColor} style:background-color={buttonColor} href={button?.link ?? '#'}>
                            {button?.label ?? 'Read more'}
                            <ArrowRight />
                        </a>
                    </div>
                    <div class="basis-1/2 justify-center">
                        <img src={image?.url} class="rounded-lg shadow-2xl" alt={image?.alt ?? ''} />
                    </div>
                </div>
            </div>
        {:else}
            <div class="hero bg-base-200 min-h-screen" style:background-color={backgroundColor}>
                <div class="hero-content flex-col lg:flex-row-reverse">
                    <div class="basis-1/2 justify-center">
                        <img src={image?.url} class="rounded-lg shadow-2xl" alt={image?.alt ?? ''} />
                    </div>

                    <div class="basis-1/2">
                        <h1 class="text-5xl font-extrabold mb-0" style:color={headingColor}>
                            {@html heading}
                        </h1>
                        <div class="py-6 font-semibold my-0" style:color={textColor}>
                            {@html body}
                        </div>
                        <a class="btn btn-outline rounded-none min-w-40" style:color={textColor} style:background-color={buttonColor} href={button?.link ?? '#'}>
                            {button?.label ?? 'Read more'}
                            <ArrowRight />
                        </a>
                    </div>
                </div>
            </div>
        {/if}
    </section>
{/if}