<script lang="ts">
    import { Search, X } from "@lucide/svelte";
    import { LucideIconMap, lucideIconKeys, type LucideIconKey } from "$lib/utils/lucide-icons";

    interface Props {
        selectedIcons?: { icon: LucideIconKey; name?: string }[];
    }

    let { selectedIcons = $bindable([]) }: Props = $props();

    let showLoading = $state(false);
    let searchValue = $state('');

    let icons = $state<LucideIconKey[]>([]);
    

    let searchDetails: HTMLDetailsElement | undefined = $state();

    const search = async () => {
        showLoading = true;
        const q = searchValue.trim().toLowerCase();
        icons = q ? (lucideIconKeys.filter(k => k.includes(q))) : lucideIconKeys;
        showLoading = false;
        searchDetails?.setAttribute('open', '');
    }
</script>

<h3 class="font-bold text-lg">Search Icons</h3>

<details class="dropdown dropdown-bottom w-full min-w-full" bind:this={searchDetails}>
    <summary class="mt-5 w-full min-w-full">
        <label class="input input-bordered flex items-center gap-2">
            <input type="text" tabindex="-1" role="button" class="grow" placeholder="Search Icons" bind:value={searchValue} required />
            <button onclick={search} type="button">
                <Search class="text-lg" />
            </button>
        </label>
    </summary>
    {#if icons.length > 0}
        <div class="p-2 shadow menu dropdown-content z-[1] bg-base-300 rounded-box min-w-full w-full flex flex-row flex-wrap gap-4 mt-4">
            {#if showLoading}
                <div class="flex justify-center absolute z-50">
                    <div class="place-self-center">
                        <h1 class="font-bold text-center">Searching...</h1>
                        <progress class="progress w-56"></progress>
                    </div>
                </div>
            {:else}
                {#each icons as icon}
                    {@const Comp = LucideIconMap[icon]}
                    <div>
                        <button type="button" onclick={() => {
                            if ( 
                                !selectedIcons.find(t => t.icon === icon)
                            ) {
                                selectedIcons = [...selectedIcons, {icon, name: ''}]
                            }
                            searchDetails?.removeAttribute('open');
                        }} class="card-title text-base">
                            <Comp class="text-sm" />    
                        </button>
                    </div>
                {:else}
                    <div>
                        <p class="text-center text-base">No Icons Found</p>
                    </div>
                {/each}
            {/if}
        </div>
        <!-- <ul class="p-2 shadow menu dropdown-content z-[1] bg-base-200 rounded-box min-w-full w-full flex flex-wrap">
            {#if showLoading}
                <Loading />
            {:else}
                {#each icons as icon}
                    <li>
                        <button type="button" onclick={() => {
                            if ( 
                                !selectedIcons.find(t => t === icon)
                            ) {
                                selectedIcons = [...selectedIcons, icon]
                            }
                            searchDetails.removeAttribute('open');
                        }} class="card-title text-base">
                        <Icon icon={icon} class="text-sm" />    
                    </button>
                    </li>
                {:else}
                    <li>
                        <p class="text-center text-base">No Icons Found</p>
                    </li>
                {/each}
            {/if}
        </ul> -->
    {/if}
</details>

<div class="flex flex-wrap gap-2 mt-4 bg-base-300">
    {#if selectedIcons}
        {#each selectedIcons as {icon, name}}
            {@const Comp = LucideIconMap[icon]}
            <div class="flex flex-col gap-3 w-20 p-4 rounded-lg">
                <div class="flex justify-end">
                    <button onclick={() => { selectedIcons = selectedIcons.filter(t => t.icon !== icon) }}>
                        <X class="text-lg text-error" />
                    </button>
                </div>
                <Comp class="text-lg btn-sm btn-circle btn-neutral text-black" />
            </div>
        {:else}
            <p class="m-0">No Icons Selected</p>
        {/each}
    {/if}
</div>