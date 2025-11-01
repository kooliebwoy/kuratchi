<script lang="ts">
 import { SearchIcons, EditorDrawer as Drawer } from '$lib/shell';
 import { LucideIconMap, type LucideIconKey } from '$lib/utils/lucide-icons';

    let id = crypto.randomUUID(); // Ensure each content has a unique ID
  interface Props {
    reverseOrder?: boolean;
    textColor?: string;
    backgroundColor?: string;
    type?: string;
    icons?: any;
    copyrightText?: any;
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
    copyrightText = {
        href: 'https://kayde.io',
        by: 'Kayde',
    }
  }: Props = $props();

    let component: HTMLElement = $state();
    let componentEditor: HTMLElement = $state();

    let footerLogo = {
        href: 'https://kayde.io',
        src: '/kayde-logo.png',
        alt: 'Kayde Logo',
        name: 'Kayde',
    }
    
    let footerMenu = [
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

    let content = $derived({
        backgroundColor: backgroundColor,
        textColor: textColor,
        reverseOrder: reverseOrder,
        poweredBy: poweredBy,
        type: type,
        icons,
    })
</script>

<div class="editor-footer-item group">
    <!-- Edit Popup -->
    <div class="editor-block-controls" bind:this={componentEditor} >
        <Drawer id={`componentDrawer${id}`}>
            {#snippet label()}
          
                  <label for={`componentDrawer${id}`} class="btn btn-xs btn-naked">
                      <Icon icon="tabler:edit" class="text-xl text-accent" />
                  </label>
              
          {/snippet}
            {#snippet content()}
          
                  <div class="card-body">
                      <div class="flex flex-wrap flex-col justify-between">
                          <div class="form-control">
                              <label class="label cursor-pointer">
                                  <span class="label-text">Swap Logo and Footer Menu</span>
                                  <input type="checkbox" class="checkbox checkbox-accent ml-4" bind:checked={reverseOrder} />
                              </label>
                          </div>

                          <div class="form-control">
                              <label class="label cursor-pointer">
                                  <span class="label-text">Component Background Color</span>
                                  <input type="color" class="input-color ml-4" bind:value={backgroundColor} />
                              </label>
                          </div>
                          
                          <!-- <div class="form-control">
                              <label class="label cursor-pointer">
                                  <span class="label-text">Home Icon Color</span>
                                  <input type="color" class="input-color ml-4" bind:value={homeIconColor} />
                              </label>
                          </div> -->
                          
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
    <div class="container mx-auto flex flex-col" id={id} bind:this={component} data-type={type}>
        <div class="hidden" id="metadata-{id}">
            {JSON.stringify(content)}
        </div>
        <footer class="footer flex flex-wrap lg:flex-nowrap p-10 text-base-content mb-0 min-w-full rounded-3xl min-h-56" style:background-color={backgroundColor}>
            {#if reverseOrder}
                <div class="flex flex-row flex-wrap lg:flex-nowrap gap-6 grow justify-between">
                    {#each footerMenu as item}
                        <nav class="flex flex-col gap-2">
                            <h6 class="footer-title" style:color={textColor}>{item.label}</h6>
                            {#each item.items as subItem}
                                <a class="link link-hover text-sm font-light opacity-90" style:color={textColor} href={subItem.link}>{subItem.label}</a>
                            {/each}
                        </nav>
                    {/each}
                </div>
                <aside class="flex-1 place-items-end">
                    <img src={footerLogo.src} alt={footerLogo.alt} class="max-w-40 max-h-40" />
                </aside>
            {:else}
                <aside class="flex-1">
                    <img src={footerLogo.src} alt={footerLogo.alt} class="max-w-40 max-h-40" />
                </aside>
                <div class="flex flex-row flex-wrap lg:flex-nowrap gap-6 grow justify-between">
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
</div>
  
