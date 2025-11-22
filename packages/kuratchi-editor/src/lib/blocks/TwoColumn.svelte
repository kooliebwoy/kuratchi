<script lang="ts">
    import { BlockActions } from "../utils/index.js";
    import { onMount } from "svelte";

    interface Props {
        id?: string;
        leftContent?: string;
        rightContent?: string;
        type?: string;
        metadata?: {
            leftWidth?: '1/3' | '1/2' | '2/3';
            gap?: 'sm' | 'md' | 'lg' | 'xl';
            verticalAlign?: 'top' | 'center' | 'bottom';
        };
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        leftContent = 'Left column content...',
        rightContent = 'Right column content...',
        type = 'two-column',
        metadata = {
            leftWidth: '1/2',
            gap: 'md',
            verticalAlign: 'top'
        },
        editable = true
    }: Props = $props();

    let component = $state<HTMLElement>();
    let leftWidth = $state(metadata.leftWidth);
    let gap = $state(metadata.gap);
    let verticalAlign = $state(metadata.verticalAlign);

    // Calculate grid classes based on left width
    let gridClasses = $derived((() => {
        switch (leftWidth) {
            case '1/3': return 'grid-cols-3';
            case '2/3': return 'grid-cols-3';
            case '1/2':
            default: return 'grid-cols-2';
        }
    })());

    let leftColClasses = $derived((() => {
        switch (leftWidth) {
            case '1/3': return 'col-span-1';
            case '2/3': return 'col-span-2';
            case '1/2':
            default: return 'col-span-1';
        }
    })());

    let rightColClasses = $derived((() => {
        switch (leftWidth) {
            case '1/3': return 'col-span-2';
            case '2/3': return 'col-span-1';
            case '1/2':
            default: return 'col-span-1';
        }
    })());

    let gapClasses = $derived((() => {
        switch (gap) {
            case 'sm': return 'gap-2';
            case 'lg': return 'gap-8';
            case 'xl': return 'gap-12';
            case 'md':
            default: return 'gap-4';
        }
    })());

    let alignClasses = $derived((() => {
        switch (verticalAlign) {
            case 'center': return 'items-center';
            case 'bottom': return 'items-end';
            case 'top':
            default: return 'items-start';
        }
    })());

    let content = $derived({
        id,
        type,
        leftContent,
        rightContent,
        metadata: {
            leftWidth,
            gap,
            verticalAlign
        }
    });

    let mounted = $state(false);
    onMount(() => {
        if (!editable) return;
        mounted = true;
    });
</script>

{#if editable}
    <div class="editor-item group relative" bind:this={component}>
        {#if mounted}
            <BlockActions {component}>
                <small>Column Width</small>
                <li><button class="btn btn-sm btn-ghost" onclick={() => leftWidth = '1/3'}>1/3 - 2/3</button></li>
                <li><button class="btn btn-sm btn-ghost" onclick={() => leftWidth = '1/2'}>1/2 - 1/2</button></li>
                <li><button class="btn btn-sm btn-ghost" onclick={() => leftWidth = '2/3'}>2/3 - 1/3</button></li>
                
                <div class="divider my-1"></div>
                <small>Gap Size</small>
                <li><button class="btn btn-sm btn-ghost" onclick={() => gap = 'sm'}>Small</button></li>
                <li><button class="btn btn-sm btn-ghost" onclick={() => gap = 'md'}>Medium</button></li>
                <li><button class="btn btn-sm btn-ghost" onclick={() => gap = 'lg'}>Large</button></li>
                <li><button class="btn btn-sm btn-ghost" onclick={() => gap = 'xl'}>Extra Large</button></li>
                
                <div class="divider my-1"></div>
                <small>Vertical Alignment</small>
                <li><button class="btn btn-sm btn-ghost" onclick={() => verticalAlign = 'top'}>Top</button></li>
                <li><button class="btn btn-sm btn-ghost" onclick={() => verticalAlign = 'center'}>Center</button></li>
                <li><button class="btn btn-sm btn-ghost" onclick={() => verticalAlign = 'bottom'}>Bottom</button></li>
            </BlockActions>
        {/if}
        
        <div data-type={type} {id} class="w-full min-w-full">
            <!-- JSON Data for this component -->
            <script type="application/json" id="metadata-{id}">
                {JSON.stringify(content)}
            </script>

            <div class={`grid ${gridClasses} ${gapClasses} ${alignClasses} py-4`}>
                <div class={`${leftColClasses} prose prose-sm max-w-none`}>
                    <div 
                        contenteditable
                        bind:innerHTML={leftContent}
                        class="outline-none min-h-[100px] p-4 border border-dashed border-base-300 rounded"
                    ></div>
                </div>
                <div class={`${rightColClasses} prose prose-sm max-w-none`}>
                    <div 
                        contenteditable
                        bind:innerHTML={rightContent}
                        class="outline-none min-h-[100px] p-4 border border-dashed border-base-300 rounded"
                    ></div>
                </div>
            </div>
        </div>
    </div>
{:else}
    <div data-type={type} {id} class={`w-full min-w-full py-4 grid ${gridClasses} ${gapClasses} ${alignClasses}`}>
        <div class={`${leftColClasses} prose prose-sm max-w-none`}>
            <div class="min-h-[100px]">{@html leftContent}</div>
        </div>
        <div class={`${rightColClasses} prose prose-sm max-w-none`}>
            <div class="min-h-[100px]">{@html rightContent}</div>
        </div>
    </div>
{/if}
