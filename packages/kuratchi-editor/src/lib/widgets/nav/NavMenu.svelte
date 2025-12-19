<script lang="ts">
    import NavItem from './NavItem.svelte';
    import type { NavMenuItem, DesktopNavConfig, defaultDesktopConfig } from './types.js';

    interface Props {
        /** Menu items to render */
        items: NavMenuItem[];
        /** Desktop navigation configuration */
        config?: DesktopNavConfig;
        /** ARIA label for accessibility */
        ariaLabel?: string;
        /** CSS class prefix */
        classPrefix?: string;
        /** Additional CSS classes */
        class?: string;
    }

    let {
        items = [],
        config = {},
        ariaLabel = 'Main navigation',
        classPrefix = 'krt-nav',
        class: className = ''
    }: Props = $props();

    // Merge with defaults - use $derived for reactivity
    const orientation = $derived(config.orientation || 'horizontal');
    const spacing = $derived(config.spacing || {});

    // Build CSS custom properties
    const navStyles = $derived(`
        --nav-gap: ${spacing.itemGap || '0.25rem'};
    `);
</script>

<nav 
    class="{classPrefix} {classPrefix}--{orientation} {className}"
    style={navStyles}
    aria-label={ariaLabel}
>
    <ul class="{classPrefix}__list" role="menubar">
        {#each items as item (item.id)}
            <NavItem 
                {item} 
                {config}
                {classPrefix}
            />
        {/each}
    </ul>
</nav>

<style>
    .krt-nav {
        display: flex;
        align-items: center;
    }

    .krt-nav__list {
        display: flex;
        align-items: center;
        gap: var(--nav-gap);
        list-style: none;
        margin: 0;
        padding: 0;
    }

    .krt-nav--horizontal .krt-nav__list {
        flex-direction: row;
    }

    .krt-nav--vertical .krt-nav__list {
        flex-direction: column;
        align-items: stretch;
    }
</style>
