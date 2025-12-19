<script lang="ts">
    import { X, ChevronDown, Menu } from '@lucide/svelte';
    import type { NavMenuItem, MobileNavConfig } from './types.js';

    interface Props {
        /** Menu items to render */
        items: NavMenuItem[];
        /** Mobile navigation configuration */
        config?: MobileNavConfig;
        /** Whether the mobile menu is open */
        isOpen?: boolean;
        /** Callback when menu should close */
        onClose?: () => void;
        /** CSS class prefix */
        classPrefix?: string;
        /** Use fixed positioning (true for production, false for editor canvas) */
        useFixedPosition?: boolean;
    }

    let {
        items = [],
        config = {},
        isOpen = $bindable(false),
        onClose,
        classPrefix = 'krt-nav-mobile',
        useFixedPosition = true
    }: Props = $props();

    // Destructure config with defaults - use $derived for reactivity
    const style = $derived(config.style || 'drawer');
    const drawerPosition = $derived(config.drawerPosition || 'right');
    const colors = $derived(config.colors || {});
    const typography = $derived(config.typography || {});
    const spacing = $derived(config.spacing || {});
    const animation = $derived(config.animation || {});
    const showCloseButton = $derived(config.showCloseButton !== false);
    const showBackdrop = $derived(config.showBackdrop !== false);
    const backdropOpacity = $derived(config.backdropOpacity ?? 0.5);
    const accordionBehavior = $derived(config.accordionBehavior || 'single');

    // Track open accordion items
    let openItems = $state<Set<string>>(new Set());

    function toggleItem(id: string) {
        if (accordionBehavior === 'single') {
            if (openItems.has(id)) {
                openItems = new Set();
            } else {
                openItems = new Set([id]);
            }
        } else {
            const newSet = new Set(openItems);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            openItems = newSet;
        }
    }

    function handleClose() {
        isOpen = false;
        onClose?.();
    }

    function handleBackdropClick() {
        handleClose();
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            handleClose();
        }
    }

    // Trap focus within the menu when open
    $effect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    });

    // Build styles
    const menuStyles = $derived(`
        --mobile-nav-bg: ${colors.background || '#ffffff'};
        --mobile-nav-bg-hover: ${colors.backgroundHover || '#f3f4f6'};
        --mobile-nav-color: ${colors.text || '#1f2937'};
        --mobile-nav-color-hover: ${colors.textHover || '#111827'};
        --mobile-nav-dropdown-bg: ${colors.dropdownBackground || '#f9fafb'};
        --mobile-nav-dropdown-color: ${colors.dropdownText || '#374151'};
        --mobile-nav-font-size: ${typography.fontSize || '1rem'};
        --mobile-nav-font-weight: ${typography.fontWeight || 500};
        --mobile-nav-item-padding: ${spacing.itemPadding || '0.75rem 1rem'};
        --mobile-nav-subitem-padding: ${spacing.dropdownItemPadding || '0.625rem 1rem 0.625rem 2rem'};
        --mobile-nav-duration: ${animation.duration || '300ms'};
        --mobile-nav-easing: ${animation.easing || 'cubic-bezier(0.4, 0, 0.2, 1)'};
        --mobile-nav-backdrop-opacity: ${backdropOpacity};
    `);
</script>

<svelte:window onkeydown={isOpen ? handleKeydown : undefined} />

{#if showBackdrop && isOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div 
        class="{classPrefix}__backdrop"
        class:is-open={isOpen}
        class:position-fixed={useFixedPosition}
        class:position-absolute={!useFixedPosition}
        onclick={handleBackdropClick}
    ></div>
{/if}

<div 
    class="{classPrefix}"
    class:is-open={isOpen}
    class:style-drawer={style === 'drawer'}
    class:style-fullscreen={style === 'fullscreen'}
    class:style-dropdown={style === 'dropdown'}
    class:position-left={drawerPosition === 'left'}
    class:position-right={drawerPosition === 'right'}
    class:position-top={drawerPosition === 'top'}
    class:position-bottom={drawerPosition === 'bottom'}
    class:position-fixed={useFixedPosition}
    class:position-absolute={!useFixedPosition}
    style={menuStyles}
    role="dialog"
    aria-modal="true"
    aria-label="Mobile navigation"
>
    {#if showCloseButton}
        <div class="{classPrefix}__header">
            <button 
                type="button" 
                class="{classPrefix}__close"
                onclick={handleClose}
                aria-label="Close menu"
            >
                <X aria-hidden="true" />
            </button>
        </div>
    {/if}

    <nav class="{classPrefix}__nav">
        <ul class="{classPrefix}__list">
            {#each items as item (item.id)}
                <li class="{classPrefix}__item" class:has-children={item.children?.length}>
                    {#if item.children?.length}
                        <button
                            type="button"
                            class="{classPrefix}__trigger"
                            class:is-open={openItems.has(item.id)}
                            onclick={() => toggleItem(item.id)}
                            aria-expanded={openItems.has(item.id)}
                        >
                            <span>{item.label}</span>
                            <ChevronDown class="{classPrefix}__caret" aria-hidden="true" />
                        </button>
                        
                        {#if openItems.has(item.id)}
                            <ul class="{classPrefix}__submenu">
                                {#each item.children as child (child.id)}
                                    <li class="{classPrefix}__subitem">
                                        <a 
                                            href={child.url || '#'}
                                            class="{classPrefix}__link"
                                            onclick={handleClose}
                                        >
                                            {child.label}
                                        </a>
                                    </li>
                                {/each}
                            </ul>
                        {/if}
                    {:else}
                        <a 
                            href={item.url || '#'}
                            class="{classPrefix}__link"
                            onclick={handleClose}
                        >
                            {item.label}
                        </a>
                    {/if}
                </li>
            {/each}
        </ul>
    </nav>
</div>

<style>
    /* Backdrop */
    .krt-nav-mobile__backdrop {
        inset: 0;
        background: rgba(0, 0, 0, var(--mobile-nav-backdrop-opacity));
        opacity: 0;
        visibility: hidden;
        transition: opacity var(--mobile-nav-duration) var(--mobile-nav-easing),
                    visibility var(--mobile-nav-duration) var(--mobile-nav-easing);
        z-index: 998;
    }

    .krt-nav-mobile__backdrop.position-fixed {
        position: fixed;
    }

    .krt-nav-mobile__backdrop.position-absolute {
        position: absolute;
    }

    .krt-nav-mobile__backdrop.is-open {
        opacity: 1;
        visibility: visible;
    }

    /* Container */
    .krt-nav-mobile {
        background: var(--mobile-nav-bg);
        color: var(--mobile-nav-color);
        z-index: 999;
        display: flex;
        flex-direction: column;
        transition: transform var(--mobile-nav-duration) var(--mobile-nav-easing);
        overflow-y: auto;
    }

    .krt-nav-mobile.position-fixed {
        position: fixed;
    }

    .krt-nav-mobile.position-absolute {
        position: absolute;
    }

    /* Drawer styles */
    .krt-nav-mobile.style-drawer.position-right {
        top: 0;
        right: 0;
        bottom: 0;
        width: min(80%, 320px);
        transform: translateX(100%);
    }

    .krt-nav-mobile.style-drawer.position-left {
        top: 0;
        left: 0;
        bottom: 0;
        width: min(80%, 320px);
        transform: translateX(-100%);
    }

    .krt-nav-mobile.style-drawer.position-top {
        top: 0;
        left: 0;
        right: 0;
        max-height: 80%;
        transform: translateY(-100%);
    }

    .krt-nav-mobile.style-drawer.position-bottom {
        bottom: 0;
        left: 0;
        right: 0;
        max-height: 80%;
        transform: translateY(100%);
    }

    .krt-nav-mobile.style-drawer.is-open {
        transform: translate(0, 0);
    }

    /* Fullscreen style */
    .krt-nav-mobile.style-fullscreen {
        inset: 0;
        opacity: 0;
        visibility: hidden;
    }

    .krt-nav-mobile.style-fullscreen.is-open {
        opacity: 1;
        visibility: visible;
    }

    /* Header with close button */
    .krt-nav-mobile__header {
        display: flex;
        justify-content: flex-end;
        padding: 1rem;
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    }

    .krt-nav-mobile__close {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2.5rem;
        height: 2.5rem;
        background: transparent;
        border: none;
        border-radius: 0.5rem;
        color: var(--mobile-nav-color);
        cursor: pointer;
        transition: background 150ms ease;
    }

    .krt-nav-mobile__close:hover {
        background: var(--mobile-nav-bg-hover);
    }

    .krt-nav-mobile__close :global(svg) {
        width: 1.5rem;
        height: 1.5rem;
    }

    /* Navigation */
    .krt-nav-mobile__nav {
        flex: 1;
        padding: 0.5rem 0;
    }

    .krt-nav-mobile__list {
        list-style: none;
        margin: 0;
        padding: 0;
    }

    .krt-nav-mobile__item {
        border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    }

    .krt-nav-mobile__trigger,
    .krt-nav-mobile__link {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: var(--mobile-nav-item-padding);
        font-size: var(--mobile-nav-font-size);
        font-weight: var(--mobile-nav-font-weight);
        color: var(--mobile-nav-color);
        background: transparent;
        border: none;
        text-decoration: none;
        cursor: pointer;
        transition: background 150ms ease, color 150ms ease;
        font-family: inherit;
        text-align: left;
    }

    .krt-nav-mobile__trigger:hover,
    .krt-nav-mobile__link:hover {
        background: var(--mobile-nav-bg-hover);
        color: var(--mobile-nav-color-hover);
    }

    /* Caret */
    .krt-nav-mobile__trigger :global(.krt-nav-mobile__caret) {
        width: 1.25rem;
        height: 1.25rem;
        opacity: 0.6;
        transition: transform 200ms ease;
    }

    .krt-nav-mobile__trigger.is-open :global(.krt-nav-mobile__caret) {
        transform: rotate(180deg);
    }

    /* Submenu */
    .krt-nav-mobile__submenu {
        list-style: none;
        margin: 0;
        padding: 0;
        background: var(--mobile-nav-dropdown-bg);
    }

    .krt-nav-mobile__subitem .krt-nav-mobile__link {
        padding: var(--mobile-nav-subitem-padding);
        font-size: 0.9375rem;
        color: var(--mobile-nav-dropdown-color);
    }
</style>
