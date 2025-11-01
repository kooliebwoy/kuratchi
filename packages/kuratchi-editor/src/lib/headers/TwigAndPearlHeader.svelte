<script lang="ts">
    import { SearchIcons, EditorDrawer as Drawer } from '$lib/shell';
    import { LucideIconMap, type LucideIconKey } from '$lib/utils/lucide-icons';
    import { Home, Search, Menu, Pencil } from '@lucide/svelte';

    let id = crypto.randomUUID(); // Ensure each content has a unique ID

    // default image since we are only showing examples
    let image = {
        src: '/clutch-cms-logo.png',
        alt: 'Clutch CMS Logo',
        title: 'Clutch CMS Logo',
    }

    let component: HTMLElement;
    let componentEditor: HTMLElement;
    
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
        menu = []
    }: Props = $props();

    if ( menu.length === 0 ) {
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
</script>

<div class="editor-header-item group">
    <!-- Edit Popup -->
    <div class="editor-block-controls" bind:this={componentEditor} >
        <Drawer id={`componentDrawer${id}`}>
            {#snippet label()}
                <label for={`componentDrawer${id}`} class="btn btn-xs btn-naked">
                    <Pencil class="text-xl text-accent" />
                </label>
            {/snippet}
            {#snippet content()}
                <div class="card-body">
                    <div class="flex flex-wrap flex-col justify-between">
                        <div class="form-control">
                            <label class="label cursor-pointer">
                                <span class="label-text">Swap Icons and Nav Menu</span>
                                <input type="checkbox" class="checkbox checkbox-accent ml-4" bind:checked={reverseOrder} />
                            </label>
                        </div>

                        <div class="form-control">
                            <label class="label cursor-pointer">
                                <span class="label-text">Search Bar Enabled</span>
                                <input type="checkbox" class="checkbox checkbox-accent ml-4" bind:checked={searchEnabled} />
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
                                <span class="label-text">Home Icon Color</span>
                                <input type="color" class="input-color ml-4" bind:value={homeIconColor} />
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
                </div>
            {/snippet}
        </Drawer>
    </div>
    <div class="container mx-auto" id={id} bind:this={component} style:background-color={backgroundColor} data-type={type}>
        <div class="hidden" id="metadata-{id}">
            {JSON.stringify(content)}
        </div>
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
                <div class="navbar-start hidden xl:flex grow">
                    <ul class="menu menu-horizontal px-1 items-center">
                        <li>
                            <a href="homepage" class="btn btn-ghost hover:bg-transparent hover:text-red-500 px-1" style:color={homeIconColor}>
                                <Home class="text-4xl -mt-2" />
                            </a>
                        </li>
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
                                                    <a href={subItem.link} class="no-underline" style:color={textColor}>{subItem.label}</a>
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
                    </ul>
                </div>
            {/if}
            <div class="navbar-center grow-0">
                <div class="dropdown">
                    <div tabindex="0" role="button" class="btn btn-ghost xl:hidden px-0">
                        <Menu class="text-white text-xl" />
                    </div>
                    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
                    <ul tabindex="0" class="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow rounded-box w-52 space-y-3" style:background-color=var(--theme-primary-color)>
                        <!-- Default Home Link -->
                        <!-- <li>
                            <a href="/homepage" class={activeSelection('/')}>Home</a>
                        </li> -->
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
                                                    <a href="{subItem.link}" class="no-underline" style:color={textColor}>{subItem.label}</a>
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
                    </ul>
                </div>
                <a class="btn btn-ghost text-xl hover:bg-transparent" href="homepage">
                    <img src={image.src} class="me-3 h-6 sm:h-9 my-0" alt={image.alt} title={image.title} />
                </a>
            </div>
            {#if reverseOrder}
                <div class="navbar-end hidden xl:flex grow">
                    <ul class="menu menu-horizontal px-1 items-center">
                                <li>
                                    <a href="homepage" class="btn btn-ghost hover:bg-transparent hover:text-red-500 px-1" style:color={homeIconColor}>
                                        <Home class="text-4xl -mt-2" />
                                    </a>
                                </li>
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
                                                    <a href={subItem.link} class="no-underline" style:color={textColor}>{subItem.label}</a>
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
</div>


