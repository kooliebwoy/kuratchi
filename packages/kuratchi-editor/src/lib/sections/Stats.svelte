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

    interface StatItem {
        label: string;
        value: string;
        description?: string;
    }

    interface Props {
        id?: string;
        type?: string;
        eyebrow?: string;
        heading?: string;
        stats?: StatItem[];
        metadata?: {
            backgroundColor?: string;
            textColor?: string;
            accentColor?: string;
            layout?: Partial<SectionLayout>;
        };
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        type = 'stats',
        eyebrow = $bindable('Overview'),
        heading = $bindable('Key metrics'),
        stats = $bindable<StatItem[]>([
            { label: 'Active users', value: '12.4k', description: 'up 18% this month' },
            { label: 'Conversion rate', value: '4.2%', description: 'steady performance' },
            { label: 'Avg. response', value: '1m 14s', description: 'support team median' },
            { label: 'Retention', value: '92%', description: 'customers coming back' }
        ]),
        metadata = $bindable({
            backgroundColor: '#0b1224',
            textColor: '#e2e8f0',
            accentColor: '#7c3aed',
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
        `--krt-stats-bg: ${metadata.backgroundColor}; --krt-stats-text: ${metadata.textColor}; --krt-stats-accent: ${metadata.accentColor}; ${sectionLayoutStyles}`
    );

    const content = $derived({ id, type, eyebrow, heading, stats, metadata: { ...metadata } });

    onMount(() => {
        if (!editable) return;
        mounted = true;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
        return () => blockRegistry.unregister(componentRef);
    });
</script>

{#if editable}
    <div class="editor-item krt-stats" bind:this={component} style={layoutStyle}>
        {#if mounted}
            <BlockActions id={id} type={type} element={component} inspectorTitle="Stats settings">
                {#snippet inspector()}
                    <div class="krt-stats__drawer">
                        <section class="krt-stats__drawerSection">
                            <h3>Section Layout</h3>
                            <SectionLayoutControls bind:layout={sectionLayout} />
                        </section>

                        <section class="krt-stats__drawerSection">
                            <h3>Colors</h3>
                            <div class="krt-stats__drawerGrid">
                                <label class="krt-stats__field">
                                    <span>Background</span>
                                    <input type="color" bind:value={metadata.backgroundColor} />
                                </label>
                                <label class="krt-stats__field">
                                    <span>Text</span>
                                    <input type="color" bind:value={metadata.textColor} />
                                </label>
                                <label class="krt-stats__field">
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
        <div class="krt-stats__inner">
            <div class="krt-stats__header">
                <p class="krt-stats__eyebrow" contenteditable bind:innerHTML={eyebrow}></p>
                <h2 class="krt-stats__heading" contenteditable bind:innerHTML={heading}></h2>
            </div>
            <div class="krt-stats__grid">
                {#each stats as stat, index}
                    <article class="krt-stats__card">
                        <p class="krt-stats__value" contenteditable bind:innerHTML={stats[index].value}></p>
                        <p class="krt-stats__label" contenteditable bind:innerHTML={stats[index].label}></p>
                        {#if stat.description}
                            <p class="krt-stats__description" contenteditable bind:innerHTML={stats[index].description}></p>
                        {/if}
                    </article>
                {/each}
            </div>
        </div>
    </div>
{:else}
    <section class="krt-stats" id={id} data-type={type} style={layoutStyle}>
        <div class="krt-stats__inner">
            <div class="krt-stats__header">
                <p class="krt-stats__eyebrow">{@html eyebrow}</p>
                <h2 class="krt-stats__heading">{@html heading}</h2>
            </div>
            <div class="krt-stats__grid">
                {#each stats as stat}
                    <article class="krt-stats__card">
                        <p class="krt-stats__value">{@html stat.value}</p>
                        <p class="krt-stats__label">{@html stat.label}</p>
                        {#if stat.description}
                            <p class="krt-stats__description">{@html stat.description}</p>
                        {/if}
                    </article>
                {/each}
            </div>
        </div>
    </section>
{/if}

<style>
    .krt-stats {
        width: 100%;
        max-width: var(--section-max-width, 100%);
        margin-inline: auto;
        background: var(--krt-stats-bg);
        color: var(--krt-stats-text);
        border-radius: var(--section-border-radius, 20px);
        padding-inline: var(--section-padding-x, 32px);
        padding-block: var(--section-padding-y, 32px);
    }

    .krt-stats__inner {
        display: flex;
        flex-direction: column;
        gap: 24px;
    }

    .krt-stats__header {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .krt-stats__eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.75rem;
        color: color-mix(in srgb, var(--krt-stats-text) 70%, transparent);
    }

    .krt-stats__heading {
        margin: 0;
        font-size: 1.8rem;
        line-height: 1.2;
    }

    .krt-stats__grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 16px;
    }

    .krt-stats__card {
        border: 1px solid color-mix(in srgb, var(--krt-stats-text) 20%, transparent);
        border-radius: 16px;
        padding: 16px;
        background: color-mix(in srgb, var(--krt-stats-bg) 85%, black 15%);
    }

    .krt-stats__value {
        font-size: 1.6rem;
        font-weight: 700;
        margin: 0 0 4px;
        color: var(--krt-stats-text);
    }

    .krt-stats__label {
        margin: 0 0 6px;
        color: color-mix(in srgb, var(--krt-stats-text) 85%, transparent);
    }

    .krt-stats__description {
        margin: 0;
        font-size: 0.9rem;
        color: color-mix(in srgb, var(--krt-stats-text) 70%, transparent);
    }

    .krt-stats__drawer {
        display: grid;
        gap: 16px;
        min-width: 280px;
    }

    .krt-stats__drawerSection {
        display: grid;
        gap: 12px;
    }

    .krt-stats__drawerGrid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 12px;
    }

    .krt-stats__field {
        display: grid;
        gap: 4px;
        font-size: 0.9rem;
    }

    .krt-stats__field input[type='color'] {
        width: 100%;
        height: 36px;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
    }
</style>
