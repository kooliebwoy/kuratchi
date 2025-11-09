<script lang="ts">
    import { ArrowRight } from "@lucide/svelte";
    import { LayoutBlock } from '../shell/index.js';

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
                    <!-- Blog cards would go here -->
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
                <!-- Blog cards would go here -->
            </div>
        </div>
    </section>
{/if}
