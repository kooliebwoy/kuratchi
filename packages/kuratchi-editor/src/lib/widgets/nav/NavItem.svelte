<script lang="ts">
    import { ChevronDown, ChevronRight } from '@lucide/svelte';
    import type { NavMenuItem, DesktopNavConfig, NavColors, NavTypography, NavSpacing, NavBorders, NavAnimation, NavCaret } from './types.js';
    import NavItemSelf from './NavItem.svelte';

    interface Props {
        /** The menu item data */
        item: NavMenuItem;
        /** Whether this is a top-level item or nested */
        isNested?: boolean;
        /** Nesting depth (for submenus) */
        depth?: number;
        /** Configuration inherited from parent */
        config?: DesktopNavConfig;
        /** CSS class prefix */
        classPrefix?: string;
    }

    let {
        item,
        isNested = false,
        depth = 0,
        config = {},
        classPrefix = 'krt-nav'
    }: Props = $props();

    // Destructure config with defaults
    const colors: NavColors = config.colors || {};
    const typography: NavTypography = config.typography || {};
    const spacing: NavSpacing = config.spacing || {};
    const borders: NavBorders = config.borders || {};
    const animation: NavAnimation = config.animation || {};
    const caret: NavCaret = config.caret || {};

    const dropdownTrigger = config.dropdownTrigger || 'hover';
    const submenuDirection = config.submenuDirection || 'right';

    // State for click-based dropdowns
    let isOpen = $state(false);

    // Check if item has children
    const hasChildren = $derived(Boolean(item.children?.length));

    // Build href
    function getHref(): string {
        if (item.url) return item.url;
        if (item.pageId) return `/${item.pageId}`;
        return '#';
    }

    // Build target/rel attributes
    function getLinkProps() {
        const props: Record<string, string> = {};
        if (item.openInNewTab || item.isExternal || item.target === '_blank') {
            props.target = '_blank';
            props.rel = item.rel || 'noopener noreferrer';
        } else if (item.target) {
            props.target = item.target;
        }
        if (item.title) props.title = item.title;
        if (item.ariaLabel) props['aria-label'] = item.ariaLabel;
        return props;
    }

    // Handle click for click-triggered dropdowns
    function handleClick(e: MouseEvent) {
        if (hasChildren && dropdownTrigger === 'click') {
            e.preventDefault();
            isOpen = !isOpen;
        }
    }

    // Handle keyboard navigation
    function handleKeydown(e: KeyboardEvent) {
        if (hasChildren) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                isOpen = !isOpen;
            } else if (e.key === 'Escape' && isOpen) {
                isOpen = false;
            }
        }
    }

    // Close on outside click (for click-triggered dropdowns)
    function handleOutsideClick(e: MouseEvent) {
        const target = e.target as HTMLElement;
        if (!target.closest(`.${classPrefix}__item`)) {
            isOpen = false;
        }
    }

    // CSS custom properties for styling
    const itemStyles = $derived(`
        --nav-item-bg: ${colors.background || 'transparent'};
        --nav-item-bg-hover: ${colors.backgroundHover || 'rgba(255, 255, 255, 0.1)'};
        --nav-item-bg-active: ${colors.backgroundActive || colors.backgroundHover || 'rgba(255, 255, 255, 0.15)'};
        --nav-item-color: ${colors.text || 'inherit'};
        --nav-item-color-hover: ${colors.textHover || colors.text || 'inherit'};
        --nav-item-padding: ${isNested ? spacing.dropdownItemPadding : spacing.itemPadding || '0.5rem 0.75rem'};
        --nav-item-radius: ${borders.itemRadius || '0.375rem'};
        --nav-item-font-size: ${typography.fontSize || '0.9375rem'};
        --nav-item-font-weight: ${typography.fontWeight || 500};
        --nav-item-letter-spacing: ${typography.letterSpacing || '0'};
        --nav-item-text-transform: ${typography.textTransform || 'none'};
        --nav-transition-duration: ${animation.duration || '200ms'};
        --nav-transition-easing: ${animation.easing || 'ease'};
    `);

    const dropdownStyles = $derived(`
        --nav-dropdown-bg: ${colors.dropdownBackground || 'rgba(0, 0, 0, 0.9)'};
        --nav-dropdown-color: ${colors.dropdownText || '#ffffff'};
        --nav-dropdown-border: ${colors.dropdownBorder || 'rgba(255, 255, 255, 0.1)'};
        --nav-dropdown-shadow: ${colors.dropdownShadow || '0 10px 40px rgba(0, 0, 0, 0.3)'};
        --nav-dropdown-radius: ${borders.dropdownRadius || '0.5rem'};
        --nav-dropdown-padding: ${spacing.dropdownPadding || '0.5rem'};
        --nav-dropdown-min-width: ${config.dropdownMinWidth || '12rem'};
        --nav-dropdown-item-hover: ${colors.dropdownItemHover || 'rgba(255, 255, 255, 0.1)'};
    `);
</script>

<svelte:window onclick={dropdownTrigger === 'click' ? handleOutsideClick : undefined} />

<li 
    class="{classPrefix}__item"
    class:has-children={hasChildren}
    class:is-open={isOpen}
    class:is-nested={isNested}
    class:trigger-hover={dropdownTrigger === 'hover'}
    class:trigger-click={dropdownTrigger === 'click'}
    style={itemStyles}
    data-depth={depth}
>
    {#if hasChildren}
        <!-- Item with dropdown -->
        <button
            type="button"
            class="{classPrefix}__trigger"
            onclick={handleClick}
            onkeydown={handleKeydown}
            aria-expanded={isOpen}
            aria-haspopup="true"
        >
            <span class="{classPrefix}__label">{item.label}</span>
            {#if caret.show !== false}
                <span class="{classPrefix}__caret" class:is-open={isOpen}>
                    {#if isNested && submenuDirection === 'right'}
                        <ChevronRight aria-hidden="true" />
                    {:else if isNested && submenuDirection === 'left'}
                        <ChevronRight aria-hidden="true" style="transform: rotate(180deg)" />
                    {:else}
                        <ChevronDown aria-hidden="true" />
                    {/if}
                </span>
            {/if}
        </button>

        <!-- Dropdown menu -->
        <ul 
            class="{classPrefix}__dropdown"
            class:is-submenu={isNested}
            class:direction-left={isNested && submenuDirection === 'left'}
            style={dropdownStyles}
            role="menu"
        >
            {#each item.children as child (child.id)}
                <NavItemSelf 
                    item={child} 
                    isNested={true} 
                    depth={depth + 1}
                    config={config}
                    classPrefix={classPrefix}
                />
            {/each}
        </ul>
    {:else}
        <!-- Simple link item -->
        <a
            href={getHref()}
            class="{classPrefix}__link"
            {...getLinkProps()}
        >
            <span class="{classPrefix}__label">{item.label}</span>
        </a>
    {/if}
</li>

<style>
    /* Base item styles */
    .krt-nav__item {
        position: relative;
        list-style: none;
    }

    .krt-nav__trigger,
    .krt-nav__link {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: var(--nav-item-padding);
        font-size: var(--nav-item-font-size);
        font-weight: var(--nav-item-font-weight);
        letter-spacing: var(--nav-item-letter-spacing);
        text-transform: var(--nav-item-text-transform);
        color: var(--nav-item-color);
        background: var(--nav-item-bg);
        border: none;
        border-radius: var(--nav-item-radius);
        text-decoration: none;
        cursor: pointer;
        transition: background var(--nav-transition-duration) var(--nav-transition-easing),
                    color var(--nav-transition-duration) var(--nav-transition-easing);
        font-family: inherit;
        white-space: nowrap;
    }

    .krt-nav__trigger:hover,
    .krt-nav__link:hover {
        background: var(--nav-item-bg-hover);
        color: var(--nav-item-color-hover);
    }

    .krt-nav__item.is-open > .krt-nav__trigger {
        background: var(--nav-item-bg-active);
    }

    /* Caret */
    .krt-nav__caret {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: transform var(--nav-transition-duration) var(--nav-transition-easing);
    }

    .krt-nav__caret :global(svg) {
        width: 0.875rem;
        height: 0.875rem;
        opacity: 0.7;
    }

    .krt-nav__caret.is-open {
        transform: rotate(180deg);
    }

    .krt-nav__item.is-nested .krt-nav__caret.is-open {
        transform: rotate(90deg);
    }

    /* Dropdown */
    .krt-nav__dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        margin: 0;
        padding: var(--nav-dropdown-padding);
        list-style: none;
        min-width: var(--nav-dropdown-min-width);
        background: var(--nav-dropdown-bg);
        color: var(--nav-dropdown-color);
        border: 1px solid var(--nav-dropdown-border);
        border-radius: var(--nav-dropdown-radius);
        box-shadow: var(--nav-dropdown-shadow);
        opacity: 0;
        visibility: hidden;
        transform: translateY(-0.5rem);
        transition: opacity var(--nav-transition-duration) var(--nav-transition-easing),
                    visibility var(--nav-transition-duration) var(--nav-transition-easing),
                    transform var(--nav-transition-duration) var(--nav-transition-easing);
        z-index: 100;
    }

    /* Hover trigger */
    .krt-nav__item.trigger-hover:hover > .krt-nav__dropdown,
    .krt-nav__item.trigger-hover:focus-within > .krt-nav__dropdown {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
    }

    /* Click trigger */
    .krt-nav__item.trigger-click.is-open > .krt-nav__dropdown {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
    }

    /* Submenu positioning */
    .krt-nav__dropdown.is-submenu {
        top: 0;
        left: 100%;
        margin-left: 0.25rem;
        transform: translateX(-0.5rem);
    }

    .krt-nav__dropdown.is-submenu.direction-left {
        left: auto;
        right: 100%;
        margin-left: 0;
        margin-right: 0.25rem;
        transform: translateX(0.5rem);
    }

    .krt-nav__item.trigger-hover:hover > .krt-nav__dropdown.is-submenu,
    .krt-nav__item.trigger-click.is-open > .krt-nav__dropdown.is-submenu {
        transform: translateX(0);
    }

    /* Nested item styles (in dropdown) */
    .krt-nav__item.is-nested .krt-nav__trigger,
    .krt-nav__item.is-nested .krt-nav__link {
        width: 100%;
        justify-content: space-between;
        background: transparent;
        border-radius: var(--nav-item-radius);
    }

    .krt-nav__item.is-nested .krt-nav__trigger:hover,
    .krt-nav__item.is-nested .krt-nav__link:hover {
        background: var(--nav-dropdown-item-hover);
    }
</style>
