<script lang="ts">
    import { LayoutBlock } from '../shell/index.js';

    interface Props {
        id?: string;
        type?: string;
        heading?: string;
        body?: string;
        button?: string;
        link?: string;
        backgroundColor?: string;
        buttonColor?: string;
        headingColor?: string;
        contentColor?: string;
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        type = 'card-no-image',
        heading = 'Hi there',
        body = 'Provident cupiditate voluptatem et in. Quaerat fugiat ut assumenda excepturi exercitationem quasi. In deleniti eaque aut repudiandae et a id nisi.',
        button = 'Read more',
        link = '#',
        backgroundColor = '#575757',
        buttonColor = '#d1d5db',
        headingColor = '#374151',
        contentColor = '#374151',
        editable = true
    }: Props = $props();

    let content = $derived({
        id,
        type,
        heading,
        body,
        button,
        link,
        backgroundColor,
        buttonColor,
        headingColor,
        contentColor
    })
</script>

{#if editable}
<LayoutBlock {id} {type}>
    {#snippet drawerContent()}
        <div class="space-y-6">
            <fieldset class="border-t border-b py-4">
                <legend>Content</legend>
                <div class="form-control w-full">
                    <label class="block">
                        <span class="text-gray-700">Heading</span>
                        <input type="text" class="mt-1 block w-full form-input" bind:value={heading} placeholder="Enter heading">
                    </label>
                </div>
                <div class="form-control w-full">
                    <label class="block">
                        <span class="text-gray-700">Body</span>
                        <textarea class="mt-1 block w-full form-textarea" rows="3" bind:value={body} placeholder="Enter body"></textarea>
                    </label>
                </div>
                <div class="form-control w-full">
                    <label class="block">
                        <span class="text-gray-700">Button Text</span>
                        <input type="text" class="mt-1 block w-full form-input" bind:value={button} placeholder="Button text">
                    </label>
                </div>
                <div class="form-control w-full">
                    <label class="block">
                        <span class="text-gray-700">Link</span>
                        <input type="url" class="mt-1 block w-full form-input" bind:value={link} placeholder="Enter link">
                    </label>
                </div>
            </fieldset>

            <fieldset class="border-t border-b py-4">
                <legend>Styles</legend>
                <div class="form-control w-full">
                    <label class="block">
                        <span class="text-gray-700">Background Color</span>
                        <input type="color" class="mt-1 block w-full form-input" bind:value={backgroundColor}>
                    </label>
                </div>
                <div class="form-control w-full">
                    <label class="block">
                        <span class="text-gray-700">Button Color</span>
                        <input type="color" class="mt-1 block w-full form-input" bind:value={buttonColor}>
                    </label>
                </div>
                <div class="form-control w-full">
                    <label class="block">
                        <span class="text-gray-700">Heading Color</span>
                        <input type="color" class="mt-1 block w-full form-input" bind:value={headingColor}>
                    </label>
                </div>
                <div class="form-control w-full">
                    <label class="block">
                        <span class="text-gray-700">Content Color</span>
                        <input type="color" class="mt-1 block w-full form-input" bind:value={contentColor}>
                    </label>
                </div>
            </fieldset>
        </div>
    {/snippet}

    {#snippet metadata()}
        {JSON.stringify(content)}
    {/snippet}

    {#snippet children()}
        <div class="card lg:card-side min-h-full h-full" style="background-color: {backgroundColor}">
            <div class="card-body">
                <h2 class="card-title font-extrabold text-4xl" style="color: {headingColor}" id="heading" bind:innerHTML={heading} contenteditable></h2>
                <p style="color: {contentColor}" id="body" bind:innerHTML={body} contenteditable></p>
                <div class="card-actions justify-start">
                    <a class="btn" href={link} style="background-color: {buttonColor}; color: {contentColor}" id="button">{button}</a>
                </div>
            </div>
        </div>
    {/snippet}
</LayoutBlock>
{:else}
    <section id={id} data-type={type} class="card lg:card-side min-h-full h-full" style:background-color={backgroundColor}>
        <div class="hidden" data-metadata>{JSON.stringify(content)}</div>
        <div class="card-body">
            <h2 class="card-title font-extrabold text-4xl" style:color={headingColor}>{heading}</h2>
            <p style:color={contentColor}>{body}</p>
            <div class="card-actions justify-start">
                <a class="btn" href={link} style:background-color={buttonColor} style:color={contentColor}>{button}</a>
            </div>
        </div>
    </section>
{/if}
