<script lang="ts">
    import { ArrowRight } from '@lucide/svelte';
    import { ImagePicker } from '../plugins/index.js';
    import { LayoutBlock } from '../shell/index.js';

    interface CardImage {
        key?: string;
        url?: string;
        src?: string;
        alt?: string;
        title?: string;
    }

    interface CardContent {
        image?: CardImage;
        title: string;
        buttonLabel: string;
        buttonLink: string;
    }

    interface LayoutMetadata {
        backgroundColor: string;
        headingColor: string;
        textColor: string;
        buttonColor: string;
    }

    interface Props {
        id?: string;
        type?: string;
        heading?: string;
        button?: { link: string; label: string };
        metadata?: LayoutMetadata;
        cards?: CardContent[];
        editable?: boolean;
    }

    const createDefaultCards = (): CardContent[] => [
        {
            title: 'Studio portraits',
            buttonLabel: 'Book session',
            buttonLink: '#',
            image: {
                src: 'https://fakeimg.pl/365x450/?text=Portrait&font=lobster',
                alt: 'Studio portrait session example',
                title: 'Portrait session photography'
            }
        },
        {
            title: 'Creative direction',
            buttonLabel: 'Meet the team',
            buttonLink: '#',
            image: {
                src: 'https://fakeimg.pl/365x450/?text=Creative&font=lobster',
                alt: 'Creative direction mood board',
                title: 'Creative direction board'
            }
        },
        {
            title: 'On-location shoots',
            buttonLabel: 'Plan your project',
            buttonLink: '#',
            image: {
                src: 'https://fakeimg.pl/365x450/?text=Location&font=lobster',
                alt: 'On-location photography session',
                title: 'On-location photography'
            }
        }
    ];

    let {
        id = crypto.randomUUID(),
        type = 'grid-ctas',
        heading = $bindable('Our services'),
        button = $bindable({ link: '#', label: 'Read more' }),
        metadata: layoutMetadata = $bindable<LayoutMetadata>({
            backgroundColor: '#f8fafc',
            headingColor: '#0f172a',
            textColor: '#1f2937',
            buttonColor: '#0f172a'
        }) as LayoutMetadata,
        cards = $bindable<CardContent[]>(createDefaultCards()),
        editable = true
    }: Props = $props();

    $effect(() => {
        layoutMetadata.backgroundColor ??= '#f8fafc';
        layoutMetadata.headingColor ??= '#0f172a';
        layoutMetadata.textColor ??= '#1f2937';
        layoutMetadata.buttonColor ??= '#0f172a';
    });

    const normalizedCards = $derived(
        cards.map((card) => ({
            title: card?.title?.trim() ?? '',
            buttonLabel: card?.buttonLabel?.trim() ?? '',
            buttonLink: card?.buttonLink?.trim() ?? '#',
            image: {
                url: card?.image?.key
                    ? `/api/bucket/${card.image.key}`
                    : card?.image?.url ?? card?.image?.src ?? '',
                alt: card?.image?.alt ?? card?.image?.title ?? card?.title ?? 'CTA image',
                title: card?.image?.title ?? card?.image?.alt ?? card?.title ?? 'CTA image',
                key: card?.image?.key
            }
        }))
    );

    const layoutStyle = $derived(
        `--krt-gridCtas-bg: ${layoutMetadata.backgroundColor}; --krt-gridCtas-heading: ${layoutMetadata.headingColor}; --krt-gridCtas-text: ${layoutMetadata.textColor}; --krt-gridCtas-button: ${layoutMetadata.buttonColor};`
    );

    const content = $derived({
        id,
        type,
        heading,
        button,
        cards: normalizedCards,
        metadata: {
            backgroundColor: layoutMetadata.backgroundColor,
            headingColor: layoutMetadata.headingColor,
            textColor: layoutMetadata.textColor,
            buttonColor: layoutMetadata.buttonColor
        }
    });

    const resolveImageUrl = (image?: CardImage) =>
        image?.key ? `/api/bucket/${image.key}` : image?.url ?? image?.src ?? '';

    let images = $state(cards.map((card) => card.image).filter(Boolean));

    $effect(() => {
        if (!editable) {
            return;
        }

        cards = cards.filter((card) => images.includes(card.image));

        images.forEach((image) => {
            if (!cards.some((card) => card.image === image)) {
                cards = [
                    ...cards,
                    {
                        image,
                        title: 'New card',
                        buttonLabel: 'Edit label',
                        buttonLink: '#'
                    }
                ];
            }
        });
    });
</script>

{#if editable}
<LayoutBlock {id} {type}>
    {#snippet metadata()}{JSON.stringify(content)}{/snippet}
    {#snippet drawerContent()}
        <div class="krt-gridCtasDrawer">
            <section class="krt-gridCtasDrawer__section">
                <h3>Section content</h3>
                <div class="krt-gridCtasDrawer__fields">
                    <label class="krt-gridCtasDrawer__field">
                        <span>Heading</span>
                        <input type="text" placeholder="Our services" bind:value={heading} />
                    </label>
                    <label class="krt-gridCtasDrawer__field">
                        <span>Button label</span>
                        <input type="text" placeholder="Read more" bind:value={button.label} />
                    </label>
                    <label class="krt-gridCtasDrawer__field">
                        <span>Button link</span>
                        <input type="text" placeholder="https://" bind:value={button.link} />
                    </label>
                </div>
            </section>

            <section class="krt-gridCtasDrawer__section">
                <h3>Colors</h3>
                <div class="krt-gridCtasDrawer__grid">
                    <label class="krt-gridCtasDrawer__field">
                        <span>Background</span>
                        <input type="color" bind:value={layoutMetadata.backgroundColor} />
                    </label>
                    <label class="krt-gridCtasDrawer__field">
                        <span>Heading</span>
                        <input type="color" bind:value={layoutMetadata.headingColor} />
                    </label>
                    <label class="krt-gridCtasDrawer__field">
                        <span>Body text</span>
                        <input type="color" bind:value={layoutMetadata.textColor} />
                    </label>
                    <label class="krt-gridCtasDrawer__field">
                        <span>Button</span>
                        <input type="color" bind:value={layoutMetadata.buttonColor} />
                    </label>
                </div>
            </section>

            <section class="krt-gridCtasDrawer__section">
                <div class="krt-gridCtasDrawer__sectionHeader">
                    <h3>Cards</h3>
                    <p class="krt-gridCtasDrawer__hint">Select or remove images to manage cards.</p>
                </div>
                <ImagePicker bind:selectedImages={images} mode="multiple" />
                <div class="krt-gridCtasDrawer__cards">
                    {#each cards as card, index}
                        <article class="krt-gridCtasDrawer__card">
                            <figure class="krt-gridCtasDrawer__preview" aria-label={`Card ${index + 1} image`}>
                                {#if resolveImageUrl(card.image)}
                                    <img src={resolveImageUrl(card.image)} alt={card.image?.alt ?? card.title} />
                                {:else}
                                    <span>No image</span>
                                {/if}
                            </figure>
                            <div class="krt-gridCtasDrawer__cardFields">
                                <label class="krt-gridCtasDrawer__field">
                                    <span>Title</span>
                                    <input type="text" placeholder="Card title" bind:value={card.title} />
                                </label>
                                <label class="krt-gridCtasDrawer__field">
                                    <span>Button label</span>
                                    <input type="text" placeholder="Learn more" bind:value={card.buttonLabel} />
                                </label>
                                <label class="krt-gridCtasDrawer__field">
                                    <span>Button link</span>
                                    <input type="text" placeholder="https://" bind:value={card.buttonLink} />
                                </label>
                            </div>
                        </article>
                    {/each}
                </div>
            </section>
        </div>
    {/snippet}

    {#snippet children()}
        <section class="krt-gridCtas" style={layoutStyle} data-type={type}>
            <div class="krt-gridCtas__metadata">{JSON.stringify(content)}</div>
            <div class="krt-gridCtas__inner">
                <header class="krt-gridCtas__header">
                    <h2 class="krt-gridCtas__heading" contenteditable bind:innerHTML={heading}></h2>
                    <a
                        class="krt-gridCtas__cta"
                        href={button.link ?? '#'}
                        onclick={(event) => event.preventDefault()}
                        aria-label={button.label ? `Edit ${button.label} label` : 'Edit primary call to action label'}
                    >
                        <span contenteditable bind:innerHTML={button.label}></span>
                        <ArrowRight aria-hidden="true" />
                    </a>
                </header>

                <div class="krt-gridCtas__grid">
                    {#each cards as card, index (index)}
                        <article class="krt-gridCtas__card">
                            {#if resolveImageUrl(card.image)}
                                <figure class="krt-gridCtas__image">
                                    <img src={resolveImageUrl(card.image)} alt={card.image?.alt ?? card.title} />
                                </figure>
                            {/if}
                            <div class="krt-gridCtas__cardBody">
                                <h3 class="krt-gridCtas__cardTitle" contenteditable bind:innerHTML={card.title}></h3>
                                <a
                                    class="krt-gridCtas__cardButton"
                                    href={card.buttonLink ?? '#'}
                                    onclick={(event) => event.preventDefault()}
                                    aria-label={`Edit ${card.buttonLabel || 'card'} button label`}
                                >
                                    <span contenteditable bind:innerHTML={card.buttonLabel}></span>
                                    <ArrowRight aria-hidden="true" />
                                </a>
                            </div>
                        </article>
                    {/each}
                </div>
            </div>
        </section>
    {/snippet}
</LayoutBlock>
{:else}
    <section id={id} data-type={type} class="krt-gridCtas" style={layoutStyle}>
        <div class="krt-gridCtas__metadata">{JSON.stringify(content)}</div>
        <div class="krt-gridCtas__inner">
            <header class="krt-gridCtas__header">
                {#if heading}
                    <h2 class="krt-gridCtas__heading">{@html heading}</h2>
                {/if}
                {#if button.label}
                    <a class="krt-gridCtas__cta" href={button.link ?? '#'} aria-label={button.label}>
                        <span>{button.label}</span>
                        <ArrowRight aria-hidden="true" />
                    </a>
                {/if}
            </header>

            <div class="krt-gridCtas__grid">
                {#each normalizedCards as card, index (index)}
                    <article class="krt-gridCtas__card">
                        {#if card.image.url}
                            <figure class="krt-gridCtas__image">
                                <img src={card.image.url} alt={card.image.alt} title={card.image.title} loading="lazy" />
                            </figure>
                        {/if}
                        <div class="krt-gridCtas__cardBody">
                            {#if card.title}
                                <h3 class="krt-gridCtas__cardTitle">{card.title}</h3>
                            {/if}
                            {#if card.buttonLabel}
                                <a class="krt-gridCtas__cardButton" href={card.buttonLink ?? '#'} aria-label={card.buttonLabel}>
                                    <span>{card.buttonLabel}</span>
                                    <ArrowRight aria-hidden="true" />
                                </a>
                            {/if}
                        </div>
                    </article>
                {/each}
            </div>
        </div>
    </section>
{/if}

<style>
    .krt-gridCtas {
        position: relative;
        isolation: isolate;
        display: block;
        padding: clamp(3rem, 6vw, 5rem) clamp(1.5rem, 7vw, 4.5rem);
        background: var(--krt-gridCtas-bg, #f8fafc);
        color: var(--krt-gridCtas-text, #1f2937);
    }

    .krt-gridCtas__metadata {
        display: none;
    }

    .krt-gridCtas__inner {
        max-width: min(1120px, 100%);
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: clamp(2rem, 6vw, 4rem);
    }

    .krt-gridCtas__header {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        align-items: flex-start;
    }

    @media (min-width: 900px) {
        .krt-gridCtas__header {
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
        }
    }

    .krt-gridCtas__heading {
        margin: 0;
        max-width: 24ch;
        font-size: clamp(2.25rem, 3vw + 1.5rem, 3.5rem);
        font-weight: 750;
        letter-spacing: -0.025em;
        color: var(--krt-gridCtas-heading, #0f172a);
        line-height: 1.1;
        outline: none;
    }

    .krt-gridCtas__cta {
        display: inline-flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.75rem 1.6rem;
        border-radius: var(--krt-radius-pill, 999px);
        background: var(--krt-gridCtas-button, #0f172a);
        color: var(--krt-gridCtas-text, #1f2937);
        font-weight: 600;
        text-decoration: none;
        transition: transform 150ms ease, box-shadow 150ms ease, background 150ms ease;
    }

    .krt-gridCtas__cta svg {
        width: 1.1rem;
        height: 1.1rem;
    }

    .krt-gridCtas__cta span {
        outline: none;
    }

    .krt-gridCtas__cta:hover {
        transform: translateY(-2px);
        box-shadow: 0 18px 32px rgba(15, 23, 42, 0.18);
    }

    .krt-gridCtas__grid {
        display: grid;
        gap: clamp(1.75rem, 3vw, 2.5rem);
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    }

    .krt-gridCtas__card {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        border-radius: var(--krt-radius-xl, 1.15rem);
        overflow: hidden;
        background: color-mix(in srgb, var(--krt-gridCtas-bg, #f8fafc) 18%, #ffffff);
        box-shadow: 0 28px 60px rgba(15, 23, 42, 0.12);
        min-height: 100%;
    }

    .krt-gridCtas__image {
        aspect-ratio: 3 / 4;
        position: relative;
        overflow: hidden;
    }

    .krt-gridCtas__image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    .krt-gridCtas__cardBody {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: clamp(1.25rem, 1rem + 1vw, 1.75rem);
    }

    .krt-gridCtas__cardTitle {
        margin: 0;
        font-size: 1.35rem;
        font-weight: 650;
        letter-spacing: -0.02em;
        color: var(--krt-gridCtas-heading, #0f172a);
        outline: none;
    }

    .krt-gridCtas__cardButton {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 600;
        text-decoration: none;
        color: var(--krt-gridCtas-text, #1f2937);
        border-radius: var(--krt-radius-pill, 999px);
        padding: 0.55rem 1.1rem;
        background: color-mix(in srgb, var(--krt-gridCtas-button, #0f172a) 14%, transparent);
        transition: transform 150ms ease, background 150ms ease;
    }

    .krt-gridCtas__cardButton span {
        outline: none;
    }

    .krt-gridCtas__cardButton svg {
        width: 1rem;
        height: 1rem;
    }

    .krt-gridCtas__cardButton:hover {
        transform: translateX(4px);
        background: color-mix(in srgb, var(--krt-gridCtas-button, #0f172a) 22%, transparent);
    }

    .krt-gridCtasDrawer {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-xl, 1.25rem);
    }

    .krt-gridCtasDrawer__section {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-md, 0.75rem);
        padding: var(--krt-space-lg, 1rem);
        border-radius: var(--krt-radius-lg, 0.9rem);
        border: 1px solid color-mix(in srgb, var(--krt-color-border, #d1d5db) 78%, transparent);
        background: color-mix(in srgb, var(--krt-color-surface, #ffffff) 95%, transparent);
    }

    .krt-gridCtasDrawer__section h3 {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
        letter-spacing: 0.02em;
    }

    .krt-gridCtasDrawer__fields {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-md, 0.75rem);
    }

    .krt-gridCtasDrawer__field {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
        font-size: 0.9rem;
        font-weight: 500;
        color: color-mix(in srgb, var(--krt-color-text, #111827) 78%, transparent);
    }

    .krt-gridCtasDrawer__field span {
        display: inline-flex;
        justify-content: space-between;
        gap: 0.5rem;
    }

    .krt-gridCtasDrawer__field input[type='text'],
    .krt-gridCtasDrawer__field textarea {
        appearance: none;
        width: 100%;
        font: inherit;
        padding: 0.6rem 0.75rem;
        border-radius: var(--krt-radius-md, 0.75rem);
        border: 1px solid color-mix(in srgb, var(--krt-color-border, #d1d5db) 82%, transparent);
        background: color-mix(in srgb, var(--krt-color-surface, #ffffff) 98%, transparent);
        outline: none;
        transition: border-color 120ms ease, box-shadow 120ms ease;
    }

    .krt-gridCtasDrawer__field input[type='text']:focus,
    .krt-gridCtasDrawer__field textarea:focus {
        border-color: color-mix(in srgb, var(--krt-color-primary, #2563eb) 55%, transparent);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--krt-color-primary, #2563eb) 25%, transparent);
    }

    .krt-gridCtasDrawer__field input[type='color'] {
        min-height: 2.5rem;
        padding: 0.2rem;
        border-radius: var(--krt-radius-md, 0.75rem);
        border: 1px solid color-mix(in srgb, var(--krt-color-border, #d1d5db) 82%, transparent);
        background: color-mix(in srgb, var(--krt-color-surface, #ffffff) 98%, transparent);
        cursor: pointer;
    }

    .krt-gridCtasDrawer__grid {
        display: grid;
        gap: var(--krt-space-md, 0.75rem);
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    }

    .krt-gridCtasDrawer__sectionHeader {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }

    .krt-gridCtasDrawer__hint {
        margin: 0;
        font-size: 0.8rem;
        color: color-mix(in srgb, var(--krt-color-text, #111827) 55%, transparent);
    }

    .krt-gridCtasDrawer__cards {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-md, 0.75rem);
    }

    .krt-gridCtasDrawer__card {
        display: flex;
        gap: var(--krt-space-md, 0.75rem);
        align-items: flex-start;
        padding: var(--krt-space-md, 0.75rem);
        border-radius: var(--krt-radius-lg, 0.9rem);
        border: 1px solid color-mix(in srgb, var(--krt-color-border, #d1d5db) 78%, transparent);
        background: color-mix(in srgb, var(--krt-color-surface, #ffffff) 96%, transparent);
    }

    .krt-gridCtasDrawer__preview {
        width: 5rem;
        height: 5rem;
        border-radius: var(--krt-radius-md, 0.75rem);
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        background: color-mix(in srgb, var(--krt-color-border, #d1d5db) 35%, transparent);
        color: color-mix(in srgb, var(--krt-color-text, #111827) 60%, transparent);
        font-size: 0.75rem;
        text-align: center;
    }

    .krt-gridCtasDrawer__preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    .krt-gridCtasDrawer__cardFields {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-sm, 0.5rem);
        flex: 1 1 auto;
    }

    .krt-gridCtas__cardButton svg,
    .krt-gridCtas__cta svg {
        flex-shrink: 0;
    }
</style>
