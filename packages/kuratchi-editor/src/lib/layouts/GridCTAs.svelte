<script lang="ts">
    import { LayoutBlock } from "../shell/index.js";
    import { ImagePicker } from "../plugins/index.js";
    import { ArrowRight } from "@lucide/svelte";

    interface CardImage {
        key?: string;
        url?: string;
        src?: string;
        alt?: string;
        name?: string;
    }

    interface CardContent {
        image: CardImage;
        title: string;
        buttonLabel: string;
        buttonLink: string;
    }

    interface Props {
        id?: string;
        type?: string;
        heading?: string;
        button?: { link: string; label: string };
        metadata?: {
            buttonColor: string;
            headingColor: string;
            textColor: string;
            backgroundColor: string;
        };
        cards?: CardContent[];
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        type = 'grid-ctas',
        heading = 'Our Services',
        button = $bindable({ link: '#', label: 'Read more' }),
        metadata = {
            buttonColor: 'bg-base-200',
            headingColor: 'text-content',
            textColor: 'text-content',
            backgroundColor: '#ffffff'
        },
        cards = $bindable<CardContent[]>([]),
        editable = true
    }: Props = $props();


    // Reactive statements to update metadata properties
    let backgroundColor = $state(metadata.backgroundColor);
    let buttonColor = $state(metadata.buttonColor);
    let headingColor = $state(metadata.headingColor);
    let textColor = $state(metadata.textColor);

    const normalizedCards = $derived(cards.map((card) => ({
        title: card?.title ?? '',
        buttonLabel: card?.buttonLabel ?? '',
        buttonLink: card?.buttonLink ?? '#',
        image: {
            url: card?.image?.key ? `/api/bucket/${card.image.key}` : card?.image?.url ?? card?.image?.src ?? '',
            alt: card?.image?.alt ?? card?.image?.name ?? card?.title ?? '',
            key: card?.image?.key
        }
    })));

    let content = $derived({
        id,
        type,
        button,
        heading,
        cards: normalizedCards,
        metadata : {
            backgroundColor,
            buttonColor,
            headingColor,
            textColor
        }
    })

    // extract images from each card
    let images = $state(cards.map((card) => card.image).filter(Boolean));

    // if image is updated, update the image in the card
$effect(() => {
    if (!editable) return;

    // if image was deleted, remove it from the card
    cards = cards.filter((card) => images.includes(card.image));

    // if image was added, create a new card with the image, unless it already exists
    images.forEach((image) => {
        if (!cards.some((card) => card.image === image)) {
            cards = [
                ...cards,
                {
                    image,
                    title: 'card title',
                    buttonLabel: 'button label',
                    buttonLink: '#'
                }
            ];
        }
    });
});
</script>

{#if editable}
<LayoutBlock
    {id}
    {type}>
    {#snippet metadata()}{JSON.stringify(content)}{/snippet}
    {#snippet drawerContent()}
        <div class="space-y-4">
            <fieldset class="border border-base-300 rounded-lg p-4">
                <legend class="text-sm font-medium px-2">Colors</legend>
                <div class="grid grid-cols-1 gap-3">
                    <div class="form-control">
                        <label class="label cursor-pointer">
                            <span class="label-text">Background Color</span>
                            <input type="color" class="input-color" bind:value={backgroundColor} />
                        </label>
                    </div>
                    <div class="form-control">
                        <label class="label cursor-pointer">
                            <span class="label-text">Heading Color</span>
                            <input type="color" class="input-color" bind:value={headingColor} />
                        </label>
                    </div>
                    <div class="form-control">
                        <label class="label cursor-pointer">
                            <span class="label-text">Text Color</span>
                            <input type="color" class="input-color" bind:value={textColor} />
                        </label>
                    </div>
                    <div class="form-control">
                        <label class="label cursor-pointer">
                            <span class="label-text">Button Color</span>
                            <input type="color" class="input-color" bind:value={buttonColor} />
                        </label>
                    </div>
                </div>
            </fieldset>

            <fieldset class="border border-base-300 rounded-lg p-4">
                <legend class="text-sm font-medium px-2">Content</legend>
                <div class="grid grid-cols-1 gap-3">
                    <label class="form-control">
                        <div class="label">
                            <span class="label-text">Heading</span>
                        </div>
                        <input type="text" class="input input-bordered" placeholder="title..." bind:value={heading} />
                    </label>
                    <label class="form-control">
                        <div class="label">
                            <span class="label-text">Button Label</span>
                        </div>
                        <input type="text" class="input input-bordered" placeholder="button label..." bind:value={button.label} />
                    </label>
                    <label class="form-control">
                        <div class="label">
                            <span class="label-text">Button Link</span>
                        </div>
                        <input type="text" class="input input-bordered" placeholder="button link..." bind:value={button.link} />
                    </label>
                </div>
            </fieldset>

            <fieldset class="border border-base-300 rounded-lg p-4">
                <legend class="text-sm font-medium px-2">Cards</legend>
                <ImagePicker bind:selectedImages={images} mode="multiple" />
                
                <div class="flex flex-col gap-3 mt-3">
                    {#each cards as card, index}
                        <div class="card bg-base-100 border border-base-300">
                            <div class="card-body p-4">
                                <div class="flex gap-3">
                                    <img src='/api/bucket/{card.image.key}' alt={card.image.name} class="w-20 h-20 object-cover rounded" />
                                    <div class="flex-1 space-y-2">
                                        <input 
                                            type="text" 
                                            class="input input-sm input-bordered w-full" 
                                            placeholder="Card title..." 
                                            bind:value={card.title}
                                        />
                                        <input 
                                            type="text" 
                                            class="input input-sm input-bordered w-full" 
                                            placeholder="Button label..." 
                                            bind:value={card.buttonLabel}
                                        />
                                        <input 
                                            type="text" 
                                            class="input input-sm input-bordered w-full" 
                                            placeholder="Button link..." 
                                            bind:value={card.buttonLink}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>
            </fieldset>
        </div>
    {/snippet}
    {#snippet children()}
        <div class="container mx-auto py-8" style:background-color={backgroundColor}>
            <div class="flex flex-col flex-wrap gap-3">
                <div class="flex justify-between items-center">
                    <h1 class="text-5xl font-bold mb-0" style:color={headingColor} contenteditable bind:innerHTML={heading}></h1>
                    <button class="btn btn-ghost rounded-none min-w-40" disabled style:color={textColor} style:background-color={buttonColor}>
                        {button.label}
                        <ArrowRight />
                    </button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 place-items-center gap-6 mt-10 mb-5">
                    {#each cards as card}
                        <div class="card w-96 max-w-96 !bg-transparent !shadow-none !rounded-none !border-none h-full">
                            <figure>
                                <img src='/api/bucket/{card.image.key}' alt={card.title} class="rounded-none object-cover w-72 h-[450px]" />
                            </figure>
                            <div class="card-body items-center text-center">
                                <h2 class="card-title" style:color={headingColor}>{card.title}</h2>
                                <div class="card-actions">
                                    <button class="btn btn-ghost" style:color={textColor}>
                                        {card.buttonLabel}
                                        <ArrowRight />
                                    </button>
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        </div>
    {/snippet}
</LayoutBlock>
{:else}
    <section id={id} data-type={type} class="container mx-auto py-8" style:background-color={backgroundColor}>
        <div class="hidden" data-metadata>{JSON.stringify(content)}</div>
        <div class="flex flex-col flex-wrap gap-3">
            <div class="flex justify-between items-center">
                <h1 class="text-5xl font-bold mb-0" style:color={headingColor}>
                    {@html heading}
                </h1>
                {#if button.label}
                    <a class="btn btn-ghost rounded-none min-w-40" href={button.link} style:color={textColor} style:background-color={buttonColor}>
                        {button.label}
                        <ArrowRight />
                    </a>
                {/if}
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 place-items-center gap-6 mt-10 mb-5">
                {#each normalizedCards as card}
                    <article class="card w-96 max-w-96 !bg-transparent !shadow-none !rounded-none !border-none h-full">
                        {#if card.image.url}
                            <figure>
                                <img src={card.image.url} alt={card.image.alt} class="rounded-none object-cover w-72 h-[450px]" />
                            </figure>
                        {/if}
                        <div class="card-body items-center text-center">
                            {#if card.title}
                                <h2 class="card-title" style:color={headingColor}>{card.title}</h2>
                            {/if}
                            {#if card.buttonLabel}
                                <div class="card-actions">
                                    <a class="btn btn-ghost" href={card.buttonLink} style:color={textColor}>
                                        {card.buttonLabel}
                                        <ArrowRight />
                                    </a>
                                </div>
                            {/if}
                        </div>
                    </article>
                {/each}
            </div>
        </div>
    </section>
{/if}


