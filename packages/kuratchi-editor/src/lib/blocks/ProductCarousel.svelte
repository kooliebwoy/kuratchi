<script lang="ts">
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
    import { ArrowRight, Plus } from '@lucide/svelte';
    import { onMount } from 'svelte';
    import { BlockActions } from '../utils/index.js';

    interface ProductItem {
        id?: string;
        name?: string;
        price?: string;
        image?: string;
        imageAlt?: string;
    }

    interface LayoutMetadata {
        backgroundColor: string;
        textColor: string;
        mutedColor: string;
        cardBackground: string;
        buttonColor: string;
    }

    interface Props {
        id?: string;
        type?: string;
        heading?: string;
        body?: string;
        buttonText?: string;
        buttonLink?: string;
        products?: ProductItem[];
        metadata?: LayoutMetadata;
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        type = 'product-carousel',
        heading = $bindable('Latest Arrivals'),
        body = $bindable(
            'Deliver great service experiences fast - without the complexity of traditional ITSM solutions.'
        ),
        buttonText = $bindable('All products'),
        buttonLink = $bindable('#'),
        products = $bindable<ProductItem[]>([
            { id: 'product-1', name: 'Product A', price: '$149', image: 'https://fakeimg.pl/420x560/?text=CMS' },
            { id: 'product-2', name: 'Product B', price: '$199', image: 'https://fakeimg.pl/420x560/?text=CMS' },
            { id: 'product-3', name: 'Product C', price: '$299', image: 'https://fakeimg.pl/420x560/?text=CMS' },
            { id: 'product-4', name: 'Product D', price: '$399', image: 'https://fakeimg.pl/420x560/?text=CMS' }
        ]),
        metadata: layoutMetadata = $bindable<LayoutMetadata>({
            backgroundColor: '#f3f4f6',
            textColor: '#0f172a',
            mutedColor: '#4b5563',
            cardBackground: '#ffffff',
            buttonColor: '#2563eb'
        }) as LayoutMetadata,
        editable = true
    }: Props = $props();

    const normalizedProducts = $derived(
        products.map((product, index) => ({
            id: product?.id ?? `product-${index}`,
            name: product?.name ?? 'Untitled product',
            price: product?.price ?? '',
            image: product?.image ?? '',
            imageAlt: product?.imageAlt ?? product?.name ?? 'Product image'
        }))
    );

    const layoutStyle = $derived(
        `--krt-productCarousel-bg: ${layoutMetadata.backgroundColor}; --krt-productCarousel-text: ${layoutMetadata.textColor}; --krt-productCarousel-muted: ${layoutMetadata.mutedColor}; --krt-productCarousel-card: ${layoutMetadata.cardBackground}; --krt-productCarousel-accent: ${layoutMetadata.buttonColor};`
    );

    const content = $derived({
        id,
        type,
        heading,
        body,
        buttonText,
        buttonLink,
        products: normalizedProducts,
        metadata: { ...layoutMetadata }
    });

    let component: HTMLElement;
    const componentRef = {};
    let mounted = $state(false);

    onMount(() => {
        mounted = true;
    });

    onMount(() => {
        if (typeof editable !== 'undefined' && !editable) return;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
        return () => blockRegistry.unregister(componentRef);
    });
</script>

{#if editable}
    <div class="editor-item group relative" bind:this={component}>
        {#if mounted}
            <BlockActions {id} {type} element={component} />
        {/if}
        <section class="krt-productCarousel" style={layoutStyle} {id} data-type={type}>
            <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
            <div class="krt-productCarousel__hero">
                <div class="krt-productCarousel__textGroup">
                    <p class="krt-productCarousel__eyebrow">Featured products</p>
                    <h2 class="krt-productCarousel__heading" contenteditable bind:innerHTML={heading}></h2>
                    <p class="krt-productCarousel__body" contenteditable bind:innerHTML={body}></p>
                </div>
                <a
                    class="krt-productCarousel__cta"
                    href={buttonLink ?? '#'}
                    onclick={(event) => event.preventDefault()}
                    aria-label={buttonText ? `Edit ${buttonText} label` : 'Edit product carousel button label'}
                >
                    <span contenteditable bind:innerHTML={buttonText}></span>
                    <ArrowRight aria-hidden="true" />
                </a>
            </div>

            <div class="krt-productCarousel__grid">
                {#if normalizedProducts.length}
                    {#each normalizedProducts as product (product.id)}
                        <article class="krt-productCard">
                            <div class="krt-productCard__media">
                                {#if product.image}
                                    <img src={product.image} alt={product.imageAlt} loading="lazy" />
                                {:else}
                                    <div class="krt-productCard__placeholder" aria-hidden="true">Add product image</div>
                                {/if}
                            </div>
                            <div class="krt-productCard__body">
                                <div>
                                    <p class="krt-productCard__price">{product.price}</p>
                                    <h3 class="krt-productCard__title">{product.name}</h3>
                                </div>
                                <button
                                    class="krt-productCard__action"
                                    type="button"
                                    aria-label={`Edit ${product.name} action`}
                                    onclick={(event) => event.preventDefault()}
                                >
                                    <Plus aria-hidden="true" />
                                </button>
                            </div>
                        </article>
                    {/each}
                {:else}
                    <p class="krt-productCarousel__empty">No products yet. Add a product to populate this section.</p>
                {/if}
            </div>
        </section>
    </div>

    <SideActions triggerId={sideActionsId}>
        {#snippet label()}
            <button id={sideActionsId} class="krt-editButton" aria-label="Edit product carousel settings" type="button">
                <Pencil size={16} />
                <span>Edit Settings</span>
            </button>
        {/snippet}
        {#snippet content()}
            <div class="krt-productCarouselDrawer">
                <section class="krt-productCarouselDrawer__section">
                    <h3>Content</h3>
                    <div class="krt-productCarouselDrawer__grid">
                        <label class="krt-productCarouselDrawer__field">
                            <span>Heading</span>
                            <input type="text" placeholder="Latest arrivals" bind:value={heading} />
                        </label>
                        <label class="krt-productCarouselDrawer__field krt-productCarouselDrawer__field--full">
                            <span>Body</span>
                            <textarea rows="3" placeholder="Tell people what makes these products special" bind:value={body}></textarea>
                        </label>
                        <label class="krt-productCarouselDrawer__field">
                            <span>Button text</span>
                            <input type="text" placeholder="All products" bind:value={buttonText} />
                        </label>
                        <label class="krt-productCarouselDrawer__field">
                            <span>Button link</span>
                            <input type="url" placeholder="https://" bind:value={buttonLink} />
                        </label>
                    </div>
                </section>

                <section class="krt-productCarouselDrawer__section">
                    <div class="krt-productCarouselDrawer__headingRow">
                        <h3>Products</h3>
                        <p>{products.length} items</p>
                    </div>
                    <div class="krt-productCarouselDrawer__list">
                        {#each products as product, index}
                            <article class="krt-productCarouselDrawer__item">
                                <header>
                                    <span>Product {index + 1}</span>
                                </header>
                                <div class="krt-productCarouselDrawer__fields">
                                    <label class="krt-productCarouselDrawer__field">
                                        <span>Name</span>
                                        <input type="text" placeholder="Cozy hoodie" bind:value={product.name} />
                                    </label>
                                    <label class="krt-productCarouselDrawer__field">
                                        <span>Price</span>
                                        <input type="text" placeholder="$199" bind:value={product.price} />
                                    </label>
                                    <label class="krt-productCarouselDrawer__field krt-productCarouselDrawer__field--full">
                                        <span>Image URL</span>
                                        <input type="url" placeholder="https://" bind:value={product.image} />
                                    </label>
                                </div>
                            </article>
                        {/each}
                    </div>
                </section>

                <section class="krt-productCarouselDrawer__section">
                    <h3>Colors</h3>
                    <div class="krt-productCarouselDrawer__grid">
                        <label class="krt-productCarouselDrawer__field">
                            <span>Background</span>
                            <input type="color" aria-label="Background color" bind:value={layoutMetadata.backgroundColor} />
                        </label>
                        <label class="krt-productCarouselDrawer__field">
                            <span>Text</span>
                            <input type="color" aria-label="Text color" bind:value={layoutMetadata.textColor} />
                        </label>
                        <label class="krt-productCarouselDrawer__field">
                            <span>Muted</span>
                            <input type="color" aria-label="Muted text color" bind:value={layoutMetadata.mutedColor} />
                        </label>
                        <label class="krt-productCarouselDrawer__field">
                            <span>Card</span>
                            <input type="color" aria-label="Card background" bind:value={layoutMetadata.cardBackground} />
                        </label>
                        <label class="krt-productCarouselDrawer__field">
                            <span>Button</span>
                            <input type="color" aria-label="Button color" bind:value={layoutMetadata.buttonColor} />
                        </label>
                    </div>
                </section>
            </div>
        {/snippet}
    </SideActions>
{:else}
    <section id={id} data-type={type} class="krt-productCarousel" style={layoutStyle}>
        <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
        <div class="krt-productCarousel__hero">
            <div class="krt-productCarousel__textGroup">
                <p class="krt-productCarousel__eyebrow">Featured products</p>
                <h2 class="krt-productCarousel__heading">{@html heading}</h2>
                <div class="krt-productCarousel__body">{@html body}</div>
            </div>
            {#if buttonText}
                <a class="krt-productCarousel__cta" href={buttonLink ?? '#'}>
                    <span>{@html buttonText}</span>
                    <ArrowRight aria-hidden="true" />
                </a>
            {/if}
        </div>

        <div class="krt-productCarousel__grid">
            {#if normalizedProducts.length}
                {#each normalizedProducts as product (product.id)}
                    <article class="krt-productCard">
                        <div class="krt-productCard__media">
                            {#if product.image}
                                <img src={product.image} alt={product.imageAlt} loading="lazy" />
                            {/if}
                        </div>
                        <div class="krt-productCard__body">
                            <div>
                                <p class="krt-productCard__price">{product.price}</p>
                                <h3 class="krt-productCard__title">{product.name}</h3>
                            </div>
                            <button class="krt-productCard__action" type="button" aria-label={`View ${product.name}`}>
                                <Plus aria-hidden="true" />
                            </button>
                        </div>
                    </article>
                {/each}
            {:else}
                <p class="krt-productCarousel__empty">No products yet. Add a product to populate this section.</p>
            {/if}
        </div>
    </section>
{/if}

<style>
    .krt-productCarouselDrawer {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .krt-productCarouselDrawer__section {
        background: var(--krt-color-surface, #fff);
        border: 1px solid var(--krt-color-border-subtle, #e2e8f0);
        border-radius: 1rem;
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .krt-productCarouselDrawer__section > h3 {
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--krt-color-text, #0f172a);
        margin: 0;
    }

    .krt-productCarouselDrawer__headingRow {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
    }

    .krt-productCarouselDrawer__headingRow p {
        font-size: 0.85rem;
        color: var(--krt-color-muted, #475569);
        margin: 0;
    }

    .krt-productCarouselDrawer__grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 0.75rem;
    }

    .krt-productCarouselDrawer__field {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        font-size: 0.85rem;
        color: var(--krt-color-text, #0f172a);
    }

    .krt-productCarouselDrawer__field input,
    .krt-productCarouselDrawer__field textarea {
        border-radius: 0.65rem;
        border: 1px solid var(--krt-color-border-subtle, #e2e8f0);
        padding: 0.5rem 0.75rem;
        font: inherit;
        color: inherit;
        background: #fff;
    }

    .krt-productCarouselDrawer__field textarea {
        resize: vertical;
    }

    .krt-productCarouselDrawer__field--full {
        grid-column: 1 / -1;
    }

    .krt-productCarouselDrawer__list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .krt-productCarouselDrawer__item {
        border: 1px solid var(--krt-color-border-subtle, #e2e8f0);
        border-radius: 0.85rem;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .krt-productCarouselDrawer__item header {
        display: flex;
        justify-content: space-between;
        font-weight: 600;
        font-size: 0.85rem;
        color: var(--krt-color-muted, #475569);
    }

    .krt-productCarouselDrawer__fields {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 0.75rem;
    }

    .krt-productCarousel {
        position: relative;
        background: var(--krt-productCarousel-bg, #f5f5f5);
        color: var(--krt-productCarousel-text, #0f172a);
        border-radius: 2rem;
        padding: 3rem clamp(1.5rem, 4vw, 4rem);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        gap: 2.5rem;
    }

    .krt-productCarousel__metadata {
        position: absolute;
        inset: 1rem auto auto 1rem;
        opacity: 0;
        pointer-events: none;
        font-size: 0;
    }

    .krt-productCarousel__hero {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    @media (min-width: 768px) {
        .krt-productCarousel__hero {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            gap: 2.5rem;
        }
    }

    .krt-productCarousel__textGroup {
        max-width: 40rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .krt-productCarousel__eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.2em;
        font-size: 0.75rem;
        color: var(--krt-productCarousel-muted, #475569);
        margin: 0;
    }

    .krt-productCarousel__heading {
        font-size: clamp(2.25rem, 4vw, 3.5rem);
        font-weight: 700;
        margin: 0;
        line-height: 1.1;
    }

    .krt-productCarousel__body {
        font-size: 1rem;
        color: var(--krt-productCarousel-muted, #475569);
        margin: 0;
    }

    .krt-productCarousel__cta {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        text-decoration: none;
        background: var(--krt-productCarousel-card, #ffffff);
        color: var(--krt-productCarousel-text, #0f172a);
        padding: 0.85rem 1.5rem;
        border-radius: 999px;
        font-weight: 600;
        border: 1px solid var(--krt-productCarousel-text, #0f172a);
    }

    .krt-productCarousel__cta span {
        display: inline-flex;
        align-items: center;
    }

    .krt-productCarousel__grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1.5rem;
    }

    .krt-productCard {
        background: var(--krt-productCarousel-card, #fff);
        border-radius: 1.5rem;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        border: 1px solid rgba(15, 23, 42, 0.08);
        min-height: 100%;
    }

    .krt-productCard__media {
        position: relative;
        aspect-ratio: 4 / 5;
        overflow: hidden;
    }

    .krt-productCard__media img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .krt-productCard__placeholder {
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
        font-size: 0.9rem;
        color: var(--krt-productCarousel-muted, #475569);
        background: repeating-linear-gradient(
            45deg,
            rgba(148, 163, 184, 0.2),
            rgba(148, 163, 184, 0.2) 10px,
            rgba(148, 163, 184, 0.35) 10px,
            rgba(148, 163, 184, 0.35) 20px
        );
    }

    .krt-productCard__body {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: center;
        padding: 1.25rem;
    }

    .krt-productCard__price {
        margin: 0;
        font-size: 0.95rem;
        color: var(--krt-productCarousel-muted, #475569);
    }

    .krt-productCard__title {
        margin: 0.15rem 0 0;
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--krt-productCarousel-text, #0f172a);
    }

    .krt-productCard__action {
        width: 3rem;
        height: 3rem;
        border-radius: 999px;
        border: none;
        background: var(--krt-productCarousel-accent, #2563eb);
        color: #fff;
        display: grid;
        place-items: center;
        cursor: pointer;
    }

    .krt-productCarousel__empty {
        grid-column: 1 / -1;
        text-align: center;
        padding: 1.5rem;
        border-radius: 1rem;
        background: rgba(15, 23, 42, 0.05);
        color: var(--krt-productCarousel-muted, #475569);
    }

    [contenteditable] {
        outline: none;
    }
</style>
