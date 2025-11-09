<script lang="ts">
    import { LayoutBlock } from "../shell/index.js";
    
    interface Props {
        id?: string;
        heading?: string;
        body?: string;
        button?: any;
        type?: string;
        metadata?: any;
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        heading = 'About Us',
        body = 'Random words from the editor Click to edit me',
        button = { label: 'Read more', link: '#' },
        type = 'about-us-hero',
        metadata = {
            backgroundColor: '#54545499',
            headingColor: '#212121',
            buttonColor: '#212121',
            textColor: '#ffffff'
        },
        editable = true
    }: Props = $props();

    let backgroundColor = $state(metadata.backgroundColor);
    let headingColor = $state(metadata.headingColor);
    let buttonColor = $state(metadata.buttonColor);
    let textColor = $state(metadata.textColor);

    let content = $derived({
        id,
        type,
        heading,
        body,
        button,
        metadata: {
            backgroundColor,
            headingColor,
            buttonColor,
            textColor
        }
    })
</script>

{#if editable}
<LayoutBlock {id} {type}>
    {#snippet drawerContent()}
        <div class="space-y-6">
            <fieldset class="fieldset">
                <legend class="fieldset-legend">Component Background Color</legend>
                <input type="color" class="input input-bordered h-12" bind:value={backgroundColor} />
            </fieldset>

            <fieldset class="fieldset">
                <legend class="fieldset-legend">Heading Color</legend>
                <input type="color" class="input input-bordered h-12" bind:value={headingColor} />
            </fieldset>

            <fieldset class="fieldset">
                <legend class="fieldset-legend">Text Color</legend>
                <input type="color" class="input input-bordered h-12" bind:value={textColor} />
            </fieldset>

            <fieldset class="fieldset">
                <legend class="fieldset-legend">Button Color</legend>
                <input type="color" class="input input-bordered h-12" bind:value={buttonColor} />
            </fieldset>

            <label class="form-control w-full">
                <div class="label">
                    <span class="label-text">Heading</span>
                </div>
                <input type="text" class="input input-bordered w-full" placeholder="Heading..." bind:value={heading} />
            </label>

            <label class="form-control w-full">
                <div class="label">
                    <span class="label-text">Body</span>
                </div>
                <textarea placeholder="Body..." class="textarea textarea-bordered textarea-lg w-full grow" bind:value={body}></textarea>
            </label>

            <label class="form-control w-full">
                <div class="label">
                    <span class="label-text">Button Label</span>
                </div>
                <input type="text" class="input input-bordered w-full" placeholder="Button label..." bind:value={button.label} />
            </label>

            <label class="form-control w-full">
                <div class="label">
                    <span class="label-text">Button Link</span>
                </div>
                <input type="text" class="input input-bordered w-full" placeholder="Button link..." bind:value={button.link} />
            </label>
        </div>
    {/snippet}

    {#snippet metadata()}
        {JSON.stringify(content)}
    {/snippet}

    {#snippet children()}
        <div class="hero min-h-screen mt-4 rounded-xl" style:background-color={backgroundColor} data-type={type}>
            <div class="hero-content text-center">
                <div class="max-w-2xl space-y-5">
                    <h1 class="text-5xl font-bold" style:color={headingColor} contenteditable bind:innerHTML={heading}></h1>
                    <p class="py-3" style:color={textColor} contenteditable bind:innerHTML={body}></p>
                    <a href={button.link} class="btn" style:background-color={buttonColor} style:color={textColor}>{button.label}</a>
                </div>
            </div>
        </div>
    {/snippet}
</LayoutBlock>
{:else}
    <section id={id} data-type={type} class="hero min-h-screen mt-4 rounded-xl" style:background-color={backgroundColor}>
        <div class="hidden" data-metadata>{JSON.stringify(content)}</div>
        <div class="hero-content text-center">
            <div class="max-w-2xl space-y-5">
                <h1 class="text-5xl font-bold" style:color={headingColor}>
                    {@html heading}
                </h1>
                <div class="py-3" style:color={textColor}>
                    {@html body}
                </div>
                {#if button?.label}
                    <a href={button?.link ?? '#'} class="btn" style:background-color={buttonColor} style:color={textColor}>
                        {button.label}
                    </a>
                {/if}
            </div>
        </div>
    </section>
{/if}
