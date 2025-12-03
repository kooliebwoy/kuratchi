<script lang="ts">
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
    import { deserialize } from "$app/forms";
    import { Upload } from "@lucide/svelte";
    import type { ActionResult } from "@sveltejs/kit";
    import { DragHandle, BLOCK_SPACING_VALUES, type BlockSpacing } from "../utils/index.js";
    import { deleteElement } from "../utils/editor.svelte.js";
    import { onMount } from "svelte";
    import { imageConfig } from "../stores/imageConfig.js";

    interface Props {
        id?: string;
        image?: Record<string, unknown>;
        type?: string;
        metadata?: {
            spacingTop?: BlockSpacing;
            spacingBottom?: BlockSpacing;
        };
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        image = {},
        type = 'image',
        metadata = {
            spacingTop: 'normal',
            spacingBottom: 'normal'
        },
        editable = true
    }: Props = $props();

    let component: HTMLElement | undefined;
    const componentRef = {};
    let componentEditor = $state<HTMLElement>();
    let spacingTop = $state<BlockSpacing>(metadata?.spacingTop ?? 'normal');
    let spacingBottom = $state<BlockSpacing>(metadata?.spacingBottom ?? 'normal');

    // Computed spacing styles
    let spacingStyle = $derived(
        `margin-top: ${BLOCK_SPACING_VALUES[spacingTop]}; margin-bottom: ${BLOCK_SPACING_VALUES[spacingBottom]};`
    );

    let profilePhotoFile: HTMLInputElement | null = $state(null);
    let photoError: boolean = $state(false);
    let photoMessage: string = $state('');
    let uploadedImage: Object = $state(image);

    const deleteImage = async () => {
        // Use custom delete handler if provided
        if ($imageConfig.deleteHandler && uploadedImage.id) {
            try {
                await $imageConfig.deleteHandler(uploadedImage.id);
                uploadedImage = {};
                return;
            } catch (err) {
                console.error('Delete failed:', err);
                return;
            }
        }

        // Fallback to default endpoint
        const formData = new FormData();
        formData.append('id', uploadedImage.id);

        const response = await fetch('/website/media?/delete', {
            method: 'POST',
            body: formData
        });

        const result: ActionResult = deserialize(await response.text());

        if ( result.type === 'success' ) {
            uploadedImage = {};
        }
    }

    const uploadImage = async () => {
        const file = profilePhotoFile.files[0];

        // Use custom upload handler if provided
        if ($imageConfig.uploadHandler) {
            try {
                const result = await $imageConfig.uploadHandler(file, 'images');
                return {
                    id: result.key || result.filename,
                    url: result.url,
                    alt: file.name,
                    ...result
                };
            } catch (err) {
                console.error('Upload failed:', err);
                throw err;
            }
        }

        // Fallback to default endpoint
        const formData = new FormData();
        formData.append('file', file);
        formData.append('alt', file.name);
        formData.append('fileName', file.name);

        const response = await fetch('/website/media?/upload', {
            method: 'POST',
            body: formData
        });

        const result: ActionResult = deserialize(await response.text());

        if ( result.type === 'success' ) {
            return result?.data?.mediaItem;
        }
    }

    const processUpload = async () => {
		const file = profilePhotoFile.files[0];

		if ( file.size / (1024 * 1024) > 10 ) {
			photoError = true;
			photoMessage = 'File size is too large. Please upload a file less than 10MB';
			profilePhotoFile.value = ''; // reset the file input
			return;
		}

		photoError = false;
		photoMessage = '';

        uploadedImage = await uploadImage();
	}	

    // extract body from the content and the card title
    let content = $derived({
        id,
        type,
        image: uploadedImage,
        metadata: {
            spacingTop,
            spacingBottom
        }
    })

    let mounted = $state(false);
    onMount(() => {
        if (!editable) return;
        mounted = true;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
        return () => blockRegistry.unregister(componentRef);
    });
</script>

{#if editable}
    <div class="editor-item group relative krt-image-block" bind:this={component} style={spacingStyle}>
        {#if mounted}
            <DragHandle />
        {/if}

        <div data-type={type} id={id} class="krt-image-body">
            <!-- JSON Data for this component -->
            <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>

            {#if !uploadedImage?.id}
                <div class="krt-image-dropzone">
                    <label for="dropzone-file" class="krt-image-dropzone-label">
                        <div class="krt-image-dropzone-inner">
                            <Upload class="krt-image-dropzone-icon" />
                            <p class="krt-image-dropzone-title"><span>Click to upload</span></p>
                            <p class="krt-image-dropzone-subtitle">PNG or JPG (MAX. 10MB)</p>
                        </div>
                        <input
                            id="dropzone-file"
                            type="file"
                            name="image"
                            class="krt-image-input"
                            bind:this={profilePhotoFile}
                            onchange={() => processUpload()}
                        />
                    </label>
                </div>
                {#if photoError}
                    <span class="krt-image-error">{photoMessage}</span>
                {/if}
            {/if}
        
            <div class="krt-image-preview-wrapper">
                {#if !photoError && uploadedImage?.id}
                    <img class="krt-image-preview" src={uploadedImage?.url ?? uploadedImage?.src ?? ''} alt={uploadedImage?.alt ?? 'Uploaded image'} />
                {/if}
            </div>
        </div>
    </div>
{:else}
    {#if uploadedImage?.id || uploadedImage?.src || uploadedImage?.url}
        <figure data-type={type} id={id} class="krt-image-figure">
            <img
                src={uploadedImage?.url ?? uploadedImage?.src ?? ''}
                alt={uploadedImage?.alt ?? 'Image'}
                class="krt-image-figure-img"
            />
        </figure>
    {/if}
{/if}

<style>
    .krt-image-block {
        width: 100%;
        min-width: 100%;
    }

    .krt-image-body {
        width: 100%;
        min-width: 100%;
    }

    .krt-image-dropzone {
        margin-top: 0.25rem;
        display: flex;
        justify-content: center;
    }

    .krt-image-dropzone-label {
        width: 100%;
        max-width: 30rem;
        height: 8rem;
        border-radius: var(--krt-radius-md, 0.5rem);
        border: 1px dashed var(--krt-color-border-subtle, #e5e7eb);
        background-color: #f9fafb;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: border-color 150ms ease, background-color 150ms ease;
    }

    .krt-image-dropzone-label:hover {
        border-color: var(--krt-color-accent, #4f46e5);
        background-color: #eff6ff;
    }

    .krt-image-dropzone-inner {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.35rem;
    }

    .krt-image-dropzone-icon {
        width: 2.25rem;
        height: 2.25rem;
        color: var(--krt-color-muted, #6b7280);
    }

    .krt-image-dropzone-title {
        margin: 0;
        font-size: 0.85rem;
        color: var(--krt-color-muted, #6b7280);
        font-weight: 500;
    }

    .krt-image-dropzone-subtitle {
        margin: 0;
        font-size: 0.75rem;
        color: var(--krt-color-muted, #6b7280);
    }

    .krt-image-input {
        display: none;
    }

    .krt-image-error {
        display: block;
        margin-top: 0.4rem;
        font-size: 0.8rem;
        color: #b91c1c;
    }

    .krt-image-preview-wrapper {
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        margin-top: 1.25rem;
    }

    .krt-image-preview {
        max-width: 100%;
        height: auto;
        border-radius: var(--krt-radius-md, 0.5rem);
        box-shadow: var(--krt-shadow-sm, 0 1px 2px rgba(15, 23, 42, 0.06));
    }

    .krt-image-figure {
        width: 100%;
        min-width: 100%;
        display: flex;
        justify-content: center;
    }

    .krt-image-figure-img {
        max-width: 100%;
        height: auto;
        border-radius: var(--krt-radius-md, 0.5rem);
        box-shadow: var(--krt-shadow-sm, 0 1px 2px rgba(15, 23, 42, 0.06));
    }
</style>

