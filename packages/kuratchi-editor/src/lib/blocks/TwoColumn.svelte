<script lang="ts">
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
    import { DragHandle, BLOCK_SPACING_VALUES, type BlockSpacing } from "../utils/index.js";
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
            spacingTop?: BlockSpacing;
            spacingBottom?: BlockSpacing;
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
            verticalAlign: 'top',
            spacingTop: 'normal',
            spacingBottom: 'normal'
        },
        editable = true
    }: Props = $props();

    let component: HTMLElement | undefined;
    const componentRef = {};
    let leftWidth = $state(metadata.leftWidth);
    let gap = $state(metadata.gap);
    let verticalAlign = $state(metadata.verticalAlign);
    let spacingTop = $state<BlockSpacing>(metadata?.spacingTop ?? 'normal');
    let spacingBottom = $state<BlockSpacing>(metadata?.spacingBottom ?? 'normal');

    // Computed spacing styles
    let spacingStyle = $derived(
        `margin-top: ${BLOCK_SPACING_VALUES[spacingTop]}; margin-bottom: ${BLOCK_SPACING_VALUES[spacingBottom]};`
    );

    let content = $derived({
        id,
        type,
        leftContent,
        rightContent,
        metadata: {
            leftWidth,
            gap,
            verticalAlign,
            spacingTop,
            spacingBottom
        }
    });

    let mounted = $state(false);
    onMount(() => {
        if (!editable) return;
        mounted = true;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
        return () => blockRegistry.unregister(componentRef);
    });
</script>

{#if editable}
    <div class="editor-item group relative krt-twocol-block" bind:this={component} style={spacingStyle}>
        {#if mounted}
            <DragHandle />
        {/if}
        
        <div data-type={type} {id} class="krt-twocol-body">
            <!-- JSON Data for this component -->
            <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>

            <div class={`krt-twocol-grid krt-twocol-grid--${leftWidth?.replace('/', '-')} krt-twocol-grid--gap-${gap} krt-twocol-grid--align-${verticalAlign}`}>
                <div class="krt-twocol-left">
                    <div 
                        contenteditable
                        bind:innerHTML={leftContent}
                        class="krt-twocol-content"
                    ></div>
                </div>
                <div class="krt-twocol-right">
                    <div 
                        contenteditable
                        bind:innerHTML={rightContent}
                        class="krt-twocol-content"
                    ></div>
                </div>
            </div>
        </div>
    </div>
{:else}
    <div data-type={type} {id} class="krt-twocol-block krt-twocol-body" style={spacingStyle}>
        <div class={`krt-twocol-grid krt-twocol-grid--${leftWidth?.replace('/', '-')} krt-twocol-grid--gap-${gap} krt-twocol-grid--align-${verticalAlign}`}>
            <div class="krt-twocol-left">
                <div class="krt-twocol-content">{@html leftContent}</div>
            </div>
            <div class="krt-twocol-right">
                <div class="krt-twocol-content">{@html rightContent}</div>
            </div>
        </div>
    </div>
{/if}

<style>
    .krt-twocol-block {
        width: 100%;
        min-width: 100%;
    }

    .krt-twocol-body {
        width: 100%;
        padding: 1rem 0;
    }

    .krt-twocol-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
    }

    .krt-twocol-grid--1-3 {
        grid-template-columns: 1fr 2fr;
    }

    .krt-twocol-grid--2-3 {
        grid-template-columns: 2fr 1fr;
    }

    .krt-twocol-grid--gap-sm { gap: 0.5rem; }
    .krt-twocol-grid--gap-md { gap: 1rem; }
    .krt-twocol-grid--gap-lg { gap: 2rem; }
    .krt-twocol-grid--gap-xl { gap: 3rem; }

    .krt-twocol-grid--align-top { align-items: start; }
    .krt-twocol-grid--align-center { align-items: center; }
    .krt-twocol-grid--align-bottom { align-items: end; }

    .krt-twocol-content {
        outline: none;
        min-height: 100px;
        padding: 1rem;
        border: 1px dashed var(--krt-color-border-subtle, #e5e7eb);
        border-radius: 0.5rem;
    }

    .krt-twocol-content:focus {
        border-color: var(--krt-color-accent, #4f46e5);
        border-style: solid;
    }
</style>
