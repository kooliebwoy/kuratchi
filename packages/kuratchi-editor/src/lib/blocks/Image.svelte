<script lang="ts">
    import { deserialize } from "$app/forms";
    import { Upload } from "@lucide/svelte";
    import type { ActionResult } from "@sveltejs/kit";
    import { SideActions } from "../shell/index.js";
    import { onMount } from "svelte";
    import { imageConfig } from "../stores/imageConfig.js";

    interface Props {
        id?: string;
        image?: Record<string, unknown>;
        type?: string;
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        image = {},
        type = 'image',
        editable = true
    }: Props = $props();

    let component = $state<HTMLElement>();
    let componentEditor = $state<HTMLElement>();

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
    })

    let mounted = $state(false);
    onMount(() => {
        if (!editable) return;
        mounted = true;
    });
</script>

{#if editable}
    <div class="editor-item group relative" bind:this={component}>
        {#if mounted}
            <SideActions {component} />
        {/if}

        <div data-type={type} id={id} class="w-full min-w-full">
            <!-- JSON Data for this component -->
            <div class="hidden" id="metadata-{id}">
                {JSON.stringify(content)}
            </div>

            {#if !uploadedImage?.id}
                <div class="flex items-center justify-center mt-1">
                    <label for="dropzone-file" class="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-bray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600">
                        <div class="flex flex-col items-center justify-center pt-8 pb-6">
                            <Upload class="w-10 h-10 text-gray-500" />
                            <p class="mb-1 text-sm text-gray-500 dark:text-gray-400"><span class="font-semibold">Click to upload</span></p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">PNG or JPG (MAX. 10MB)</p>
                        </div>
                        <input id="dropzone-file" type="file" name="image" class="hidden" bind:this={profilePhotoFile} onchange={() => processUpload()} />
                    </label>
                </div>
                {#if photoError}
                    <span class="text-red-500 mt-1">{photoMessage}</span>
                {/if}
            {/if}
        
            <div class="flex w-full place-items-center justify-center mt-5">
                <div class="avatar">
                    {#if !photoError && uploadedImage?.id}
                        <img src={'/api/bucket/' + uploadedImage?.key} alt={uploadedImage?.alt ?? 'Uploaded image'} />
                    {/if}
                </div>
            </div>
        </div>
    </div>
{:else}
    {#if uploadedImage?.id || uploadedImage?.src || uploadedImage?.url}
        <figure data-type={type} id={id} class="w-full min-w-full flex justify-center">
            <img
                src={uploadedImage?.key ? '/api/bucket/' + uploadedImage.key : uploadedImage?.src ?? uploadedImage?.url ?? ''}
                alt={uploadedImage?.alt ?? 'Image'}
                class="max-w-full h-auto"
            />
        </figure>
    {/if}
{/if}

