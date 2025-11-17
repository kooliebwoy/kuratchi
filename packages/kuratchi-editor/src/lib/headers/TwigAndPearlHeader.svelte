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
    const mobileTriggerClass = $derived(useMobileMenuOnDesktop ? '' : 'xl:hidden');
    const desktopContainerClass = (hidden: boolean) => hidden ? 'hidden' : 'xl:flex';

    function hrefFrom(item: any): string {
        if (typeof item?.link === 'string' && item.link.length > 0) return item.link;
        if (typeof item?.slug === 'string' && item.slug.length > 0) return `/${item.slug}`;
        return '#';
    }
</script>

<LayoutBlock {id} type={type}>
{#snippet drawerContent()}
    <div class="space-y-6">
        <!-- Display Options -->
        <div class="space-y-3">
            <h3 class="text-sm font-semibold text-base-content">Display Options</h3>
            <div class="space-y-2">
                <label class="label cursor-pointer">
                    <span class="label-text">Swap Icons and Nav Menu</span>
                    <input type="checkbox" class="checkbox checkbox-accent" bind:checked={reverseOrder} />
                </label>
                <label class="label cursor-pointer">
                    <span class="label-text">Search Bar Enabled</span>
                    <input type="checkbox" class="checkbox checkbox-accent" bind:checked={searchEnabled} />
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
                        <span class="label-text text-xs">Home Icon Color</span>
                    </label>
                    <input type="color" class="input input-bordered h-10" bind:value={homeIconColor} />
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
        <div class="navbar">
            {#if reverseOrder}
                <div class="navbar-start grow">
                    <div class="flex items-center ml-4 space-x-3">
                        {#each icons as {icon, link, name}}
                            {@const Comp = LucideIconMap[icon as LucideIconKey]}
                            <button class="btn btn-ghost btn-circle !mx-0" style:color={textColor}>
                                <Comp class="text-lg" />
                            </button>
                        {/each}
                        {#if searchEnabled}
                            <label class="input input-ghost items-center gap-2 rounded-3xl input-sm hidden lg:flex" style:color={textColor}>
                                <Search />
                                <input type="text" class="grow" placeholder="Search" />
                            </label>
                        {/if}
                    </div>
                </div>
            {:else}
                <div class={`navbar-start ${desktopContainerClass(!showDesktopMenu)} grow`}>
                    <ul class="menu menu-horizontal px-1 items-center">
                        <li>
                            <a href="homepage" class="btn btn-ghost hover:bg-transparent hover:text-red-500 px-1" style:color={homeIconColor}>
                                <Home class="text-4xl -mt-2" />
                            </a>
                        </li>
                        {#if !menuHidden}
                        {#each menu as item}
                            {#if item.items}
                                <li>
                                    <details>
                                        <summary style:color={textColor}>
                                            {item.label}
                                        </summary>
                                        <ul class="p-2 min-w-36" style:background-color={backgroundColor}>
                                            {#each item.items as subItem}
                                                <li>
                                                    <a href={hrefFrom(subItem)} class="no-underline" style:color={textColor}>{subItem.label}</a>
                                                </li>
                                            {/each}
                                        </ul>
                                    </details>
                                </li>
                            {:else}
                                <li>
                                    <a href={hrefFrom(item)} class="no-underline" style:color={textColor}>{item.label}</a>
                                </li>
                            {/if}
                        {/each}
                        {/if}
                    </ul>
                </div>
            {/if}
            <div class="navbar-center grow-0">
                <div class="dropdown">
                    <div tabindex="0" role="button" class={`btn btn-ghost px-0 ${mobileTriggerClass}`}>
                        <Menu class="text-white text-xl" />
                    </div>
                    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
                    <ul tabindex="0" class="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow rounded-box w-52 space-y-3" style:background-color=var(--theme-primary-color)>
                        <!-- Default Home Link -->
                        <!-- <li>
                            <a href="/homepage" class={activeSelection('/')}>Home</a>
                        </li> -->
                        {#if !menuHidden}
                        {#each menu as item}
                            {#if item.items}
                                <li>
                                    <details>
                                        <summary style:color={textColor}>
                                            {item.label}
                                        </summary>
                                        <ul class="p-2">
                                            {#each item.items as subItem}
                                                <li>
                                                    <a href={hrefFrom(subItem)} class="no-underline" style:color={textColor}>{subItem.label}</a>
                                                </li>
                                            {/each}
                                        </ul>
                                    </details>
                                </li>
                            {:else}
                                <li>
                                    <a href={hrefFrom(item)} class="no-underline" style:color={textColor}>{item.label}</a>
                                </li>
                            {/if}
                        {/each}
                        {/if}
                    </ul>
                </div>
                <a class="btn btn-ghost text-xl hover:bg-transparent" href="homepage">
                    <img src={image.src} class="me-3 h-6 sm:h-9 my-0" alt={image.alt} title={image.title} />
                </a>
            </div>
            {#if reverseOrder}
                <div class={`navbar-end ${desktopContainerClass(!showDesktopMenu)} grow`}>
                    <ul class="menu menu-horizontal px-1 items-center">
                                <li>
                                    <a href="homepage" class="btn btn-ghost hover:bg-transparent hover:text-red-500 px-1" style:color={homeIconColor}>
                                        <Home class="text-4xl -mt-2" />
                                    </a>
                                </li>
                        {#if !menuHidden}
                        {#each menu as item}
                            {#if item.items}
                                <li>
                                    <details>
                                        <summary style:color={textColor}>
                                            {item.label}
                                        </summary>
                                        <ul class="p-2 min-w-36" style:background-color=var(--theme-primary-color)>
                                            {#each item.items as subItem}
                                                <li>
                                                    <a href={hrefFrom(subItem)} class="no-underline" style:color={textColor}>{subItem.label}</a>
                                                </li>
                                            {/each}
                                        </ul>
                                    </details>
                                </li>
                            {:else if item.link}
                                <li>
                                    <a href={item.link} class="no-underline" style:color={textColor}>{item.label}</a>
                                </li>
                            {/if}
                        {/each}
                        {/if}
                    </ul>
                </div>
            {:else}
                <div class="navbar-end grow">
                    <div class="flex items-center ml-4 space-x-3">
                        {#if searchEnabled}
                            <label class="input input-ghost items-center gap-2 rounded-3xl input-sm hidden lg:flex" style:color={textColor}>
                                <Search />
                                <input type="text" class="grow" placeholder="Search" />
                            </label>
                        {/if}
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
    </div>
{/snippet}
</LayoutBlock>
