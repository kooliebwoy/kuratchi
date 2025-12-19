<script lang="ts">
    import { onMount } from 'svelte';
    import { BlockActions } from '../utils/index.js';
    import { 
        NavMenu, 
        NavMenuMobile, 
        NavSettingsPanel, 
        type DesktopNavConfig, 
        type MobileNavConfig, 
        type NavMenuItem,
        // Inspector Widgets
        InspectorSection,
        ToggleControl,
        ColorControl,
        SocialLinksEditor
    } from '../widgets/index.js';
    import { LucideIconMap, type LucideIconKey } from '../utils/lucide-icons.js';
    import { Home, Search, Menu } from '@lucide/svelte';
    import { blockRegistry } from '../stores/editorSignals.svelte.js';

    let id = crypto.randomUUID(); // Ensure each content has a unique ID

    // default image since we are only showing examples
    let image = {
        src: '/clutch-cms-logo.png',
        alt: 'Clutch CMS Logo',
        title: 'Clutch CMS Logo',
    }

    // Nav dropdown trigger options
    type DropdownTriggerOption = 'hover' | 'click';
    type DropdownAlignOption = 'start' | 'center' | 'end';
    type SubmenuDirectionOption = 'left' | 'right';
    type MobileStyleOption = 'drawer' | 'fullscreen';
    type DrawerPositionOption = 'left' | 'right';

    interface Props {
        searchEnabled?: boolean;
        type?: string;
        backgroundColor?: string;
        homeIconColor?: string;
        textColor?: string;
        reverseOrder?: boolean;
        icons?: any;
        menu?: any;
        editable?: boolean;
        useMobileMenuOnDesktop?: boolean;
        menuHidden?: boolean;
        isSticky?: boolean;
        // Nav configuration props (reactive from plugin)
        navDropdownTrigger?: DropdownTriggerOption;
        navDropdownAlign?: DropdownAlignOption;
        navSubmenuDirection?: SubmenuDirectionOption;
        navHoverBgColor?: string;
        navHoverTextColor?: string;
        navDropdownBgColor?: string;
        navDropdownTextColor?: string;
        navDropdownHoverBgColor?: string;
        navDropdownHoverTextColor?: string;
        mobileNavStyle?: MobileStyleOption;
        mobileDrawerPosition?: DrawerPositionOption;
        /** Forced viewport for editor preview */
        forcedViewport?: 'phone' | 'tablet' | 'desktop';
    }

    const DEFAULT_MENU: NavMenuItem[] = [
        { id: '1', label: 'Home', url: '/' },
        {
            id: '2',
            label: 'Products',
            children: [
                { id: '2a', label: 'Product A', url: '#' },
                { id: '2b', label: 'Product B', url: '#' },
            ],
        },
        { id: '3', label: 'About Us', url: '#' },
        { id: '4', label: 'Contact', url: '#' },
    ];

    let {
        searchEnabled: initialSearchEnabled = true,
        type = 'twig-and-pearl-header',
        backgroundColor: initialBackgroundColor = '#212121',
        homeIconColor: initialHomeIconColor = '#575757',
        textColor: initialTextColor = '#ffffff',
        reverseOrder: initialReverseOrder = false,
        icons: initialIcons = [
            { icon: 'facebook', link: '#', name: "Facebook", enabled: true },
            { icon: 'x', link: '#', name: "X", enabled: true },
            { icon: 'instagram', link: '#', name: "Instagram", enabled: true },
        ] as { icon: LucideIconKey; link: string; name: string; enabled: boolean }[],
        menu: initialMenu = [],
        editable = true,
        useMobileMenuOnDesktop: initialUseMobileMenuOnDesktop = false,
        menuHidden: initialMenuHidden = false,
        // Nav configuration props (initial values, become local state)
        navDropdownTrigger: initialNavDropdownTrigger = 'hover' as DropdownTriggerOption,
        navDropdownAlign: initialNavDropdownAlign = 'start' as DropdownAlignOption,
        navSubmenuDirection: initialNavSubmenuDirection = 'right' as SubmenuDirectionOption,
        navHoverBgColor: initialNavHoverBgColor = 'rgba(255, 255, 255, 0.1)',
        navHoverTextColor: initialNavHoverTextColor = '',
        navDropdownBgColor: initialNavDropdownBgColor = '',
        navDropdownTextColor: initialNavDropdownTextColor = '#ffffff',
        navDropdownHoverBgColor: initialNavDropdownHoverBgColor = '',
        navDropdownHoverTextColor: initialNavDropdownHoverTextColor = '',
        mobileNavStyle: initialMobileNavStyle = 'drawer' as MobileStyleOption,
        mobileDrawerPosition: initialMobileDrawerPosition = 'right' as DrawerPositionOption,
        isSticky: initialIsSticky = false,
        forcedViewport,
    }: Props = $props();

    // Normalize menu items to use 'children' and 'url' properties
    function normalizeMenuItems(items: any[]): NavMenuItem[] {
        return items.map((item, index) => ({
            id: item.id || `item-${index}`,
            label: item.label,
            url: item.url || item.link || item.slug,
            children: item.children || item.items ? normalizeMenuItems(item.children || item.items) : undefined,
        }));
    }

    // Menu items come from props (injected by Dashboard via siteMetadata.navigation.header.items)
    // Navigation CRUD is handled in Dashboard, not editable in header component
    const resolvedMenu = initialMenuHidden
        ? []
        : (initialMenu?.length ?? 0) > 0
            ? normalizeMenuItems(initialMenu)
            : DEFAULT_MENU;

    let searchEnabled = $state(initialSearchEnabled);
    let backgroundColor = $state(initialBackgroundColor);
    let homeIconColor = $state(initialHomeIconColor);
    let textColor = $state(initialTextColor);
    let reverseOrder = $state(initialReverseOrder);
    let icons = $state<{ icon: LucideIconKey; link: string; name: string; enabled: boolean }[]>(initialIcons);
    let localMenu = $state<NavMenuItem[]>(resolvedMenu);
    let useMobileMenuOnDesktop = $state(initialUseMobileMenuOnDesktop);
    let menuHidden = $state(initialMenuHidden);

    // Nav configuration state (saved with header)
    let navDropdownTrigger = $state<DropdownTriggerOption>(initialNavDropdownTrigger);
    let navDropdownAlign = $state<DropdownAlignOption>(initialNavDropdownAlign);
    let navSubmenuDirection = $state<SubmenuDirectionOption>(initialNavSubmenuDirection);
    let navHoverBgColor = $state(initialNavHoverBgColor);
    let navHoverTextColor = $state(initialNavHoverTextColor);
    let navDropdownBgColor = $state(initialNavDropdownBgColor);
    let navDropdownTextColor = $state(initialNavDropdownTextColor);
    let navDropdownHoverBgColor = $state(initialNavDropdownHoverBgColor);
    let navDropdownHoverTextColor = $state(initialNavDropdownHoverTextColor);
    let mobileNavStyle = $state<MobileStyleOption>(initialMobileNavStyle);
    let mobileDrawerPosition = $state<DrawerPositionOption>(initialMobileDrawerPosition);

    // Mobile menu state
    let mobileMenuOpen = $state(false);
    let isSticky = $state(initialIsSticky);

    // Computed desktop nav config
    const desktopNavConfig = $derived<DesktopNavConfig>({
        orientation: 'horizontal',
        dropdownTrigger: navDropdownTrigger ?? 'hover',
        dropdownAlign: navDropdownAlign ?? 'start',
        submenuDirection: navSubmenuDirection ?? 'right',
        colors: {
            background: 'transparent',
            backgroundHover: navHoverBgColor || 'rgba(255, 255, 255, 0.1)',
            backgroundActive: navHoverBgColor || 'rgba(255, 255, 255, 0.1)',
            text: textColor,
            textHover: navHoverTextColor || textColor,
            dropdownBackground: navDropdownBgColor || backgroundColor,
            dropdownItemHover: navDropdownHoverBgColor || navHoverBgColor || 'rgba(255, 255, 255, 0.1)',
            dropdownText: navDropdownTextColor || '#ffffff',
            dropdownBorder: 'rgba(255, 255, 255, 0.15)',
            dropdownShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
        },
        typography: {
            fontSize: '0.95rem',
            fontWeight: 500,
        },
        spacing: {
            itemGap: '0.25rem',
            itemPadding: '0.35rem 0.5rem',
            dropdownItemPadding: '0.35rem 0.6rem',
            dropdownPadding: '0.5rem',
        },
        borders: {
            itemRadius: '0.375rem',
            dropdownRadius: '0.5rem',
        },
        animation: {
            duration: '200ms',
            easing: 'ease',
            caretRotation: true,
        },
        caret: {
            show: true,
            size: '0.875rem',
        },
        dropdownMinWidth: '10rem',
    });

    // Computed mobile nav config
    const mobileNavConfig = $derived<MobileNavConfig>({
        style: mobileNavStyle ?? 'drawer',
        drawerPosition: mobileDrawerPosition ?? 'right',
        colors: {
            background: backgroundColor,
            backgroundHover: navHoverBgColor || 'rgba(255, 255, 255, 0.1)',
            text: textColor,
            dropdownBackground: navDropdownBgColor || backgroundColor,
            dropdownText: navDropdownTextColor || '#ffffff',
        },
        typography: {
            fontSize: '1rem',
            fontWeight: 500,
        },
        showCloseButton: true,
        showBackdrop: true,
        backdropOpacity: 0.5,
        accordionBehavior: 'single',
    });

    let content = $derived({
        id,
        backgroundColor,
        homeIconColor,
        textColor,
        reverseOrder,
        searchEnabled,
        type,
        icons,
        menu: localMenu,
        useMobileMenuOnDesktop,
        menuHidden,
        isSticky,
        // Nav configuration
        navDropdownTrigger,
        navDropdownAlign,
        navSubmenuDirection,
        navHoverBgColor,
        navHoverTextColor,
        navDropdownBgColor,
        navDropdownTextColor,
        navDropdownHoverBgColor,
        navDropdownHoverTextColor,
        mobileNavStyle,
        mobileDrawerPosition,
    });
    const serializeContent = () => JSON.stringify(content);

    const showDesktopMenu = $derived(!useMobileMenuOnDesktop);
    const componentRef = {};

    let component = $state<HTMLElement>();
    let mounted = $state(false);

    onMount(() => {
        mounted = true;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'header' }), 'header', component);
        return () => blockRegistry.unregister(componentRef);
    });

    function hrefFrom(item: any): string {
        if (typeof item?.url === 'string' && item.url.length > 0) return item.url;
        if (typeof item?.link === 'string' && item.link.length > 0) return item.link;
        if (typeof item?.slug === 'string' && item.slug.length > 0) return `/${item.slug}`;
        return '#';
    }

    // Get children from menu item (supports both 'items' and 'children' properties)
    function getChildren(item: any): any[] {
        return item?.children ?? item?.items ?? [];
    }

    // Check if menu item has children
    function hasChildren(item: any): boolean {
        const children = getChildren(item);
        return Array.isArray(children) && children.length > 0;
    }
</script>

{#if editable}
    <div
        class="editor-header-item group relative krt-header__editor"
        bind:this={component}
        data-krt-serialized={serializeContent()}
    >
        {#if mounted}
            <BlockActions 
                {id} 
                {type} 
                element={component}
                inspectorTitle="Header settings"
            >
                {#snippet inspector()}
                    <div class="krt-headerInspector">
                        <!-- Quick Settings -->
                        <InspectorSection title="Quick Settings" icon="⚡" hint="Common adjustments" primary>
                            <ToggleControl label="Sticky Header" bind:checked={isSticky} />
                            <ToggleControl label="Swap Layout" bind:checked={reverseOrder} />
                            <ToggleControl label="Show Search Bar" bind:checked={searchEnabled} />
                        </InspectorSection>

                        <!-- Colors -->
                        <InspectorSection title="Colors" icon="🎨" hint="Header appearance">
                            <ColorControl label="Background" bind:value={backgroundColor} />
                            <ColorControl label="Text" bind:value={textColor} />
                            <ColorControl label="Home Icon" bind:value={homeIconColor} />
                        </InspectorSection>

                        <!-- Social Links -->
                        <SocialLinksEditor bind:icons={icons} />

                        <!-- Desktop Nav Settings -->
                        <NavSettingsPanel
                            bind:dropdownTrigger={navDropdownTrigger}
                            bind:dropdownAlign={navDropdownAlign}
                            bind:submenuDirection={navSubmenuDirection}
                            bind:hoverBgColor={navHoverBgColor}
                            bind:hoverTextColor={navHoverTextColor}
                            bind:dropdownBgColor={navDropdownBgColor}
                            bind:dropdownTextColor={navDropdownTextColor}
                            bind:dropdownHoverBgColor={navDropdownHoverBgColor}
                            bind:mobileStyle={mobileNavStyle}
                            bind:mobileDrawerPosition={mobileDrawerPosition}
                        />
                    </div>
                {/snippet}
            </BlockActions>
        {/if}
        <div
            id={id}
            data-type={type}
            class="krt-header krt-header--twig"
            class:krt-header--sticky={isSticky}
            class:krt-header--forceDesktop={forcedViewport === 'desktop'}
            class:krt-header--forceTablet={forcedViewport === 'tablet'}
            class:krt-header--forcePhone={forcedViewport === 'phone'}
            style:background-color={backgroundColor}
            style:color={textColor}
        >
            <svelte:element this={'script'} type="application/json" data-region-metadata>{serializeContent()}</svelte:element>
            <div class="krt-header__bar" class:krt-header__bar--reversed={reverseOrder}>
                <div class="krt-header__segment">
                    {#if reverseOrder}
                        <div class="krt-header__metaGroup">
                            {#if searchEnabled}
                                <label class="krt-header__search">
                                    <Search aria-hidden="true" />
                                    <input type="text" placeholder="Search" />
                                </label>
                            {/if}
                            {#each icons as { icon, link, name }}
                                {@const Comp = LucideIconMap[icon as LucideIconKey]}
                                <a class="krt-header__iconButton" href={link} aria-label={name}>
                                    <Comp aria-hidden="true" />
                                </a>
                            {/each}
                        </div>
                    {:else}
                        <nav class="krt-header__desktopNav" class:krt-header__desktopNav--visible={showDesktopMenu && !menuHidden}>
                            <a class="krt-header__home" href="homepage" style:color={homeIconColor}>
                                <Home aria-hidden="true" />
                            </a>
                            {#if !menuHidden}
                                <NavMenu 
                                    items={localMenu} 
                                    config={desktopNavConfig}
                                    ariaLabel="Main navigation"
                                />
                            {/if}
                        </nav>
                    {/if}
                </div>

                <div class="krt-header__brand">
                    {#if !menuHidden}
                        <button 
                            type="button"
                            class="krt-header__mobileTrigger"
                            class:krt-header__mobileTrigger--desktopHidden={showDesktopMenu}
                            onclick={() => mobileMenuOpen = true}
                            aria-label="Open menu"
                        >
                            <Menu aria-hidden="true" />
                        </button>
                    {/if}

                    <a class="krt-header__logo" href="homepage">
                        <img src={image.src} alt={image.alt} title={image.title} />
                    </a>
                </div>

                <div class="krt-header__segment">
                    {#if reverseOrder}
                        <nav class="krt-header__desktopNav" class:krt-header__desktopNav--visible={showDesktopMenu && !menuHidden}>
                            <a class="krt-header__home" href="homepage" style:color={homeIconColor}>
                                <Home aria-hidden="true" />
                            </a>
                            {#if !menuHidden}
                                <NavMenu 
                                    items={localMenu} 
                                    config={desktopNavConfig}
                                    ariaLabel="Main navigation"
                                />
                            {/if}
                        </nav>
                    {:else}
                        <div class="krt-header__metaGroup">
                            {#if searchEnabled}
                                <label class="krt-header__search">
                                    <Search aria-hidden="true" />
                                    <input type="text" placeholder="Search" />
                                </label>
                            {/if}
                            {#each icons as { icon, link, name }}
                                {@const Comp = LucideIconMap[icon as LucideIconKey]}
                                <a class="krt-header__iconButton" href={link} aria-label={name}>
                                    <Comp aria-hidden="true" />
                                </a>
                            {/each}
                        </div>
                    {/if}
                </div>
            </div>
        </div>

        <!-- Mobile Navigation Menu -->
        <NavMenuMobile 
            items={localMenu}
            config={mobileNavConfig}
            bind:isOpen={mobileMenuOpen}
            useFixedPosition={false}
        />
    </div>

{:else}
    <div
        id={id}
        data-type={type}
        class="krt-header krt-header--twig"
        class:krt-header--sticky={isSticky}
        style:background-color={backgroundColor}
        style:color={textColor}
        data-krt-serialized={serializeContent()}
    >
        <div id="metadata-{id}" style="display: none;">{serializeContent()}</div>
        <svelte:element this={'script'} type="application/json" data-region-metadata>{serializeContent()}</svelte:element>
        <div class="krt-header__bar" class:krt-header__bar--reversed={reverseOrder}>
            <div class="krt-header__segment">
                {#if reverseOrder}
                    <div class="krt-header__metaGroup">
                        {#if searchEnabled}
                            <label class="krt-header__search">
                                <Search aria-hidden="true" />
                                <input type="text" placeholder="Search" />
                            </label>
                        {/if}
                        {#each icons as { icon, link, name }}
                            {@const Comp = LucideIconMap[icon as LucideIconKey]}
                            <a class="krt-header__iconButton" href={link} aria-label={name}>
                                <Comp aria-hidden="true" />
                            </a>
                        {/each}
                    </div>
                {:else}
                    <nav class="krt-header__desktopNav" class:krt-header__desktopNav--visible={showDesktopMenu && !menuHidden}>
                        <a class="krt-header__home" href="homepage" style:color={homeIconColor}>
                            <Home aria-hidden="true" />
                        </a>
                        {#if !menuHidden}
                            <NavMenu 
                                items={localMenu} 
                                config={desktopNavConfig}
                                ariaLabel="Main navigation"
                            />
                        {/if}
                    </nav>
                {/if}
            </div>

            <div class="krt-header__brand">
                {#if !menuHidden}
                    <button 
                        type="button"
                        class="krt-header__mobileTrigger"
                        class:krt-header__mobileTrigger--desktopHidden={showDesktopMenu}
                        onclick={() => mobileMenuOpen = true}
                        aria-label="Open menu"
                    >
                        <Menu aria-hidden="true" />
                    </button>
                {/if}

                <a class="krt-header__logo" href="homepage">
                    <img src={image.src} alt={image.alt} title={image.title} />
                </a>
            </div>

            <div class="krt-header__segment">
                {#if reverseOrder}
                    <nav class="krt-header__desktopNav" class:krt-header__desktopNav--visible={showDesktopMenu && !menuHidden}>
                        <a class="krt-header__home" href="homepage" style:color={homeIconColor}>
                            <Home aria-hidden="true" />
                        </a>
                        {#if !menuHidden}
                            <NavMenu 
                                items={localMenu} 
                                config={desktopNavConfig}
                                ariaLabel="Main navigation"
                            />
                        {/if}
                    </nav>
                {:else}
                    <div class="krt-header__metaGroup">
                        {#if searchEnabled}
                            <label class="krt-header__search">
                                <Search aria-hidden="true" />
                                <input type="text" placeholder="Search" />
                            </label>
                        {/if}
                        {#each icons as { icon, link, name }}
                            {@const Comp = LucideIconMap[icon as LucideIconKey]}
                            <a class="krt-header__iconButton" href={link} aria-label={name}>
                                <Comp aria-hidden="true" />
                            </a>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>

        <!-- Mobile Navigation Menu -->
        <NavMenuMobile 
            items={localMenu}
            config={mobileNavConfig}
            bind:isOpen={mobileMenuOpen}
        />
    </div>
{/if}

<style>
    /* Inspector container */
    .krt-headerInspector {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-xl, 1.5rem);
    }

    /* Header Component Styles */
    .krt-header {
        padding: 0 var(--krt-space-lg, 1rem);
        container-type: inline-size;
        container-name: twig-header;
    }

    .krt-header--sticky {
        position: sticky;
        top: 0;
        z-index: 100;
    }

    .krt-header__bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--krt-space-md, 0.75rem);
        padding: var(--krt-space-md, 0.75rem) 0;
    }

    .krt-header__bar--reversed {
        flex-direction: row-reverse;
    }

    .krt-header__segment {
        flex: 1 1 0;
        display: flex;
        align-items: center;
        justify-content: flex-start;
    }

    .krt-header__metaGroup {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--krt-space-sm, 0.5rem);
        width: 100%;
    }

    .krt-header__desktopNav {
        display: none;
        align-items: center;
        gap: var(--krt-space-md, 0.75rem);
    }

    .krt-header__desktopNav--visible {
        display: none;
    }

    /* Use container query so it works in editor preview */
    @container twig-header (min-width: 64rem) {
        .krt-header__desktopNav--visible {
            display: flex;
        }

        .krt-header__metaGroup {
            justify-content: flex-end;
        }
    }

    /* Fallback for browsers without container query support */
    @supports not (container-type: inline-size) {
        @media (min-width: 64rem) {
            .krt-header__desktopNav--visible {
                display: flex;
            }

            .krt-header__metaGroup {
                justify-content: flex-end;
            }
        }
    }

    .krt-header__home {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 3rem;
        height: 3rem;
        border-radius: var(--krt-radius-pill, 999px);
        border: 1px solid transparent;
        transition: border 150ms ease, transform 150ms ease;
        color: inherit;
    }

    .krt-header__home:hover {
        border-color: color-mix(in srgb, currentColor 30%, transparent);
        transform: translateY(-1px);
    }

    .krt-header__brand {
        display: flex;
        align-items: center;
        gap: var(--krt-space-sm, 0.5rem);
        justify-content: center;
        position: relative;
    }

    .krt-header__logo {
        display: inline-flex;
        align-items: center;
        gap: var(--krt-space-sm, 0.5rem);
        padding: 0.35rem 0.75rem;
        border-radius: var(--krt-radius-pill, 999px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(0, 0, 0, 0.35);
    }

    .krt-header__logo img {
        height: 1.75rem;
        width: auto;
        display: block;
    }

    .krt-header__mobileTrigger {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.75rem;
        height: 2.75rem;
        border-radius: var(--krt-radius-pill, 999px);
        border: 1px solid rgba(255, 255, 255, 0.16);
        background: transparent;
        color: inherit;
        cursor: pointer;
        transition: background 150ms ease;
    }

    .krt-header__mobileTrigger:hover {
        background: rgba(255, 255, 255, 0.12);
    }

    .krt-header__mobileTrigger--desktopHidden {
        display: inline-flex;
    }

    /* Use container query so it works in editor preview */
    @container twig-header (min-width: 64rem) {
        .krt-header__mobileTrigger--desktopHidden {
            display: none;
        }
    }

    /* Fallback for browsers without container query support */
    @supports not (container-type: inline-size) {
        @media (min-width: 64rem) {
            .krt-header__mobileTrigger--desktopHidden {
                display: none;
            }
        }
    }

    .krt-header__iconButton {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: var(--krt-radius-pill, 999px);
        border: 1px solid rgba(255, 255, 255, 0.16);
        background: transparent;
        color: inherit;
        transition: background 150ms ease, transform 150ms ease;
    }

    .krt-header__iconButton:hover {
        background: rgba(255, 255, 255, 0.12);
        transform: translateY(-1px);
    }

    .krt-header__search {
        display: none;
        align-items: center;
        gap: var(--krt-space-xs, 0.25rem);
        padding: 0.25rem 0.5rem;
        border-radius: var(--krt-radius-pill, 999px);
        border: 1px solid rgba(255, 255, 255, 0.16);
        background: rgba(0, 0, 0, 0.35);
        color: inherit;
    }

    .krt-header__search input {
        border: none;
        background: transparent;
        color: inherit;
        font-size: 0.85rem;
        width: 8rem;
    }

    .krt-header__search input::placeholder {
        color: rgba(255, 255, 255, 0.6);
    }

    /* Use container query so it works in editor preview */
    @container twig-header (min-width: 64rem) {
        .krt-header__search {
            display: inline-flex;
        }
    }

    /* Fallback for browsers without container query support */
    @supports not (container-type: inline-size) {
        @media (min-width: 64rem) {
            .krt-header__search {
                display: inline-flex;
            }
        }
    }

    .krt-header__editor {
        position: static; /* Allow mobile menu to escape to canvas positioning context */
    }

    /* ============================================
       FORCED VIEWPORT OVERRIDES
       These override container queries when editor 
       preview size buttons are used
       ============================================ */
    
    /* Force Desktop: Show desktop nav, hide mobile trigger */
    .krt-header--forceDesktop .krt-header__desktopNav {
        display: flex !important;
    }
    .krt-header--forceDesktop .krt-header__mobileTrigger {
        display: none !important;
    }
    .krt-header--forceDesktop .krt-header__search {
        display: inline-flex !important;
    }

    /* Force Tablet/Phone: Hide desktop nav, show mobile trigger */
    .krt-header--forceTablet .krt-header__desktopNav,
    .krt-header--forcePhone .krt-header__desktopNav {
        display: none !important;
    }
    .krt-header--forceTablet .krt-header__mobileTrigger,
    .krt-header--forcePhone .krt-header__mobileTrigger {
        display: inline-flex !important;
    }
    .krt-header--forceTablet .krt-header__search,
    .krt-header--forcePhone .krt-header__search {
        display: none !important;
    }
</style>
