<script lang="ts">
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
    import { BlockActions } from '../utils/index.js';
    import { onMount } from 'svelte';

    interface FeatureItem {
        title: string;
        description: string;
        badge?: string;
    }

    interface Props {
        id?: string;
        type?: string;
        eyebrow?: string;
        heading?: string;
        subheading?: string;
        features?: FeatureItem[];
        metadata?: {
            backgroundColor?: string;
            cardColor?: string;
            accentColor?: string;
            textColor?: string;
        };
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        type = 'feature-showcase',
        eyebrow = $bindable('Features'),
        heading = $bindable('Everything you need to move faster'),
        subheading = $bindable('Launch memorable pages with modular blocks, built-in content controls, and flexible styling.'),
        features = $bindable<FeatureItem[]>([
            { title: 'Flexible layouts', description: 'Grid, columns, cards, and sliders that adapt responsively.' },
            { title: 'Content controls', description: 'Inline editing with guardrails so teams keep copy on-brand.', badge: 'New' },
            { title: 'Media ready', description: 'Drop in product shots, hero art, or iconography in seconds.' },
            { title: 'Collaboration', description: 'Share drafts, gather feedback, and publish with confidence.' }
        ]),
        metadata = $bindable({
            backgroundColor: '#0b1224',
            cardColor: '#10172f',
            accentColor: '#22c55e',
            textColor: '#e2e8f0'
        }),
        editable = true
    }: Props = $props();

    let component = $state<HTMLElement>();
    const componentRef = {};
    let mounted = $state(false);

    const layoutStyle = $derived(
        `--krt-features-bg: ${metadata.backgroundColor}; --krt-features-card: ${metadata.cardColor}; --krt-features-accent: ${metadata.accentColor}; --krt-features-text: ${metadata.textColor};`
    );

    const content = $derived({ id, type, eyebrow, heading, subheading, features, metadata: { ...metadata } });

    onMount(() => {
        if (!editable) return;
        mounted = true;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
        return () => blockRegistry.unregister(componentRef);
    });
</script>

{#if editable}
    <div class="editor-item krt-featureShowcase" bind:this={component} style={layoutStyle}>
        {#if mounted}
            <BlockActions id={id} type={type} element={component} inspectorTitle="Feature showcase settings">
                {#snippet inspector()}
                    <div class="krt-featureShowcase__drawer">
                        <section class="krt-featureShowcase__section">
                            <h3>Colors</h3>
                            <div class="krt-featureShowcase__grid">
                                <label class="krt-featureShowcase__field">
                                    <span>Background</span>
                                    <input type="color" bind:value={metadata.backgroundColor} />
                                </label>
                                <label class="krt-featureShowcase__field">
                                    <span>Cards</span>
                                    <input type="color" bind:value={metadata.cardColor} />
                                </label>
                                <label class="krt-featureShowcase__field">
                                    <span>Accent</span>
                                    <input type="color" bind:value={metadata.accentColor} />
                                </label>
                                <label class="krt-featureShowcase__field">
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
        <div class="krt-featureShowcase__inner">
            <div class="krt-featureShowcase__header">
                <p class="krt-featureShowcase__eyebrow" contenteditable bind:innerHTML={eyebrow}></p>
                <h2 class="krt-featureShowcase__title" contenteditable bind:innerHTML={heading}></h2>
                <p class="krt-featureShowcase__subtitle" contenteditable bind:innerHTML={subheading}></p>
            </div>
            <div class="krt-featureShowcase__gridCards">
                {#each features as feature, index}
                    <article class="krt-featureShowcase__card">
                        <div class="krt-featureShowcase__cardHeader">
                            <div class="krt-featureShowcase__badge" aria-hidden="true"></div>
                            {#if feature.badge}
                                <span class="krt-featureShowcase__pill" contenteditable bind:innerHTML={features[index].badge}></span>
                            {/if}
                        </div>
                        <h3 class="krt-featureShowcase__cardTitle" contenteditable bind:innerHTML={features[index].title}></h3>
                        <p class="krt-featureShowcase__cardBody" contenteditable bind:innerHTML={features[index].description}></p>
                    </article>
                {/each}
            </div>
        </div>
    </div>
{:else}
    <section class="krt-featureShowcase" id={id} data-type={type} style={layoutStyle}>
        <div class="krt-featureShowcase__inner">
            <div class="krt-featureShowcase__header">
                <p class="krt-featureShowcase__eyebrow">{@html eyebrow}</p>
                <h2 class="krt-featureShowcase__title">{@html heading}</h2>
                <p class="krt-featureShowcase__subtitle">{@html subheading}</p>
            </div>
            <div class="krt-featureShowcase__gridCards">
                {#each features as feature}
                    <article class="krt-featureShowcase__card">
                        <div class="krt-featureShowcase__cardHeader">
                            <div class="krt-featureShowcase__badge" aria-hidden="true"></div>
                            {#if feature.badge}
                                <span class="krt-featureShowcase__pill">{@html feature.badge}</span>
                            {/if}
                        </div>
                        <h3 class="krt-featureShowcase__cardTitle">{@html feature.title}</h3>
                        <p class="krt-featureShowcase__cardBody">{@html feature.description}</p>
                    </article>
                {/each}
            </div>
        </div>
    </section>
{/if}

<style>
    .krt-featureShowcase {
        width: 100%;
        background: var(--krt-features-bg);
        color: var(--krt-features-text);
        border-radius: 24px;
        padding: 48px 40px;
    }

    .krt-featureShowcase__inner {
        display: flex;
        flex-direction: column;
        gap: 28px;
    }

    .krt-featureShowcase__header {
        display: grid;
        gap: 10px;
        max-width: 720px;
    }

    .krt-featureShowcase__eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.8rem;
        color: color-mix(in srgb, var(--krt-features-text) 70%, transparent);
    }

    .krt-featureShowcase__title {
        margin: 0;
        font-size: 2rem;
        line-height: 1.2;
    }

    .krt-featureShowcase__subtitle {
        margin: 0;
        color: color-mix(in srgb, var(--krt-features-text) 80%, transparent);
        line-height: 1.5;
        font-size: 1.05rem;
    }

    .krt-featureShowcase__gridCards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
    }

    .krt-featureShowcase__card {
        background: var(--krt-features-card);
        border: 1px solid color-mix(in srgb, var(--krt-features-text) 18%, transparent);
        border-radius: 18px;
        padding: 18px;
        display: grid;
        gap: 10px;
        box-shadow: 0 16px 40px color-mix(in srgb, black 30%, transparent);
    }

    .krt-featureShowcase__cardHeader {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .krt-featureShowcase__badge {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--krt-features-accent);
    }

    .krt-featureShowcase__pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--krt-features-accent) 30%, transparent);
        color: var(--krt-features-text);
        font-size: 0.8rem;
        border: 1px solid var(--krt-features-accent);
    }

    .krt-featureShowcase__cardTitle {
        margin: 0;
        font-size: 1.15rem;
    }

    .krt-featureShowcase__cardBody {
        margin: 0;
        color: color-mix(in srgb, var(--krt-features-text) 78%, transparent);
        line-height: 1.5;
    }

    .krt-featureShowcase__drawer {
        display: grid;
        gap: 16px;
        min-width: 300px;
    }

    .krt-featureShowcase__section {
        display: grid;
        gap: 10px;
    }

    .krt-featureShowcase__grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 10px;
    }

    .krt-featureShowcase__field {
        display: grid;
        gap: 4px;
        font-size: 0.9rem;
    }

    .krt-featureShowcase__field input[type='color'] {
        width: 100%;
        height: 36px;
        border-radius: 10px;
        border: 1px solid #e2e8f0;
    }
</style>
