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

    interface FAQItem {
        question: string;
        answer: string;
    }

    interface Props {
        id?: string;
        type?: string;
        eyebrow?: string;
        heading?: string;
        faqs?: FAQItem[];
        metadata?: {
            backgroundColor?: string;
            borderColor?: string;
            textColor?: string;
            layout?: Partial<SectionLayout>;
        };
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        type = 'faq',
        eyebrow = $bindable('Support'),
        heading = $bindable('Frequently asked questions'),
        faqs = $bindable<FAQItem[]>([
            {
                question: 'Do you offer customer support?',
                answer: 'Absolutely. Our team is available 24/7 by chat and email for all plans.'
            },
            {
                question: 'Can I upgrade later?',
                answer: 'Yes, plans can be upgraded at any time and prorated automatically.'
            },
            {
                question: 'Is there a free trial?',
                answer: 'We include a 14-day trial on every new workspace so you can test everything.'
            }
        ]),
        metadata = $bindable({
            backgroundColor: '#0f172a',
            borderColor: '#1e293b',
            textColor: '#e2e8f0',
            layout: { ...DEFAULT_SECTION_LAYOUT }
        }),
        editable = true
    }: Props = $props();

    let openIndex = $state(0);
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
        `--krt-faq-bg: ${metadata.backgroundColor}; --krt-faq-border: ${metadata.borderColor}; --krt-faq-text: ${metadata.textColor}; ${sectionLayoutStyles}`
    );

    const content = $derived({ id, type, eyebrow, heading, faqs, metadata: { ...metadata } });

    const toggle = (index: number) => {
        openIndex = openIndex === index ? -1 : index;
    };

    onMount(() => {
        if (!editable) return;
        mounted = true;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
        return () => blockRegistry.unregister(componentRef);
    });
</script>

{#if editable}
    <div class="editor-item krt-faq" bind:this={component} style={layoutStyle}>
        {#if mounted}
            <BlockActions id={id} type={type} element={component} inspectorTitle="FAQ settings">
                {#snippet inspector()}
                    <div class="krt-faq__drawer">
                        <section class="krt-faq__section">
                            <h3>Section Layout</h3>
                            <SectionLayoutControls bind:layout={sectionLayout} />
                        </section>

                        <section class="krt-faq__section">
                            <h3>Colors</h3>
                            <div class="krt-faq__grid">
                                <label class="krt-faq__field">
                                    <span>Background</span>
                                    <input type="color" bind:value={metadata.backgroundColor} />
                                </label>
                                <label class="krt-faq__field">
                                    <span>Border</span>
                                    <input type="color" bind:value={metadata.borderColor} />
                                </label>
                                <label class="krt-faq__field">
                                    <span>Text</span>
                                    <input type="color" bind:value={metadata.textColor} />
                                </label>
                            </div>
                        </section>
                    </div>
                {/snippet}
            </BlockActions>
        {/if}
        <div id={`metadata-${id}`} style="display: none;">{JSON.stringify(content)}</div>
        <div class="krt-faq__inner">
            <div class="krt-faq__header">
                <p class="krt-faq__eyebrow" contenteditable bind:innerHTML={eyebrow}></p>
                <h2 class="krt-faq__heading" contenteditable bind:innerHTML={heading}></h2>
            </div>
            <div class="krt-faq__list">
                {#each faqs as faq, index}
                    <article class={`krt-faq__item ${openIndex === index ? 'krt-faq__item--open' : ''}`}>
                        <button class="krt-faq__question" type="button" on:click={() => toggle(index)}>
                            <span contenteditable bind:innerHTML={faqs[index].question}></span>
                            <span aria-hidden="true">{openIndex === index ? '−' : '+'}</span>
                        </button>
                        <div class="krt-faq__answer">
                            <p contenteditable bind:innerHTML={faqs[index].answer}></p>
                        </div>
                    </article>
                {/each}
            </div>
        </div>
    </div>
{:else}
    <section class="krt-faq" id={id} data-type={type} style={layoutStyle}>
        <div class="krt-faq__inner">
            <div class="krt-faq__header">
                <p class="krt-faq__eyebrow">{@html eyebrow}</p>
                <h2 class="krt-faq__heading">{@html heading}</h2>
            </div>
            <div class="krt-faq__list">
                {#each faqs as faq, index}
                    <article class={`krt-faq__item ${openIndex === index ? 'krt-faq__item--open' : ''}`}>
                        <button class="krt-faq__question" type="button" on:click={() => toggle(index)}>
                            <span>{@html faq.question}</span>
                            <span aria-hidden="true">{openIndex === index ? '−' : '+'}</span>
                        </button>
                        {#if openIndex === index}
                            <div class="krt-faq__answer">
                                <p>{@html faq.answer}</p>
                            </div>
                        {/if}
                    </article>
                {/each}
            </div>
        </div>
    </section>
{/if}

<style>
    .krt-faq {
        width: 100%;
        max-width: var(--section-max-width, 100%);
        margin-inline: auto;
        background: var(--krt-faq-bg);
        color: var(--krt-faq-text);
        border-radius: var(--section-border-radius, 20px);
        padding-inline: var(--section-padding-x, 32px);
        padding-block: var(--section-padding-y, 32px);
        border: 1px solid var(--krt-faq-border);
    }

    .krt-faq__inner {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .krt-faq__header {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .krt-faq__eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.75rem;
        color: color-mix(in srgb, var(--krt-faq-text) 70%, transparent);
    }

    .krt-faq__heading {
        margin: 0;
        font-size: 1.7rem;
        line-height: 1.3;
    }

    .krt-faq__list {
        display: grid;
        gap: 12px;
    }

    .krt-faq__item {
        border: 1px solid var(--krt-faq-border);
        border-radius: 14px;
        overflow: hidden;
        background: color-mix(in srgb, var(--krt-faq-bg) 90%, black 10%);
    }

    .krt-faq__question {
        width: 100%;
        background: transparent;
        color: inherit;
        padding: 14px 16px;
        border: none;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        cursor: pointer;
        font-size: 1rem;
        font-weight: 600;
    }

    .krt-faq__question span[aria-hidden] {
        font-size: 1.4rem;
    }

    .krt-faq__answer {
        padding: 0 16px 14px;
        color: color-mix(in srgb, var(--krt-faq-text) 78%, transparent);
        line-height: 1.6;
    }

    .krt-faq__drawer {
        display: grid;
        gap: 16px;
        min-width: 280px;
    }

    .krt-faq__section {
        display: grid;
        gap: 10px;
    }

    .krt-faq__grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 10px;
    }

    .krt-faq__field {
        display: grid;
        gap: 4px;
        font-size: 0.9rem;
    }

    .krt-faq__field input[type='color'] {
        width: 100%;
        height: 36px;
        border-radius: 10px;
        border: 1px solid #e2e8f0;
    }
</style>
