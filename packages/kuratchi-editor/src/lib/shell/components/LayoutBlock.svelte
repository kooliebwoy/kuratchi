<script lang="ts">
    import { Pencil, GripVertical, X, Trash2 } from '@lucide/svelte';
    import type { Snippet } from 'svelte';
    import { deleteElement } from '$lib/utils/editor.svelte';
    import { getFooterBlock } from '$lib/registry/footerBlocks.svelte';
    import { getHeaderBlock } from '$lib/registry/headerBlocks.svelte';
    import { openRightPanel } from '$lib/stores/right-panel';

    interface Props {
        id: string;
        type: string;
        drawerContent?: Snippet;
        metadata?: Snippet;
        children?: Snippet;
    }

    let { id, type, drawerContent, metadata, children }: Props = $props();
    let component: HTMLElement;

    const isNotHeaderOrFooter = !getFooterBlock(type) && !getHeaderBlock(type);

    let drawerState = $state(false);
</script>

<div 
    class="group relative" 
    bind:this={component} 
    class:editor-item={isNotHeaderOrFooter} 
    class:editor-header-item={getHeaderBlock(type)} 
    class:editor-footer-item={getFooterBlock(type)}
>
    <div class="absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 flex items-center gap-2">
        <div class="flex items-center gap-2 pr-1 pt-0.5">
            <button class="btn btn-xs btn-neutral btn-square" onclick={() => drawerContent ? openRightPanel(drawerContent, `Edit ${type}`) : drawerState = true}>
                <Pencil class="text-xl text-info" />
            </button>
            {#if isNotHeaderOrFooter}
                <button class="btn btn-xs btn-neutral btn-square cursor-grab active:cursor-grabbing drag-handle handle">
                    <GripVertical class="text-base" />
                </button>
                <button onclick={() => deleteElement(component!)} class="btn btn-xs btn-neutral btn-square">
                    <Trash2 class="text-base text-error" />
                </button>
            {/if}
        </div>
    </div>

    <div class="component-wrapper" id={id} data-type={type}>
        <div class="hidden" id={`metadata-${id}`}>
            {@render metadata?.()}
        </div>
        {@render children?.()}
    </div>
</div>

<div class="drawer drawer-end">
    <input id="{id}" type="checkbox" class="drawer-toggle" bind:checked={drawerState} />
    <div class="drawer-side z-50">
        <div class="menu !bg-base-200 text-base-content min-h-full p-4 min-w-96">
            <div class="flex mb-5 justify-end pr-2">
                <button class="btn btn-sm btn-circle btn-neutral shadow-lg" onclick={() => drawerState = false}>
                    <X class="text-2xl text-error" />
                </button>
            </div>
            {@render drawerContent?.()}
        </div>
    </div>    
</div>

