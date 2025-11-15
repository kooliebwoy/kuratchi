<script lang="ts">
 import { LayoutBlock } from '../shell/index.js';
 import { IconPicker } from '../plugins/index.js';
 import { LucideIconMap, type LucideIconKey } from '../utils/lucide-icons.js';

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
</script>

<LayoutBlock {id} type={type}>
{#snippet drawerContent()}
    <div class="space-y-6">
        <!-- Display Options -->
        <div class="space-y-3">
            <h3 class="text-sm font-semibold text-base-content">Display Options</h3>
            <div class="space-y-2">
                <label class="label cursor-pointer">
                    <span class="label-text">Swap Logo and Footer Menu</span>
                    <input type="checkbox" class="checkbox checkbox-accent" bind:checked={reverseOrder} />
                </label>
            </div>
        </div>

        <!-- Colors -->
        <div class="space-y-3">
            <h3 class="text-sm font-semibold text-base-content">Colors</h3>
            <div class="space-y-2">
                <div class="form-control">
                    <label class="label">
                        <span class="label-text text-xs">Component Background</span>
                    </label>
                    <input type="color" class="input input-bordered h-10" bind:value={backgroundColor} />
                </div>
                <div class="form-control">
                    <label class="label">
                        <span class="label-text text-xs">Text Color</span>
                    </label>
                    <input type="color" class="input input-bordered h-10" bind:value={textColor} />
                </div>
            </div>
        </div>

        <!-- Icons -->
        <div class="space-y-3">
            <h3 class="text-sm font-semibold text-base-content">Icons</h3>
            <IconPicker bind:selectedIcons={icons} />
            <div class="space-y-2">
                {#each icons as icon}
                    {@const Comp = LucideIconMap[icon.icon as LucideIconKey]}
                    <div class="form-control">
                        <label class="label">
                            <span class="label-text text-xs flex items-center gap-2">
                                <Comp class="text-lg" />
                                Link
                            </span>
                        </label>
                        <input type="text" class="input input-bordered input-sm" value={icon.link} onchange={(e) => icon.link = (e.target as HTMLInputElement).value} />
                    </div>
                {/each}
            </div>
        </div>
    </div>
{/snippet}

{#snippet metadata()}
    {JSON.stringify(content)}
{/snippet}

{#snippet children()}
    <div class="container mx-auto" id={id} style:background-color={backgroundColor} data-type={type}>
        <footer class="footer p-10 text-base-content mb-0 min-w-full rounded-3xl min-h-56" style:background-color={backgroundColor}>
            {#if reverseOrder}
                <div class="flex flex-col lg:flex-row gap-6 grow">
                    {#if !menuHidden}
                        <div class="flex flex-row gap-8">
                            {#each footerMenu as item}
                                <nav class="flex flex-col gap-2">
                                    <h6 class="footer-title" style:color={textColor}>{item.label}</h6>
                                    {#each item.items as subItem}
                                        <a class="link link-hover text-sm font-light opacity-90" style:color={textColor} href={subItem.link}>{subItem.label}</a>
                                    {/each}
                                </nav>
                            {/each}
                        </div>
                    {/if}
                </div>
                <aside class="flex-1 flex justify-end items-center">
                    <img src={footerLogo.src} alt={footerLogo.alt} class="max-w-40 max-h-40" />
                </aside>
            {:else}
                <aside class="flex-1 flex items-center">
                    <img src={footerLogo.src} alt={footerLogo.alt} class="max-w-40 max-h-40" />
                </aside>
                <div class="flex flex-col lg:flex-row gap-6 grow">
                    {#if !menuHidden}
                        <div class="flex flex-row gap-8">
                            {#each footerMenu as item}
                                <nav class="flex flex-col gap-2">
                                    <h6 class="footer-title" style:color={textColor}>{item.label}</h6>
                                    {#each item.items as subItem}
                                        <a class="link link-hover text-sm font-light opacity-90" style:color={textColor} href={subItem.link}>{subItem.label}</a>
                                    {/each}
                                </nav>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/if}
        </footer>

        <footer class="footer grid grid-cols-1 md:grid-cols-3 place-content-evenly px-4 bg-transparent text-neutral-content">
            <aside class="self-center">
                <p style:color={textColor}>Copyright © {new Date().getFullYear()} - All right reserved by {copyrightText.by}</p>
            </aside>
            <small class="opacity-50 self-center place-self-center">
                <a href="https://kayde.io" target="_blank" class="text-white">{poweredBy}</a>
            </small>
            <nav class="grid-flow-col gap-2 md:place-self-center md:justify-self-end">
                {#each icons as {icon, link, name}}
                    {@const Comp = LucideIconMap[icon as LucideIconKey]}
                    <button class="btn btn-ghost btn-circle !mx-0" style:color={textColor}>
                        <Comp class="text-sm" />
                    </button>
                {/each}
            </nav>
        </footer>
    </div>
{/snippet}
</LayoutBlock>
  
