<script lang="ts">
    import { Pencil } from '@lucide/svelte';
    import { onMount } from 'svelte';
    import { BlockActions } from '../utils/index.js';
    import { IconPicker, NavMenu, NavMenuMobile, type DesktopNavConfig, type MobileNavConfig, type NavMenuItem } from '../widgets/index.js';
    import { LucideIconMap, type LucideIconKey } from '../utils/lucide-icons.js';
    import { Home, Search, Menu, ChevronDown } from '@lucide/svelte';
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
        // New nav configuration props
        navDropdownTrigger?: DropdownTriggerOption;
        navDropdownAlign?: DropdownAlignOption;
        navSubmenuDirection?: SubmenuDirectionOption;
        navHoverBgColor?: string;
        navDropdownBgColor?: string;
        navDropdownTextColor?: string;
        mobileNavStyle?: MobileStyleOption;
        mobileDrawerPosition?: DrawerPositionOption;
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
        // Nav configuration props
        navDropdownTrigger: initialNavDropdownTrigger = 'hover' as DropdownTriggerOption,
        navDropdownAlign: initialNavDropdownAlign = 'start' as DropdownAlignOption,
        navSubmenuDirection: initialNavSubmenuDirection = 'right' as SubmenuDirectionOption,
        navHoverBgColor: initialNavHoverBgColor = 'rgba(255, 255, 255, 0.1)',
        navDropdownBgColor: initialNavDropdownBgColor = '',
        navDropdownTextColor: initialNavDropdownTextColor = '#ffffff',
        mobileNavStyle: initialMobileNavStyle = 'drawer' as MobileStyleOption,
        mobileDrawerPosition: initialMobileDrawerPosition = 'right' as DrawerPositionOption,
        isSticky: initialIsSticky = false,
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

    const resolvedMenu = (!initialMenuHidden && (initialMenu?.length ?? 0) === 0)
        ? DEFAULT_MENU
        : normalizeMenuItems(initialMenu);

    let searchEnabled = $state(initialSearchEnabled);
    let backgroundColor = $state(initialBackgroundColor);
    let homeIconColor = $state(initialHomeIconColor);
    let textColor = $state(initialTextColor);
    let reverseOrder = $state(initialReverseOrder);
    let icons = $state<{ icon: LucideIconKey; link: string; name: string; enabled: boolean }[]>(initialIcons);
    let localMenu = $state<NavMenuItem[]>(resolvedMenu);
    let useMobileMenuOnDesktop = $state(initialUseMobileMenuOnDesktop);
    let menuHidden = $state(initialMenuHidden);

    // Nav configuration state
    let navDropdownTrigger = $state<DropdownTriggerOption>(initialNavDropdownTrigger);
    let navDropdownAlign = $state<DropdownAlignOption>(initialNavDropdownAlign);
    let navSubmenuDirection = $state<SubmenuDirectionOption>(initialNavSubmenuDirection);
    let navHoverBgColor = $state(initialNavHoverBgColor);
    let navDropdownBgColor = $state(initialNavDropdownBgColor);
    let navDropdownTextColor = $state(initialNavDropdownTextColor);
    let mobileNavStyle = $state<MobileStyleOption>(initialMobileNavStyle);
    let mobileDrawerPosition = $state<DrawerPositionOption>(initialMobileDrawerPosition);
    let mobileMenuOpen = $state(false);
    let isSticky = $state(initialIsSticky);

    // Computed desktop nav config
    const desktopNavConfig = $derived<DesktopNavConfig>({
        orientation: 'horizontal',
        dropdownTrigger: navDropdownTrigger,
        dropdownAlign: navDropdownAlign,
        submenuDirection: navSubmenuDirection,
        colors: {
            background: 'transparent',
            backgroundHover: navHoverBgColor,
            backgroundActive: navHoverBgColor,
            text: textColor,
            textHover: textColor,
            dropdownBackground: navDropdownBgColor || backgroundColor,
            dropdownItemHover: navHoverBgColor,
            dropdownText: navDropdownTextColor,
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
        style: mobileNavStyle,
        drawerPosition: mobileDrawerPosition,
        colors: {
            background: backgroundColor,
            backgroundHover: navHoverBgColor,
            text: textColor,
            dropdownBackground: navDropdownBgColor || backgroundColor,
            dropdownText: navDropdownTextColor,
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
        navDropdownBgColor,
        navDropdownTextColor,
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
                    <div class="krt-headerDrawer">
                        <section class="krt-headerDrawer__section">
                            <h3 class="krt-headerDrawer__title">Behavior</h3>
                            <div class="krt-headerDrawer__cards">
                                <label class="krt-headerDrawer__card">
                                    <input type="checkbox" class="krt-switch" bind:checked={isSticky} />
                                    <span>Sticky Header</span>
                                </label>
                            </div>
                        </section>

                        <section class="krt-headerDrawer__section">
                            <h3 class="krt-headerDrawer__title">Layout</h3>
                            <div class="krt-headerDrawer__cards">
                                <label class="krt-headerDrawer__card">
                                    <input type="checkbox" class="krt-switch" bind:checked={reverseOrder} />
                                    <span>Swap Icons and Nav Menu</span>
                                </label>
                                <label class="krt-headerDrawer__card">
                                    <input type="checkbox" class="krt-switch" bind:checked={searchEnabled} />
                                    <span>Search Bar Enabled</span>
                                </label>
                            </div>
                        </section>

                        <section class="krt-headerDrawer__section">
                            <h3 class="krt-headerDrawer__title">Styling</h3>
                            <div class="krt-headerDrawer__cards">
                                <label class="krt-headerDrawer__card krt-headerDrawer__card--color">
                                    <span>Background Color</span>
                                    <div class="krt-headerDrawer__colorControl">
                                        <input type="color" bind:value={backgroundColor} />
                                        <span>{backgroundColor}</span>
                                    </div>
                                </label>
                                <label class="krt-headerDrawer__card krt-headerDrawer__card--color">
                                    <span>Home Icon Color</span>
                                    <div class="krt-headerDrawer__colorControl">
                                        <input type="color" bind:value={homeIconColor} />
                                        <span>{homeIconColor}</span>
                                    </div>
                                </label>
                                <label class="krt-headerDrawer__card krt-headerDrawer__card--color">
                                    <span>Text Color</span>
                                    <div class="krt-headerDrawer__colorControl">
                                        <input type="color" bind:value={textColor} />
                                        <span>{textColor}</span>
                                    </div>
                                </label>
                            </div>
                        </section>

                        <section class="krt-headerDrawer__section">
                            <h3 class="krt-headerDrawer__title">Social Icons</h3>
                            <div class="krt-headerDrawer__cards">
                                <div class="krt-headerDrawer__card">
                                    <IconPicker bind:selectedIcons={icons} />
                                </div>

                                {#each icons as icon}
                                    {@const Comp = LucideIconMap[icon.icon as LucideIconKey]}
                                    <label class="krt-headerDrawer__card krt-headerDrawer__card--icon">
                                        <div class="krt-headerDrawer__iconHeading">
                                            <Comp aria-hidden="true" />
                                            <span>{icon.name}</span>
                                        </div>
                                        <input
                                            type="text"
                                            class="krt-headerDrawer__input"
                                            placeholder="https://example.com"
                                            value={icon.link}
                                            onchange={(e) => icon.link = (e.target as HTMLInputElement).value}
                                        />
                                    </label>
                                {/each}
                            </div>
                        </section>

                        <section class="krt-headerDrawer__section">
                            <h3 class="krt-headerDrawer__title">Navigation Style</h3>
                            <div class="krt-headerDrawer__cards">
                                <label class="krt-headerDrawer__card">
                                    <span>Dropdown Trigger</span>
                                    <select class="krt-headerDrawer__select" bind:value={navDropdownTrigger}>
                                        <option value="hover">Hover</option>
                                        <option value="click">Click</option>
                                    </select>
                                </label>
                                <label class="krt-headerDrawer__card">
                                    <span>Dropdown Align</span>
                                    <select class="krt-headerDrawer__select" bind:value={navDropdownAlign}>
                                        <option value="start">Left</option>
                                        <option value="center">Center</option>
                                        <option value="end">Right</option>
                                    </select>
                                </label>
                                <label class="krt-headerDrawer__card">
                                    <span>Submenu Direction</span>
                                    <select class="krt-headerDrawer__select" bind:value={navSubmenuDirection}>
                                        <option value="right">Right</option>
                                        <option value="left">Left</option>
                                    </select>
                                </label>
                                <label class="krt-headerDrawer__card krt-headerDrawer__card--color">
                                    <span>Hover Background</span>
                                    <div class="krt-headerDrawer__colorControl">
                                        <input type="color" bind:value={navHoverBgColor} />
                                        <span>{navHoverBgColor}</span>
                                    </div>
                                </label>
                                <label class="krt-headerDrawer__card krt-headerDrawer__card--color">
                                    <span>Dropdown Background</span>
                                    <div class="krt-headerDrawer__colorControl">
                                        <input type="color" bind:value={navDropdownBgColor} />
                                        <span>{navDropdownBgColor || 'Same as header'}</span>
                                    </div>
                                </label>
                                <label class="krt-headerDrawer__card krt-headerDrawer__card--color">
                                    <span>Dropdown Text Color</span>
                                    <div class="krt-headerDrawer__colorControl">
                                        <input type="color" bind:value={navDropdownTextColor} />
                                        <span>{navDropdownTextColor}</span>
                                    </div>
                                </label>
                            </div>
                        </section>

                        <section class="krt-headerDrawer__section">
                            <h3 class="krt-headerDrawer__title">Mobile Menu</h3>
                            <div class="krt-headerDrawer__cards">
                                <label class="krt-headerDrawer__card">
                                    <span>Menu Style</span>
                                    <select class="krt-headerDrawer__select" bind:value={mobileNavStyle}>
                                        <option value="drawer">Drawer</option>
                                        <option value="fullscreen">Fullscreen</option>
                                    </select>
                                </label>
                                {#if mobileNavStyle === 'drawer'}
                                    <label class="krt-headerDrawer__card">
                                        <span>Drawer Position</span>
                                        <select class="krt-headerDrawer__select" bind:value={mobileDrawerPosition}>
                                            <option value="right">Right</option>
                                            <option value="left">Left</option>
                                        </select>
                                    </label>
                                {/if}
                            </div>
                        </section>
                    </div>
                {/snippet}
            </BlockActions>
        {/if}
        <div
            id={id}
            data-type={type}
            class="krt-header krt-header--twig"
            class:krt-header--sticky={isSticky}
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
    .krt-headerDrawer {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-lg, 1rem);
    }

    .krt-headerDrawer__section {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-md, 0.75rem);
    }

    .krt-headerDrawer__title {
        margin: 0;
        font-size: 0.8rem;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--krt-color-muted, #6b7280);
    }

    .krt-headerDrawer__cards {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-sm, 0.5rem);
    }

    .krt-headerDrawer__card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--krt-space-sm, 0.5rem);
        padding: var(--krt-space-md, 0.75rem) var(--krt-space-lg, 1rem);
        border-radius: var(--krt-radius-md, 0.5rem);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        background: var(--krt-color-surface, #ffffff);
        font-size: 0.9rem;
    }

    .krt-headerDrawer__card span {
        font-weight: 500;
    }

    .krt-headerDrawer__select {
        padding: 0.4rem 0.6rem;
        border-radius: var(--krt-radius-sm, 0.375rem);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        background: var(--krt-color-bg, #fafafa);
        font-size: 0.85rem;
        color: var(--krt-color-text, #1f2937);
        cursor: pointer;
        min-width: 6rem;
    }

    .krt-headerDrawer__select:focus {
        outline: 2px solid var(--krt-color-primary, #3b82f6);
        outline-offset: 1px;
    }

    .krt-headerDrawer__card--color {
        flex-direction: column;
        align-items: flex-start;
    }

    .krt-headerDrawer__colorControl {
        display: flex;
        align-items: center;
        gap: var(--krt-space-sm, 0.5rem);
        font-family: 'SFMono-Regular', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 0.75rem;
        color: var(--krt-color-muted, #6b7280);
    }

    .krt-headerDrawer__colorControl input[type='color'] {
        width: 2.5rem;
        height: 2.5rem;
        border-radius: var(--krt-radius-md, 0.5rem);
        border: 2px solid var(--krt-color-border-subtle, #e5e7eb);
        background: none;
        padding: 0;
        cursor: pointer;
    }

    .krt-headerDrawer__card--icon {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--krt-space-sm, 0.5rem);
    }

    .krt-headerDrawer__iconHeading {
        display: flex;
        align-items: center;
        gap: var(--krt-space-sm, 0.5rem);
        font-size: 0.75rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--krt-color-muted, #6b7280);
    }

    .krt-headerDrawer__iconHeading :global(svg) {
        width: 1.5rem;
        height: 1.5rem;
        color: var(--krt-color-accent, #4f46e5);
    }

    .krt-headerDrawer__input {
        width: 100%;
        border-radius: var(--krt-radius-md, 0.5rem);
        border: 1px solid var(--krt-color-border-subtle, #e5e7eb);
        padding: 0.45rem 0.75rem;
        font-size: 0.85rem;
        background: #f9fafb;
    }

    .krt-switch {
        inline-size: 2.25rem;
        block-size: 1.25rem;
        border-radius: 999px;
        background: var(--krt-color-border-subtle, #e5e7eb);
        position: relative;
        appearance: none;
        cursor: pointer;
        transition: background 150ms ease;
    }

    .krt-switch::after {
        content: '';
        position: absolute;
        inset-block: 0.1875rem;
        inset-inline-start: 0.1875rem;
        width: 0.875rem;
        border-radius: 50%;
        background: #ffffff;
        box-shadow: 0 1px 3px rgba(15, 23, 42, 0.2);
        transition: transform 150ms ease;
    }

    .krt-switch:checked {
        background: var(--krt-color-primary, #111827);
    }

    .krt-switch:checked::after {
        transform: translateX(1rem);
    }

    .krt-header {
        padding: 0 var(--krt-space-lg, 1rem);
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

    @media (min-width: 64rem) {
        .krt-header__desktopNav--visible {
            display: flex;
        }

        .krt-header__metaGroup {
            justify-content: flex-end;
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

    @media (min-width: 64rem) {
        .krt-header__mobileTrigger--desktopHidden {
            display: none;
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

    @media (min-width: 64rem) {
        .krt-header__search {
            display: inline-flex;
        }
    }

    .krt-header__editor {
        position: relative;
    }
</style>
