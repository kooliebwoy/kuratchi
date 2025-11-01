<script lang="ts">
    import { deserialize } from "$app/forms";
    import { Plus, Save, Trash2 } from "@lucide/svelte";
    import type { ActionResult } from "@sveltejs/kit";

    interface Props {
        selectedImages?: any[];
    }

    let { selectedImages = $bindable([]) }: Props = $props();

    let showLoading = false;

    const getImages = async () => {
        showLoading = true;
        
        // we have a form endpoint that returns a list of images
        const response = await fetch('/website/media?/getAllMedia', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        });

        const result: ActionResult = deserialize(await response.text());

        if ( result.type === 'success' ) {
            return result?.data?.media;
        }
    }

    let imageDialog: HTMLDialogElement | undefined = $state();
</script>

<h4 class="card-title">Select Images</h4>

{#await getImages() then mediaImages}
    {#if mediaImages.length === 0}
        <div>
            <h4 class="text-error/50">No Media Items</h4>
        </div>
    {:else}
        <div class="flex flex-wrap gap-4">

            <button class="btn btn-neutral btn-sm" type="button" onclick={() => imageDialog?.showModal()}>
                Select Images
                <Plus class="text-xl" />
            </button>

            <dialog bind:this={imageDialog} class="modal">
                <div class="modal-box w-5/6 max-w-7xl">
                    <form method="dialog">
                        <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
                    </form>
            
                    <div class="card-body">
                        <h3 class="text-lg font-bold">Media Gallery</h3>

                        <div class="flex flex-wrap gap-4">
                            {#each mediaImages as imageItem}
                                <div class="relative">
                                    <img src='/api/bucket/{imageItem.key}' alt="Media Item" class="w-full h-48 object-cover rounded-lg" />
                                    <button type="button" class="btn btn-sm btn-success btn-circle absolute right-2 top-2" onclick={() => {
                                        if ( !selectedImages.find(t => t.src === imageItem.src) ) {
                                            selectedImages = [...selectedImages, imageItem];
                                        }
                                    }}>
                                        <Plus class="text-xl" />
                                    </button>
                                </div>
                            {/each}
                        </div>
                        
                        <div class="modal-action justify-end">
                            <!-- <form method="dialog">
                                <button class="btn btn-sm btn-error">
                                    <Icon icon="material-symbols:cancel" class="text-xl" />
                                    Cancel
                                </button>
                            </form> -->
                            <button type="button" class="btn btn-sm btn-neutral" onclick={() => imageDialog?.close()}>
                                All Done
                                <Save class="text-xl text-accent" />
                            </button>
                        </div>
                    </div>
                </div>
            </dialog>
        </div>
    {/if}
{/await}
            

<div class="flex flex-wrap gap-2 mt-4 bg-base-300">
    {#if selectedImages}
        {#each selectedImages as image}
            <div class="flex flex-col gap-3 w-40 p-2 rounded-lg">
                <div class="flex justify-end">
                    <button type="button" onclick={() => { selectedImages = selectedImages.filter(t => t !== image) }}>
                        <Trash2 class="text-lg text-error" />
                    </button>
                </div>
                <img src='/api/bucket/{image.key}' alt={image.alt} class="w-32 h-32 object-cover rounded-lg" />
            </div>
        {:else}
            <p class="m-0">No Images Selected</p>
        {/each}
    {/if}
</div>