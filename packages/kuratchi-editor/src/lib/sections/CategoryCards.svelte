<script lang="ts">
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
    import { onMount } from 'svelte';
    import { ImagePicker } from '../widgets/index.js';
    import { BlockActions } from '../utils/index.js';
    import SectionLayoutControls from './SectionLayoutControls.svelte';
    import { 
        type SectionLayout, 
        DEFAULT_SECTION_LAYOUT, 
        getSectionLayoutStyles,
        mergeLayoutWithDefaults 
    } from './section-layout.js';

    interface CategoryItem {
        image: { url?: string; alt?: string };
        label: string;
        link: string;
    }

    interface LayoutMetadata {
        backgroundColor: string;
        headingColor: string;
        labelColor: string;
        cardBackground: string;
        layout?: Partial<SectionLayout>;
    }

    interface Props {
        id?: string;
        type?: string;
        heading?: string;
        categories?: CategoryItem[];
        metadata?: LayoutMetadata;
        editable?: boolean;
    }

    const createDefaultCategories = (): CategoryItem[] => [
        { image: { url: 'https://fakeimg.pl/200x150/?text=Category+1', alt: 'Category 1' }, label: 'Side x Sides', link: '#' },
        { image: { url: 'https://fakeimg.pl/200x150/?text=Category+2', alt: 'Category 2' }, label: 'ATVs', link: '#' },
        { image: { url: 'https://fakeimg.pl/200x150/?text=Category+3', alt: 'Category 3' }, label: 'Motorcycles', link: '#' },
        { image: { url: 'https://fakeimg.pl/200x150/?text=Category+4', alt: 'Category 4' }, label: 'View All', link: '#' }
    ];

    let {
        id = crypto.randomUUID(),
        type = 'category-cards',
        heading = $bindable('Shop Top Categories'),
        categories = $bindable<CategoryItem[]>(createDefaultCategories()),
        metadata = $bindable<LayoutMetadata>({
            backgroundColor: '#ffffff',
            headingColor: '#1a1a1a',
            labelColor: '#1a1a1a',
            cardBackground: '#f5f5f5',
            layout: { ...DEFAULT_SECTION_LAYOUT }
        }),
        editable = true
    }: Props = $props();

    let categoriesState = $state(categories);
    let editingIndex = $state<number | null>(null);

    // Section layout state
    let sectionLayout = $state<SectionLayout>(mergeLayoutWithDefaults(metadata.layout));
    
    $effect(() => {
        metadata.layout = { ...sectionLayout };
    });

    const sectionLayoutStyles = $derived(getSectionLayoutStyles(sectionLayout));

    const layoutStyle = $derived(
        `--krt-categoryCards-bg: ${metadata.backgroundColor}; --krt-categoryCards-heading: ${metadata.headingColor}; --krt-categoryCards-label: ${metadata.labelColor}; --krt-categoryCards-card-bg: ${metadata.cardBackground}; ${sectionLayoutStyles}`
    );

    let content = $derived({
        id,
        type,
        heading,
        categories: categoriesState,
        metadata: { ...metadata }
    });

    let component = $state<HTMLElement>();
    const componentRef = {};
    let mounted = $state(false);

    function addCategory() {
        categoriesState = [...categoriesState, { 
            image: { url: 'https://fakeimg.pl/200x150/?text=New', alt: 'New Category' }, 
            label: 'New Category', 
            link: '#' 
        }];
    }

    function removeCategory(index: number) {
        categoriesState = categoriesState.filter((_, i) => i !== index);
        if (editingIndex === index) editingIndex = null;
    }

    onMount(() => {
        if (!editable) return;
        mounted = true;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
        return () => blockRegistry.unregister(componentRef);
    });
</script>

{#if editable}
<div class="editor-item group relative krt-categoryCards__wrapper" bind:this={component}>
    {#if mounted}
        <BlockActions {id} {type} element={component} inspectorTitle="Category Cards Settings">
            {#snippet inspector()}
                <div class="krt-categoryCardsDrawer">
                    <section class="krt-categoryCardsDrawer__section">
                        <h3>Section Layout</h3>
                        <SectionLayoutControls bind:layout={sectionLayout} />
                    </section>

                    <section class="krt-categoryCardsDrawer__section">
                        <h3>Colors</h3>
                        <div class="krt-categoryCardsDrawer__grid">
                            <label class="krt-categoryCardsDrawer__field">
                                <span>Background</span>
                                <input type="color" bind:value={metadata.backgroundColor} />
                            </label>
                            <label class="krt-categoryCardsDrawer__field">
                                <span>Heading</span>
                                <input type="color" bind:value={metadata.headingColor} />
                            </label>
                            <label class="krt-categoryCardsDrawer__field">
                                <span>Labels</span>
                                <input type="color" bind:value={metadata.labelColor} />
                            </label>
                            <label class="krt-categoryCardsDrawer__field">
                                <span>Card Background</span>
                                <input type="color" bind:value={metadata.cardBackground} />
                            </label>
                        </div>
                    </section>

                    <section class="krt-categoryCardsDrawer__section">
                        <h3>Categories</h3>
                        <div class="krt-categoryCardsDrawer__list">
                            {#each categoriesState as category, index}
                                <div class="krt-categoryCardsDrawer__item">
                                    <div class="krt-categoryCardsDrawer__itemHeader">
                                        <span>{category.label}</span>
                                        <div class="krt-categoryCardsDrawer__itemActions">
                                            <button type="button" onclick={() => editingIndex = editingIndex === index ? null : index}>
                                                {editingIndex === index ? 'Close' : 'Edit'}
                                            </button>
                                            <button type="button" onclick={() => removeCategory(index)}>Remove</button>
                                        </div>
                                    </div>
                                    {#if editingIndex === index}
                                        <div class="krt-categoryCardsDrawer__itemEdit">
                                            <label class="krt-categoryCardsDrawer__field">
                                                <span>Label</span>
                                                <input type="text" bind:value={category.label} />
                                            </label>
                                            <label class="krt-categoryCardsDrawer__field">
                                                <span>Link</span>
                                                <input type="url" bind:value={category.link} placeholder="https://" />
                                            </label>
                                            <div class="krt-categoryCardsDrawer__field">
                                                <span>Image</span>
                                                <ImagePicker 
                                                    bind:selectedImage={categoriesState[index].image}
                                                    mode="single" 
                                                />
                                            </div>
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                        <button type="button" class="krt-categoryCardsDrawer__addBtn" onclick={addCategory}>
                            + Add Category
                        </button>
                    </section>
                </div>
            {/snippet}
        </BlockActions>
    {/if}

    <section class="krt-categoryCards" style={layoutStyle} data-type={type}>
        <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
        <div class="krt-categoryCards__inner">
            <h2 class="krt-categoryCards__heading" contenteditable bind:innerHTML={heading}></h2>
            <div class="krt-categoryCards__grid">
                {#each categoriesState as category, index}
                    <a href={category.link} class="krt-categoryCards__card" onclick={(e) => editable && e.preventDefault()}>
                        <div class="krt-categoryCards__imageWrap">
                            {#if category.image?.url}
                                <img src={category.image.url} alt={category.image.alt ?? category.label} loading="lazy" />
                            {:else}
                                <div class="krt-categoryCards__placeholder">Add image</div>
                            {/if}
                        </div>
                        <span class="krt-categoryCards__label" contenteditable bind:innerHTML={category.label}></span>
                    </a>
                {/each}
            </div>
        </div>
    </section>
</div>
{:else}
    <section id={id} data-type={type} class="krt-categoryCards" style={layoutStyle}>
        <div class="krt-categoryCards__inner">
            <h2 class="krt-categoryCards__heading">{@html heading}</h2>
            <div class="krt-categoryCards__grid">
                {#each categories as category}
                    <a href={category.link} class="krt-categoryCards__card">
                        <div class="krt-categoryCards__imageWrap">
                            {#if category.image?.url}
                                <img src={category.image.url} alt={category.image.alt ?? category.label} loading="lazy" />
                            {/if}
                        </div>
                        <span class="krt-categoryCards__label">{@html category.label}</span>
                    </a>
                {/each}
            </div>
        </div>
    </section>
{/if}

<style>
    .krt-categoryCards {
        width: 100%;
        background-color: var(--krt-categoryCards-bg, #ffffff);
        padding: var(--krt-section-padding-y, 4rem) var(--krt-section-padding-x, 2rem);
    }

    .krt-categoryCards__inner {
        max-width: var(--krt-section-max-width, 1200px);
        margin: 0 auto;
        text-align: center;
    }

    .krt-categoryCards__heading {
        color: var(--krt-categoryCards-heading, #1a1a1a);
        font-size: 1.75rem;
        font-weight: 700;
        margin: 0 0 2rem 0;
        outline: none;
    }

    .krt-categoryCards__grid {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 1.5rem;
    }

    .krt-categoryCards__card {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-decoration: none;
        transition: transform 0.2s ease;
    }

    .krt-categoryCards__card:hover {
        transform: translateY(-4px);
    }

    .krt-categoryCards__imageWrap {
        width: 140px;
        height: 100px;
        background-color: var(--krt-categoryCards-card-bg, #f5f5f5);
        border-radius: 8px;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 0.75rem;
    }

    .krt-categoryCards__imageWrap img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .krt-categoryCards__placeholder {
        color: #999;
        font-size: 0.875rem;
    }

    .krt-categoryCards__label {
        color: var(--krt-categoryCards-label, #1a1a1a);
        font-size: 0.9rem;
        font-weight: 500;
        outline: none;
    }

    /* Drawer styles */
    .krt-categoryCardsDrawer {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .krt-categoryCardsDrawer__section {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .krt-categoryCardsDrawer__section h3 {
        font-size: 0.875rem;
        font-weight: 600;
        margin: 0;
        color: #374151;
    }

    .krt-categoryCardsDrawer__grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.75rem;
    }

    .krt-categoryCardsDrawer__field {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .krt-categoryCardsDrawer__field span {
        font-size: 0.75rem;
        color: #6b7280;
    }

    .krt-categoryCardsDrawer__field input[type="color"] {
        width: 100%;
        height: 32px;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        cursor: pointer;
    }

    .krt-categoryCardsDrawer__field input[type="text"],
    .krt-categoryCardsDrawer__field input[type="url"] {
        padding: 0.5rem;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        font-size: 0.875rem;
    }

    .krt-categoryCardsDrawer__list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .krt-categoryCardsDrawer__item {
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        overflow: hidden;
    }

    .krt-categoryCardsDrawer__itemHeader {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem 0.75rem;
        background: #f9fafb;
    }

    .krt-categoryCardsDrawer__itemHeader span {
        font-size: 0.875rem;
        font-weight: 500;
    }

    .krt-categoryCardsDrawer__itemActions {
        display: flex;
        gap: 0.5rem;
    }

    .krt-categoryCardsDrawer__itemActions button {
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        background: #e5e7eb;
    }

    .krt-categoryCardsDrawer__itemActions button:hover {
        background: #d1d5db;
    }

    .krt-categoryCardsDrawer__itemEdit {
        padding: 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        border-top: 1px solid #e5e7eb;
    }

    .krt-categoryCardsDrawer__addBtn {
        width: 100%;
        padding: 0.5rem;
        border: 1px dashed #d1d5db;
        border-radius: 6px;
        background: transparent;
        color: #6b7280;
        cursor: pointer;
        font-size: 0.875rem;
    }

    .krt-categoryCardsDrawer__addBtn:hover {
        border-color: #9ca3af;
        color: #374151;
    }

    @media (max-width: 640px) {
        .krt-categoryCards__imageWrap {
            width: 100px;
            height: 70px;
        }

        .krt-categoryCards__grid {
            gap: 1rem;
        }
    }
</style>
