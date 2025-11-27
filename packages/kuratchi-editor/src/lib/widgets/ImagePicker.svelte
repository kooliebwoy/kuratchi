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

    let imageDialog: HTMLDialogElement; // @ts-ignore - DOM ref, not reactive state
    let imageUrl = $state('');
    let imageAlt = $state('');
    let isUploading = $state(false);
    let uploadError = $state('');
    let activeTab = $state($imageConfig.uploadHandler || $imageConfig.uploadEndpoint ? 'upload' : 'url');
    let isDialogOpen = $state(false);

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

<div class="krt-imagePicker">
    <button class="krt-imagePicker__button" type="button" onclick={() => {
        isDialogOpen = true;
        imageDialog?.showModal();
    }}>
        <Plus class="krt-imagePicker__buttonIcon" />
        <span>
            {mode === 'multiple' 
                ? (selectedImages.length > 0 ? `Change Images (${selectedImages.length})` : 'Select Images')
                : (selectedImage.url ? 'Change Image' : 'Select Image')
            }
        </span>
    </button>

    {#if isDialogOpen}
        <dialog bind:this={imageDialog} class="krt-imagePicker__dialog" onclose={() => isDialogOpen = false}>
            <div class="krt-imagePicker-content">
                <div class="krt-imagePicker-header">
                    <h3>{mode === 'multiple' ? 'Add Images' : 'Add Image'}</h3>
                    <button 
                        type="button" 
                        class="krt-imagePicker-close" 
                        onclick={() => imageDialog?.close()}
                        aria-label="Close dialog"
                    >
                        ✕
                    </button>
                </div>

                <!-- Tabs -->
                {#if $imageConfig.uploadHandler || $imageConfig.uploadEndpoint}
                    <div class="krt-imagePicker-tabs">
                        <button 
                            class="krt-imagePicker-tab {activeTab === 'url' ? 'krt-imagePicker-tab--active' : ''}" 
                            onclick={() => activeTab = 'url'}
                        >
                            Image URL
                        </button>
                        <button 
                            class="krt-imagePicker-tab {activeTab === 'upload' ? 'krt-imagePicker-tab--active' : ''}" 
                            onclick={() => activeTab = 'upload'}
                        >
                            Upload Image
                        </button>
                    </div>
                {/if}

                <div class="krt-imagePicker-body">
                    {#if activeTab === 'url'}
                        <!-- Direct URL Input -->
                        <div class="krt-imagePicker-field">
                            <label for="image-url">Image URL</label>
                            <input 
                                id="image-url"
                                type="url" 
                                placeholder="https://example.com/image.jpg" 
                                bind:value={imageUrl}
                            />
                        </div>
                        <div class="krt-imagePicker-field">
                            <label for="image-alt">Alt Text</label>
                            <input 
                                id="image-alt"
                                type="text" 
                                placeholder="Image description..." 
                                bind:value={imageAlt}
                            />
                        </div>
                        <div class="krt-imagePicker-actions">
                            <button 
                                type="button" 
                                class="krt-imagePicker-submit" 
                                disabled={!imageUrl || !imageAlt}
                                onclick={handleUrlSubmit}
                            >
                                {mode === 'multiple' ? 'Add Image' : 'Set Image'}
                            </button>
                        </div>
                    {:else}
                        <!-- File Upload -->
                        <div class="krt-imagePicker-field">
                            <label for="image-file">Upload Image</label>
                            <input 
                                id="image-file"
                                type="file" 
                                accept="image/*"
                                onchange={handleImageUpload}
                                disabled={isUploading}
                            />
                        </div>
                        <div class="krt-imagePicker-field">
                            <label for="image-alt-upload">Alt Text</label>
                            <input 
                                id="image-alt-upload"
                                type="text" 
                                placeholder="Image description..." 
                                bind:value={imageAlt}
                            />
                        </div>
                        {#if isUploading}
                            <div class="krt-imagePicker-loading">
                                <div class="krt-imagePicker-spinner"></div>
                            </div>
                        {/if}
                        {#if uploadError}
                            <div class="krt-imagePicker-error">
                                {uploadError}
                            </div>
                        {/if}
                    {/if}
                </div>
            </div>
        </dialog>
    {/if}

    <!-- Selected Image(s) Preview -->
    {#if mode === 'multiple'}
        {#if selectedImages.length > 0}
            <div class="krt-imagePicker__preview">
                {#each selectedImages as image, index}
                    {@const imageUrl = image.url || image.src || ''}
                    {#if imageUrl}
                        <div class="krt-imagePicker__previewItem">
                            <img 
                                src={imageUrl}
                                alt={image.alt || ''} 
                                class="krt-imagePicker__previewImage"
                            />
                            <button 
                                type="button" 
                                class="krt-imagePicker__removeButton"
                                onclick={() => removeImage(index)}
                                title="Remove image"
                            >
                                <Trash2 />
                            </button>
                        </div>
                    {/if}
                {/each}
            </div>
        {:else}
            <p class="krt-imagePicker__empty">No images selected</p>
        {/if}
    {:else}
        {@const imageUrl = selectedImage.url || selectedImage.src || ''}
        {#if imageUrl}
            <div class="krt-imagePicker__previewItem krt-imagePicker__previewItem--single">
                <img 
                    src={imageUrl}
                    alt={selectedImage.alt || ''} 
                    class="krt-imagePicker__previewImage"
                />
                <button 
                    type="button" 
                    class="krt-imagePicker__removeButton"
                    onclick={() => removeImage()}
                    title="Remove image"
                >
                    <Trash2 />
                </button>
            </div>
        {:else}
            <p class="krt-imagePicker__empty">No image selected</p>
        {/if}
    {/if}
</div>

<style>
    .krt-imagePicker-dialog {
        border: none;
        border-radius: 1rem;
        padding: 0;
        max-width: 600px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(4px);
    }

    .krt-imagePicker-dialog::backdrop {
        background: rgba(0, 0, 0, 0.4);
    }

    .krt-imagePicker-content {
        display: flex;
        flex-direction: column;
        gap: 0;
        padding: 0;
        background: var(--krt-color-surface, #fff);
        border-radius: 1rem;
        overflow: hidden;
    }

    .krt-imagePicker-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.5rem;
        border-bottom: 1px solid var(--krt-color-border-subtle, #e2e8f0);
        background: var(--krt-color-surface, #fff);
    }

    .krt-imagePicker-header h3 {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--krt-color-text, #0f172a);
    }

    .krt-imagePicker-close {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        border: none;
        background: transparent;
        color: var(--krt-color-text-secondary, #64748b);
        cursor: pointer;
        border-radius: 0.5rem;
        font-size: 1.25rem;
        transition: all 0.2s ease;
    }

    .krt-imagePicker-close:hover {
        background: var(--krt-color-bg-hover, #f1f5f9);
        color: var(--krt-color-text, #0f172a);
    }

    .krt-imagePicker-tabs {
        display: flex;
        gap: 0;
        padding: 0 1.5rem;
        border-bottom: 1px solid var(--krt-color-border-subtle, #e2e8f0);
        background: var(--krt-color-surface, #fff);
    }

    .krt-imagePicker-tab {
        flex: 1;
        padding: 1rem;
        border: none;
        background: transparent;
        color: var(--krt-color-text-secondary, #64748b);
        cursor: pointer;
        font-weight: 500;
        font-size: 0.95rem;
        border-bottom: 2px solid transparent;
        transition: all 0.2s ease;
    }

    .krt-imagePicker-tab:hover {
        color: var(--krt-color-text, #0f172a);
    }

    .krt-imagePicker-tab--active {
        color: var(--krt-color-primary, #3b82f6);
        border-bottom-color: var(--krt-color-primary, #3b82f6);
    }

    .krt-imagePicker-body {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 1.5rem;
    }

    .krt-imagePicker-field {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .krt-imagePicker-field label {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--krt-color-text, #0f172a);
    }

    .krt-imagePicker-field input[type='url'],
    .krt-imagePicker-field input[type='text'],
    .krt-imagePicker-field input[type='file'] {
        padding: 0.75rem;
        border: 1px solid var(--krt-color-border-subtle, #e2e8f0);
        border-radius: 0.5rem;
        font-size: 0.95rem;
        font-family: inherit;
        background: var(--krt-color-surface, #fff);
        color: var(--krt-color-text, #0f172a);
        transition: all 0.2s ease;
    }

    .krt-imagePicker-field input[type='url']:focus,
    .krt-imagePicker-field input[type='text']:focus,
    .krt-imagePicker-field input[type='file']:focus {
        outline: none;
        border-color: var(--krt-color-primary, #3b82f6);
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .krt-imagePicker-field input[type='file'] {
        padding: 0.5rem;
    }

    .krt-imagePicker-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        margin-top: 0.5rem;
    }

    .krt-imagePicker-submit {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 0.5rem;
        background: var(--krt-color-primary, #3b82f6);
        color: #fff;
        font-weight: 500;
        font-size: 0.95rem;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .krt-imagePicker-submit:hover:not(:disabled) {
        background: var(--krt-color-primary-dark, #2563eb);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    }

    .krt-imagePicker-submit:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .krt-imagePicker-loading {
        display: flex;
        justify-content: center;
        padding: 2rem;
    }

    .krt-imagePicker-spinner {
        width: 2rem;
        height: 2rem;
        border: 3px solid var(--krt-color-border-subtle, #e2e8f0);
        border-top-color: var(--krt-color-primary, #3b82f6);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    .krt-imagePicker-error {
        padding: 1rem;
        border-radius: 0.5rem;
        background: rgba(239, 68, 68, 0.1);
        color: #dc2626;
        font-size: 0.875rem;
        border: 1px solid rgba(239, 68, 68, 0.2);
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .krt-imagePicker {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        width: 100%;
    }

    .krt-imagePicker__button {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1.25rem;
        border: 1px solid rgba(0, 0, 0, 0.15);
        border-radius: 0.5rem;
        background: #ffffff;
        color: rgba(0, 0, 0, 0.8);
        font-weight: 500;
        font-size: 0.95rem;
        cursor: pointer;
        transition: all 200ms ease;
    }

    .krt-imagePicker__button:hover {
        border-color: rgba(59, 130, 246, 0.5);
        background: rgba(59, 130, 246, 0.05);
        color: rgba(59, 130, 246, 0.9);
    }

    .krt-imagePicker__buttonIcon {
        width: 1.125rem;
        height: 1.125rem;
    }

    .krt-imagePicker__dialog {
        border: none;
        border-radius: 1rem;
        padding: 0;
        max-width: 600px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(4px);
    }

    .krt-imagePicker__dialog::backdrop {
        background: rgba(0, 0, 0, 0.4);
    }

    .krt-imagePicker__preview {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
        gap: 0.75rem;
    }

    .krt-imagePicker__previewItem {
        position: relative;
        aspect-ratio: 1;
        border-radius: 0.5rem;
        overflow: hidden;
        border: 1px solid rgba(0, 0, 0, 0.1);
        background: rgba(0, 0, 0, 0.02);
        transition: all 200ms ease;
    }

    .krt-imagePicker__previewItem:hover {
        border-color: rgba(59, 130, 246, 0.3);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .krt-imagePicker__previewItem--single {
        grid-column: 1 / -1;
        max-width: 15rem;
        aspect-ratio: auto;
        height: 12rem;
    }

    .krt-imagePicker__previewImage {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .krt-imagePicker__removeButton {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        width: 2rem;
        height: 2rem;
        border: none;
        border-radius: 0.375rem;
        background: rgba(239, 68, 68, 0.9);
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: all 150ms ease;
    }

    .krt-imagePicker__previewItem:hover .krt-imagePicker__removeButton {
        opacity: 1;
    }

    .krt-imagePicker__removeButton:hover {
        background: rgba(220, 38, 38, 1);
        transform: scale(1.1);
    }

    .krt-imagePicker__removeButton :global(svg) {
        width: 1rem;
        height: 1rem;
    }

    .krt-imagePicker__empty {
        padding: 1rem;
        text-align: center;
        color: rgba(0, 0, 0, 0.4);
        font-size: 0.9rem;
        font-style: italic;
    }
</style>
