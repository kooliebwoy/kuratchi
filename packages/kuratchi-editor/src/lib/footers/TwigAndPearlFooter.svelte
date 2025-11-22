<script lang="ts">
 import { Pencil } from '@lucide/svelte';
 import { onMount } from 'svelte';
 import { IconPicker } from '../plugins/index.js';
 import { LucideIconMap, type LucideIconKey } from '../utils/lucide-icons.js';
 import { BlockActions, SideActions } from '../utils/index.js';

    let id = crypto.randomUUID(); // Ensure each content has a unique ID
  interface Props {
    reverseOrder?: boolean;
    textColor?: string;
    backgroundColor?: string;
    type?: string;
    icons?: any;
    menu?: any;
    copyrightText?: any;
    editable?: boolean;
    menuHidden?: boolean;
  }

  let {
    reverseOrder = $bindable(false),
    textColor = $bindable('#ffffff'),
    backgroundColor = $bindable('#212121'),
    type = 'twig-and-pearl-footer',
    icons = $bindable([
        { icon: 'facebook', link: '#', name: "Facebook", enabled: true },
        { icon: 'x', link: '#', name: "X", enabled: true },
        { icon: 'instagram', link: '#', name: "Instagram", enabled: true },
    ] as { icon: LucideIconKey; link: string; name: string; enabled: boolean }[]),
    menu = undefined,
    copyrightText = {
        href: 'https://kayde.io',
        by: 'Kayde',
    },
    editable = true,
    menuHidden = false
  }: Props = $props();

    let footerLogo = {
        href: 'https://kayde.io',
        src: '/kayde-logo.png',
        alt: 'Kayde Logo',
        name: 'Kayde',
    }
    
    const defaultFooterMenu = [
        {
            label: 'Legal',
            items: [
                { label: 'Privacy Policy', link: '/product-a' },
                { label: 'Terms & Conditions', link: '/product-b' },
            ],
        },
        {
            label: 'Resources',
            items: [
                { label: 'CMS Login', link: '/product-a' },
                { label: 'Clutch Blog', link: '/product-b' },
            ],
        },
        {
            label: 'Follow Us',
            items: [
                { label: 'Discord', link: '/product-a' },
                { label: 'Facebook', link: '/product-b' },
            ],
        },
    ];

    const poweredBy = 'Powered by Clutch CMS';

    // Compute menu once per prop change to avoid inline re-evaluation
    const footerMenu = $derived.by(() => {
        return (menu && Array.isArray(menu) && menu.length > 0) ? menu : defaultFooterMenu;
    });

    let content = $derived({
        backgroundColor: backgroundColor,
        textColor: textColor,
        reverseOrder: reverseOrder,
        poweredBy: poweredBy,
        type: type,
        icons,
    })

    let component: HTMLElement;
    let mounted = $state(false);
    const sideActionsId = `side-actions-${id}`;

    onMount(() => {
        mounted = true;
    });

    function hrefFrom(item: any): string {
        if (typeof item?.link === 'string' && item.link.length > 0) return item.link;
        if (typeof item?.slug === 'string' && item.slug.length > 0) return item.slug;
        return '#';
    }
</script>

{#if editable}
    <div class="editor-footer-item group relative" bind:this={component}>
        {#if mounted}
            <BlockActions {id} {type} element={component} />
        {/if}
        <div
            id={id}
            data-type={type}
            class="krt-footer krt-footer--twig"
            style:background-color={backgroundColor}
            style:color={textColor}
        >
            <script type="application/json" id="metadata-{id}">{JSON.stringify(content)}</script>
            <section class="krt-footer__primary" class:krt-footer__primary--reversed={reverseOrder}>
                {#if reverseOrder}
                    <div class="krt-footer__columns">
                        {#if !menuHidden}
                            <div class="krt-footer__navColumns">
                                {#each footerMenu as column}
                                    <nav class="krt-footer__navColumn">
                                        <h6>{column.label}</h6>
                                        <ul>
                                            {#each column.items as item}
                                                <li>
                                                    <a href={hrefFrom(item)}>{item.label}</a>
                                                </li>
                                            {/each}
                                        </ul>
                                    </nav>
                                {/each}
                            </div>
                        {/if}
                    </div>
                    <aside class="krt-footer__brand">
                        <img src={footerLogo.src} alt={footerLogo.alt} />
                    </aside>
                {:else}
                    <aside class="krt-footer__brand">
                        <img src={footerLogo.src} alt={footerLogo.alt} />
                    </aside>
                    <div class="krt-footer__columns">
                        {#if !menuHidden}
                            <div class="krt-footer__navColumns">
                                {#each footerMenu as column}
                                    <nav class="krt-footer__navColumn">
                                        <h6>{column.label}</h6>
                                        <ul>
                                            {#each column.items as item}
                                                <li>
                                                    <a href={hrefFrom(item)}>{item.label}</a>
                                                </li>
                                            {/each}
                                        </ul>
                                    </nav>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/if}
            </section>

            <section class="krt-footer__meta">
                <p>Copyright © {new Date().getFullYear()} · All rights reserved by {copyrightText.by}</p>
                <a href="https://kayde.io" target="_blank" rel="noreferrer noopener">{poweredBy}</a>
                <nav class="krt-footer__social">
                    {#each icons as { icon, link, name }}
                        {@const Comp = LucideIconMap[icon as LucideIconKey]}
                        <a class="krt-footer__iconButton" href={hrefFrom({ link })} aria-label={name}>
                            <Comp aria-hidden="true" />
                        </a>
                    {/each}
                </nav>
            </section>
        </div>
    </div>

    <SideActions triggerId={sideActionsId}>
        {#snippet label()}
            <button id={sideActionsId} class="krt-editButton" aria-label="Edit footer settings" type="button">
                <Pencil size={16} />
                <span>Edit Settings</span>
            </button>
        {/snippet}
        {#snippet content()}
            <div class="krt-footerDrawer">
                <section class="krt-footerDrawer__section">
                    <h3 class="krt-footerDrawer__title">Display Options</h3>
                    <div class="krt-footerDrawer__cards">
                        <label class="krt-footerDrawer__card">
                            <span>Swap Logo and Footer Menu</span>
                            <input type="checkbox" class="krt-switch" bind:checked={reverseOrder} />
                        </label>
                    </div>
                </section>

                <section class="krt-footerDrawer__section">
                    <h3 class="krt-footerDrawer__title">Colors</h3>
                    <div class="krt-footerDrawer__cards">
                        <label class="krt-footerDrawer__card krt-footerDrawer__card--color">
                            <span>Component Background</span>
                            <div class="krt-footerDrawer__colorControl">
                                <input type="color" bind:value={backgroundColor} />
                                <span>{backgroundColor}</span>
                            </div>
                        </label>
                        <label class="krt-footerDrawer__card krt-footerDrawer__card--color">
                            <span>Text Color</span>
                            <div class="krt-footerDrawer__colorControl">
                                <input type="color" bind:value={textColor} />
                                <span>{textColor}</span>
                            </div>
                        </label>
                    </div>
                </section>

                <section class="krt-footerDrawer__section">
                    <h3 class="krt-footerDrawer__title">Icons</h3>
                    <div class="krt-footerDrawer__cards">
                        <div class="krt-footerDrawer__card">
                            <IconPicker bind:selectedIcons={icons} />
                        </div>

                        {#each icons as icon}
                            {@const Comp = LucideIconMap[icon.icon as LucideIconKey]}
                            <label class="krt-footerDrawer__card krt-footerDrawer__card--icon">
                                <div class="krt-footerDrawer__iconHeading">
                                    <Comp aria-hidden="true" />
                                    <span>{icon.name}</span>
                                </div>
                                <input
                                    type="text"
                                    class="krt-footerDrawer__input"
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
        id={id}
        data-type={type}
        class="krt-footer krt-footer--twig"
        style:background-color={backgroundColor}
        style:color={textColor}
    >
        <script type="application/json" id="metadata-{id}">{JSON.stringify(content)}</script>
        <section class="krt-footer__primary" class:krt-footer__primary--reversed={reverseOrder}>
            {#if reverseOrder}
                <div class="krt-footer__columns">
                    {#if !menuHidden}
                        <div class="krt-footer__navColumns">
                            {#each footerMenu as column}
                                <nav class="krt-footer__navColumn">
                                    <h6>{column.label}</h6>
                                    <ul>
                                        {#each column.items as item}
                                            <li>
                                                <a href={hrefFrom(item)}>{item.label}</a>
                                            </li>
                                        {/each}
                                    </ul>
                                </nav>
                            {/each}
                        </div>
                    {/if}
                </div>
                <aside class="krt-footer__brand">
                    <img src={footerLogo.src} alt={footerLogo.alt} />
                </aside>
            {:else}
                <aside class="krt-footer__brand">
                    <img src={footerLogo.src} alt={footerLogo.alt} />
                </aside>
                <div class="krt-footer__columns">
                    {#if !menuHidden}
                        <div class="krt-footer__navColumns">
                            {#each footerMenu as column}
                                <nav class="krt-footer__navColumn">
                                    <h6>{column.label}</h6>
                                    <ul>
                                        {#each column.items as item}
                                            <li>
                                                <a href={hrefFrom(item)}>{item.label}</a>
                                            </li>
                                        {/each}
                                    </ul>
                                </nav>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/if}
        </section>

        <section class="krt-footer__meta">
            <p>Copyright © {new Date().getFullYear()} · All rights reserved by {copyrightText.by}</p>
            <a href="https://kayde.io" target="_blank" rel="noreferrer noopener">{poweredBy}</a>
            <nav class="krt-footer__social">
                {#each icons as { icon, link, name }}
                    {@const Comp = LucideIconMap[icon as LucideIconKey]}
                    <a class="krt-footer__iconButton" href={hrefFrom({ link })} aria-label={name}>
                        <Comp aria-hidden="true" />
                    </a>
                {/each}
            </nav>
        </section>
    </div>
{/if}

<style>
    .krt-footerDrawer {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-lg, 1rem);
    }

    .krt-footerDrawer__section {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-md, 0.75rem);
    }

    .krt-footerDrawer__title {
        margin: 0;
        font-size: 0.8rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        font-weight: 600;
        color: var(--krt-color-muted, #6b7280);
    }

    .krt-footerDrawer__cards {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-sm, 0.5rem);
    }

    .krt-footerDrawer__card {
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

    .krt-footerDrawer__card span {
        font-weight: 500;
    }

    .krt-footerDrawer__card--color {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--krt-space-sm, 0.5rem);
    }

    .krt-footerDrawer__colorControl {
        display: flex;
        align-items: center;
        gap: var(--krt-space-sm, 0.5rem);
        font-family: 'SFMono-Regular', ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 0.75rem;
        color: var(--krt-color-muted, #6b7280);
    }

    .krt-footerDrawer__colorControl input[type='color'] {
        width: 2.5rem;
        height: 2.5rem;
        border-radius: var(--krt-radius-md, 0.5rem);
        border: 2px solid var(--krt-color-border-subtle, #e5e7eb);
        background: none;
        padding: 0;
        cursor: pointer;
    }

    .krt-footerDrawer__card--icon {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--krt-space-sm, 0.5rem);
    }

    .krt-footerDrawer__iconHeading {
        display: flex;
        align-items: center;
        gap: var(--krt-space-sm, 0.5rem);
        font-size: 0.75rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--krt-color-muted, #6b7280);
    }

    .krt-footerDrawer__iconHeading :global(svg) {
        width: 1.5rem;
        height: 1.5rem;
        color: var(--krt-color-accent, #4f46e5);
    }

    .krt-footerDrawer__input {
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

    .krt-footer {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-xl, 1.25rem);
        padding: var(--krt-space-xl, 1.25rem) var(--krt-space-2xl, 2rem);
        border-radius: var(--krt-radius-2xl, 1.25rem);
        background: color-mix(in srgb, currentColor 8%, transparent);
    }

    .krt-footer__primary {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-lg, 1rem);
        align-items: stretch;
    }

    @media (min-width: 64rem) {
        .krt-footer__primary {
            flex-direction: row;
            align-items: flex-start;
            justify-content: space-between;
        }

        .krt-footer__primary--reversed {
            flex-direction: row-reverse;
        }
    }

    .krt-footer__brand {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--krt-space-lg, 1rem);
        border-radius: var(--krt-radius-lg, 0.75rem);
        background: rgba(0, 0, 0, 0.18);
        border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
        min-width: 14rem;
    }

    .krt-footer__brand img {
        width: min(12rem, 100%);
        height: auto;
        display: block;
    }

    .krt-footer__columns {
        flex: 1 1 0;
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-lg, 1rem);
    }

    @media (min-width: 48rem) {
        .krt-footer__columns {
            flex-direction: row;
        }
    }

    .krt-footer__navColumns {
        display: grid;
        gap: var(--krt-space-lg, 1rem);
    }

    @media (min-width: 48rem) {
        .krt-footer__navColumns {
            grid-auto-flow: column;
            grid-auto-columns: minmax(10rem, auto);
        }
    }

    .krt-footer__navColumn h6 {
        margin: 0 0 var(--krt-space-sm, 0.5rem);
        font-size: 0.8rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        font-weight: 600;
        color: inherit;
        opacity: 0.8;
    }

    .krt-footer__navColumn ul {
        margin: 0;
        padding: 0;
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-xs, 0.25rem);
    }

    .krt-footer__navColumn a {
        font-size: 0.95rem;
        color: inherit;
        text-decoration: none;
        opacity: 0.85;
        transition: opacity 150ms ease;
    }

    .krt-footer__navColumn a:hover {
        opacity: 1;
    }

    .krt-footer__meta {
        display: grid;
        gap: var(--krt-space-sm, 0.5rem);
        align-items: center;
        justify-items: center;
        padding: var(--krt-space-lg, 1rem);
        border-radius: var(--krt-radius-lg, 0.75rem);
        background: rgba(0, 0, 0, 0.22);
        border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
    }

    @media (min-width: 48rem) {
        .krt-footer__meta {
            grid-template-columns: 1fr auto auto;
            justify-items: start;
        }
    }

    .krt-footer__meta p {
        margin: 0;
        font-size: 0.85rem;
        opacity: 0.8;
    }

    .krt-footer__meta a {
        color: inherit;
        font-size: 0.85rem;
        text-decoration: none;
        opacity: 0.75;
    }

    .krt-footer__meta a:hover {
        opacity: 1;
    }

    .krt-footer__social {
        display: flex;
        align-items: center;
        gap: var(--krt-space-sm, 0.5rem);
        justify-content: center;
    }

    @media (min-width: 48rem) {
        .krt-footer__social {
            justify-content: flex-end;
        }
    }

    .krt-footer__iconButton {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.25rem;
        height: 2.25rem;
        border-radius: var(--krt-radius-pill, 999px);
        border: 1px solid color-mix(in srgb, currentColor 16%, transparent);
        background: rgba(0, 0, 0, 0.25);
        color: inherit;
        transition: background 150ms ease, transform 150ms ease;
    }

    .krt-footer__iconButton:hover {
        background: rgba(255, 255, 255, 0.18);
        transform: translateY(-1px);
    }

    .krt-footer__iconButton :global(svg) {
        width: 1rem;
        height: 1rem;
    }
</style>
  
