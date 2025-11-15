<script lang="ts">
    import { Pencil, GripVertical, X, Trash2 } from '@lucide/svelte';
    import type { Snippet } from 'svelte';
    import { deleteElement } from '../../utils/editor.svelte.js';
    import { isFooterBlockType } from '../../presets/footers.js';
    import { isHeaderBlockType } from '../../presets/headers.js';
    import { openRightPanel } from '../../stores/right-panel.js';

    interface Props {
        id: string;
        type: string;
        drawerContent?: Snippet;
        metadata?: Snippet;
        children?: Snippet;
    }

    let { id, type, drawerContent, metadata, children }: Props = $props();
    let component: HTMLElement;

    const isNotHeaderOrFooter = !isFooterBlockType(type) && !isHeaderBlockType(type);

    let drawerState = $state(false);
</script>

<div 
    class="group relative" 
    bind:this={component} 
    class:editor-item={isNotHeaderOrFooter} 
    class:editor-header-item={isHeaderBlockType(type)} 
    class:editor-footer-item={isFooterBlockType(type)}
>
    <div class="absolute -left-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-50 flex flex-row gap-1">
        <button class="btn btn-xs btn-circle btn-ghost bg-base-100 border border-base-300 shadow-sm hover:bg-base-200 cursor-grab active:cursor-grabbing drag-handle handle" title="Drag to reorder">
            <GripVertical class="text-base text-base-content/70" />
        </button>
        <button class="btn btn-xs btn-circle btn-ghost bg-base-100 border border-base-300 shadow-sm hover:bg-base-200" onclick={() => drawerContent ? openRightPanel(drawerContent, `Edit ${type}`) : drawerState = true} title="Edit component">
            <Pencil class="text-base text-base-content/70" />
        </button>
        {#if isNotHeaderOrFooter}
            <button onclick={() => deleteElement(component!)} class="btn btn-xs btn-circle btn-ghost bg-base-100 border border-base-300 shadow-sm hover:bg-base-200" title="Delete component">
                <Trash2 class="text-base text-error" />
            </button>
        {/if}
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
        <div class="menu !bg-base-200 text-base-content min-h-full p-4 min-w-[24rem]">
            <div class="flex mb-5 justify-end pr-2">
                <button class="btn btn-sm btn-circle btn-neutral shadow-lg" onclick={() => drawerState = false}>
                    <X class="text-2xl text-error" />
                </button>
            </div>
            {@render drawerContent?.()}
        </div>
    </div>    
</div>
