<script lang="ts">
    import { onMount } from 'svelte';
    import { BlockActions } from '../utils/index.js';
    import { 
        FooterNavLinks, 
        type FooterLink, 
        type FooterLinksConfig,
        // Inspector Widgets
        InspectorSection,
        ToggleControl,
        ColorControl,
        SocialLinksEditor
    } from '../widgets/index.js';
    import { LucideIconMap, type LucideIconKey } from '../utils/lucide-icons.js';
    import { blockRegistry } from '../stores/editorSignals.svelte.js';

    let id = crypto.randomUUID(); // Ensure each content has a unique ID

    interface Props {
        reverseOrder?: boolean;
        textColor?: string;
        backgroundColor?: string;
        type?: string;
        icons?: { icon: LucideIconKey; slug: string; name: string; enabled: boolean }[];
        subscribeText?: string;
        copyrightText?: any;
        menu?: any;
        menuHidden?: boolean;
        editable?: boolean;
    }

    let {
        reverseOrder: initialReverseOrder = false,
        textColor: initialTextColor = '#ffffff',
        backgroundColor: initialBackgroundColor = '#212121',
        type = 'saige-blake-footer',
        icons: initialIcons = [
            { icon: 'facebook', slug: '#', name: "Facebook", enabled: true },
            { icon: 'x', slug: '#', name: "X", enabled: true },
            { icon: 'instagram', slug: '#', name: "Instagram", enabled: true },
        ] as { icon: LucideIconKey; slug: string; name: string; enabled: boolean }[],
        subscribeText: initialSubscribeText = 'Get all the latest news and info sent to your inbox.',
        copyrightText: initialCopyrightText = {
            href: 'https://kayde.io',
            by: 'Kayde',
        },
        menu: initialMenu = [
            { label: 'Privacy Policy', slug: '/product-a' },
            { label: 'Terms & Conditions', slug: '/product-b' },
            { label: 'Follow Us', slug: '/product-c' },
            { label: 'Contact Us', slug: '/product-d' },
        ],
        menuHidden: initialMenuHidden = false,
        editable = true
    }: Props = $props();

    let reverseOrder = $state(initialReverseOrder);
    let textColor = $state(initialTextColor);
    let backgroundColor = $state(initialBackgroundColor);
    let icons = $state(initialIcons);
    let subscribeText = $state(initialSubscribeText);
    let copyrightText = $state(initialCopyrightText);
    let localMenu = $state(initialMenu);
    let menuHidden = $state(initialMenuHidden);

    const defaultMenu = [
        { label: 'Privacy Policy', slug: '/product-a' },
        { label: 'Terms & Conditions', slug: '/product-b' },
        { label: 'Follow Us', slug: '/product-c' },
        { label: 'Contact Us', slug: '/product-d' },
    ];

    // Menu items come from props (injected by Dashboard via siteMetadata.navigation.footer.items)
    // Navigation CRUD is handled in Dashboard, not editable in footer component
    const computedMenu = $derived.by(() => {
        if (localMenu && Array.isArray(localMenu) && localMenu.length > 0) {
            return localMenu;
        }
        return defaultMenu;
    });

    // Normalize menu items to FooterLink format
    function normalizeFooterLinks(items: any[]): FooterLink[] {
        return items.map((item, index) => ({
            id: item.id || `link-${index}`,
            label: item.label,
            url: item.slug || item.link || item.url || '#',
            external: item.external,
        }));
    }

    const footerLinks = $derived<FooterLink[]>(normalizeFooterLinks(computedMenu));

    // Footer links configuration
    const footerLinksConfig = $derived<Partial<FooterLinksConfig>>({
        layout: 'horizontal',
        colors: {
            linkText: textColor,
            linkHover: textColor,
        },
    });

    const poweredBy = 'Powered by Clutch CMS';
    const componentRef = {};

    // Helper function to get href from an item
    function hrefFrom(item: any): string {
        if (typeof item?.url === 'string' && item.url.length > 0) return item.url;
        if (typeof item?.link === 'string' && item.link.length > 0) return item.link;
        if (typeof item?.slug === 'string' && item.slug.length > 0) return `/${item.slug}`;
        return '#';
    }

    let content = $derived({
        id,
        backgroundColor,
        textColor,
        reverseOrder,
        poweredBy,
        type,
        icons,
        subscribeText,
        copyrightText,
        menuHidden
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
    class="editor-footer-item krt-footer__editor"
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
                    <SocialLinksEditor bind:icons={icons} linkField="slug" />
                </div>
            {/snippet}
        </BlockActions>
    {/if}
    <div
        {id}
        class="krt-footer krt-footer--saige"
        style:background-color={backgroundColor}
        style:color={textColor}
        data-type={type}
    >
        <svelte:element this={'script'} type="application/json" data-region-metadata>{serializeContent()}</svelte:element>
        <section class="krt-footer__cta">
            <h2 class="krt-footer__heading" contenteditable bind:innerHTML={subscribeText}></h2>
            <div class="krt-footer__form">
                <input
                    type="email"
                    class="krt-footer__input"
                    placeholder="Email Address"
                    aria-label="Email address"
                />
                <button class="krt-footer__button" type="button">Subscribe</button>
            </div>
        </section>

        <section class="krt-footer__secondary" class:krt-footer__secondary--reversed={reverseOrder}>
            <div class="krt-footer__segment">
                {#if reverseOrder}
                    {#if !menuHidden}
                        <FooterNavLinks links={footerLinks} config={footerLinksConfig} />
                    {/if}
                {:else}
                    <div class="krt-footer__icons">
                        {#each icons as { icon, slug, name }}
                            {@const Comp = LucideIconMap[icon as LucideIconKey]}
                            <a class="krt-footer__iconButton" href={hrefFrom({ slug })} aria-label={name}>
                                <Comp aria-hidden="true" />
                            </a>
                        {/each}
                    </div>
                {/if}
            </div>
            <div class="krt-footer__segment">
                {#if reverseOrder}
                    <div class="krt-footer__icons">
                        {#each icons as { icon, slug, name }}
                            {@const Comp = LucideIconMap[icon as LucideIconKey]}
                            <a class="krt-footer__iconButton" href={hrefFrom({ slug })} aria-label={name}>
                                <Comp aria-hidden="true" />
                            </a>
                        {/each}
                    </div>
                {:else if !menuHidden}
                    <FooterNavLinks links={footerLinks} config={footerLinksConfig} />
                {/if}
            </div>
        </section>

        <section class="krt-footer__legal">
            <p>{new Date().getFullYear()} {copyrightText.by} · All rights reserved.</p>
            <small>
                <a href="https://kayde.io" target="_blank" rel="noreferrer noopener">{poweredBy}</a>
            </small>
        </section>
    </div>
</div>

{:else}
    <div
        {id}
        class="krt-footer krt-footer--saige"
        style:background-color={backgroundColor}
        style:color={textColor}
        data-type={type}
        data-krt-serialized={serializeContent()}
    >
        <div id="metadata-{id}" style="display: none;">{serializeContent()}</div>
        <svelte:element this={'script'} type="application/json" data-region-metadata>{serializeContent()}</svelte:element>
        <section class="krt-footer__cta">
            <h2 class="krt-footer__heading">{subscribeText}</h2>
            <div class="krt-footer__form">
                <input
                    type="email"
                    class="krt-footer__input"
                    placeholder="Email Address"
                    aria-label="Email address"
                />
                <button class="krt-footer__button" type="button">Subscribe</button>
            </div>
        </section>

        <section class="krt-footer__secondary" class:krt-footer__secondary--reversed={reverseOrder}>
            <div class="krt-footer__segment">
                {#if reverseOrder}
                    {#if !menuHidden}
                        <FooterNavLinks links={footerLinks} config={footerLinksConfig} />
                    {/if}
                {:else}
                    <div class="krt-footer__icons">
                        {#each icons as { icon, slug, name }}
                            {@const Comp = LucideIconMap[icon as LucideIconKey]}
                            <a class="krt-footer__iconButton" href={hrefFrom({ slug })} aria-label={name}>
                                <Comp aria-hidden="true" />
                            </a>
                        {/each}
                    </div>
                {/if}
            </div>
            <div class="krt-footer__segment">
                {#if reverseOrder}
                    <div class="krt-footer__icons">
                        {#each icons as { icon, slug, name }}
                            {@const Comp = LucideIconMap[icon as LucideIconKey]}
                            <a class="krt-footer__iconButton" href={hrefFrom({ slug })} aria-label={name}>
                                <Comp aria-hidden="true" />
                            </a>
                        {/each}
                    </div>
                {:else if !menuHidden}
                    <FooterNavLinks links={footerLinks} config={footerLinksConfig} />
                {/if}
            </div>
        </section>

        <section class="krt-footer__legal">
            <p>{new Date().getFullYear()} {copyrightText.by} · All rights reserved.</p>
            <small>
                <a href="https://kayde.io" target="_blank" rel="noreferrer noopener">{poweredBy}</a>
            </small>
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
        background: color-mix(in srgb, currentColor 6%, transparent);
    }

    .krt-footer__cta {
        display: grid;
        gap: var(--krt-space-md, 0.75rem);
        padding: var(--krt-space-lg, 1rem) var(--krt-space-xl, 1.25rem);
        border-radius: var(--krt-radius-xl, 1rem);
        border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
        background: rgba(0, 0, 0, 0.2);
        box-shadow: 0 16px 45px rgba(15, 23, 42, 0.18);
    }

    .krt-footer__heading {
        margin: 0;
        font-size: clamp(1.5rem, 2vw + 1rem, 2.25rem);
        font-weight: 700;
        line-height: 1.25;
        max-width: 28ch;
    }

    .krt-footer__form {
        display: flex;
        flex-direction: column;
        gap: var(--krt-space-sm, 0.5rem);
    }

    @media (min-width: 40rem) {
        .krt-footer__form {
            flex-direction: row;
            align-items: center;
        }
    }

    .krt-footer__input {
        flex: 1 1 12rem;
        border-radius: var(--krt-radius-lg, 0.75rem);
        border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
        padding: 0.65rem 0.9rem;
        background: rgba(255, 255, 255, 0.88);
        color: var(--krt-color-neutral-900, #1f2937);
        font-size: 0.95rem;
    }

    .krt-footer__input::placeholder {
        color: rgba(15, 23, 42, 0.55);
    }

    .krt-footer__button {
        flex: 0 0 auto;
        border: none;
        border-radius: var(--krt-radius-lg, 0.75rem);
        padding: 0.7rem 1.4rem;
        font-weight: 600;
        letter-spacing: 0.04em;
        background: color-mix(in srgb, currentColor 22%, transparent);
        color: inherit;
        cursor: pointer;
        transition: transform 150ms ease, background 150ms ease;
    }

    .krt-footer__button:hover {
        transform: translateY(-1px);
        background: color-mix(in srgb, currentColor 30%, transparent);
    }

    .krt-footer__secondary {
        display: grid;
        gap: var(--krt-space-lg, 1rem);
        border-radius: var(--krt-radius-xl, 1rem);
        border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
        padding: var(--krt-space-lg, 1rem) var(--krt-space-xl, 1.25rem);
        background: rgba(0, 0, 0, 0.16);
    }

    @media (min-width: 48rem) {
        .krt-footer__secondary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .krt-footer__secondary--reversed {
            direction: rtl;
        }

        .krt-footer__secondary--reversed .krt-footer__segment {
            direction: ltr;
        }
    }

    .krt-footer__segment {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    @media (min-width: 48rem) {
        .krt-footer__segment {
            justify-content: flex-start;
        }
    }

    .krt-footer__icons {
        display: flex;
        align-items: center;
        gap: var(--krt-space-sm, 0.5rem);
    }

    .krt-footer__iconButton {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: var(--krt-radius-pill, 999px);
        border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
        background: rgba(255, 255, 255, 0.1);
        color: inherit;
        transition: transform 150ms ease, background 150ms ease;
    }

    .krt-footer__iconButton:hover {
        transform: translateY(-1px);
        background: rgba(255, 255, 255, 0.22);
    }

    .krt-footer__iconButton :global(svg) {
        width: 1.1rem;
        height: 1.1rem;
    }

    .krt-footer__legal {
        display: grid;
        gap: var(--krt-space-xs, 0.25rem);
        justify-items: center;
        padding: var(--krt-space-md, 0.75rem);
        border-radius: var(--krt-radius-lg, 0.75rem);
        border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
        background: rgba(0, 0, 0, 0.12);
    }

    @media (min-width: 48rem) {
        .krt-footer__legal {
            grid-template-columns: auto auto;
            justify-content: space-between;
            justify-items: start;
            align-items: center;
            padding-inline: var(--krt-space-xl, 1.25rem);
        }
    }

    .krt-footer__legal p,
    .krt-footer__legal small {
        margin: 0;
        font-size: 0.85rem;
        opacity: 0.8;
    }

    .krt-footer__legal a {
        color: inherit;
        text-decoration: none;
        font-style: italic;
    }

    .krt-footer__legal a:hover {
        opacity: 1;
    }

    .krt-footer__editor {
        position: relative;
    }
</style>
