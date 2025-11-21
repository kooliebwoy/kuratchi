<script lang="ts">
    import { LayoutBlock } from "../shell/index.js";
    import { IconPicker } from "../plugins/index.js";
    import { LucideIconMap, type LucideIconKey } from "../utils/lucide-icons.js";

    interface IconItem {
        icon: LucideIconKey;
        link: string;
        name: string;
        enabled: boolean;
    }

    interface Props {
        id?: string;
        type?: string;
        metadata?: {
            backgroundColor: string;
            iconColors: string;
            roundedBorder: string;
        };
        icons?: IconItem[];
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        type = 'icon-bar',
        metadata = {
            backgroundColor: '#575757',
            iconColors: '#212121',
            roundedBorder: 'rounded-3xl'
        },
        icons = $bindable<IconItem[]>([
            { icon: 'truck', link: '#', name: "Free Shipping & Returns", enabled: true },
            { icon: 'badgeDollarSign', link: '#', name: "100% Money Back Guarantee", enabled: true },
            { icon: 'home', link: '#', name: "High Quality Material", enabled: true },
            { icon: 'circleDollarSign', link: '#', name: "Safe and Secure Checkout", enabled: true },
        ]),
        editable = true
    }: Props = $props();

    let iconsState = $state(icons);

    let backgroundColor = $state(metadata.backgroundColor);
    let iconColors = $state(metadata.iconColors);
    let roundedBorder = $state(metadata.roundedBorder);

    const visibleIcons = $derived(iconsState.filter((icon) => icon.enabled));

    let content = $derived({
        id,
        type,
        icons: iconsState,
        metadata: {
            backgroundColor,
            iconColors,
            roundedBorder
        }
    })

    let roundedBorderOptions = $state([
        { value: 'rounded-none', name: 'None' },
        { value: 'rounded-sm', name: 'Small' },
        { value: 'rounded-md', name: 'Medium' },
        { value: 'rounded-lg', name: 'Large' },
        { value: 'rounded-xl', name: 'Extra Large' },
        { value: 'rounded-2xl', name: 'Extra Extra Large' },
        { value: 'rounded-3xl', name: 'Extra Extra Extra Large' },
        { value: 'rounded-full', name: 'Full' }
    ]);

    const radiusClassMap: Record<string, string> = {
        'rounded-none': 'krt-iconBar__band--radius-none',
        'rounded-sm': 'krt-iconBar__band--radius-sm',
        'rounded-md': 'krt-iconBar__band--radius-md',
        'rounded-lg': 'krt-iconBar__band--radius-lg',
        'rounded-xl': 'krt-iconBar__band--radius-xl',
        'rounded-2xl': 'krt-iconBar__band--radius-2xl',
        'rounded-3xl': 'krt-iconBar__band--radius-3xl',
        'rounded-full': 'krt-iconBar__band--radius-full'
    };

    const radiusClass = $derived(() => radiusClassMap[roundedBorder] ?? radiusClassMap['rounded-md']);
</script>

{#if editable}
<LayoutBlock {id} {type}>
    {#snippet drawerContent()}
        <div class="krt-iconBar__drawer">
            <section class="krt-iconBar__drawerSection">
                <h3>Appearance</h3>
                <div class="krt-iconBar__drawerGrid">
                    <label class="krt-iconBar__drawerField">
                        <span>Component Background</span>
                        <div class="krt-iconBar__colorControl">
                            <input type="color" bind:value={backgroundColor} />
                            <span>{backgroundColor}</span>
                        </div>
                    </label>
                    <label class="krt-iconBar__drawerField">
                        <span>Icon & Text Color</span>
                        <div class="krt-iconBar__colorControl">
                            <input type="color" bind:value={iconColors} />
                            <span>{iconColors}</span>
                        </div>
                    </label>
                    <label class="krt-iconBar__drawerField">
                        <span>Border Radius</span>
                        <select bind:value={roundedBorder}>
                            <option disabled>Select border radius</option>
                            {#each roundedBorderOptions as option}
                                <option value={option.value}>{option.name}</option>
                            {/each}
                        </select>
                    </label>
                </div>
            </section>

            <section class="krt-iconBar__drawerSection">
                <h3>Icons</h3>
                <p class="krt-iconBar__drawerHint">Toggle and rename the icon callouts shown to shoppers.</p>
                <IconPicker bind:selectedIcons={iconsState} />

                <div class="krt-iconBar__iconsGrid">
                    {#each iconsState as icon, i}
                        {@const Comp = LucideIconMap[icon.icon as LucideIconKey]}
                        <label class="krt-iconBar__iconField">
                            <span class="krt-iconBar__iconLabel">
                                <Comp aria-hidden="true" />
                                {icon.name}
                            </span>
                            <input
                                type="text"
                                bind:value={iconsState[i].name}
                                aria-label={`Label for ${icon.name}`}
                            />
                        </label>
                    {/each}
                </div>
            </section>
        </div>
    {/snippet}

    {#snippet metadata()}
        {JSON.stringify(content)}
    {/snippet}

    {#snippet children()}
        <section class={`krt-iconBar ${radiusClass}`} style:background-color={backgroundColor}>
            <div class="krt-iconBar__band" style:color={iconColors}>
                {#each iconsState as { icon, name }}
                    {@const Comp = LucideIconMap[icon as LucideIconKey]}
                    <div class="krt-iconBar__item">
                        <Comp aria-hidden="true" />
                        <h6>{name}</h6>
                    </div>
                {/each}
            </div>
        </section>
    {/snippet}
</LayoutBlock>
{:else}
    <section id={id} data-type={type} class={`krt-iconBar ${radiusClass}`} style:background-color={backgroundColor}>
        <div class="krt-iconBar__metadata">{JSON.stringify(content)}</div>
        <div class="krt-iconBar__band" style:color={iconColors}>
            {#each visibleIcons as iconItem}
                {@const Comp = LucideIconMap[iconItem.icon as LucideIconKey]}
                <div class="krt-iconBar__item">
                    {#if iconItem.link}
                        <a href={iconItem.link} class="krt-iconBar__link">
                            <Comp aria-hidden="true" />
                            <span>{iconItem.name}</span>
                        </a>
                    {:else}
                        <div class="krt-iconBar__link krt-iconBar__link--static">
                            <Comp aria-hidden="true" />
                            <span>{iconItem.name}</span>
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    </section>
{/if}

<style>
    .krt-iconBar {
        display: flex;
        justify-content: center;
        padding: var(--krt-space-lg, 1rem) var(--krt-space-3xl, 2.5rem);
        margin-block: var(--krt-space-lg, 1rem);
        border-radius: var(--krt-radius-xl, 1rem);
        transition: background 180ms ease;
    }

    .krt-iconBar__metadata {
        display: none;
    }

    .krt-iconBar__band {
        width: min(80rem, 100%);
        display: grid;
        gap: var(--krt-space-lg, 1rem);
        background: rgba(255, 255, 255, 0.12);
        border-radius: inherit;
        padding: var(--krt-space-xl, 1.25rem) var(--krt-space-2xl, 2rem);
        backdrop-filter: blur(10px);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
    }

    @media (min-width: 48rem) {
        .krt-iconBar__band {
            grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
        }
    }

    .krt-iconBar__item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--krt-space-sm, 0.5rem);
        text-align: center;
    }

    .krt-iconBar__item h6 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        letter-spacing: 0.01em;
    }

    .krt-iconBar__link {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        gap: var(--krt-space-sm, 0.5rem);
        color: inherit;
        text-decoration: none;
        transition: transform 150ms ease, color 150ms ease;
    }

    .krt-iconBar__link:hover {
        transform: translateY(-2px);
        color: color-mix(in srgb, currentColor 70%, white 30%);
    }

    .krt-iconBar__link--static {
        cursor: default;
    }

    .krt-iconBar__item :global(svg) {
        width: clamp(2.5rem, 4vw + 1.5rem, 3.5rem);
        height: clamp(2.5rem, 4vw + 1.5rem, 3.5rem);
    }

    .krt-iconBar__drawer {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-xl, 1.25rem);
    }

    .krt-iconBar__drawerSection {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-md, 0.75rem);
    }

    .krt-iconBar__drawerSection h3 {
        margin: 0;
        font-size: 0.95rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--krt-color-muted, #6b7280);
    }

    .krt-iconBar__drawerGrid {
        display: grid;
        gap: var(--krt-space-md, 0.75rem);
    }

    .krt-iconBar__drawerField {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-xs, 0.25rem);
        padding: var(--krt-space-sm, 0.5rem) var(--krt-space-md, 0.75rem);
        border-radius: var(--krt-radius-md, 0.5rem);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        background: var(--krt-color-surface, #ffffff);
        font-size: 0.85rem;
        font-weight: 600;
    }

    .krt-iconBar__drawerField input[type='color'] {
        width: 2.5rem;
        height: 2.5rem;
        border: none;
        border-radius: var(--krt-radius-md, 0.5rem);
        padding: 0;
        cursor: pointer;
        background: none;
    }

    .krt-iconBar__colorControl {
        display: flex;
        align-items: center;
        gap: var(--krt-space-sm, 0.5rem);
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 0.75rem;
        color: var(--krt-color-muted, #6b7280);
    }

    .krt-iconBar__drawerField select {
        border-radius: var(--krt-radius-sm, 0.375rem);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        padding: 0.45rem 0.6rem;
        font-size: 0.85rem;
        background: #f8fafc;
    }

    .krt-iconBar__drawerHint {
        margin: 0;
        font-size: 0.8rem;
        color: var(--krt-color-muted, #6b7280);
    }

    .krt-iconBar__iconsGrid {
        display: grid;
        gap: var(--krt-space-sm, 0.5rem);
    }

    .krt-iconBar__iconField {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-xs, 0.25rem);
        padding: var(--krt-space-sm, 0.5rem) var(--krt-space-md, 0.75rem);
        border-radius: var(--krt-radius-md, 0.5rem);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        background: var(--krt-color-surface, #ffffff);
    }

    .krt-iconBar__iconLabel {
        display: inline-flex;
        align-items: center;
        gap: var(--krt-space-xs, 0.25rem);
        font-size: 0.85rem;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--krt-color-muted, #6b7280);
    }

    .krt-iconBar__iconLabel :global(svg) {
        width: 1.2rem;
        height: 1.2rem;
        color: var(--krt-color-accent, #4f46e5);
    }

    .krt-iconBar__iconField input[type='text'] {
        border-radius: var(--krt-radius-sm, 0.375rem);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        padding: 0.45rem 0.6rem;
        font-size: 0.85rem;
        background: #f8fafc;
    }

    .krt-iconBar__band--radius-none { border-radius: 0; }
    .krt-iconBar__band--radius-sm { border-radius: 0.25rem; }
    .krt-iconBar__band--radius-md { border-radius: 0.5rem; }
    .krt-iconBar__band--radius-lg { border-radius: 0.75rem; }
    .krt-iconBar__band--radius-xl { border-radius: 1rem; }
    .krt-iconBar__band--radius-2xl { border-radius: 1.5rem; }
    .krt-iconBar__band--radius-3xl { border-radius: 2rem; }
    .krt-iconBar__band--radius-full { border-radius: 999px; }
</style>
