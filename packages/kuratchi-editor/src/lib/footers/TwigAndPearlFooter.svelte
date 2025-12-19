<script lang="ts">
 import { onMount } from 'svelte';
 import { 
    FooterNavColumns, 
    type FooterLinkColumn, 
    type FooterColumnsConfig,
    // Inspector Widgets
    InspectorSection,
    ToggleControl,
    ColorControl,
    SocialLinksEditor
 } from '../widgets/index.js';
 import { LucideIconMap, type LucideIconKey } from '../utils/lucide-icons.js';
 import { BlockActions } from '../utils/index.js';
 import { blockRegistry } from '../stores/editorSignals.svelte.js';

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
    reverseOrder: initialReverseOrder = false,
    textColor: initialTextColor = '#ffffff',
    backgroundColor: initialBackgroundColor = '#212121',
    type = 'twig-and-pearl-footer',
    icons: initialIcons = [
        { icon: 'facebook', link: '#', name: "Facebook", enabled: true },
        { icon: 'x', link: '#', name: "X", enabled: true },
        { icon: 'instagram', link: '#', name: "Instagram", enabled: true },
    ] as { icon: LucideIconKey; link: string; name: string; enabled: boolean }[],
    menu: initialMenu = undefined,
    copyrightText: initialCopyrightText = {
        href: 'https://kayde.io',
        by: 'Kayde',
    },
    editable = true,
    menuHidden: initialMenuHidden = false
  }: Props = $props();

  const resolvedMenu = (!initialMenuHidden && (initialMenu?.length ?? 0) === 0)
    ? undefined
    : initialMenu;

  let reverseOrder = $state(initialReverseOrder);
  let textColor = $state(initialTextColor);
  let backgroundColor = $state(initialBackgroundColor);
  let icons = $state(initialIcons);
  let localMenu = $state(resolvedMenu);
  let copyrightText = $state(initialCopyrightText);
  let menuHidden = $state(initialMenuHidden);

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
    const componentRef = {};

    // Menu items come from props (injected by Dashboard via siteMetadata.navigation.footer.items)
    // Navigation CRUD is handled in Dashboard, not editable in footer component
    const footerMenu = $derived.by(() => {
        if (localMenu && Array.isArray(localMenu) && localMenu.length > 0) {
            return localMenu;
        }
        return defaultFooterMenu;
    });

    // Normalize menu to FooterLinkColumn format
    function normalizeFooterColumns(menu: any[]): FooterLinkColumn[] {
        return menu.map((column, index) => ({
            id: column.id || `col-${index}`,
            heading: column.label || column.heading || '',
            links: (column.items || column.links || []).map((link: any, linkIndex: number) => ({
                id: link.id || `link-${index}-${linkIndex}`,
                label: link.label,
                url: link.link || link.url || link.slug || '#',
                external: link.external,
            })),
        }));
    }

    const footerColumns = $derived<FooterLinkColumn[]>(normalizeFooterColumns(footerMenu));

    // Footer nav configuration
    const footerNavConfig = $derived<Partial<FooterColumnsConfig>>({
        layout: 'columns',
        colors: {
            headingText: textColor,
            linkText: textColor,
            linkHover: textColor,
        },
    });

  let content = $derived({
        id,
        backgroundColor,
        textColor,
        reverseOrder,
        poweredBy,
        type,
        icons,
        menu: footerMenu,
        menuHidden,
        copyrightText
    });
    const serializeContent = () => JSON.stringify(content);

    let component = $state<HTMLElement>();
    let mounted = $state(false);

  onMount(() => {
    mounted = true;
    blockRegistry.register(componentRef, () => ({ ...content, region: 'footer' }), 'footer', component);
    return () => blockRegistry.unregister(componentRef);
  });
</script>

{#if editable}
    <div
        class="editor-footer-item group relative krt-footer__editor"
        bind:this={component}
        data-krt-serialized={serializeContent()}
    >
        {#if mounted}
            <BlockActions
                {id}
                {type}
                element={component}
                inspectorTitle="Footer settings"
            >
                {#snippet inspector()}
                    <div class="krt-footerInspector">
                        <!-- Quick Settings -->
                        <InspectorSection title="Quick Settings" icon="⚡" hint="Common adjustments" primary>
                            <ToggleControl label="Swap Layout" bind:checked={reverseOrder} />
                        </InspectorSection>

                        <!-- Colors -->
                        <InspectorSection title="Colors" icon="🎨" hint="Footer appearance">
                            <ColorControl label="Background" bind:value={backgroundColor} />
                            <ColorControl label="Text" bind:value={textColor} />
                        </InspectorSection>

                        <!-- Social Links -->
                        <SocialLinksEditor bind:icons={icons} />
                    </div>
                {/snippet}
            </BlockActions>
        {/if}
        <div
            id={id}
            data-type={type}
            class="krt-footer krt-footer--twig"
            style:background-color={backgroundColor}
            style:color={textColor}
        >
            <div id="metadata-{id}" style="display: none;">{serializeContent()}</div>
            <svelte:element this={'script'} type="application/json" data-region-metadata>{serializeContent()}</svelte:element>
            <section class="krt-footer__primary" class:krt-footer__primary--reversed={reverseOrder}>
                {#if reverseOrder}
                    <div class="krt-footer__columns">
                        {#if !menuHidden}
                            <FooterNavColumns 
                                columns={footerColumns} 
                                config={footerNavConfig}
                                ariaLabel="Footer navigation"
                            />
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
                            <FooterNavColumns 
                                columns={footerColumns} 
                                config={footerNavConfig}
                                ariaLabel="Footer navigation"
                            />
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
                        <a class="krt-footer__iconButton" href={link || '#'} aria-label={name}>
                            <Comp aria-hidden="true" />
                        </a>
                    {/each}
                </nav>
            </section>
        </div>
    </div>

    
{:else}
    <div
        id={id}
        data-type={type}
        class="krt-footer krt-footer--twig"
        style:background-color={backgroundColor}
        style:color={textColor}
        data-krt-serialized={serializeContent()}
    >
        <div id="metadata-{id}" style="display: none;">{serializeContent()}</div>
        <svelte:element this={'script'} type="application/json" data-region-metadata>{serializeContent()}</svelte:element>
        <section class="krt-footer__primary" class:krt-footer__primary--reversed={reverseOrder}>
            {#if reverseOrder}
                <div class="krt-footer__columns">
                    {#if !menuHidden}
                        <FooterNavColumns 
                            columns={footerColumns} 
                            config={footerNavConfig}
                            ariaLabel="Footer navigation"
                        />
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
                        <FooterNavColumns 
                            columns={footerColumns} 
                            config={footerNavConfig}
                            ariaLabel="Footer navigation"
                        />
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
                    <a class="krt-footer__iconButton" href={link || '#'} aria-label={name}>
                        <Comp aria-hidden="true" />
                    </a>
                {/each}
            </nav>
        </section>
    </div>
{/if}

<style>
    /* Inspector container */
    .krt-footerInspector {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-xl, 1.5rem);
    }

    /* Footer Component Styles */
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

    .krt-footer__editor {
        position: relative;
    }
</style>
  
