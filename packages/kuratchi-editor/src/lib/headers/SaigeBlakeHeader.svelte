<script lang="ts">
    import { onMount } from 'svelte';
    import { Pencil } from '@lucide/svelte';
    import { BlockActions } from '../utils/index.js';
    import { IconPicker, ImagePicker, NavMenu, NavMenuMobile, type DesktopNavConfig, type MobileNavConfig, type NavMenuItem } from '../widgets/index.js';
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
        // Nav configuration props
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
        // Nav configuration props
        navDropdownTrigger: initialNavDropdownTrigger = 'hover' as DropdownTriggerOption,
        navDropdownAlign: initialNavDropdownAlign = 'start' as DropdownAlignOption,
        navSubmenuDirection: initialNavSubmenuDirection = 'right' as SubmenuDirectionOption,
        navHoverBgColor: initialNavHoverBgColor = 'color-mix(in srgb, currentColor 8%, transparent)',
        navDropdownBgColor: initialNavDropdownBgColor = '',
        navDropdownTextColor: initialNavDropdownTextColor = '#1f2937',
        mobileNavStyle: initialMobileNavStyle = 'drawer' as MobileStyleOption,
        mobileDrawerPosition: initialMobileDrawerPosition = 'right' as DrawerPositionOption,
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

    const resolvedMenu = (initialMenu?.length ?? 0) === 0
        ? DEFAULT_MENU
        : normalizeMenuItems(initialMenu);

    // Use local state for logo so changes trigger reactivity
    let logo = $state<LogoData>(initialLogo);
    
    // Use local state for icons so changes trigger reactivity
    let icons = $state<{ icon: LucideIconKey; link: string; name: string; enabled: boolean }[]>(initialIcons);
    
    // Use local state for other properties so changes trigger reactivity
    let backgroundColor = $state(initialBackgroundColor);
    let textColor = $state(initialTextColor);
    let reverseOrder = $state(initialReverseOrder);

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

    let id = crypto.randomUUID();
    let localMenu = $state<NavMenuItem[]>(resolvedMenu);
    let logoUrl = $derived(logo?.url || '');
    let logoAlt = $derived(logo?.alt || 'Logo');

    // Computed desktop nav config - light theme style
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
            dropdownBackground: navDropdownBgColor || 'rgba(255, 255, 255, 0.96)',
            dropdownItemHover: 'rgba(15, 23, 42, 0.08)',
            dropdownText: navDropdownTextColor,
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
        style: mobileNavStyle,
        drawerPosition: mobileDrawerPosition,
        colors: {
            background: 'rgba(255, 255, 255, 0.96)',
            backgroundHover: 'rgba(15, 23, 42, 0.08)',
            text: navDropdownTextColor,
            dropdownBackground: 'rgba(15, 23, 42, 0.04)',
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
        navDropdownBgColor,
        navDropdownTextColor,
        mobileNavStyle,
        mobileDrawerPosition,
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
                <div class="krt-headerDrawer">
                    <section class="krt-headerDrawer__section">
                        <h3 class="krt-headerDrawer__title">Layout</h3>
                        <div class="krt-headerDrawer__cards">
                            <label class="krt-headerDrawer__card">
                                <input type="checkbox" class="krt-switch" bind:checked={reverseOrder} />
                                <span>Swap Icons and Nav Menu</span>
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
                                <span>Text Color</span>
                                <div class="krt-headerDrawer__colorControl">
                                    <input type="color" bind:value={textColor} />
                                    <span>{textColor}</span>
                                </div>
                            </label>
                        </div>
                    </section>

                    <section class="krt-headerDrawer__section">
                        <h3 class="krt-headerDrawer__title">Logo</h3>
                        <div class="krt-headerDrawer__cards">
                            <div class="krt-headerDrawer__card krt-headerDrawer__card--media">
                                <ImagePicker bind:selectedImage={logo} mode="single" />
                            </div>
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
        {id}
        class="krt-header krt-header--saige"
        style:background-color={backgroundColor}
        style:color={textColor}
        data-type={type}
    >
        <svelte:element this="script" type="application/json" data-region-metadata>{serializeContent()}</svelte:element>
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
    />
</div>

{:else}
    <div
        {id}
        class="krt-header krt-header--saige"
        style:background-color={backgroundColor}
        style:color={textColor}
        data-type={type}
        data-krt-serialized={serializeContent()}
    >
        <div id="metadata-{id}" style="display: none;">{serializeContent()}</div>
        <svelte:element this="script" type="application/json" data-region-metadata>{serializeContent()}</svelte:element>
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
    />
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

    .krt-headerDrawer__card--media {
        padding: var(--krt-space-lg, 1rem);
    }

    .krt-headerDrawer__colorControl {
        display: flex;
        align-items: center;
        gap: var(--krt-space-sm, 0.5rem);
        font-family: 'SFMono-Regular', ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
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
        padding: 0 var(--krt-space-xl, 1.25rem);
    }

    .krt-header__bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--krt-space-lg, 1rem);
        padding: var(--krt-space-md, 0.75rem) 0;
    }

    .krt-header__bar--reversed {
        flex-direction: row-reverse;
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

    @media (min-width: 64rem) {
        .krt-header__navShell {
            display: flex;
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

    @media (min-width: 64rem) {
        .krt-header__mobileTrigger {
            display: none;
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
        position: relative;
    }
</style>
