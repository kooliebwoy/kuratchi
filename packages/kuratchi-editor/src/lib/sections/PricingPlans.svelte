<script lang="ts">
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
    import { BlockActions } from '../utils/index.js';
    import { onMount } from 'svelte';

    interface PlanFeature {
        label: string;
    }

    interface PlanItem {
        name: string;
        price: string;
        cadence: string;
        description: string;
        features: PlanFeature[];
        highlighted?: boolean;
    }

    interface Props {
        id?: string;
        type?: string;
        eyebrow?: string;
        heading?: string;
        subheading?: string;
        plans?: PlanItem[];
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
        type = 'pricing-plans',
        heading = $bindable('Simple plans for every team'),
        subheading = $bindable('Choose the plan that fits your workflow. Upgrade or downgrade anytime.'),
        plans = $bindable<PlanItem[]>([
            {
                name: 'Starter',
                price: '$19',
                cadence: '/month',
                description: 'Launch your first pages with core building blocks.',
                features: [
                    { label: 'Unlimited pages' },
                    { label: 'Brand color controls' },
                    { label: 'Basic analytics' }
                ]
            },
            {
                name: 'Growth',
                price: '$49',
                cadence: '/month',
                description: 'For teams shipping campaigns and collaborating often.',
                highlighted: true,
                features: [
                    { label: 'Advanced editor access' },
                    { label: 'Collaboration tools' },
                    { label: 'Priority support' }
                ]
            },
            {
                name: 'Enterprise',
                price: 'Let’s talk',
                cadence: '',
                description: 'Security reviews, SSO, and a dedicated success manager.',
                features: [
                    { label: 'Custom contracts' },
                    { label: 'SSO & audit logs' },
                    { label: 'Dedicated onboarding' }
                ]
            }
        ]),
        metadata = $bindable({
            backgroundColor: '#0f172a',
            cardColor: '#0b1224',
            accentColor: '#22d3ee',
            textColor: '#e2e8f0'
        }),
        editable = true
    }: Props = $props();

    let component = $state<HTMLElement>();
    const componentRef = {};
    let mounted = $state(false);

    const layoutStyle = $derived(
        `--krt-pricing-bg: ${metadata.backgroundColor}; --krt-pricing-card: ${metadata.cardColor}; --krt-pricing-accent: ${metadata.accentColor}; --krt-pricing-text: ${metadata.textColor};`
    );

    const content = $derived({ id, type, eyebrow, heading, subheading, plans, metadata: { ...metadata } });

    onMount(() => {
        if (!editable) return;
        mounted = true;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
        return () => blockRegistry.unregister(componentRef);
    });
</script>

{#if editable}
    <div class="editor-item krt-pricing" bind:this={component} style={layoutStyle}>
        {#if mounted}
            <BlockActions id={id} type={type} element={component} inspectorTitle="Pricing settings">
                {#snippet inspector()}
                    <div class="krt-pricing__drawer">
                        <section class="krt-pricing__section">
                            <h3>Colors</h3>
                            <div class="krt-pricing__grid">
                                <label class="krt-pricing__field">
                                    <span>Background</span>
                                    <input type="color" bind:value={metadata.backgroundColor} />
                                </label>
                                <label class="krt-pricing__field">
                                    <span>Cards</span>
                                    <input type="color" bind:value={metadata.cardColor} />
                                </label>
                                <label class="krt-pricing__field">
                                    <span>Accent</span>
                                    <input type="color" bind:value={metadata.accentColor} />
                                </label>
                                <label class="krt-pricing__field">
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
        <div class="krt-pricing__inner">
            <div class="krt-pricing__header">
                <p class="krt-pricing__eyebrow" contenteditable bind:innerHTML={eyebrow}></p>
                <h2 class="krt-pricing__title" contenteditable bind:innerHTML={heading}></h2>
                <p class="krt-pricing__subtitle" contenteditable bind:innerHTML={subheading}></p>
            </div>
            <div class="krt-pricing__plans">
                {#each plans as plan, index}
                    <article class={`krt-pricing__card ${plan.highlighted ? 'krt-pricing__card--highlight' : ''}`}>
                        <div class="krt-pricing__cardHeader">
                            <h3 contenteditable bind:innerHTML={plans[index].name}></h3>
                            <p class="krt-pricing__price">
                                <span contenteditable bind:innerHTML={plans[index].price}></span>
                                <small contenteditable bind:innerHTML={plans[index].cadence}></small>
                            </p>
                        </div>
                        <p class="krt-pricing__description" contenteditable bind:innerHTML={plans[index].description}></p>
                        <ul class="krt-pricing__features">
                            {#each plan.features as feature, featureIndex}
                                <li contenteditable bind:innerHTML={plans[index].features[featureIndex].label}></li>
                            {/each}
                        </ul>
                        <button class="krt-pricing__cta" type="button">Choose plan</button>
                    </article>
                {/each}
            </div>
        </div>
    </div>
{:else}
    <section class="krt-pricing" id={id} data-type={type} style={layoutStyle}>
        <div class="krt-pricing__inner">
            <div class="krt-pricing__header">
                <p class="krt-pricing__eyebrow">{@html eyebrow}</p>
                <h2 class="krt-pricing__title">{@html heading}</h2>
                <p class="krt-pricing__subtitle">{@html subheading}</p>
            </div>
            <div class="krt-pricing__plans">
                {#each plans as plan}
                    <article class={`krt-pricing__card ${plan.highlighted ? 'krt-pricing__card--highlight' : ''}`}>
                        <div class="krt-pricing__cardHeader">
                            <h3>{@html plan.name}</h3>
                            <p class="krt-pricing__price">
                                <span>{@html plan.price}</span>
                                <small>{@html plan.cadence}</small>
                            </p>
                        </div>
                        <p class="krt-pricing__description">{@html plan.description}</p>
                        <ul class="krt-pricing__features">
                            {#each plan.features as feature}
                                <li>{@html feature.label}</li>
                            {/each}
                        </ul>
                        <button class="krt-pricing__cta" type="button">Choose plan</button>
                    </article>
                {/each}
            </div>
        </div>
    </section>
{/if}

<style>
    .krt-pricing {
        width: 100%;
        background: var(--krt-pricing-bg);
        color: var(--krt-pricing-text);
        border-radius: 24px;
        padding: 48px 40px;
    }

    .krt-pricing__inner {
        display: flex;
        flex-direction: column;
        gap: 26px;
    }

    .krt-pricing__header {
        display: grid;
        gap: 10px;
        max-width: 720px;
    }

    .krt-pricing__eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.82rem;
        color: color-mix(in srgb, var(--krt-pricing-text) 68%, transparent);
    }

    .krt-pricing__title {
        margin: 0;
        font-size: 2rem;
        line-height: 1.2;
    }

    .krt-pricing__subtitle {
        margin: 0;
        color: color-mix(in srgb, var(--krt-pricing-text) 80%, transparent);
        line-height: 1.5;
    }

    .krt-pricing__plans {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 16px;
    }

    .krt-pricing__card {
        background: var(--krt-pricing-card);
        border: 1px solid color-mix(in srgb, var(--krt-pricing-text) 18%, transparent);
        border-radius: 18px;
        padding: 18px;
        display: grid;
        gap: 12px;
    }

    .krt-pricing__card--highlight {
        border-color: var(--krt-pricing-accent);
        box-shadow: 0 18px 38px color-mix(in srgb, var(--krt-pricing-accent) 25%, transparent);
    }

    .krt-pricing__cardHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .krt-pricing__price {
        margin: 0;
        display: flex;
        align-items: baseline;
        gap: 6px;
        font-size: 1.5rem;
        font-weight: 700;
    }

    .krt-pricing__price small {
        color: color-mix(in srgb, var(--krt-pricing-text) 75%, transparent);
        font-weight: 500;
    }

    .krt-pricing__description {
        margin: 0;
        color: color-mix(in srgb, var(--krt-pricing-text) 80%, transparent);
    }

    .krt-pricing__features {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 8px;
        color: color-mix(in srgb, var(--krt-pricing-text) 85%, transparent);
    }

    .krt-pricing__cta {
        background: var(--krt-pricing-accent);
        color: #0b1224;
        border: none;
        padding: 12px 14px;
        border-radius: 12px;
        font-weight: 700;
        cursor: pointer;
    }

    .krt-pricing__drawer {
        display: grid;
        gap: 14px;
        min-width: 300px;
    }

    .krt-pricing__section {
        display: grid;
        gap: 10px;
    }

    .krt-pricing__grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 10px;
    }

    .krt-pricing__field {
        display: grid;
        gap: 4px;
        font-size: 0.9rem;
    }

    .krt-pricing__field input[type='color'] {
        width: 100%;
        height: 36px;
        border-radius: 10px;
        border: 1px solid #e2e8f0;
    }
</style>
