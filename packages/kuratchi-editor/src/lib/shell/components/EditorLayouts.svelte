<script lang="ts">
    import { PanelsTopLeft } from "@lucide/svelte";

    interface Props {
        components?: any;
        addComponent: any;
    }

    let { components = [], addComponent }: Props = $props();

    let drawer: HTMLInputElement;

    const addLayoutComponent = (component: any) => {
        addComponent(component); // add the component to the editor, this is the parent function

        drawer.checked = false; // close the drawer
    }
</script>

<div class="drawer drawer-end">
    <input id="editor-layout-drawer" type="checkbox" class="drawer-toggle" bind:this={drawer} />
    <div class="drawer-content">
        <label for="editor-layout-drawer" class="drawer-button btn btn-sm btn-nuetral">
            <PanelsTopLeft class="text-2xl dark:text-accent text-success" />
            Layouts
        </label>
    </div> 
    <div class="drawer-side z-50">
        <label for="editor-layout-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
        <div class="p-4 w-96 min-h-full bg-base-100 text-base-content my-0">
            <section class="p-6">
                <h3>Select Layout</h3>

                {#each components as component}
                     {#if component.name == 'Layouts'}
                        <div class="flex flex-col gap-2 w-full ">
                            {#each component.items as item}
                                <div>
                                    <button class="btn btn-xs btn-naked" onclick={() => addLayoutComponent(item)}>
                                        <!-- <Icon icon={item.icon} class="text-lg" />
                                        <span>{item.name}</span> -->
                                        <img src={item.image} alt={item.name} class="max-w-80" />
                                    </button>
                                </div>
                            {/each}
                        </div>
                     {/if}
                {/each}
            </section>
        </div>
    </div>
</div>