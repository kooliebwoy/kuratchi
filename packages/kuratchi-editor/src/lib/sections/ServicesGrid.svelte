<script lang="ts">
    import { Plus, ArrowUp, ArrowDown, Trash2 } from '@lucide/svelte';
    import { onMount } from 'svelte';
    import { Pencil } from 'lucide-svelte';
    import { BlockActions, SideActions } from '../shell/index.js';
    import { LucideIconMap, type LucideIconKey } from '../utils/lucide-icons.js';

    type ServicesSpacing = 'small' | 'medium' | 'large';

    interface ServiceItem {
        title: string;
        description: string;
        icon?: LucideIconKey;
    }

    interface StylingOptions {
        backgroundColor: string;
        textColor: string;
        columns: number;
        spacing: ServicesSpacing;
    }

    interface Metadata {
        title: string;
        subtitle: string;
        services: ServiceItem[];
        styling: StylingOptions;
    }

    interface Props {
        id?: string;
        type?: string;
        metadata?: Metadata;
        editable?: boolean;
    }

    const spacingGapMap: Record<ServicesSpacing, string> = {
        small: '1.25rem',
        medium: '1.75rem',
        large: '2.5rem'
    };

    let {
        id = crypto.randomUUID(),
        type = 'services-grid',
        metadata: layoutMetadata = $bindable<Metadata>({
            title: 'Our services',
            subtitle: 'A partner across strategy, design, and execution.',
            services: [
                {
                    title: 'Brand strategy',
                    description: 'Define a cohesive story, positioning, and vernacular that resonates with your audience.',
                    icon: 'badgeDollarSign'
                },
                {
                    title: 'Product design',
                    description: 'Craft thoughtful product flows and interface systems tuned for clarity and conversion.',
                    icon: 'star'
                },
                {
                    title: 'Web development',
                    description: 'Ship resilient experiences with scalable architectures, performance budgets, and accessibility baked in.',
                    icon: 'truck'
                }
            ],
            styling: {
                backgroundColor: '#f8fafc',
                textColor: '#0f172a',
                columns: 3,
                spacing: 'large'
            }
        }),
        editable = true
    }: Props = $props();

    $effect(() => {
        layoutMetadata.title ??= 'Our services';
        layoutMetadata.subtitle ??= '';
        layoutMetadata.services ??= [];
        layoutMetadata.styling ??= {
            backgroundColor: '#f8fafc',
            textColor: '#0f172a',
            columns: 3,
            spacing: 'large'
        };
        layoutMetadata.styling.backgroundColor ??= '#f8fafc';
        layoutMetadata.styling.textColor ??= '#0f172a';
        layoutMetadata.styling.columns ??= 3;
        layoutMetadata.styling.spacing ??= 'large';
    });

    let title = $state(layoutMetadata.title ?? '');
    let subtitle = $state(layoutMetadata.subtitle ?? '');
    let services = $state(layoutMetadata.services ?? []);
    let backgroundColor = $state(layoutMetadata.styling.backgroundColor);
    let textColor = $state(layoutMetadata.styling.textColor);
    let columns = $state(layoutMetadata.styling.columns);
    let spacing = $state(layoutMetadata.styling.spacing);

    $effect(() => {
        layoutMetadata.title = title;
        layoutMetadata.subtitle = subtitle;
        layoutMetadata.services = services;
        layoutMetadata.styling.backgroundColor = backgroundColor;
        layoutMetadata.styling.textColor = textColor;
        layoutMetadata.styling.columns = columns;
        layoutMetadata.styling.spacing = spacing;
    });

    const normalizedServices = $derived(
        services.map((service) => ({
            title: service?.title?.trim() ?? '',
            description: service?.description?.trim() ?? '',
            icon: service?.icon
        }))
    );

    const layoutStyle = $derived(
        `--krt-servicesGrid-bg: ${backgroundColor}; --krt-servicesGrid-text: ${textColor}; --krt-servicesGrid-columns: ${Math.min(
            Math.max(columns, 1),
            4
        )}; --krt-servicesGrid-gap: ${spacingGapMap[spacing] ?? spacingGapMap.large};`
    );

    const content = $derived({
        id,
        type,
        metadata: layoutMetadata
    });

    function addService() {
        services = [
            ...services,
            {
                title: 'New service',
                description: 'Describe the value clients receive here.',
                icon: 'star'
            }
        ];
    }

    function removeService(index: number) {
        services = services.filter((_, i) => i !== index);
    }

    function moveService(index: number, direction: 'up' | 'down') {
        const nextIndex = direction === 'up' ? index - 1 : index + 1;
        if (nextIndex < 0 || nextIndex >= services.length) return;
        const next = [...services];
        [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
        services = next;
    }

    function updateService(index: number, key: keyof ServiceItem, value: string) {
        const next = [...services];
        next[index] = {
            ...next[index],
            [key]: value
        };
        services = next;
    }

    let component: HTMLElement;
    let mounted = $state(false);
    const sideActionsId = `side-actions-${id}`;

    onMount(() => {
        mounted = true;
    });
</script>

{#if editable}
<div class="editor-item" bind:this={component}>
    {#if mounted}
        <BlockActions {id} {type} element={component} />
    {/if}
    <section {id} data-type={type} class="krt-servicesGrid" style={layoutStyle}>
        <div class="krt-servicesGrid__metadata">{JSON.stringify(content)}</div>
        <div class="krt-servicesGrid__container">
            {#if title || subtitle}
                <header class="krt-servicesGrid__header">
                    {#if title}
                        <h2 class="krt-servicesGrid__title" style:color={textColor} contenteditable bind:innerHTML={title}></h2>
                    {/if}
                    {#if subtitle}
                        <p class="krt-servicesGrid__subtitle" style:color={textColor} contenteditable bind:innerHTML={subtitle}></p>
                    {/if}
                </header>
            {/if}

            <div class="krt-servicesGrid__list">
                {#each services as service, index (index)}
                    <article class="krt-servicesGrid__item" style:color={textColor}>
                        {#if service.icon}
                            {@const Comp = LucideIconMap[service.icon as LucideIconKey]}
                            <div class="krt-servicesGrid__icon" aria-hidden="true">
                                <Comp />
                            </div>
                        {/if}
                        <h3 class="krt-servicesGrid__itemTitle" contenteditable bind:innerHTML={service.title}></h3>
                        <p class="krt-servicesGrid__itemBody" contenteditable bind:innerHTML={service.description}></p>
                    </article>
                {/each}
            </div>
        </div>
    </section>
</div>

<SideActions triggerId={sideActionsId}>
    {#snippet label()}
        <button id={sideActionsId} class="krt-editButton" aria-label="Edit services grid settings">
            <Pencil size={16} />
            <span>Edit Settings</span>
        </button>
    {/snippet}
    {#snippet content()}
        <div class="krt-servicesGridDrawer">
            <section class="krt-servicesGridDrawer__section">
                <h3>Intro</h3>
                <div class="krt-servicesGridDrawer__fields">
                    <label class="krt-servicesGridDrawer__field">
                        <span>Title</span>
                        <input type="text" bind:value={title} placeholder="Our services" />
                    </label>
                    <label class="krt-servicesGridDrawer__field">
                        <span>Subtitle</span>
                        <textarea rows="3" bind:value={subtitle} placeholder="Add an optional supporting line"></textarea>
                    </label>
                </div>
            </section>

            <section class="krt-servicesGridDrawer__section">
                <div class="krt-servicesGridDrawer__sectionHeader">
                    <h3>Services</h3>
                    <button type="button" class="krt-servicesGridDrawer__action" onclick={addService}>
                        <Plus aria-hidden="true" />
                        <span>Add service</span>
                    </button>
                </div>

                <div class="krt-servicesGridDrawer__list">
                    {#each services as service, index (index)}
                        <article class="krt-servicesGridDrawer__card">
                            <header class="krt-servicesGridDrawer__cardHeader">
                                <span>Service {index + 1}</span>
                                <div class="krt-servicesGridDrawer__cardControls">
                                    <button type="button" onclick={() => moveService(index, 'up')} disabled={index === 0}>
                                        <ArrowUp aria-hidden="true" />
                                        <span class="krt-servicesGridDrawer__sr">Move up</span>
                                    </button>
                                    <button type="button" onclick={() => moveService(index, 'down')} disabled={index === services.length - 1}>
                                        <ArrowDown aria-hidden="true" />
                                        <span class="krt-servicesGridDrawer__sr">Move down</span>
                                    </button>
                                    <button type="button" class="krt-servicesGridDrawer__danger" onclick={() => removeService(index)}>
                                        <Trash2 aria-hidden="true" />
                                        <span class="krt-servicesGridDrawer__sr">Remove service</span>
                                    </button>
                                </div>
                            </header>

                            <div class="krt-servicesGridDrawer__fields">
                                <label class="krt-servicesGridDrawer__field">
                                    <span>Service title</span>
                                    <input
                                        type="text"
                                        value={service.title}
                                        oninput={(event) => updateService(index, 'title', event.currentTarget.value)}
                                        placeholder="Brand strategy"
                                    />
                                </label>

                                <label class="krt-servicesGridDrawer__field">
                                    <span>Description</span>
                                    <textarea
                                        rows="2"
                                        value={service.description}
                                        oninput={(event) => updateService(index, 'description', event.currentTarget.value)}
                                        placeholder="Describe the service offering"
                                    ></textarea>
                                </label>

                                <label class="krt-servicesGridDrawer__field">
                                    <span>Icon (Lucide key)</span>
                                    <input
                                        type="text"
                                        value={service.icon ?? ''}
                                        oninput={(event) => updateService(index, 'icon', event.currentTarget.value)}
                                        placeholder="star"
                                    />
                                </label>
                            </div>
                        </article>
                    {/each}
                </div>
            </section>

            <section class="krt-servicesGridDrawer__section">
                <h3>Layout</h3>
                <div class="krt-servicesGridDrawer__grid">
                    <label class="krt-servicesGridDrawer__field">
                        <span>Columns</span>
                        <select bind:value={columns}>
                            <option value={1}>Single column</option>
                            <option value={2}>Two columns</option>
                            <option value={3}>Three columns</option>
                            <option value={4}>Four columns</option>
                        </select>
                    </label>
                    <label class="krt-servicesGridDrawer__field">
                        <span>Spacing</span>
                        <select bind:value={spacing}>
                            <option value="small">Compact</option>
                            <option value="medium">Comfortable</option>
                            <option value="large">Roomy</option>
                        </select>
                    </label>
                    <label class="krt-servicesGridDrawer__field">
                        <span>Background</span>
                        <input type="color" bind:value={backgroundColor} />
                    </label>
                    <label class="krt-servicesGridDrawer__field">
                        <span>Text</span>
                        <input type="color" bind:value={textColor} />
                    </label>
                </div>
            </section>
        </div>
    {/snippet}
</SideActions>
{:else}
    <section id={id} data-type={type} class="krt-servicesGrid" style={layoutStyle}>
        <div class="krt-servicesGrid__metadata">{JSON.stringify(content)}</div>
        <div class="krt-servicesGrid__container">
            {#if layoutMetadata.title || layoutMetadata.subtitle}
                <header class="krt-servicesGrid__header">
                    {#if layoutMetadata.title}
                        <h2 class="krt-servicesGrid__title" style:color={textColor}>
                            {@html layoutMetadata.title}
                        </h2>
                    {/if}
                    {#if layoutMetadata.subtitle}
                        <div class="krt-servicesGrid__subtitle" style:color={textColor}>
                            {@html layoutMetadata.subtitle}
                        </div>
                    {/if}
                </header>
            {/if}

            <div class="krt-servicesGrid__list">
                {#each normalizedServices as service, index (index)}
                    <article class="krt-servicesGrid__item" style:color={textColor}>
                        {#if service.icon}
                            {@const Comp = LucideIconMap[service.icon as LucideIconKey]}
                            <div class="krt-servicesGrid__icon" aria-hidden="true">
                                <Comp />
                            </div>
                        {/if}
                        {#if service.title}
                            <h3 class="krt-servicesGrid__itemTitle">{service.title}</h3>
                        {/if}
                        {#if service.description}
                            <p class="krt-servicesGrid__itemBody">{service.description}</p>
                        {/if}
                    </article>
                {/each}
            </div>
        </div>
    </section>
{/if}

<style>
    .krt-servicesGrid {
        position: relative;
        isolation: isolate;
        display: block;
        padding: clamp(3rem, 6vw, 6rem) clamp(1.5rem, 5vw, 6rem);
        background: var(--krt-servicesGrid-bg, #f8fafc);
        color: var(--krt-servicesGrid-text, #0f172a);
    }

    .krt-servicesGrid__metadata {
        display: none;
    }

    .krt-servicesGrid__container {
        max-width: min(1080px, 100%);
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: clamp(2rem, 4vw, 3.5rem);
    }

    .krt-servicesGrid__header {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        text-align: center;
        margin: 0 auto;
        max-width: 60ch;
    }

    .krt-servicesGrid__title {
        margin: 0;
        font-size: clamp(2.25rem, 3vw + 1.5rem, 3.5rem);
        font-weight: 750;
        letter-spacing: -0.02em;
    }

    .krt-servicesGrid__subtitle {
        margin: 0 auto;
        font-size: clamp(1rem, 0.4vw + 0.95rem, 1.2rem);
        line-height: 1.75;
        opacity: 0.85;
        max-width: 50ch;
    }

    .krt-servicesGrid__list {
        display: grid;
        gap: var(--krt-servicesGrid-gap, 2rem);
        grid-template-columns: repeat(var(--krt-servicesGrid-columns, 3), minmax(0, 1fr));
    }

    @media (max-width: 900px) {
        .krt-servicesGrid__list {
            grid-template-columns: repeat(min(var(--krt-servicesGrid-columns, 3), 2), minmax(0, 1fr));
        }
    }

    @media (max-width: 640px) {
        .krt-servicesGrid__list {
            grid-template-columns: repeat(1, minmax(0, 1fr));
        }
    }

    .krt-servicesGrid__item {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
        padding: clamp(1.75rem, 1.5rem + 1vw, 2.25rem);
        border-radius: var(--krt-radius-xl, 1.25rem);
        background: color-mix(in srgb, var(--krt-servicesGrid-bg, #f8fafc) 25%, #ffffff);
        box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
        backdrop-filter: blur(6px);
        text-align: left;
        min-height: 100%;
    }

    .krt-servicesGrid__icon {
        width: 3rem;
        height: 3rem;
        border-radius: var(--krt-radius-lg, 0.9rem);
        display: grid;
        place-items: center;
        background: color-mix(in srgb, var(--krt-servicesGrid-text, #0f172a) 18%, transparent);
    }

    .krt-servicesGrid__icon svg {
        width: 1.4rem;
        height: 1.4rem;
        color: color-mix(in srgb, var(--krt-servicesGrid-text, #0f172a) 70%, transparent);
    }

    .krt-servicesGrid__itemTitle {
        margin: 0;
        font-size: 1.35rem;
        font-weight: 650;
        letter-spacing: -0.01em;
    }

    .krt-servicesGrid__itemBody {
        margin: 0;
        font-size: 1rem;
        line-height: 1.7;
        opacity: 0.85;
    }

    .krt-servicesGrid__title,
    .krt-servicesGrid__subtitle,
    .krt-servicesGrid__itemTitle,
    .krt-servicesGrid__itemBody {
        outline: none;
    }

    .krt-servicesGridDrawer {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-lg, 1.1rem);
    }

    .krt-servicesGridDrawer__section {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-md, 0.75rem);
        padding: var(--krt-space-lg, 1rem);
        border-radius: var(--krt-radius-lg, 0.9rem);
        border: 1px solid color-mix(in srgb, var(--krt-color-border, #d1d5db) 78%, transparent);
        background: color-mix(in srgb, var(--krt-color-surface, #ffffff) 94%, transparent);
    }

    .krt-servicesGridDrawer__sectionHeader {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--krt-space-md, 0.75rem);
    }

    .krt-servicesGridDrawer__section h3 {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
        letter-spacing: 0.01em;
    }

    .krt-servicesGridDrawer__fields {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-md, 0.75rem);
    }

    .krt-servicesGridDrawer__grid {
        display: grid;
        gap: var(--krt-space-md, 0.75rem);
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    }

    .krt-servicesGridDrawer__field {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
        font-size: 0.9rem;
        font-weight: 500;
        color: color-mix(in srgb, var(--krt-color-text, #111827) 80%, transparent);
    }

    .krt-servicesGridDrawer__field input[type='text'],
    .krt-servicesGridDrawer__field textarea,
    .krt-servicesGridDrawer__field select,
    .krt-servicesGridDrawer__field input[type='color'] {
        appearance: none;
        width: 100%;
        font: inherit;
        padding: 0.55rem 0.7rem;
        border-radius: var(--krt-radius-md, 0.75rem);
        border: 1px solid color-mix(in srgb, var(--krt-color-border, #d1d5db) 82%, transparent);
        background: color-mix(in srgb, var(--krt-color-surface, #ffffff) 96%, transparent);
        outline: none;
        transition: border-color 120ms ease, box-shadow 120ms ease;
        resize: vertical;
    }

    .krt-servicesGridDrawer__field input[type='color'] {
        min-height: 2.5rem;
        padding: 0.2rem;
    }

    .krt-servicesGridDrawer__field input[type='text']:focus,
    .krt-servicesGridDrawer__field textarea:focus,
    .krt-servicesGridDrawer__field select:focus,
    .krt-servicesGridDrawer__field input[type='color']:focus {
        border-color: color-mix(in srgb, var(--krt-color-primary, #2563eb) 55%, transparent);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--krt-color-primary, #2563eb) 25%, transparent);
    }

    .krt-servicesGridDrawer__action {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.4rem 0.75rem;
        border-radius: var(--krt-radius-pill, 999px);
        border: 1px solid color-mix(in srgb, var(--krt-color-border, #d1d5db) 75%, transparent);
        background: color-mix(in srgb, var(--krt-color-surface, #ffffff) 96%, transparent);
        font-size: 0.88rem;
        font-weight: 600;
        cursor: pointer;
    }

    .krt-servicesGridDrawer__action svg {
        width: 1rem;
        height: 1rem;
    }

    .krt-servicesGridDrawer__list {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-md, 0.75rem);
    }

    .krt-servicesGridDrawer__card {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-md, 0.75rem);
        padding: var(--krt-space-md, 0.85rem);
        border-radius: var(--krt-radius-md, 0.75rem);
        border: 1px solid color-mix(in srgb, var(--krt-color-border, #d1d5db) 80%, transparent);
        background: color-mix(in srgb, var(--krt-color-surface, #ffffff) 96%, transparent);
    }

    .krt-servicesGridDrawer__cardHeader {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--krt-space-sm, 0.5rem);
        font-size: 0.85rem;
        font-weight: 600;
    }

    .krt-servicesGridDrawer__cardControls {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
    }

    .krt-servicesGridDrawer__cardControls button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.9rem;
        height: 1.9rem;
        border-radius: var(--krt-radius-sm, 0.5rem);
        border: 1px solid color-mix(in srgb, var(--krt-color-border, #d1d5db) 70%, transparent);
        background: color-mix(in srgb, var(--krt-color-surface, #ffffff) 94%, transparent);
        cursor: pointer;
    }

    .krt-servicesGridDrawer__cardControls button:disabled {
        opacity: 0.35;
        cursor: not-allowed;
    }

    .krt-servicesGridDrawer__cardControls svg {
        width: 1rem;
        height: 1rem;
    }

    .krt-servicesGridDrawer__danger {
        border-color: color-mix(in srgb, var(--krt-color-danger, #ef4444) 45%, transparent) !important;
        color: color-mix(in srgb, var(--krt-color-danger, #ef4444) 70%, transparent);
    }

    .krt-servicesGridDrawer__sr {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }
</style>
