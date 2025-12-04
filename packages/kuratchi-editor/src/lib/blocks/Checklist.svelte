<script lang="ts">
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
    import { DragHandle, BLOCK_SPACING_VALUES, type BlockSpacing } from "../utils/index.js";
    import Checkbox from "./Checkbox.svelte";
    import { onMount, mount } from "svelte";

    interface Props {
        id?: string;
        checklist?: any[];
        type?: string;
        metadata?: {
            color?: string;
            spacingTop?: BlockSpacing;
            spacingBottom?: BlockSpacing;
        };
        editable?: boolean;
    }

    let {
        id = crypto.randomUUID(),
        checklist = $bindable([]),
        type = 'checklist',
        metadata = {
            color: '#000000',
            spacingTop: 'normal',
            spacingBottom: 'normal'
        },
        editable = true
    }: Props = $props();

    let component: HTMLElement | undefined;
    const componentRef = {};
    let spacingTop = $state<BlockSpacing>(metadata?.spacingTop ?? 'normal');
    let spacingBottom = $state<BlockSpacing>(metadata?.spacingBottom ?? 'normal');

    // Computed spacing styles
    let spacingStyle = $derived(
        `margin-top: ${BLOCK_SPACING_VALUES[spacingTop]}; margin-bottom: ${BLOCK_SPACING_VALUES[spacingBottom]};`
    );

    // extract body from the content and the card title
    let content = $derived({
        id,
        type,
        checklist,
        metadata: {
            color: metadata.color,
            spacingTop,
            spacingBottom
        }
    })

    let checklistParent: HTMLDivElement | null = null;

    function handleKeyDown(event: KeyboardEvent): void {
        try {
            const isEnter = event.key === 'Enter';
            const isBackspace = event.key === 'Backspace';

            if ( isEnter ) {
                event.preventDefault();
                if (checklistParent) {
                    const newCheckbox = mount(Checkbox, { 
                        target: checklistParent 
                    });
                    const lastChild = checklistParent.lastElementChild as HTMLElement;
                    if (lastChild) {
                        const editable = lastChild.querySelector('[contenteditable]') as HTMLElement;
                        if (editable) {
                            editable.focus();
                        }
                    }
                }
            }

            if ( isBackspace ) {
                const checkbox = event.target?.parentElement as HTMLElement;
                if (checkbox && event?.target?.textContent?.trim() === '') {
                    const nearestSibling = checkbox.previousElementSibling as HTMLElement || checkbox.nextElementSibling as HTMLElement;
                    if (nearestSibling) {
                        checkbox.remove();
                        const editable = nearestSibling.querySelector('[contenteditable]') as HTMLElement;
                        if (editable) {
                            editable.focus();
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error occurred in handleKeyDown:', error);
        }
    }

    let mounted = $state(false);
    onMount(() => {
        if (!editable) return;
        mounted = true;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
        return () => blockRegistry.unregister(componentRef);
    });
</script>

{#if editable}
    <div class="editor-item group relative krt-checklist-block" bind:this={component} style={spacingStyle}>
        {#if mounted}
            <DragHandle />
        {/if}

        <div data-type={type} id={id} class="krt-checklist-body">
            <!-- JSON Data for this component -->
            <div id="metadata-{id}" style="display: none;">
                {JSON.stringify(content)}
            </div>

            <div onkeydown={(e) => handleKeyDown(e)} bind:this={checklistParent} role="list">
                <Checkbox />
            </div>
        </div>
    </div>
{:else}
    <div data-type={type} id={id} class="krt-checklist-block krt-checklist-body" style={spacingStyle}>
        {#each Array.isArray(checklist) ? checklist : [] as item, index}
            <div class="krt-checklist-item">
                <input type="checkbox" class="krt-checklist-checkbox" disabled checked={Boolean(item?.completed)} />
                <p class="krt-checklist-text" style:color={metadata?.color || '#000000'}>
                    {item?.content ?? `Item ${index + 1}`}
                </p>
            </div>
        {/each}
    </div>
{/if}

<style>
    .krt-checklist-block {
        width: 100%;
        min-width: 100%;
    }

    .krt-checklist-body {
        width: 100%;
    }

    .krt-checklist-item {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
    }

    .krt-checklist-checkbox {
        margin-top: 0.25rem;
    }

    .krt-checklist-text {
        flex: 1;
        margin: 0;
        font-size: 1rem;
    }
</style>
