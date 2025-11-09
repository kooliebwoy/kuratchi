<script lang="ts">
    import { SearchIcons, LayoutBlock } from '../shell/index.js';
    import { LucideIconMap, type LucideIconKey } from '../utils/lucide-icons.js';

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
    }

    let {
        reverseOrder = false,
        textColor = '#ffffff',
        backgroundColor = '#212121',
        type = 'saige-blake-footer',
        icons = [
            { icon: 'facebook', slug: '#', name: "Facebook", enabled: true },
            { icon: 'x', slug: '#', name: "X", enabled: true },
            { icon: 'instagram', slug: '#', name: "Instagram", enabled: true },
        ] as { icon: LucideIconKey; slug: string; name: string; enabled: boolean }[],
        subscribeText = 'Get all the latest news and info sent to your inbox.',
        copyrightText = {
            href: 'https://kayde.io',
            by: 'Kayde',
        },
        menu = [
            { label: 'Privacy Policy', slug: '/product-a' },
            { label: 'Terms & Conditions', slug: '/product-b' },
            { label: 'Follow Us', slug: '/product-c' },
            { label: 'Contact Us', slug: '/product-d' },
        ],
        menuHidden = false
    }: Props = $props();

    let footerLogo = {
        href: 'https://kayde.io',
        src: '/kayde-logo.png',
        alt: 'Kayde Logo',
        name: 'Kayde',
    }
    
    const defaultMenu = [
        { label: 'Privacy Policy', slug: '/product-a' },
        { label: 'Terms & Conditions', slug: '/product-b' },
        { label: 'Follow Us', slug: '/product-c' },
        { label: 'Contact Us', slug: '/product-d' },
    ];

    // Compute menu once per prop change to avoid inline re-evaluation
    const computedMenu = $derived.by(() => {
        return (menu && Array.isArray(menu) && menu.length > 0) ? menu : defaultMenu;
    });

    const poweredBy = 'Powered by Clutch CMS';

    let content = $derived({
        backgroundColor: backgroundColor,
        textColor: textColor,
        reverseOrder: reverseOrder,
        poweredBy: poweredBy,
        type,
        icons,
        // Do not include menu here to avoid excessive JSON churn
        subscribeText,
        copyrightText,
    })
</script>

<LayoutBlock {id} {type}>
    {#snippet drawerContent()}
        <div class="flex flex-wrap flex-col justify-between">
            <fieldset class="fieldset p-4">
                <label class="fieldset-label">
                    <input type="checkbox" class="checkbox" bind:checked={reverseOrder} />
                    Swap Logo and Footer Menu
                </label>
            </fieldset>
            
            <fieldset class="fieldset p-4">
                <label class="fieldset-label">
                    <input type="color" class="input-color" bind:value={backgroundColor} />
                    Component Background Color
                </label>
            </fieldset>
            
            <fieldset class="fieldset p-4">
                <label class="fieldset-label">
                    <input type="color" class="input-color" bind:value={textColor} />
                    Text Color
                </label>
            </fieldset>
            
            <div class="divider"></div>

            <h4>Icons</h4>

            <SearchIcons bind:selectedIcons={icons} />

            {#each icons as icon}
                {@const Comp = LucideIconMap[icon.icon]}
                <fieldset class="fieldset w-xs bg-base-300 border border-base-300 p-4 rounded-box">
                    <legend class="fieldset-legend">
                        <Comp class="text-2xl" />
                    </legend>
                    <input type="text" class="input" value={icon.slug} onchange={(e) => icon.slug = (e.target as HTMLInputElement).value} />
                </fieldset>
            {/each}
        </div>
    {/snippet}

    {#snippet metadata()}
        {JSON.stringify(content)}
    {/snippet}

    {#snippet children()}
        <footer class="footer footer-center p-10" style:background-color={backgroundColor} style:color={textColor}>
            <aside>
                <h1 class="text-3xl font-bold text-wrap max-w-64" contenteditable bind:innerHTML={subscribeText} style:color={textColor}></h1>
                <input type="text" placeholder="Email Address" class="input input-bordered input-md w-full max-w-xs rounded-none mt-2 -mb-2" />
                <button class="btn btn-ghost underline text-lg font-semibold" style:color={textColor}>Subscribe</button>
            </aside>
        </footer>
        
        <footer class="footer sm:footer-horizontal bg-neutral text-neutral-content items-center p-4" style:background-color={backgroundColor}>
            {#if reverseOrder}
                <aside class="grid-flow-col items-center">
                    {#if !menuHidden}
                        <nav class="flex flex-wrap gap-2 md:place-self-center md:justify-self-end">
                            {#each computedMenu as item}
                                <a class="link link-hover text-sm font-light opacity-90" style:color={textColor} href={item.slug}>{item.label}</a>
                            {/each}
                        </nav>
                    {/if}
                </aside>
                <nav class="md:place-self-center md:justify-self-end">
                    <div class="grid grid-flow-col gap-4">
                        {#each icons as {icon, slug, name}}
                            {@const Comp = LucideIconMap[icon]}
                            <button class="btn btn-ghost btn-circle !mx-0" style:color={textColor}>
                                <Comp class="text-xl opacity-90" />
                            </button>
                        {/each}
                    </div>
                </nav>
            {:else}
                <aside class="grid-flow-col items-center">
                    <nav class="md:place-self-center md:justify-self-end">
                        <div class="grid grid-flow-col gap-4">
                            {#each icons as {icon, slug, name}}
                                {@const Comp = LucideIconMap[icon]}
                                <button class="btn btn-ghost btn-circle !mx-0" style:color={textColor}>
                                    <Comp class="text-xl opacity-90" />
                                </button>
                            {/each}
                        </div>
                    </nav>
                </aside>
                {#if !menuHidden}
                    <nav class="flex flex-wrap gap-2 md:place-self-center md:justify-self-end">
                        {#each (menu && Array.isArray(menu) && menu.length > 0 ? menu : defaultMenu) as item}
                            <a class="link link-hover text-sm font-light opacity-90" style:color={textColor} href={item.slug}>{item.label}</a>
                        {/each}
                    </nav>
                {/if}
            {/if}
        </footer>
        <footer class="footer footer-center p-4" style:background-color={backgroundColor} style:color={textColor}>
            <aside>
                <p style:color={textColor} class="opacity-60 text-sm"> {new Date().getFullYear()} {copyrightText.by} All right reserved.</p>
                <small class="opacity-50">
                    <a href="https://kayde.io" target="_blank" class="text-content italic">{poweredBy}</a>
                </small>
            </aside>
        </footer>
    {/snippet}
</LayoutBlock>