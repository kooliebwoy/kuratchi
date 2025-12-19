<script lang="ts">
    import type { FooterLinkColumn, FooterColumnsConfig } from './footer-types.js';
    import { defaultColumnsConfig } from './footer-types.js';

    interface Props {
        /** Array of column groups with heading and links */
        columns: FooterLinkColumn[];
        /** Configuration options */
        config?: Partial<FooterColumnsConfig>;
        /** CSS class prefix for styling */
        classPrefix?: string;
        /** Aria label for the navigation */
        ariaLabel?: string;
    }

    let {
        columns = [],
        config = {},
        classPrefix = 'krt-footer-nav',
        ariaLabel = 'Footer navigation'
    }: Props = $props();

    // Merge with defaults - use $derived for reactivity
    const mergedConfig = $derived<FooterColumnsConfig>({
        ...defaultColumnsConfig,
        ...config,
        colors: { ...defaultColumnsConfig.colors, ...config.colors },
        typography: { ...defaultColumnsConfig.typography, ...config.typography },
        spacing: { ...defaultColumnsConfig.spacing, ...config.spacing },
        columns: { ...defaultColumnsConfig.columns, ...config.columns },
    });

    const colors = $derived(mergedConfig.colors!);
    const typography = $derived(mergedConfig.typography!);
    const spacing = $derived(mergedConfig.spacing!);
    const gridCols = $derived(mergedConfig.columns!);
</script>

<nav 
    class="{classPrefix}"
    aria-label={ariaLabel}
    style:--footer-nav-bg={colors.background}
    style:--footer-nav-heading-color={colors.headingText}
    style:--footer-nav-link-color={colors.linkText}
    style:--footer-nav-link-hover={colors.linkHover}
    style:--footer-nav-underline-color={colors.underlineColor || colors.linkHover}
    style:--footer-nav-heading-size={typography.headingSize}
    style:--footer-nav-heading-weight={typography.headingWeight}
    style:--footer-nav-heading-transform={typography.headingTransform}
    style:--footer-nav-heading-spacing={typography.headingLetterSpacing}
    style:--footer-nav-link-size={typography.linkSize}
    style:--footer-nav-link-weight={typography.linkWeight}
    style:--footer-nav-column-gap={spacing.columnGap}
    style:--footer-nav-heading-gap={spacing.headingGap}
    style:--footer-nav-link-gap={spacing.linkGap}
    style:--footer-nav-cols-mobile={gridCols.mobile}
    style:--footer-nav-cols-tablet={gridCols.tablet}
    style:--footer-nav-cols-desktop={gridCols.desktop}
>
    <div class="{classPrefix}__grid">
        {#each columns as column (column.id || column.heading)}
            <div class="{classPrefix}__column">
                <h6 class="{classPrefix}__heading">{column.heading}</h6>
                <ul class="{classPrefix}__links">
                    {#each column.links as link (link.id || link.label)}
                        <li class="{classPrefix}__item">
                            <a 
                                href={link.url || '#'} 
                                class="{classPrefix}__link"
                                target={link.external ? '_blank' : undefined}
                                rel={link.external ? 'noopener noreferrer' : undefined}
                            >
                                {link.label}
                            </a>
                        </li>
                    {/each}
                </ul>
            </div>
        {/each}
    </div>
</nav>

<style>
    .krt-footer-nav {
        background: var(--footer-nav-bg, transparent);
    }

    .krt-footer-nav__grid {
        display: grid;
        gap: var(--footer-nav-column-gap, 2rem);
        grid-template-columns: repeat(var(--footer-nav-cols-mobile, 1), minmax(0, 1fr));
    }

    @media (min-width: 48rem) {
        .krt-footer-nav__grid {
            grid-template-columns: repeat(var(--footer-nav-cols-tablet, 2), minmax(0, 1fr));
        }
    }

    @media (min-width: 64rem) {
        .krt-footer-nav__grid {
            grid-template-columns: repeat(var(--footer-nav-cols-desktop, 3), minmax(0, 1fr));
        }
    }

    .krt-footer-nav__column {
        display: flex;
        flex-direction: column;
        gap: var(--footer-nav-heading-gap, 0.5rem);
    }

    .krt-footer-nav__heading {
        margin: 0;
        font-size: var(--footer-nav-heading-size, 0.8rem);
        font-weight: var(--footer-nav-heading-weight, 600);
        text-transform: var(--footer-nav-heading-transform, uppercase);
        letter-spacing: var(--footer-nav-heading-spacing, 0.14em);
        color: var(--footer-nav-heading-color, inherit);
        opacity: 0.8;
    }

    .krt-footer-nav__links {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--footer-nav-link-gap, 0.25rem);
    }

    .krt-footer-nav__item {
        margin: 0;
        padding: 0;
    }

    .krt-footer-nav__link {
        font-size: var(--footer-nav-link-size, 0.95rem);
        font-weight: var(--footer-nav-link-weight, 400);
        color: var(--footer-nav-link-color, inherit);
        text-decoration: none;
        opacity: 0.85;
        transition: opacity 150ms ease;
    }

    .krt-footer-nav__link:hover {
        color: var(--footer-nav-link-hover, inherit);
        opacity: 1;
    }
</style>
