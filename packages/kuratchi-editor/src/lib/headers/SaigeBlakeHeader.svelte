<script lang="ts">
    import { onMount } from 'svelte';
    import { Pencil } from '@lucide/svelte';
    import { BlockActions, SideActions } from '../utils/index.js';
    import { IconPicker, ImagePicker } from '../plugins/index.js';
    import { LucideIconMap, type LucideIconKey } from '../utils/lucide-icons.js';
    import { Menu } from '@lucide/svelte';

    interface LogoData {
        url: string;
        alt: string;
    }

    interface Props {
        type?: string;
        backgroundColor?: string;
        textColor?: string;
        reverseOrder?: boolean;
        icons?: any;
        menu?: any;
        logo?: LogoData;
        editable?: boolean;
    }

    let {
        type = 'saige-blake-header',
        backgroundColor = '#ffffff',
        textColor = '#92c8c8',
        reverseOrder = false,
        icons = [
            { icon: 'facebook', link: '#', name: "Facebook", enabled: true },
            { icon: 'x', link: '#', name: "X", enabled: true },
            { icon: 'instagram', link: '#', name: "Instagram", enabled: true },
        ] as { icon: LucideIconKey; link: string; name: string; enabled: boolean }[],
        menu = [],
        logo: initialLogo = {
            url: '/clutch-cms-logo.png',
            alt: 'Clutch CMS Logo'
        },
        editable = true
    }: Props = $props();

    // Use local state for logo so changes trigger reactivity
    let logo = $state<LogoData>(initialLogo);

    if ( menu.length === 0 ) {
        menu = [
            { label: 'Home', slug: '/' },
            {
                label: 'Products',
                items: [
                    { label: 'Product A', slug: '/product-a' },
                    { label: 'Product B', slug: '/product-b' },
                ],
            },
            { label: 'About Us', slug: '/about' },
            { label: 'Contact', slug: '/contact' },
        ];
    }

    let id = crypto.randomUUID();
    let localMenu = $state(menu);
    let logoUrl = $derived(logo?.url || '');
    let logoAlt = $derived(logo?.alt || 'Logo');

    let content = $derived({
        id,
        backgroundColor,
        textColor,
        reverseOrder,
        type,
        icons,
        menu: localMenu,
        logo,
    })

    function hrefFrom(item: any): string {
        if (typeof item?.slug === 'string' && item.slug.length > 0) return item.slug;
        if (typeof item?.link === 'string' && item.link.length > 0) return item.link;
        return '#';
    }

    let component: HTMLElement;
    let mounted = $state(false);
    const sideActionsId = `side-actions-${id}`;

    onMount(() => {
        mounted = true;
    });
</script>

{#if editable}
<div class="editor-header-item" bind:this={component}>
    {#if mounted}
        <BlockActions {id} {type} element={component} />
    {/if}
    <div
        {id}
        class="krt-header krt-header--saige"
        style:background-color={backgroundColor}
        style:color={textColor}
        data-type={type}
    >
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
                            <ul class="krt-header__navList">
                                {#each localMenu as item, index}
                                    {#if item.items?.length}
                                        <li class="krt-header__navItem">
                                            <details class="krt-header__navDropdown">
                                                <summary>{item.label}</summary>
                                                <ul class="krt-header__menuPopover">
                                                    {#each item.items as subItem}
                                                        <li><a href={hrefFrom(subItem)}>{subItem.label}</a></li>
                                                    {/each}
                                                </ul>
                                            </details>
                                        </li>
                                    {:else if hrefFrom(item) !== '#'}
                                        <li class="krt-header__navItem">
                                            <a href={hrefFrom(item)}>{item.label}</a>
                                        </li>
                                    {/if}
                                {/each}
                            </ul>
                        {/if}
                    </div>
                {/if}
            </div>

            <div class="krt-header__brand">
                {#if localMenu.length}
                    <details class="krt-header__sheetToggle">
                        <summary aria-label="Toggle menu">
                            <span class="krt-header__mobileTrigger">
                                <Menu aria-hidden="true" />
                            </span>
                        </summary>
                        <ul class="krt-header__sheet">
                            {#each localMenu as item, index}
                                <li>
                                    {#if item.items?.length}
                                        <details class="krt-header__sheetDropdown">
                                            <summary>{item.label}</summary>
                                            <ul>
                                                {#each item.items as subItem}
                                                    <li><a href={hrefFrom(subItem)}>{subItem.label}</a></li>
                                                {/each}
                                            </ul>
                                        </details>
                                    {:else if hrefFrom(item) !== '#'}
                                        <a href={hrefFrom(item)}>{item.label}</a>
                                    {/if}
                                </li>
                            {/each}
                        </ul>
                    </details>
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
                            <ul class="krt-header__navList">
                                {#each localMenu as item, index}
                                    {@const itemKey = item.id ?? item.slug ?? `item-${index}`}
                                    {#if item.items?.length}
                                        <li class="krt-header__navItem">
                                            <button
                                                class="krt-header__navButton"
                                                type="button"
                                                popovertarget={`saige-popover-${itemKey}`}
                                                style={`anchor-name: --saige-anchor-${itemKey}`}
                                            >
                                                {item.label}
                                            </button>
                                            <ul
                                                id={`saige-popover-${itemKey}`}
                                                popover
                                                class="krt-header__menuPopover"
                                                style={`position-anchor: --saige-anchor-${itemKey}`}
                                            >
                                                {#each item.items as subItem}
                                                    <li><a href={hrefFrom(subItem)}>{subItem.label}</a></li>
                                                {/each}
                                            </ul>
                                        </li>
                                    {:else if hrefFrom(item) !== '#'}
                                        <li class="krt-header__navItem">
                                            <a href={hrefFrom(item)}>{item.label}</a>
                                        </li>
                                    {/if}
                                {/each}
                            </ul>
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
</div>

<SideActions triggerId={sideActionsId}>
    {#snippet label()}
        <button id={sideActionsId} class="krt-editButton" aria-label="Edit header settings">
            <Pencil size={16} />
            <span>Edit Settings</span>
        </button>
    {/snippet}
    {#snippet content()}
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
        </div>
    {/snippet}
</SideActions>
{:else}
    <div
        {id}
        class="krt-header krt-header--saige"
        style:background-color={backgroundColor}
        style:color={textColor}
        data-type={type}
    >
        <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>
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
                            <ul class="krt-header__navList">
                                {#each localMenu as item, index}
                                    {#if item.items?.length}
                                        <li class="krt-header__navItem">
                                            <details class="krt-header__navDropdown">
                                                <summary>{item.label}</summary>
                                                <ul class="krt-header__menuPopover">
                                                    {#each item.items as subItem}
                                                        <li><a href={hrefFrom(subItem)}>{subItem.label}</a></li>
                                                    {/each}
                                                </ul>
                                            </details>
                                        </li>
                                    {:else if hrefFrom(item) !== '#'}
                                        <li class="krt-header__navItem">
                                            <a href={hrefFrom(item)}>{item.label}</a>
                                        </li>
                                    {/if}
                                {/each}
                            </ul>
                        {/if}
                    </div>
                {/if}
            </div>

            <div class="krt-header__brand">
                {#if localMenu.length}
                    <details class="krt-header__sheetToggle">
                        <summary aria-label="Toggle menu">
                            <span class="krt-header__mobileTrigger">
                                <Menu aria-hidden="true" />
                            </span>
                        </summary>
                        <ul class="krt-header__sheet">
                            {#each localMenu as item, index}
                                <li>
                                    {#if item.items?.length}
                                        <details class="krt-header__sheetDropdown">
                                            <summary>{item.label}</summary>
                                            <ul>
                                                {#each item.items as subItem}
                                                    <li><a href={hrefFrom(subItem)}>{subItem.label}</a></li>
                                                {/each}
                                            </ul>
                                        </details>
                                    {:else if hrefFrom(item) !== '#'}
                                        <a href={hrefFrom(item)}>{item.label}</a>
                                    {/if}
                                </li>
                            {/each}
                        </ul>
                    </details>
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
                            <ul class="krt-header__navList">
                                {#each localMenu as item, index}
                                    {@const itemKey = item.id ?? item.slug ?? `item-${index}`}
                                    {#if item.items?.length}
                                        <li class="krt-header__navItem">
                                            <button
                                                class="krt-header__navButton"
                                                type="button"
                                                popovertarget={`saige-popover-${itemKey}`}
                                                style={`anchor-name: --saige-anchor-${itemKey}`}
                                            >
                                                {item.label}
                                            </button>
                                            <ul
                                                id={`saige-popover-${itemKey}`}
                                                popover
                                                class="krt-header__menuPopover"
                                                style={`position-anchor: --saige-anchor-${itemKey}`}
                                            >
                                                {#each item.items as subItem}
                                                    <li><a href={hrefFrom(subItem)}>{subItem.label}</a></li>
                                                {/each}
                                            </ul>
                                        </li>
                                    {:else if hrefFrom(item) !== '#'}
                                        <li class="krt-header__navItem">
                                            <a href={hrefFrom(item)}>{item.label}</a>
                                        </li>
                                    {/if}
                                {/each}
                            </ul>
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

    .krt-header__navList {
        display: flex;
        align-items: center;
        gap: var(--krt-space-md, 0.75rem);
        list-style: none;
        margin: 0;
        padding: 0;
    }

    @media (max-width: 63.9375rem) {
        .krt-header__navList {
            display: none;
        }
    }

    .krt-header__navItem {
        position: relative;
    }

    .krt-header__navItem a,
    .krt-header__navDropdown summary {
        font-size: 0.95rem;
        font-weight: 600;
        color: inherit;
        text-decoration: none;
        padding: 0.35rem 0.5rem;
        border-radius: var(--krt-radius-sm, 0.375rem);
        border: 1px solid transparent;
        background: transparent;
        cursor: pointer;
        transition: background 150ms ease, border 150ms ease, color 150ms ease;
        list-style: none;
        display: inline-flex;
        align-items: center;
        gap: var(--krt-space-xs, 0.25rem);
    }

    .krt-header__navItem a:hover,
    .krt-header__navDropdown summary:hover,
    .krt-header__navDropdown[open] summary {
        background: color-mix(in srgb, currentColor 8%, transparent);
        border-color: color-mix(in srgb, currentColor 16%, transparent);
    }

    .krt-header__navDropdown summary::-webkit-details-marker {
        display: none;
    }

    .krt-header__navDropdown {
        position: relative;
    }

    .krt-header__navDropdown > ul {
        position: absolute;
        inset-inline-start: 0;
        inset-block-start: calc(100% + 0.25rem);
        z-index: 3;
    }

    .krt-header__navDropdown:not([open]) > ul {
        display: none;
    }

    .krt-header__menuPopover {
        list-style: none;
        margin: 0;
        padding: var(--krt-space-sm, 0.5rem);
        border-radius: var(--krt-radius-lg, 0.75rem);
        border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
        background: color-mix(in srgb, #ffffff 88%, currentColor 12%);
        box-shadow: 0 20px 45px rgba(15, 23, 42, 0.15);
        min-width: 11rem;
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-xs, 0.25rem);
        color: var(--krt-color-neutral-900, #1f2937);
    }

    .krt-header__menuPopover a {
        display: block;
        padding: 0.5rem 0.65rem;
        border-radius: var(--krt-radius-sm, 0.375rem);
        text-decoration: none;
        color: inherit;
        font-weight: 500;
    }

    .krt-header__menuPopover a:hover {
        background: rgba(15, 23, 42, 0.08);
    }

    .krt-header__brand {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--krt-space-sm, 0.5rem);
        position: relative;
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
        width: 2.5rem;
        height: 2.5rem;
        border-radius: var(--krt-radius-pill, 999px);
        border: 1px solid color-mix(in srgb, currentColor 16%, transparent);
        background: rgba(255, 255, 255, 0.65);
        color: inherit;
        cursor: pointer;
        transition: background 150ms ease, transform 150ms ease;
    }

    .krt-header__sheetToggle[open] .krt-header__mobileTrigger,
    .krt-header__mobileTrigger:hover {
        background: rgba(255, 255, 255, 0.85);
        transform: translateY(-1px);
    }

    @media (min-width: 64rem) {
        .krt-header__sheetToggle {
            display: none;
        }
    }

    .krt-header__sheet {
        list-style: none;
        margin: 0;
        padding: var(--krt-space-md, 0.75rem);
        border-radius: var(--krt-radius-lg, 0.75rem);
        border: 1px solid rgba(15, 23, 42, 0.12);
        background: rgba(255, 255, 255, 0.96);
        box-shadow: 0 18px 45px rgba(15, 23, 42, 0.18);
        min-width: 17rem;
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-sm, 0.5rem);
        color: var(--krt-color-neutral-900, #1f2937);
    }

    @media (min-width: 64rem) {
        .krt-header__sheet {
            display: none;
        }
    }

    .krt-header__sheet a {
        display: block;
        padding: 0.45rem 0.6rem;
        border-radius: var(--krt-radius-md, 0.5rem);
        text-decoration: none;
        color: inherit;
        font-weight: 500;
    }

    .krt-header__sheet a:hover {
        background: rgba(15, 23, 42, 0.08);
    }

    .krt-header__sheetDropdown {
        border-radius: var(--krt-radius-md, 0.5rem);
        overflow: hidden;
        background: rgba(15, 23, 42, 0.04);
    }

    .krt-header__sheetDropdown summary {
        cursor: pointer;
        padding: 0.45rem 0.6rem;
        font-weight: 600;
    }

    .krt-header__sheetDropdown[open] summary {
        background: rgba(15, 23, 42, 0.08);
    }

    .krt-header__sheetDropdown ul {
        list-style: none;
        margin: 0;
        padding: var(--krt-space-sm, 0.5rem) var(--krt-space-sm, 0.5rem) var(--krt-space-md, 0.75rem);
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-xs, 0.25rem);
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
</style>
