<script lang="ts">
    import { Plus, Trash2 } from '@lucide/svelte';
    import { imageConfig } from '$lib/stores/imageConfig';

    interface ImageData {
        url: string;
        alt: string;
        caption?: string;
    }

    interface Props {
        selectedImage?: ImageData;
    }

    let { 
        selectedImage = $bindable({ url: '', alt: '' })
    }: Props = $props();

    let imageDialog: HTMLDialogElement;
    let imageUrl = '';
    let imageAlt = '';
    let isUploading = false;
    let activeTab = $state($imageConfig.uploadEndpoint ? 'upload' : 'url');

    async function handleImageUpload(event: Event) {
        if (!$imageConfig.uploadEndpoint) return;
        
        const input = event.target as HTMLInputElement;
        if (!input.files?.length) return;

        const file = input.files[0];
        isUploading = true;

        try {
            const formData = new FormData();
            formData.append('image', file);

            const response = await fetch($imageConfig.uploadEndpoint, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Upload failed');

            const result = await response.json();
            if (result.url) {
                selectedImage = {
                    url: result.url,
                    alt: imageAlt || file.name
                };
                imageDialog?.close();
            }
        } catch (error) {
            console.error('Upload failed:', error);
        } finally {
            isUploading = false;
        }
    }

    function handleUrlSubmit() {
        if (imageUrl) {
            selectedImage = {
                url: imageUrl,
                alt: imageAlt || 'Image'
            };
            imageUrl = '';
            imageAlt = '';
            imageDialog?.close();
        }
    }
</script>

<div class="flex flex-col gap-4">
    <button class="btn btn-neutral btn-sm" type="button" onclick={() => imageDialog.showModal()}>
        {selectedImage.url ? 'Change Image' : 'Select Image'}
        <Plus class="text-xl" />
    </button>

    <dialog bind:this={imageDialog} class="modal">
        <div class="modal-box w-11/12 max-w-2xl">
            <form method="dialog">
                <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
            </form>
    
            <div class="card-body p-0">
                <h3 class="text-lg font-bold mb-4">Add Image</h3>

                <!-- Tabs -->
                {#if $imageConfig.uploadEndpoint}
                    <div class="tabs tabs-boxed mb-4">
                        <button 
                            class="tab {activeTab === 'url' ? 'tab-active' : ''}" 
                            onclick={() => activeTab = 'url'}
                        >
                            Image URL
                        </button>
                        <button 
                            class="tab {activeTab === 'upload' ? 'tab-active' : ''}" 
                            onclick={() => activeTab = 'upload'}
                        >
                            Upload Image
                        </button>
                    </div>
                {/if}

                <div class="flex flex-col gap-4">
                    {#if activeTab === 'url'}
                        <!-- Direct URL Input -->
                        <div class="form-control w-full">
                            <label class="label">
                                <span class="label-text">Image URL</span>
                            </label>
                            <input 
                                type="url" 
                                class="input input-bordered w-full" 
                                placeholder="https://example.com/image.jpg" 
                                bind:value={imageUrl}
                            />
                        </div>
                        <div class="form-control w-full">
                            <label class="label">
                                <span class="label-text">Alt Text</span>
                            </label>
                            <input 
                                type="text" 
                                class="input input-bordered w-full" 
                                placeholder="Image description..." 
                                bind:value={imageAlt}
                            />
                        </div>
                        <div class="flex justify-end mt-2">
                            <button 
                                type="button" 
                                class="btn btn-primary" 
                                disabled={!imageUrl || !imageAlt}
                                onclick={handleUrlSubmit}
                            >
                                Add Image
                            </button>
                        </div>
                    {:else}
                        <!-- File Upload -->
                        <div class="form-control w-full">
                            <label class="label">
                                <span class="label-text">Upload Image</span>
                            </label>
                            <input 
                                type="file" 
                                class="file-input file-input-bordered w-full" 
                                accept="image/*"
                                onchange={handleImageUpload}
                                disabled={isUploading}
                            />
                        </div>
                        <div class="form-control w-full">
                            <label class="label">
                                <span class="label-text">Alt Text</span>
                            </label>
                            <input 
                                type="text" 
                                class="input input-bordered w-full" 
                                placeholder="Image description..." 
                                bind:value={imageAlt}
                            />
                        </div>
                        {#if isUploading}
                            <div class="flex justify-center">
                                <div class="loading loading-spinner loading-md"></div>
                            </div>
                        {/if}
                    {/if}
                </div>
            </div>
        </div>
    </dialog>

    <!-- Selected Image Preview -->
    {#if selectedImage.url}
        <div class="relative w-48 aspect-square">
            <img 
                src={selectedImage.url}
                alt={selectedImage.alt} 
                class="w-full h-full object-cover rounded-lg"
            />
            <button 
                type="button" 
                class="btn btn-circle btn-sm absolute -right-2 -top-2"
                onclick={() => selectedImage = { url: '', alt: '' }}
            >
                <Trash2 class="text-lg text-error" />
            </button>
        </div>
    {:else}
        <p class="text-sm opacity-70">No image selected</p>
    {/if}
</div>