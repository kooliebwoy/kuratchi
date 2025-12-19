<script lang="ts">
    import type { FooterLink, FooterLinksConfig } from './footer-types.js';
    import { defaultLinksConfig } from './footer-types.js';

    interface Props {
        /** Array of links to display */
        links: FooterLink[];
        /** Configuration options */
        config?: Partial<FooterLinksConfig>;
        /** CSS class prefix for styling */
        classPrefix?: string;
        /** Aria label for the navigation */
        ariaLabel?: string;
    }

    let {
        links = [],
        config = {},
        classPrefix = 'krt-footer-links',
        ariaLabel = 'Footer links'
    }: Props = $props();

    // Merge with defaults - use $derived for reactivity
    const mergedConfig = $derived<FooterLinksConfig>({
        ...defaultLinksConfig,
        ...config,
        colors: { ...defaultLinksConfig.colors, ...config.colors },
        typography: { ...defaultLinksConfig.typography, ...config.typography },
        spacing: { ...defaultLinksConfig.spacing, ...config.spacing },
    });

    const layout = $derived(mergedConfig.layout);
    const showSeparator = $derived(mergedConfig.showSeparator);
    const separator = $derived(mergedConfig.separator || '·');
    const colors = $derived(mergedConfig.colors!);
    const typography = $derived(mergedConfig.typography!);
    const spacing = $derived(mergedConfig.spacing!);
</script>

<nav 
    class="{classPrefix}"
    class:is-horizontal={layout === 'horizontal'}
    class:is-vertical={layout === 'vertical'}
    aria-label={ariaLabel}
    style:--footer-links-color={colors.linkText}
    style:--footer-links-hover={colors.linkHover}
    style:--footer-links-underline={colors.underlineColor || colors.linkHover}
    style:--footer-links-size={typography.linkSize}
    style:--footer-links-weight={typography.linkWeight}
    style:--footer-links-gap={spacing.linkGap}
>
    <ul class="{classPrefix}__list">
        {#each links as link, i (link.id || link.label)}
            {#if showSeparator && i > 0}
                <li class="{classPrefix}__separator" aria-hidden="true">{separator}</li>
            {/if}
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
</nav>

<style>
    .krt-footer-links__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        gap: var(--footer-links-gap, 0.5rem);
    }

    .is-horizontal .krt-footer-links__list {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
    }

    .is-vertical .krt-footer-links__list {
        flex-direction: column;
    }

    .krt-footer-links__separator {
        color: var(--footer-links-color, inherit);
        opacity: 0.5;
    }

    .krt-footer-links__item {
        margin: 0;
        padding: 0;
    }

    .krt-footer-links__link {
        font-size: var(--footer-links-size, 0.95rem);
        font-weight: var(--footer-links-weight, 500);
        color: var(--footer-links-color, inherit);
        text-decoration: none;
        opacity: 0.85;
        position: relative;
        transition: opacity 150ms ease;
    }

    .krt-footer-links__link::after {
        content: '';
        position: absolute;
        inset-inline: 0;
        inset-block-end: -0.15rem;
        height: 1px;
        background: var(--footer-links-underline, currentColor);
        opacity: 0;
        transition: opacity 150ms ease;
    }

    .krt-footer-links__link:hover {
        color: var(--footer-links-hover, inherit);
        opacity: 1;
    }

    .krt-footer-links__link:hover::after {
        opacity: 0.6;
    }

    @media (min-width: 48rem) {
        .is-horizontal .krt-footer-links__list {
            justify-content: flex-start;
        }
    }
</style>
