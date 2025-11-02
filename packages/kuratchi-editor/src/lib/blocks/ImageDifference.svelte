<script lang="ts">
    import { browser } from "$app/environment";
    import { SideActions } from "../shell/index.js";
    import { onMount } from "svelte";

    interface Props {
        id?: string;
        type?: string;
        metadata?: any;
    }

    let {
        id = crypto.randomUUID(),
        type = 'image-difference',
        metadata = {
            image1: {
                id: '1',
                src: 'https://img.daisyui.com/images/stock/photo-1560717789-0ac7c58ac90a.webp',
                alt: 'daisy',
                key: ''
            },
            image2: {
                id: '2',
                src: 'https://img.daisyui.com/images/stock/photo-1560717789-0ac7c58ac90a-blur.webp',
                alt: 'daisy',
                key: ''
            }
        }
    }: Props = $props();

    let component: HTMLElement;

    let image1 = $state(metadata.image1);
    let image2 = $state(metadata.image2);

    // extract body from the content and the card title
    let content = $derived({
        id,
        type,
        metadata
    })

    let mounted = $state(false);
    onMount(() => {
        mounted = true;
    });
</script>

<div class="editor-item group relative" bind:this={component}>
    {#if mounted}
        <SideActions {component} />
    {/if}

    <div data-type={type} id={id} class="w-full min-w-full">
        <!-- JSON Data for this component -->
        <div class="hidden" id="metadata-{id}">
            {JSON.stringify(content)}
        </div>

        <div class="diff aspect-[16/9]">
            <div class="diff-item-1">
                <img alt={image1.alt} src={ image1.key ? '/api/bucket/' + image1.key : image1.src} />
            </div>
            <div class="diff-item-2">
                <img alt={image2.alt} src={ image2.key ? '/api/bucket/' + image2.key : image2.src} />
            </div>
            <div class="diff-resizer"></div>
        </div>
    </div>
</div>

