<script lang="ts">
    import { onMount } from 'svelte';
    import { BlockActions } from '../utils/index.js';
    import { ImagePicker, NavMenu, NavMenuMobile, type DesktopNavConfig, type MobileNavConfig, type NavMenuItem } from '../widgets/index.js';
    import { Menu, Phone, MapPin, Clock } from '@lucide/svelte';
    import { blockRegistry } from '../stores/editorSignals.svelte.js';

    interface LogoData {
        url: string;
        alt: string;
    }

    interface TopBarItem {
        icon: 'phone' | 'location' | 'hours';
        text: string;
        link?: string;
    }

    interface Props {
        type?: string;
        backgroundColor?: string;
        topBarColor?: string;
        textColor?: string;
        topBarTextColor?: string;
        accentColor?: string;
        logo?: LogoData;
        topBarItems?: TopBarItem[];
        menu?: NavMenuItem[];
        ctaLabel?: string;
        ctaLink?: string;
        isSticky?: boolean;
        editable?: boolean;
    }

    const DEFAULT_MENU: NavMenuItem[] = [
        { id: '1', label: 'New Inventory', url: '/inventory/new', children: [
            { id: '1a', label: 'Side x Sides', url: '/inventory/sxs' },
            { id: '1b', label: 'ATVs', url: '/inventory/atv' },
            { id: '1c', label: 'Motorcycles', url: '/inventory/motorcycles' },
        ]},
        { id: '2', label: 'Pre-Owned', url: '/inventory/used' },
        { id: '3', label: 'Parts & Gear', url: '/parts', children: [
            { id: '3a', label: 'OEM Parts', url: '/parts/oem' },
            { id: '3b', label: 'Accessories', url: '/parts/accessories' },
            { id: '3c', label: 'Apparel', url: '/parts/apparel' },
        ]},
        { id: '4', label: 'Financing', url: '/financing' },
        { id: '5', label: 'Service', url: '/service' },
        { id: '6', label: 'Company', url: '/about', children: [
            { id: '6a', label: 'About Us', url: '/about' },
            { id: '6b', label: 'Contact', url: '/contact' },
            { id: '6c', label: 'Careers', url: '/careers' },
        ]},
    ];

    const DEFAULT_TOPBAR: TopBarItem[] = [
        { icon: 'phone', text: '(555) 123-4567', link: 'tel:5551234567' },
        { icon: 'location', text: '123 Main St, City, ST', link: '#' },
        { icon: 'hours', text: 'Mon-Sat: 9AM-6PM' },
    ];

    let {
        type = 'powersports-header',
        backgroundColor: initialBackgroundColor = '#1a1a1a',
        topBarColor: initialTopBarColor = '#ff6600',
        textColor: initialTextColor = '#ffffff',
        topBarTextColor: initialTopBarTextColor = '#ffffff',
        accentColor: initialAccentColor = '#ff6600',
        logo: initialLogo = { url: 'https://fakeimg.pl/180x50/?text=LOGO', alt: 'Logo' },
        topBarItems: initialTopBarItems = DEFAULT_TOPBAR,
        menu: initialMenu = [],
        ctaLabel: initialCtaLabel = 'Get a Quote',
        ctaLink: initialCtaLink = '/quote',
        isSticky: initialIsSticky = true,
        editable = true,
    }: Props = $props();

    function normalizeMenuItems(items: any[]): NavMenuItem[] {
        return items.map((item, index) => ({
            id: item.id || `item-${index}`,
            label: item.label,
            url: item.url || item.slug || item.link,
            children: item.children || item.items ? normalizeMenuItems(item.children || item.items) : undefined,
        }));
    }

    const resolvedMenu = (initialMenu?.length ?? 0) === 0 ? DEFAULT_MENU : normalizeMenuItems(initialMenu);

    let logo = $state<LogoData>(initialLogo);
    let backgroundColor = $state(initialBackgroundColor);
    let topBarColor = $state(initialTopBarColor);
    let textColor = $state(initialTextColor);
    let topBarTextColor = $state(initialTopBarTextColor);
    let accentColor = $state(initialAccentColor);
    let topBarItems = $state<TopBarItem[]>(initialTopBarItems);
    let ctaLabel = $state(initialCtaLabel);
    let ctaLink = $state(initialCtaLink);
    let isSticky = $state(initialIsSticky);
    let mobileMenuOpen = $state(false);

    let id = crypto.randomUUID();
    let localMenu = $state<NavMenuItem[]>(resolvedMenu);

    const desktopNavConfig = $derived<DesktopNavConfig>({
        orientation: 'horizontal',
        dropdownTrigger: 'hover',
        dropdownAlign: 'start',
        submenuDirection: 'right',
        colors: {
            background: 'transparent',
            backgroundHover: 'rgba(255, 255, 255, 0.1)',
            backgroundActive: 'rgba(255, 255, 255, 0.1)',
            text: textColor,
            textHover: accentColor,
            dropdownBackground: '#ffffff',
            dropdownItemHover: 'rgba(0, 0, 0, 0.05)',
            dropdownText: '#1a1a1a',
            dropdownBorder: 'rgba(0, 0, 0, 0.1)',
            dropdownShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        },
        typography: {
            fontSize: '0.875rem',
            fontWeight: 600,
        },
        spacing: {
            itemGap: '0.125rem',
            itemPadding: '0.5rem 0.75rem',
            dropdownItemPadding: '0.5rem 1rem',
            dropdownPadding: '0.5rem',
        },
        borders: {
            itemRadius: '0.25rem',
            dropdownRadius: '0.5rem',
        },
        animation: {
            duration: '150ms',
            easing: 'ease',
            caretRotation: true,
        },
        caret: {
            show: true,
            size: '0.75rem',
        },
        dropdownMinWidth: '12rem',
    });

    const mobileNavConfig = $derived<MobileNavConfig>({
        style: 'drawer',
        drawerPosition: 'right',
        colors: {
            background: backgroundColor,
            backgroundHover: 'rgba(255, 255, 255, 0.1)',
            text: textColor,
            dropdownBackground: 'rgba(255, 255, 255, 0.05)',
            dropdownText: textColor,
        },
        typography: {
            fontSize: '1rem',
            fontWeight: 500,
        },
        showCloseButton: true,
        showBackdrop: true,
        backdropOpacity: 0.6,
        accordionBehavior: 'single',
    });

    let content = $derived({
        id,
        type,
        backgroundColor,
        topBarColor,
        textColor,
        topBarTextColor,
        accentColor,
        logo,
        topBarItems,
        menu: localMenu,
        ctaLabel,
        ctaLink,
        isSticky,
    });

    const serializeContent = () => JSON.stringify(content);
    const componentRef = {};
    let component = $state<HTMLElement>();
    let mounted = $state(false);

    function getIconComponent(iconType: string) {
        switch (iconType) {
            case 'phone': return Phone;
            case 'location': return MapPin;
            case 'hours': return Clock;
            default: return Phone;
        }
    }

    onMount(() => {
        mounted = true;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'header' }), 'header', component);
        return () => blockRegistry.unregister(componentRef);
    });
</script>

{#if editable}
<div
    class="editor-header-item krt-powersportsHeader__editor"
    bind:this={component}
    data-krt-serialized={serializeContent()}
>
    {#if mounted}
        <BlockActions {id} {type} element={component} inspectorTitle="Header Settings">
            {#snippet inspector()}
                <div class="krt-headerDrawer">
                    <section class="krt-headerDrawer__section">
                        <h3 class="krt-headerDrawer__title">Behavior</h3>
                        <label class="krt-headerDrawer__card">
                            <input type="checkbox" class="krt-switch" bind:checked={isSticky} />
                            <span>Sticky Header</span>
                        </label>
                    </section>

                    <section class="krt-headerDrawer__section">
                        <h3 class="krt-headerDrawer__title">Colors</h3>
                        <div class="krt-headerDrawer__grid">
                            <label class="krt-headerDrawer__field">
                                <span>Background</span>
                                <input type="color" bind:value={backgroundColor} />
                            </label>
                            <label class="krt-headerDrawer__field">
                                <span>Text</span>
                                <input type="color" bind:value={textColor} />
                            </label>
                            <label class="krt-headerDrawer__field">
                                <span>Top Bar</span>
                                <input type="color" bind:value={topBarColor} />
                            </label>
                            <label class="krt-headerDrawer__field">
                                <span>Accent</span>
                                <input type="color" bind:value={accentColor} />
                            </label>
                        </div>
                    </section>

                    <section class="krt-headerDrawer__section">
                        <h3 class="krt-headerDrawer__title">Logo</h3>
                        <ImagePicker bind:selectedImage={logo} mode="single" />
                    </section>

                    <section class="krt-headerDrawer__section">
                        <h3 class="krt-headerDrawer__title">CTA Button</h3>
                        <label class="krt-headerDrawer__field">
                            <span>Label</span>
                            <input type="text" bind:value={ctaLabel} />
                        </label>
                        <label class="krt-headerDrawer__field">
                            <span>Link</span>
                            <input type="url" bind:value={ctaLink} placeholder="https://" />
                        </label>
                    </section>

                    <section class="krt-headerDrawer__section">
                        <h3 class="krt-headerDrawer__title">Top Bar Info</h3>
                        {#each topBarItems as item, index}
                            <div class="krt-headerDrawer__itemRow">
                                <select bind:value={item.icon}>
                                    <option value="phone">Phone</option>
                                    <option value="location">Location</option>
                                    <option value="hours">Hours</option>
                                </select>
                                <input type="text" bind:value={item.text} placeholder="Text" />
                            </div>
                        {/each}
                    </section>
                </div>
            {/snippet}
        </BlockActions>
    {/if}

    <header
        class="krt-powersportsHeader"
        class:krt-powersportsHeader--sticky={isSticky}
        style="--header-bg: {backgroundColor}; --header-text: {textColor}; --header-topbar: {topBarColor}; --header-topbar-text: {topBarTextColor}; --header-accent: {accentColor};"
    >
        <!-- Top Bar -->
        <div class="krt-powersportsHeader__topBar">
            <div class="krt-powersportsHeader__topBarInner">
                {#each topBarItems as item}
                    {#if item.link}
                        <a href={item.link} class="krt-powersportsHeader__topBarItem" onclick={(e) => editable && e.preventDefault()}>
                            <svelte:component this={getIconComponent(item.icon)} size={14} />
                            <span contenteditable bind:innerHTML={item.text}></span>
                        </a>
                    {:else}
                        <span class="krt-powersportsHeader__topBarItem">
                            <svelte:component this={getIconComponent(item.icon)} size={14} />
                            <span contenteditable bind:innerHTML={item.text}></span>
                        </span>
                    {/if}
                {/each}
            </div>
        </div>

        <!-- Main Header -->
        <div class="krt-powersportsHeader__main">
            <div class="krt-powersportsHeader__mainInner">
                <a href="/" class="krt-powersportsHeader__logo" onclick={(e) => editable && e.preventDefault()}>
                    {#if logo?.url}
                        <img src={logo.url} alt={logo.alt} />
                    {:else}
                        <span>LOGO</span>
                    {/if}
                </a>

                <nav class="krt-powersportsHeader__nav">
                    <NavMenu items={localMenu} config={desktopNavConfig} editable={editable} />
                </nav>

                <div class="krt-powersportsHeader__actions">
                    <a href={ctaLink} class="krt-powersportsHeader__cta" onclick={(e) => editable && e.preventDefault()}>
                        <span contenteditable bind:innerHTML={ctaLabel}></span>
                    </a>
                    <button class="krt-powersportsHeader__menuBtn" onclick={() => mobileMenuOpen = true} aria-label="Open menu">
                        <Menu size={24} />
                    </button>
                </div>
            </div>
        </div>
    </header>

    <NavMenuMobile
        items={localMenu}
        config={mobileNavConfig}
        bind:isOpen={mobileMenuOpen}
        editable={editable}
    />
</div>
{:else}
    <header
        class="krt-powersportsHeader"
        class:krt-powersportsHeader--sticky={isSticky}
        style="--header-bg: {backgroundColor}; --header-text: {textColor}; --header-topbar: {topBarColor}; --header-topbar-text: {topBarTextColor}; --header-accent: {accentColor};"
    >
        <div class="krt-powersportsHeader__topBar">
            <div class="krt-powersportsHeader__topBarInner">
                {#each topBarItems as item}
                    {#if item.link}
                        <a href={item.link} class="krt-powersportsHeader__topBarItem">
                            <svelte:component this={getIconComponent(item.icon)} size={14} />
                            <span>{@html item.text}</span>
                        </a>
                    {:else}
                        <span class="krt-powersportsHeader__topBarItem">
                            <svelte:component this={getIconComponent(item.icon)} size={14} />
                            <span>{@html item.text}</span>
                        </span>
                    {/if}
                {/each}
            </div>
        </div>

        <div class="krt-powersportsHeader__main">
            <div class="krt-powersportsHeader__mainInner">
                <a href="/" class="krt-powersportsHeader__logo">
                    {#if logo?.url}
                        <img src={logo.url} alt={logo.alt} />
                    {/if}
                </a>

                <nav class="krt-powersportsHeader__nav">
                    <NavMenu items={localMenu} config={desktopNavConfig} editable={false} />
                </nav>

                <div class="krt-powersportsHeader__actions">
                    <a href={ctaLink} class="krt-powersportsHeader__cta">{@html ctaLabel}</a>
                    <button class="krt-powersportsHeader__menuBtn" onclick={() => mobileMenuOpen = true} aria-label="Open menu">
                        <Menu size={24} />
                    </button>
                </div>
            </div>
        </div>

        <NavMenuMobile
            items={localMenu}
            config={mobileNavConfig}
            bind:isOpen={mobileMenuOpen}
            editable={false}
        />
    </header>
{/if}

<style>
    .krt-powersportsHeader {
        width: 100%;
        background: var(--header-bg, #1a1a1a);
        color: var(--header-text, #ffffff);
    }

    .krt-powersportsHeader--sticky {
        position: sticky;
        top: 0;
        z-index: 100;
    }

    .krt-powersportsHeader__topBar {
        background: var(--header-topbar, #ff6600);
        color: var(--header-topbar-text, #ffffff);
        font-size: 0.8rem;
        padding: 0.4rem 0;
    }

    .krt-powersportsHeader__topBarInner {
        max-width: 1400px;
        margin: 0 auto;
        padding: 0 1.5rem;
        display: flex;
        justify-content: flex-end;
        gap: 1.5rem;
        flex-wrap: wrap;
    }

    .krt-powersportsHeader__topBarItem {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        color: inherit;
        text-decoration: none;
    }

    .krt-powersportsHeader__topBarItem span {
        outline: none;
    }

    a.krt-powersportsHeader__topBarItem:hover {
        opacity: 0.85;
    }

    .krt-powersportsHeader__main {
        padding: 0.75rem 0;
    }

    .krt-powersportsHeader__mainInner {
        max-width: 1400px;
        margin: 0 auto;
        padding: 0 1.5rem;
        display: flex;
        align-items: center;
        gap: 2rem;
    }

    .krt-powersportsHeader__logo {
        flex-shrink: 0;
        text-decoration: none;
        color: inherit;
    }

    .krt-powersportsHeader__logo img {
        max-height: 50px;
        width: auto;
    }

    .krt-powersportsHeader__nav {
        flex: 1;
        display: flex;
        justify-content: center;
    }

    .krt-powersportsHeader__actions {
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .krt-powersportsHeader__cta {
        display: inline-block;
        padding: 0.6rem 1.25rem;
        background: var(--header-accent, #ff6600);
        color: #ffffff;
        text-decoration: none;
        font-weight: 600;
        font-size: 0.875rem;
        border-radius: 4px;
        transition: opacity 0.2s;
    }

    .krt-powersportsHeader__cta:hover {
        opacity: 0.9;
    }

    .krt-powersportsHeader__cta span {
        outline: none;
    }

    .krt-powersportsHeader__menuBtn {
        display: none;
        background: transparent;
        border: none;
        color: inherit;
        cursor: pointer;
        padding: 0.5rem;
    }

    /* Drawer styles */
    .krt-headerDrawer {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .krt-headerDrawer__section {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .krt-headerDrawer__title {
        font-size: 0.875rem;
        font-weight: 600;
        margin: 0;
        color: #374151;
    }

    .krt-headerDrawer__grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.75rem;
    }

    .krt-headerDrawer__field {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .krt-headerDrawer__field span {
        font-size: 0.75rem;
        color: #6b7280;
    }

    .krt-headerDrawer__field input[type="color"] {
        width: 100%;
        height: 32px;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        cursor: pointer;
    }

    .krt-headerDrawer__field input[type="text"],
    .krt-headerDrawer__field input[type="url"] {
        padding: 0.5rem;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        font-size: 0.875rem;
    }

    .krt-headerDrawer__card {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.5rem;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        cursor: pointer;
    }

    .krt-headerDrawer__card span {
        font-size: 0.875rem;
    }

    .krt-headerDrawer__itemRow {
        display: flex;
        gap: 0.5rem;
    }

    .krt-headerDrawer__itemRow select {
        padding: 0.5rem;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        font-size: 0.875rem;
    }

    .krt-headerDrawer__itemRow input {
        flex: 1;
        padding: 0.5rem;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        font-size: 0.875rem;
    }

    @media (max-width: 1024px) {
        .krt-powersportsHeader__nav {
            display: none;
        }

        .krt-powersportsHeader__cta {
            display: none;
        }

        .krt-powersportsHeader__menuBtn {
            display: flex;
        }
    }

    @media (max-width: 640px) {
        .krt-powersportsHeader__topBarInner {
            justify-content: center;
            gap: 1rem;
        }
    }
</style>
