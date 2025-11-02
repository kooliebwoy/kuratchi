<script lang="ts">
    import { LayoutBlock, SearchIcons } from '../shell/index.js';
    import { LucideIconMap, type LucideIconKey } from '../utils/lucide-icons.js';
    import { Menu } from '@lucide/svelte';

    interface Props {
        type?: string;
        backgroundColor?: string;
        textColor?: string;
        reverseOrder?: boolean;
        icons?: any;
        menu?: any;
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
        menu = []
    }: Props = $props();

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

    // default image since we are only showing examples
    let image = {
        src: '/clutch-cms-logo.png',
        alt: 'Clutch CMS Logo',
        title: 'Clutch CMS Logo',
    }

    let content = $derived({
        backgroundColor,
        textColor,
        reverseOrder,
        type,
        icons,
        menu: localMenu,
    })
</script>

<LayoutBlock {id} {type}>
    {#snippet drawerContent()}
        <div class="flex flex-wrap flex-col justify-between">
            <div class="form-control">
                <label class="label cursor-pointer">
                    <span class="label-text">Swap Icons and Nav Menu</span>
                    <input type="checkbox" class="checkbox checkbox-accent ml-4" bind:checked={reverseOrder} />
                </label>
            </div>

            <div class="form-control">
                <label class="label cursor-pointer">
                    <span class="label-text">Component Background Color</span>
                    <input type="color" class="input-color ml-4" bind:value={backgroundColor} />
                </label>
            </div>
            
            <div class="form-control">
                <label class="label cursor-pointer">
                    <span class="label-text">Text Color</span>
                    <input type="color" class="input-color ml-4" bind:value={textColor} />
                </label>
            </div>

            <div class="divider"></div>

            <h4>Icons</h4>

            <SearchIcons bind:selectedIcons={icons} />

            {#each icons as icon}
                {@const Comp = LucideIconMap[icon.icon as LucideIconKey]}
                <div class="form-control">
                    <label class="label cursor-pointer">
                        <Comp class="text-2xl" />
                        <input type="text" class="input input-bordered" value={icon.link} onchange={(e) => icon.link = (e.target as HTMLInputElement).value} />
                    </label>
                </div>
            {/each}
        </div>
    {/snippet}

    {#snippet metadata()}
        {JSON.stringify(content)}
    {/snippet}

    {#snippet children()}
        <div class="navbar" style:background-color={backgroundColor} data-type={type}>
            {#if reverseOrder}
                <div class="navbar-start grow">
                    <div class="flex items-center ml-4 space-x-3">
                        {#each icons as {icon, link, name}}
                            {@const Comp = LucideIconMap[icon as LucideIconKey]}
                            <button class="btn btn-ghost btn-circle !mx-0" style:color={textColor}>
                                <Comp class="text-lg" />
                            </button>
                        {/each}
                    </div>
                </div>
            {:else}
                <div class="navbar-start hidden xl:flex grow">
                    <a class="btn btn-ghost text-xl hover:bg-transparent font-normal" href="homepage">
                        <img src={image.src} class="me-3 h-6 sm:h-9 my-0" alt={image.alt} title={image.title} />
                    </a>
                    <ul class="menu menu-horizontal px-1 items-center">
                        {#each localMenu as item}
                            {#if item.items}
                                <li>
                                    <button class="btn btn-ghost hover:bg-base-100/20 hover:border-none hover:shadow-none" style:color={textColor} popovertarget="popover-{item.id}" style="anchor-name:--anchor-{item.id}">
                                        {item.label}
                                      </button>
                                    <ul class="dropdown menu w-40 rounded-box bg-base-100 shadow-sm mt-1" style:background-color={backgroundColor} popover id="popover-{item.id}" style="position-anchor:--anchor-{item.id}">
                                        {#each item.items as subItem}
                                            <li>
                                                <a href={subItem.slug} class="no-underline hover:bg-base-100/20" style:color={textColor}>{subItem.label}</a>
                                            </li>
                                        {/each}
                                    </ul>
                                </li>
                            {:else if item.slug}
                                <li><a href={item.slug} class="no-underline hover:bg-base-100/20" style:color={textColor}>{item.label}</a></li>
                            {/if}
                        {/each}
                    </ul>
                </div>
            {/if}
            <div class="navbar-center grow-0">
                <button class="btn btn-sm xl:hidden" popovertarget="popover-MobileMenu" style="anchor-name:--anchor-MobileMenu">
                    <Menu class="text-xl" />
                </button>
                <ul class="dropdown menu w-52 rounded-box bg-base-100 shadow-sm mt-1" popover id="popover-MobileMenu" style="position-anchor:--anchor-MobileMenu">
                    {#each localMenu as item}
                        {#if item.items}
                            <li>
                                <details>
                                    <summary style:color={textColor}>
                                        {item.label}
                                    </summary>
                                    <ul class="p-2">
                                        {#each item.items as subItem}
                                            <li>
                                                <a href={subItem.slug} class="no-underline" style:color={textColor}>{subItem.label}</a>
                                            </li>
                                        {/each}
                                    </ul>
                                </details>
                            </li>
                        {:else if item.slug}
                            <li><a href={item.slug} class="no-underline" style:color={textColor}>{item.label}</a></li>
                        {/if}
                    {/each}
                </ul>
            </div>
            {#if reverseOrder}
                <div class="navbar-end hidden xl:flex grow">
                    <a class="btn btn-ghost text-xl hover:bg-transparent font-normal" href="homepage">
                        <img src={image.src} class="me-3 h-6 sm:h-9 my-0" alt={image.alt} title={image.title} />
                    </a>
                    <ul class="menu menu-horizontal px-1 items-center">
                        {#each localMenu as item}
                            {#if item.items}
                                <li>
                                    <button class="btn btn-ghost hover:bg-base-100/20 hover:border-none hover:shadow-none" style:color={textColor} popovertarget="popover-{item.id}" style="anchor-name:--anchor-{item.id}">
                                        {item.label}
                                      </button>
                                    <ul class="dropdown menu w-40 rounded-box bg-base-100 shadow-sm mt-1" style:background-color={backgroundColor} popover id="popover-{item.id}" style="position-anchor:--anchor-{item.id}">
                                        {#each item.items as subItem}
                                            <li>
                                                <a href={subItem.slug} class="no-underline hover:bg-base-100/20" style:color={textColor}>{subItem.label}</a>
                                            </li>
                                        {/each}
                                    </ul>
                                </li>
                            {:else if item.slug}
                                <li><a href={item.slug} class="no-underline hover:bg-base-100/20" style:color={textColor}>{item.label}</a></li>
                            {/if}
                        {/each}
                    </ul>
                </div>
            {:else}
                <div class="navbar-end grow">
                    <div class="flex items-center ml-4 space-x-3">
                        {#each icons as {icon, link, name}}
                            {@const Comp = LucideIconMap[icon as LucideIconKey]}
                            <button class="btn btn-ghost btn-circle !mx-0" style:color={textColor}>
                                <Comp class="text-lg" />
                            </button>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>
    {/snippet}
</LayoutBlock>
