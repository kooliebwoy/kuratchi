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
        LogoEditor,
        SocialLinksEditor
    } from '../widgets/index.js';
    import { LucideIconMap, type LucideIconKey } from '../utils/lucide-icons.js';
    import { Menu } from '@lucide/svelte';
    import { blockRegistry } from '../stores/editorSignals.svelte.js';

    interface LogoData {
        url: string;
        alt: string;
    }

    // Nav configuration types
    type DropdownTriggerOption = 'hover' | 'click';
    type DropdownAlignOption = 'start' | 'center' | 'end';
    type SubmenuDirectionOption = 'left' | 'right';
    type MobileStyleOption = 'drawer' | 'fullscreen';
    type DrawerPositionOption = 'left' | 'right';

    interface Props {
        type?: string;
        backgroundColor?: string;
        textColor?: string;
        reverseOrder?: boolean;
        icons?: any;
        menu?: any;
        logo?: LogoData;
        editable?: boolean;
        isSticky?: boolean;
        menuHidden?: boolean;
        // Nav configuration props
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
        /** 
         * Forced viewport for editor preview. 
         * Overrides container queries to match selected device size.
         */
        forcedViewport?: 'phone' | 'tablet' | 'desktop';
    }

    const DEFAULT_MENU: NavMenuItem[] = [
        { id: '1', label: 'Home', url: '/' },
        {
            id: '2',
            label: 'Products',
            children: [
                { id: '2a', label: 'Product A', url: '/product-a' },
                { id: '2b', label: 'Product B', url: '/product-b' },
            ],
        },
        { id: '3', label: 'About Us', url: '/about' },
        { id: '4', label: 'Contact', url: '/contact' },
    ];

    let {
        type = 'saige-blake-header',
        backgroundColor: initialBackgroundColor = '#ffffff',
        textColor: initialTextColor = '#92c8c8',
        reverseOrder: initialReverseOrder = false,
        icons: initialIcons = [
            { icon: 'facebook', link: '#', name: "Facebook", enabled: true },
            { icon: 'x', link: '#', name: "X", enabled: true },
            { icon: 'instagram', link: '#', name: "Instagram", enabled: true },
        ] as { icon: LucideIconKey; link: string; name: string; enabled: boolean }[],
        menu: initialMenu = [],
        logo: initialLogo = {
            url: '/clutch-cms-logo.png',
            alt: 'Clutch CMS Logo'
        },
        editable = true,
        // Nav configuration props (initial values, become local state)
        navDropdownTrigger: initialNavDropdownTrigger = 'hover' as DropdownTriggerOption,
        navDropdownAlign: initialNavDropdownAlign = 'start' as DropdownAlignOption,
        navSubmenuDirection: initialNavSubmenuDirection = 'right' as SubmenuDirectionOption,
        navHoverBgColor: initialNavHoverBgColor = 'color-mix(in srgb, currentColor 8%, transparent)',
        navHoverTextColor: initialNavHoverTextColor = '',
        navDropdownBgColor: initialNavDropdownBgColor = '',
        navDropdownTextColor: initialNavDropdownTextColor = '#1f2937',
        navDropdownHoverBgColor: initialNavDropdownHoverBgColor = '',
        navDropdownHoverTextColor: initialNavDropdownHoverTextColor = '',
        mobileNavStyle: initialMobileNavStyle = 'drawer' as MobileStyleOption,
        mobileDrawerPosition: initialMobileDrawerPosition = 'right' as DrawerPositionOption,
        isSticky: initialIsSticky = false,
        menuHidden = false,
        forcedViewport,
    }: Props = $props();

    // Normalize menu items to use 'children' and 'url' properties
    function normalizeMenuItems(items: any[]): NavMenuItem[] {
        return items.map((item, index) => ({
            id: item.id || `item-${index}`,
            label: item.label,
            url: item.url || item.slug || item.link,
            children: item.children || item.items ? normalizeMenuItems(item.children || item.items) : undefined,
        }));
    }

    // Menu items come from props (injected by Dashboard via siteMetadata.navigation.header.items)
    // Navigation CRUD is handled in Dashboard, not editable in header component
    const resolvedMenu = (initialMenu?.length ?? 0) > 0
        ? normalizeMenuItems(initialMenu)
        : DEFAULT_MENU;

    // Use local state for logo so changes trigger reactivity
    let logo = $state<LogoData>(initialLogo);
    
    // Use local state for icons so changes trigger reactivity
    let icons = $state<{ icon: LucideIconKey; link: string; name: string; enabled: boolean }[]>(initialIcons);
    
    // Use local state for other properties so changes trigger reactivity
    let backgroundColor = $state(initialBackgroundColor);
    let textColor = $state(initialTextColor);
    let reverseOrder = $state(initialReverseOrder);

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

    let id = crypto.randomUUID();
    let localMenu = $state<NavMenuItem[]>(resolvedMenu);
    let logoUrl = $derived(logo?.url || '');
    let logoAlt = $derived(logo?.alt || 'Logo');

    // Computed desktop nav config - light theme style
    const desktopNavConfig = $derived<DesktopNavConfig>({
        orientation: 'horizontal',
        dropdownTrigger: navDropdownTrigger ?? 'hover',
        dropdownAlign: navDropdownAlign ?? 'start',
        submenuDirection: navSubmenuDirection ?? 'right',
        colors: {
            background: 'transparent',
            backgroundHover: navHoverBgColor || 'color-mix(in srgb, currentColor 8%, transparent)',
            backgroundActive: navHoverBgColor || 'color-mix(in srgb, currentColor 8%, transparent)',
            text: textColor,
            textHover: navHoverTextColor || textColor,
            dropdownBackground: navDropdownBgColor || 'rgba(255, 255, 255, 0.96)',
            dropdownItemHover: navDropdownHoverBgColor || 'rgba(15, 23, 42, 0.08)',
            dropdownText: navDropdownTextColor || '#1f2937',
            dropdownBorder: 'rgba(15, 23, 42, 0.12)',
            dropdownShadow: '0 18px 45px rgba(15, 23, 42, 0.15)',
        },
        typography: {
            fontSize: '0.95rem',
            fontWeight: 600,
        },
        spacing: {
            itemGap: '0.25rem',
            itemPadding: '0.35rem 0.5rem',
            dropdownItemPadding: '0.5rem 0.65rem',
            dropdownPadding: '0.5rem',
        },
        borders: {
            itemRadius: '0.375rem',
            dropdownRadius: '0.75rem',
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
        dropdownMinWidth: '11rem',
    });

    // Computed mobile nav config
    const mobileNavConfig = $derived<MobileNavConfig>({
        style: mobileNavStyle ?? 'drawer',
        drawerPosition: mobileDrawerPosition ?? 'right',
        colors: {
            background: 'rgba(255, 255, 255, 0.96)',
            backgroundHover: navDropdownHoverBgColor || 'rgba(15, 23, 42, 0.08)',
            text: navDropdownTextColor || '#1f2937',
            dropdownBackground: 'rgba(15, 23, 42, 0.04)',
            dropdownText: navDropdownTextColor || '#1f2937',
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
        textColor,
        reverseOrder,
        type,
        icons,
        menu: localMenu,
        logo,
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
        isSticky,
    });
    const serializeContent = () => JSON.stringify(content);
    const componentRef = {};

    let component = $state<HTMLElement>();
    let mounted = $state(false);

    onMount(() => {
        mounted = true;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'header' }), 'header', component);
        return () => blockRegistry.unregister(componentRef);
    });
</script>

{#if editable}
<div
        class="editor-header-item krt-header__editor"
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
                    </InspectorSection>

                    <!-- Logo -->
                    <LogoEditor bind:logo={logo} />

                    <!-- Colors -->
                    <InspectorSection title="Colors" icon="🎨" hint="Header appearance">
                        <ColorControl label="Background" bind:value={backgroundColor} />
                        <ColorControl label="Text" bind:value={textColor} />
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
        {id}
        class="krt-header krt-header--saige"
        class:krt-header--sticky={isSticky}
        class:krt-header--forceDesktop={forcedViewport === 'desktop'}
        class:krt-header--forceTablet={forcedViewport === 'tablet'}
        class:krt-header--forcePhone={forcedViewport === 'phone'}
        style:background-color={backgroundColor}
        style:color={textColor}
        data-type={type}
    >
        <svelte:element this={"script"} type="application/json" data-region-metadata>{serializeContent()}</svelte:element>
        <div class="krt-header__bar" class:krt-header__bar--reversed={reverseOrder}>
            <div class="krt-header__segment">
                {#if reverseOrder}
                    <div class="krt-header__metaGroup">
                        {#each icons as { icon, link, name }}
                            {@const Comp = LucideIconMap[icon as LucideIconKey]}
                            <a class="krt-header__iconButton" href={link} aria-label={name}>
                                <Comp aria-hidden="true" />
                            </a>
                        {/each}
                    </div>
                {:else}
                    <div class="krt-header__navShell">
                        <a class="krt-header__logoLink" href="homepage">
                            {#if logoUrl}
                                <img src={logoUrl} alt={logoAlt} />
                            {/if}
                        </a>
                        {#if localMenu.length}
                            <NavMenu 
                                items={localMenu} 
                                config={desktopNavConfig}
                                ariaLabel="Main navigation"
                            />
                        {/if}
                    </div>
                {/if}
            </div>

            <div class="krt-header__brand">
                {#if localMenu.length}
                    <button 
                        class="krt-header__mobileTrigger"
                        type="button"
                        aria-label="Toggle menu"
                        onclick={() => mobileMenuOpen = !mobileMenuOpen}
                    >
                        <Menu aria-hidden="true" />
                    </button>
                {/if}
            </div>

            <div class="krt-header__segment">
                {#if reverseOrder}
                    <div class="krt-header__navShell">
                        <a class="krt-header__logoLink" href="/">
                            {#if logoUrl}
                                <img src={logoUrl} alt={logoAlt} />
                            {/if}
                        </a>
                        {#if localMenu.length}
                            <NavMenu 
                                items={localMenu} 
                                config={desktopNavConfig}
                                ariaLabel="Main navigation"
                            />
                        {/if}
                    </div>
                {:else}
                    <div class="krt-header__metaGroup">
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

    <NavMenuMobile
        items={localMenu}
        config={mobileNavConfig}
        bind:isOpen={mobileMenuOpen}
        onClose={() => mobileMenuOpen = false}
        useFixedPosition={false}
    />
</div>

{:else}
    <div
        {id}
        class="krt-header krt-header--saige"
        class:krt-header--sticky={isSticky}
        style:background-color={backgroundColor}
        style:color={textColor}
        data-type={type}
        data-krt-serialized={serializeContent()}
    >
        <div id="metadata-{id}" style="display: none;">{serializeContent()}</div>
        <svelte:element this={"script"} type="application/json" data-region-metadata>{serializeContent()}</svelte:element>
        <div class="krt-header__bar" class:krt-header__bar--reversed={reverseOrder}>
            <div class="krt-header__segment">
                {#if reverseOrder}
                    <div class="krt-header__metaGroup">
                        {#each icons as { icon, link, name }}
                            {@const Comp = LucideIconMap[icon as LucideIconKey]}
                            <a class="krt-header__iconButton" href={link} aria-label={name}>
                                <Comp aria-hidden="true" />
                            </a>
                        {/each}
                    </div>
                {:else}
                    <div class="krt-header__navShell">
                        <a class="krt-header__logoLink" href="/">
                            {#if logoUrl}
                                <img src={logoUrl} alt={logoAlt} />
                            {/if}
                        </a>
                        {#if localMenu.length}
                            <NavMenu 
                                items={localMenu} 
                                config={desktopNavConfig}
                                ariaLabel="Main navigation"
                            />
                        {/if}
                    </div>
                {/if}
            </div>

            <div class="krt-header__brand">
                {#if localMenu.length}
                    <button 
                        class="krt-header__mobileTrigger"
                        type="button"
                        aria-label="Toggle menu"
                        onclick={() => mobileMenuOpen = !mobileMenuOpen}
                    >
                        <Menu aria-hidden="true" />
                    </button>
                {/if}
            </div>

            <div class="krt-header__segment">
                {#if reverseOrder}
                    <div class="krt-header__navShell">
                        <a class="krt-header__logoLink" href="/">
                            {#if logoUrl}
                                <img src={logoUrl} alt={logoAlt} />
                            {/if}
                        </a>
                        {#if localMenu.length}
                            <NavMenu 
                                items={localMenu} 
                                config={desktopNavConfig}
                                ariaLabel="Main navigation"
                            />
                        {/if}
                    </div>
                {:else}
                    <div class="krt-header__metaGroup">
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

        <NavMenuMobile
            items={localMenu}
            config={mobileNavConfig}
            bind:isOpen={mobileMenuOpen}
            onClose={() => mobileMenuOpen = false}
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
        padding: 0 var(--krt-space-xl, 1.25rem);
        container-type: inline-size;
        container-name: header;
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
        gap: var(--krt-space-lg, 1rem);
        padding: var(--krt-space-md, 0.75rem) 0;
    }

    .krt-header__segment {
        flex: 1 1 0;
        display: flex;
        align-items: center;
    }

    .krt-header__navShell {
        display: none;
        align-items: center;
        gap: var(--krt-space-lg, 1rem);
        width: 100%;
    }

    /* Use container query so it works in editor preview */
    @container header (min-width: 64rem) {
        .krt-header__navShell {
            display: flex;
        }
    }

    /* Fallback for browsers without container query support */
    @supports not (container-type: inline-size) {
        @media (min-width: 64rem) {
            .krt-header__navShell {
                display: flex;
            }
        }
    }

    .krt-header__logoLink {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.35rem 0.5rem;
        border-radius: var(--krt-radius-md, 0.5rem);
        border: 1px solid color-mix(in srgb, currentColor 16%, transparent);
        transition: border 150ms ease, transform 150ms ease;
    }

    .krt-header__logoLink:hover {
        transform: translateY(-1px);
    }

    .krt-header__logoLink img {
        height: 1.5rem;
        width: auto;
        display: block;
    }

    .krt-header__brand {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--krt-space-sm, 0.5rem);
        position: relative;
    }

    .krt-header__mobileTrigger {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: var(--krt-radius-pill, 999px);
        border: 1px solid color-mix(in srgb, currentColor 16%, transparent);
        background: rgba(255, 255, 255, 0.65);
        color: inherit;
        cursor: pointer;
        transition: background 150ms ease, transform 150ms ease;
    }

    .krt-header__mobileTrigger:hover {
        background: rgba(255, 255, 255, 0.85);
        transform: translateY(-1px);
    }

    /* Use container query so it works in editor preview */
    @container header (min-width: 64rem) {
        .krt-header__mobileTrigger {
            display: none;
        }
    }

    /* Fallback for browsers without container query support */
    @supports not (container-type: inline-size) {
        @media (min-width: 64rem) {
            .krt-header__mobileTrigger {
                display: none;
            }
        }
    }

    .krt-header__metaGroup {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--krt-space-sm, 0.5rem);
        width: 100%;
    }

    .krt-header__iconButton {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: var(--krt-radius-pill, 999px);
        border: 1px solid color-mix(in srgb, currentColor 16%, transparent);
        background: rgba(255, 255, 255, 0.5);
        color: inherit;
        transition: background 150ms ease, transform 150ms ease;
    }

    .krt-header__iconButton:hover {
        background: rgba(255, 255, 255, 0.85);
        transform: translateY(-1px);
    }

    .krt-header__iconButton :global(svg) {
        width: 1.1rem;
        height: 1.1rem;
    }

    .krt-header__editor {
        position: static; /* Allow mobile menu to escape to canvas positioning context */
    }

    /* ============================================
       FORCED VIEWPORT OVERRIDES
       These override container queries when editor 
       preview size buttons are used
       ============================================ */
    
    /* Force Desktop: Always show desktop nav, hide mobile trigger */
    .krt-header--forceDesktop .krt-header__navShell {
        display: flex !important;
    }
    .krt-header--forceDesktop .krt-header__mobileTrigger {
        display: none !important;
    }

    /* Force Tablet/Phone: Always show mobile trigger, hide desktop nav */
    .krt-header--forceTablet .krt-header__navShell,
    .krt-header--forcePhone .krt-header__navShell {
        display: none !important;
    }
    .krt-header--forceTablet .krt-header__mobileTrigger,
    .krt-header--forcePhone .krt-header__mobileTrigger {
        display: inline-flex !important;
    }
</style>
