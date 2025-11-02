<script lang="ts">
    import { SearchIcons, LayoutBlock } from "../shell/index.js";
    import { LucideIconMap, type LucideIconKey } from "../utils/lucide-icons.js";

    interface Props {
        id?: string;
        type?: string;
        metadata?: any;
        icons?: any;
    }

    let {
        id = crypto.randomUUID(),
        type = 'icon-bar',
        metadata = {
            backgroundColor: '#575757',
            iconColors: '#212121',
            roundedBorder: 'rounded-3xl'
        },
        icons = [
            { icon: 'truck', link: '#', name: "Free Shipping & Returns", enabled: true },
            { icon: 'badgeDollarSign', link: '#', name: "100% Money Back Guarantee", enabled: true },
            { icon: 'home', link: '#', name: "High Quality Material", enabled: true },
            { icon: 'circleDollarSign', link: '#', name: "Safe and Secure Checkout", enabled: true },
        ] as { icon: LucideIconKey; link: string; name: string; enabled: boolean }[]
    }: Props = $props();

    let iconsState = $state(icons);

    let backgroundColor = $state(metadata.backgroundColor);
    let iconColors = $state(metadata.iconColors);
    let roundedBorder = $state(metadata.roundedBorder);

    let content = $derived({
        id,
        type,
        icons: iconsState,
        metadata: {
            backgroundColor,
            iconColors,
            roundedBorder
        }
    })

    let roundedBorderOptions = $state([
        { value: 'rounded-none', name: 'None' },
        { value: 'rounded-sm', name: 'Small' },
        { value: 'rounded-md', name: 'Medium' },
        { value: 'rounded-lg', name: 'Large' },
        { value: 'rounded-xl', name: 'Extra Large' },
        { value: 'rounded-2xl', name: 'Extra Extra Large' },
        { value: 'rounded-3xl', name: 'Extra Extra Extra Large' },
        { value: 'rounded-full', name: 'Full' }
    ]);
</script>

<LayoutBlock {id} {type}>
    {#snippet drawerContent()}
        <div class="space-y-6">
            <div class="form-control gap-4">
                <fieldset class="fieldset">
                    <legend class="fieldset-legend">Component Background Color</legend>
                    <input type="color" class="input input-bordered h-12" bind:value={backgroundColor} />
                </fieldset>
            
                <fieldset class="fieldset">
                    <legend class="fieldset-legend">Icon & Text Color</legend>
                    <input type="color" class="input input-bordered h-12" bind:value={iconColors} />
                </fieldset>

                <fieldset class="fieldset">
                    <legend class="fieldset-legend">Border Radius</legend>
                    <select class="select" bind:value={roundedBorder}>
                        <option disabled>Select border radius</option>
                        {#each roundedBorderOptions as option}
                            <option value={option.value}>{option.name}</option>
                        {/each}
                    </select>
                </fieldset>
            </div>

            <div class="divider"></div>

            <div class="space-y-4">
                <SearchIcons bind:selectedIcons={iconsState} />

                <div class="grid grid-cols-1 gap-4">
                    {#each iconsState as icon, i}
                        {@const Comp = LucideIconMap[icon.icon as LucideIconKey]}
                        <fieldset class="fieldset">
                            <legend class="fieldset-legend">
                                <Comp class="text-2xl" />
                            </legend>
                            <input 
                                type="text" 
                                class="input input-bordered w-full" 
                                bind:value={iconsState[i].name}
                            />
                        </fieldset>
                    {/each}
                </div>
            </div>
        </div>
    {/snippet}

    {#snippet metadata()}
        {JSON.stringify(content)}
    {/snippet}

    {#snippet children()}
        <div class="flex place-content-center px-0 md:px-12 my-4 {roundedBorder}" style:background-color={backgroundColor}>
            <div class="flex flex-wrap md:flex-nowrap bg-twig-light justify-evenly gap-y-6 w-full flex-col md:flex-row">
                {#each iconsState as { icon, name }}
                    {@const Comp = LucideIconMap[icon as LucideIconKey]}
                    <div class="space-y-2 text-center" style:color={iconColors}>
                        <Comp class="text-6xl inline-flex" />
                        <h6>{name}</h6>
                    </div>
                {/each}
            </div>
        </div>
    {/snippet}
</LayoutBlock>
