<script lang="ts">
    import { Plus, Trash2 } from '@lucide/svelte';
    import { imageConfig } from '../stores/imageConfig.js';

    interface ImageData {
        url?: string;
        src?: string;  // Support legacy 'src' property
        alt?: string;
        key?: string;  // Support legacy 'key' property
        caption?: string;
    }

    interface Props {
        selectedImage?: ImageData;
        selectedImages?: ImageData[];
        mode?: 'single' | 'multiple';
    }

    let { 
        selectedImage = $bindable({ url: '', alt: '' }),
        selectedImages = $bindable([]),
        mode = 'single'
    }: Props = $props();

    let imageDialog: HTMLDialogElement;
    let imageUrl = $state('');
    let imageAlt = $state('');
    let isUploading = $state(false);
    let uploadError = $state('');
    let activeTab = $state($imageConfig.uploadHandler || $imageConfig.uploadEndpoint ? 'upload' : 'url');

    async function handleImageUpload(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files?.length) return;

        const file = input.files[0];
        isUploading = true;
        uploadError = '';

        try {
            // Use new uploadHandler if available
            if ($imageConfig.uploadHandler) {
                console.log('[ImagePicker] Uploading file:', file.name, file.type, file.size);
                const result = await $imageConfig.uploadHandler(file, mode === 'multiple' ? 'images' : 'logos');
                console.log('[ImagePicker] Upload result:', result);
                
                if (result?.url) {
                    const newImage = {
                        url: result.url,
                        alt: imageAlt || file.name,
                        key: result.key
                    };
                    
                    console.log('[ImagePicker] Setting new image:', { mode, newImage, currentSelectedImage: selectedImage });
                    
                    if (mode === 'multiple') {
                        selectedImages = [...selectedImages, newImage];
                    } else {
                        selectedImage = newImage;
                    }
                    
                    console.log('[ImagePicker] After setting:', { selectedImage, selectedImages });
                    
                    imageUrl = '';
                    imageAlt = '';
                    imageDialog?.close();
                } else {
                    throw new Error('Upload failed: No URL returned');
                }
            }
            // Fall back to uploadEndpoint for backwards compatibility
            else if ($imageConfig.uploadEndpoint) {
                const formData = new FormData();
                formData.append('image', file);

                const response = await fetch($imageConfig.uploadEndpoint, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) throw new Error('Upload failed');

                const result = await response.json();
                if (result.url) {
                    const newImage = {
                        url: result.url,
                        alt: imageAlt || file.name
                    };
                    
                    if (mode === 'multiple') {
                        selectedImages = [...selectedImages, newImage];
                    } else {
                        selectedImage = newImage;
                    }
                    
                    imageUrl = '';
                    imageAlt = '';
                    imageDialog?.close();
                }
            }
        } catch (error) {
            console.error('[ImagePicker] Upload failed:', error);
            uploadError = error instanceof Error ? error.message : 'Upload failed';
        } finally {
            isUploading = false;
            // Reset the file input to allow re-uploading the same file
            input.value = '';
        }
    }

    function handleUrlSubmit() {
        if (imageUrl) {
            const newImage = {
                url: imageUrl,
                alt: imageAlt || 'Image'
            };
            
            console.log('[ImagePicker] URL submit:', { mode, newImage, currentSelectedImage: selectedImage });
            
            if (mode === 'multiple') {
                selectedImages = [...selectedImages, newImage];
            } else {
                selectedImage = newImage;
            }
            
            console.log('[ImagePicker] After URL submit:', { selectedImage, selectedImages });
            
            imageUrl = '';
            imageAlt = '';
            imageDialog?.close();
        }
    }

    function removeImage(index?: number) {
        if (mode === 'multiple' && index !== undefined) {
            selectedImages = selectedImages.filter((_, i) => i !== index);
        } else {
            selectedImage = { url: '', alt: '' };
        }
    }
</script>

<div class="flex flex-col gap-4">
    <button class="btn btn-neutral btn-sm" type="button" onclick={() => imageDialog.showModal()}>
        {mode === 'multiple' 
            ? (selectedImages.length > 0 ? `Change Images (${selectedImages.length})` : 'Select Images')
            : (selectedImage.url ? 'Change Image' : 'Select Image')
        }
        <Plus class="text-xl" />
    </button>

    <dialog bind:this={imageDialog} class="modal">
        <div class="modal-box w-11/12 max-w-2xl">
            <form method="dialog">
                <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
            </form>
    
            <div class="card-body p-0">
                <h3 class="text-lg font-bold mb-4">
                    {mode === 'multiple' ? 'Add Images' : 'Add Image'}
                </h3>

                <!-- Tabs -->
                {#if $imageConfig.uploadHandler || $imageConfig.uploadEndpoint}
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
                            <div class="label">
                                <span class="label-text">Image URL</span>
                            </div>
                            <input 
                                type="url" 
                                class="input input-bordered w-full" 
                                placeholder="https://example.com/image.jpg" 
                                bind:value={imageUrl}
                            />
                        </div>
                        <div class="form-control w-full">
                            <div class="label">
                                <span class="label-text">Alt Text</span>
                            </div>
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
                                {mode === 'multiple' ? 'Add Image' : 'Set Image'}
                            </button>
                        </div>
                    {:else}
                        <!-- File Upload -->
                        <div class="form-control w-full">
                            <div class="label">
                                <span class="label-text">Upload Image</span>
                            </div>
                            <input 
                                type="file" 
                                class="file-input file-input-bordered w-full" 
                                accept="image/*"
                                onchange={handleImageUpload}
                                disabled={isUploading}
                            />
                        </div>
                        <div class="form-control w-full">
                            <div class="label">
                                <span class="label-text">Alt Text</span>
                            </div>
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
                        {#if uploadError}
                            <div class="alert alert-error">
                                <span class="text-sm">{uploadError}</span>
                            </div>
                        {/if}
                    {/if}
                </div>
            </div>
        </div>
    </dialog>

    <!-- Selected Image(s) Preview -->
    {#if mode === 'multiple'}
        {#if selectedImages.length > 0}
            <div class="flex flex-wrap gap-2">
                {#each selectedImages as image, index}
                    {@const imageUrl = image.url || image.src || ''}
                    {#if imageUrl}
                        <div class="relative w-32 aspect-square">
                            <img 
                                src={imageUrl}
                                alt={image.alt || ''} 
                                class="w-full h-full object-cover rounded-lg"
                            />
                            <button 
                                type="button" 
                                class="btn btn-circle btn-sm absolute -right-2 -top-2"
                                onclick={() => removeImage(index)}
                            >
                                <Trash2 class="text-lg text-error" />
                            </button>
                        </div>
                    {/if}
                {/each}
            </div>
        {:else}
            <p class="text-sm opacity-70">No images selected</p>
        {/if}
    {:else}
        {@const imageUrl = selectedImage.url || selectedImage.src || ''}
        {#if imageUrl}
            <div class="relative w-48 aspect-square">
                <img 
                    src={imageUrl}
                    alt={selectedImage.alt || ''} 
                    class="w-full h-full object-cover rounded-lg"
                />
                <button 
                    type="button" 
                    class="btn btn-circle btn-sm absolute -right-2 -top-2"
                    onclick={() => removeImage()}
                >
                    <Trash2 class="text-lg text-error" />
                </button>
            </div>
        {:else}
            <p class="text-sm opacity-70">No image selected</p>
        {/if}
    {/if}
</div>
