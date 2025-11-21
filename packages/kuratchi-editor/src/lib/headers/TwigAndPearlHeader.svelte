<script lang="ts">
    import { LayoutBlock } from '../shell/index.js';
    import { IconPicker } from '../plugins/index.js';
    import { LucideIconMap, type LucideIconKey } from '../utils/lucide-icons.js';
    import { Home, Search, Menu } from '@lucide/svelte';

    let id = crypto.randomUUID(); // Ensure each content has a unique ID

    // default image since we are only showing examples
    let image = {
        src: '/clutch-cms-logo.png',
        alt: 'Clutch CMS Logo',
        title: 'Clutch CMS Logo',
    }

    // Default menu data
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
    }

    let {
        searchEnabled = true,
        type = 'twig-and-pearl-header',
        backgroundColor = '#212121',
        homeIconColor = '#575757',
        textColor = '#ffffff',
        reverseOrder = false,
        icons = [
            { icon: 'facebook', link: '#', name: "Facebook", enabled: true },
            { icon: 'x', link: '#', name: "X", enabled: true },
            { icon: 'instagram', link: '#', name: "Instagram", enabled: true },
        ] as { icon: LucideIconKey; link: string; name: string; enabled: boolean }[],
        menu = [],
        editable = true,
        useMobileMenuOnDesktop = false,
        menuHidden = false
    }: Props = $props();

    if (!menuHidden && menu.length === 0 ) {
        menu = [
            { label: 'Home', link: '/' },
            {
                label: 'Products',
                items: [
                    { label: 'Product A', link: '#' },
                    { label: 'Product B', link: '#' },
                ],
            },
            { label: 'About Us', link: '#' },
            { label: 'Contact', link: '#' },
        ];
    }

    let content = $derived({
        backgroundColor: backgroundColor,
        homeIconColor: homeIconColor,
        textColor: textColor,
        reverseOrder: reverseOrder,
        searchEnabled: searchEnabled,
        type: type,
        icons,
    })

    const showDesktopMenu = $derived(!useMobileMenuOnDesktop);

    function hrefFrom(item: any): string {
        if (typeof item?.link === 'string' && item.link.length > 0) return item.link;
        if (typeof item?.slug === 'string' && item.slug.length > 0) return `/${item.slug}`;
        return '#';
    }
</script>

<LayoutBlock {id} type={type}>
{#snippet drawerContent()}
    <div class="krt-headerDrawer">
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
    </div>
{/snippet}

{#snippet metadata()}
    {JSON.stringify(content)}
{/snippet}

{#snippet children()}
    <div
        id={id}
        data-type={type}
        class="krt-header krt-header--twig"
        style:background-color={backgroundColor}
        style:color={textColor}
    >
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
                            <ul class="krt-header__navList">
                                {#each menu as item}
                                    <li class="krt-header__navItem">
                                        {#if item.items}
                                            <details class="krt-header__dropdown">
                                                <summary>{item.label}</summary>
                                                <ul class="krt-header__dropdownList" style:background-color={backgroundColor}>
                                                    {#each item.items as subItem}
                                                        <li>
                                                            <a href={hrefFrom(subItem)}>{subItem.label}</a>
                                                        </li>
                                                    {/each}
                                                </ul>
                                            </details>
                                        {:else}
                                            <a href={hrefFrom(item)}>{item.label}</a>
                                        {/if}
                                    </li>
                                {/each}
                            </ul>
                        {/if}
                    </nav>
                {/if}
            </div>

            <div class="krt-header__brand">
                {#if !menuHidden}
                    <details class="krt-header__sheetToggle" class:krt-header__sheetToggle--desktopHidden={showDesktopMenu}>
                        <summary aria-label="Open menu">
                            <span class="krt-header__mobileTrigger">
                                <Menu aria-hidden="true" />
                            </span>
                        </summary>
                        <ul class="krt-header__sheet" style:background-color={backgroundColor}>
                            {#each menu as item}
                                <li>
                                    {#if item.items}
                                        <details class="krt-header__sheetDropdown">
                                            <summary>{item.label}</summary>
                                            <ul>
                                                {#each item.items as subItem}
                                                    <li><a href={hrefFrom(subItem)}>{subItem.label}</a></li>
                                                {/each}
                                            </ul>
                                        </details>
                                    {:else}
                                        <a href={hrefFrom(item)}>{item.label}</a>
                                    {/if}
                                </li>
                            {/each}
                        </ul>
                    </details>
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
                            <ul class="krt-header__navList">
                                {#each menu as item}
                                    <li class="krt-header__navItem">
                                        {#if item.items}
                                            <details class="krt-header__dropdown">
                                                <summary>{item.label}</summary>
                                                <ul class="krt-header__dropdownList" style:background-color={backgroundColor}>
                                                    {#each item.items as subItem}
                                                        <li>
                                                            <a href={hrefFrom(subItem)}>{subItem.label}</a>
                                                        </li>
                                                    {/each}
                                                </ul>
                                            </details>
                                        {:else if item.link}
                                            <a href={hrefFrom(item)}>{item.label}</a>
                                        {/if}
                                    </li>
                                {/each}
                            </ul>
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
{/snippet}
</LayoutBlock>

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

    .krt-header__navList {
        display: flex;
        align-items: center;
        gap: var(--krt-space-md, 0.75rem);
        list-style: none;
        margin: 0;
        padding: 0;
    }

    .krt-header__navItem a,
    .krt-header__navItem summary {
        font-size: 0.95rem;
        font-weight: 500;
        color: inherit;
        text-decoration: none;
        cursor: pointer;
        padding: 0.35rem 0.5rem;
        border-radius: var(--krt-radius-sm, 0.375rem);
        transition: background 150ms ease, color 150ms ease;
    }

    .krt-header__navItem a:hover,
    .krt-header__navItem summary:hover {
        background: rgba(255, 255, 255, 0.1);
    }

    .krt-header__dropdown {
        position: relative;
    }

    .krt-header__dropdown summary::-webkit-details-marker {
        display: none;
    }

    .krt-header__dropdown[open] summary {
        background: rgba(255, 255, 255, 0.1);
    }

    .krt-header__dropdownList {
        position: absolute;
        inset-block-start: calc(100% + 0.4rem);
        inset-inline-start: 0;
        list-style: none;
        margin: 0;
        padding: var(--krt-space-sm, 0.5rem);
        border-radius: var(--krt-radius-md, 0.5rem);
        border: 1px solid rgba(255, 255, 255, 0.15);
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(6px);
        min-width: 10rem;
    }

    .krt-header__dropdown:not([open]) > .krt-header__dropdownList {
        display: none;
    }

    .krt-header__dropdownList li {
        margin: 0;
        padding: 0;
    }

    .krt-header__dropdownList a {
        display: block;
        padding: 0.35rem 0.6rem;
        border-radius: var(--krt-radius-sm, 0.375rem);
    }

    .krt-header__dropdownList a:hover {
        background: rgba(255, 255, 255, 0.12);
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

    .krt-header__sheetToggle {
        position: relative;
        display: inline-flex;
    }

    .krt-header__sheetToggle summary {
        list-style: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin: 0;
        padding: 0;
    }

    .krt-header__sheetToggle summary::-webkit-details-marker {
        display: none;
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

    .krt-header__sheetToggle[open] .krt-header__mobileTrigger,
    .krt-header__mobileTrigger:hover {
        background: rgba(255, 255, 255, 0.12);
    }

    .krt-header__sheetToggle--desktopHidden {
        display: inline-flex;
    }

    @media (min-width: 64rem) {
        .krt-header__sheetToggle--desktopHidden {
            display: none;
        }
    }

    .krt-header__sheet {
        list-style: none;
        margin: 0;
        padding: var(--krt-space-md, 0.75rem);
        border-radius: var(--krt-radius-lg, 0.75rem);
        border: 1px solid rgba(255, 255, 255, 0.16);
        box-shadow: 0 12px 50px rgba(15, 23, 42, 0.45);
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-sm, 0.5rem);
        min-width: 17rem;
        color: inherit;
    }

    .krt-header__sheet a {
        display: block;
        padding: 0.45rem 0.6rem;
        border-radius: var(--krt-radius-md, 0.5rem);
        text-decoration: none;
        color: inherit;
    }

    .krt-header__sheet a:hover {
        background: rgba(255, 255, 255, 0.08);
    }

    .krt-header__sheetDropdown {
        border-radius: var(--krt-radius-md, 0.5rem);
        overflow: hidden;
    }

    .krt-header__sheetDropdown summary {
        cursor: pointer;
        padding: 0.45rem 0.6rem;
        border-radius: var(--krt-radius-md, 0.5rem);
    }

    .krt-header__sheetDropdown[open] summary {
        background: rgba(255, 255, 255, 0.12);
    }

    .krt-header__sheetDropdown ul {
        list-style: none;
        margin: 0;
        padding: var(--krt-space-sm, 0.5rem);
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-xs, 0.25rem);
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
</style>
