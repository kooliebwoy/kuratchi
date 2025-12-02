<script lang="ts">
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
    import { BlockActions } from '../utils/index.js';
    import { onMount } from 'svelte';
    import SectionLayoutControls from './SectionLayoutControls.svelte';
    import { 
        type SectionLayout, 
        DEFAULT_SECTION_LAYOUT, 
        getSectionLayoutStyles,
        mergeLayoutWithDefaults 
    } from './section-layout.js';

    interface TestimonialItem {
        quote: string;
        name: string;
        title: string;
    }

    interface Props {
        id?: string;
        type?: string;
        eyebrow?: string;
        heading?: string;
        testimonials?: TestimonialItem[];
        metadata?: {
            backgroundColor?: string;
            cardColor?: string;
            textColor?: string;
            accentColor?: string;
            layout?: Partial<SectionLayout>;
        };
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        type = 'testimonials-grid',
        eyebrow = $bindable('Social proof'),
        heading = $bindable('Loved by product teams everywhere'),
        testimonials = $bindable<TestimonialItem[]>([
            {
                quote: '“Kuratchi lets us ship campaigns without waiting on engineering. The blocks feel like our brand out of the box.”',
                name: 'Sienna Flores',
                title: 'VP Growth, Northwind'
            },
            {
                quote: '“The editor is intuitive enough for marketing but powerful enough for designers. Publishing takes minutes.”',
                name: 'James Harper',
                title: 'Creative Director, Lunar Studio'
            },
            {
                quote: '“We rolled out a new resource hub over a weekend. Collaboration and approvals were seamless.”',
                name: 'Priya Desai',
                title: 'Head of Content, Aurora'
            }
        ]),
        metadata = $bindable({
            backgroundColor: '#0b1224',
            cardColor: '#0f172a',
            textColor: '#e2e8f0',
            accentColor: '#38bdf8',
            layout: { ...DEFAULT_SECTION_LAYOUT }
        }),
        editable = true
    }: Props = $props();

    let component = $state<HTMLElement>();
    const componentRef = {};
    let mounted = $state(false);

    // Ensure layout defaults are merged
    let sectionLayout = $state<SectionLayout>(mergeLayoutWithDefaults(metadata.layout));
    
    // Sync layout changes back to metadata
    $effect(() => {
        metadata.layout = { ...sectionLayout };
    });

    const sectionLayoutStyles = $derived(getSectionLayoutStyles(sectionLayout));

    const layoutStyle = $derived(
        `--krt-testimonial-bg: ${metadata.backgroundColor}; --krt-testimonial-card: ${metadata.cardColor}; --krt-testimonial-text: ${metadata.textColor}; --krt-testimonial-accent: ${metadata.accentColor}; ${sectionLayoutStyles}`
    );

    const content = $derived({ id, type, heading, testimonials, metadata: { ...metadata } });

    onMount(() => {
        if (!editable) return;
        mounted = true;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
        return () => blockRegistry.unregister(componentRef);
    });
</script>

{#if editable}
    <div class="editor-item krt-testimonials" bind:this={component} style={layoutStyle}>
        {#if mounted}
            <BlockActions id={id} type={type} element={component} inspectorTitle="Testimonials settings">
                {#snippet inspector()}
                    <div class="krt-testimonials__drawer">
                        <section class="krt-testimonials__section">
                            <h3>Section Layout</h3>
                            <SectionLayoutControls bind:layout={sectionLayout} />
                        </section>

                        <section class="krt-testimonials__section">
                            <h3>Colors</h3>
                            <div class="krt-testimonials__grid">
                                <label class="krt-testimonials__field">
                                    <span>Background</span>
                                    <input type="color" bind:value={metadata.backgroundColor} />
                                </label>
                                <label class="krt-testimonials__field">
                                    <span>Cards</span>
                                    <input type="color" bind:value={metadata.cardColor} />
                                </label>
                                <label class="krt-testimonials__field">
                                    <span>Text</span>
                                    <input type="color" bind:value={metadata.textColor} />
                                </label>
                                <label class="krt-testimonials__field">
                                    <span>Accent</span>
                                    <input type="color" bind:value={metadata.accentColor} />
                                </label>
                            </div>
                        </section>
                    </div>
                {/snippet}
            </BlockActions>
        {/if}
        <div id={`metadata-${id}`} style="display: none;">{JSON.stringify(content)}</div>
        <div class="krt-testimonials__inner">
            <div class="krt-testimonials__header">
                <p class="krt-testimonials__eyebrow">Social proof</p>
                <h2 class="krt-testimonials__heading" contenteditable bind:innerHTML={heading}></h2>
            </div>
            <div class="krt-testimonials__gridCards">
                {#each testimonials as testimonial, index}
                    <article class="krt-testimonials__card">
                        <p class="krt-testimonials__quote" contenteditable bind:innerHTML={testimonials[index].quote}></p>
                        <div class="krt-testimonials__meta">
                            <div class="krt-testimonials__avatar" aria-hidden="true"></div>
                            <div>
                                <p class="krt-testimonials__name" contenteditable bind:innerHTML={testimonials[index].name}></p>
                                <p class="krt-testimonials__title" contenteditable bind:innerHTML={testimonials[index].title}></p>
                            </div>
                        </div>
                    </article>
                {/each}
            </div>
        </div>
    </div>
{:else}
    <section class="krt-testimonials" id={id} data-type={type} style={layoutStyle}>
        <div class="krt-testimonials__inner">
            <div class="krt-testimonials__header">
                <p class="krt-testimonials__eyebrow">Social proof</p>
                <h2 class="krt-testimonials__heading">{@html heading}</h2>
            </div>
            <div class="krt-testimonials__gridCards">
                {#each testimonials as testimonial}
                    <article class="krt-testimonials__card">
                        <p class="krt-testimonials__quote">{@html testimonial.quote}</p>
                        <div class="krt-testimonials__meta">
                            <div class="krt-testimonials__avatar" aria-hidden="true"></div>
                            <div>
                                <p class="krt-testimonials__name">{@html testimonial.name}</p>
                                <p class="krt-testimonials__title">{@html testimonial.title}</p>
                            </div>
                        </div>
                    </article>
                {/each}
            </div>
        </div>
    </section>
{/if}

<style>
    .krt-testimonials {
        width: 100%;
        max-width: var(--section-max-width, 100%);
        margin-inline: auto;
        background: var(--krt-testimonial-bg);
        color: var(--krt-testimonial-text);
        border-radius: var(--section-border-radius, 22px);
        padding-inline: var(--section-padding-x, 38px);
        padding-block: var(--section-padding-y, 44px);
    }

    .krt-testimonials__inner {
        display: flex;
        flex-direction: column;
        gap: 24px;
    }

    .krt-testimonials__header {
        display: grid;
        gap: 8px;
    }

    .krt-testimonials__eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.78rem;
        color: color-mix(in srgb, var(--krt-testimonial-text) 70%, transparent);
    }

    .krt-testimonials__heading {
        margin: 0;
        font-size: 1.9rem;
        line-height: 1.2;
    }

    .krt-testimonials__gridCards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 16px;
    }

    .krt-testimonials__card {
        background: var(--krt-testimonial-card);
        border: 1px solid color-mix(in srgb, var(--krt-testimonial-text) 14%, transparent);
        border-radius: 16px;
        padding: 18px;
        display: grid;
        gap: 14px;
        box-shadow: 0 12px 32px color-mix(in srgb, black 25%, transparent);
    }

    .krt-testimonials__quote {
        margin: 0;
        color: color-mix(in srgb, var(--krt-testimonial-text) 85%, transparent);
        line-height: 1.6;
    }

    .krt-testimonials__meta {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .krt-testimonials__avatar {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--krt-testimonial-accent), color-mix(in srgb, var(--krt-testimonial-accent) 30%, #0b1224));
    }

    .krt-testimonials__name {
        margin: 0;
        font-weight: 700;
    }

    .krt-testimonials__title {
        margin: 0;
        color: color-mix(in srgb, var(--krt-testimonial-text) 75%, transparent);
        font-size: 0.95rem;
    }

    .krt-testimonials__drawer {
        display: grid;
        gap: 14px;
        min-width: 280px;
    }

    .krt-testimonials__section {
        display: grid;
        gap: 10px;
    }

    .krt-testimonials__grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 10px;
    }

    .krt-testimonials__field {
        display: grid;
        gap: 4px;
        font-size: 0.9rem;
    }

    .krt-testimonials__field input[type='color'] {
        width: 100%;
        height: 36px;
        border-radius: 10px;
        border: 1px solid #e2e8f0;
    }
</style>
