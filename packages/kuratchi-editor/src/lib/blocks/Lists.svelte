<script lang="ts">
    import { blockRegistry } from '../stores/editorSignals.svelte.js';
    import { DragHandle, BLOCK_SPACING_VALUES, type BlockSpacing, setupSelectionListener, type SelectionState } from "../utils/index.js";
    import EditorToolbar from "../widgets/EditorToolbar.svelte";
    import { tick, onMount, onDestroy } from "svelte";

    type ListKind = 'ul' | 'ol';

    interface Props {
        id?: string;
        type?: string;
        metadata?: {
            listType?: ListKind;
            items?: string[];
            spacingTop?: BlockSpacing;
            spacingBottom?: BlockSpacing;
        };
        editable?: boolean;
    }

    let {
        type = 'list',
        metadata = {
            listType: 'ul',
            items: ['List item'],
            spacingTop: 'normal',
            spacingBottom: 'normal'
        },
        id = crypto.randomUUID(),
        editable = true
    }: Props = $props();

    let component: HTMLElement | undefined;
    const componentRef = {};
    let listContainer = $state<HTMLElement>();

    let listType = $state((metadata.listType ?? 'ul') as ListKind);
    let items = $state(Array.isArray(metadata.items) && metadata.items.length ? metadata.items : ['List item']);
    let spacingTop = $state<BlockSpacing>(metadata?.spacingTop ?? 'normal');
    let spacingBottom = $state<BlockSpacing>(metadata?.spacingBottom ?? 'normal');

    // Computed spacing styles
    let spacingStyle = $derived(
        `margin-top: ${BLOCK_SPACING_VALUES[spacingTop]}; margin-bottom: ${BLOCK_SPACING_VALUES[spacingBottom]};`
    );

    // Selection state for toolbar
    let selectionState: SelectionState = $state({
        showToolbar: false,
        position: { x: 0, y: 0 }
    });

    let cleanup: (() => void) | undefined;

    // Setup selection listener when component is available
    $effect(() => {
        if (!editable) return;
        if (component) {
            if (cleanup) cleanup();
            cleanup = setupSelectionListener(component, selectionState);
        }
    });

    onDestroy(() => {
        if (cleanup) cleanup();
    });

    // Block context for toolbar
    function getBlockContext() {
        return {
            type: 'list' as const,
            blockElement: component,
            spacingTop,
            spacingBottom,
            onSpacingTopChange: (s: BlockSpacing) => { spacingTop = s; },
            onSpacingBottomChange: (s: BlockSpacing) => { spacingBottom = s; }
        };
    }

    const content = $derived({
        id,
        type,
        metadata: {
            listType,
            items,
            spacingTop,
            spacingBottom
        }
    });

    const ensureItem = () => {
        if (!items.length) {
            items = [''];
        }
    };

    const changeType = (newType: ListKind) => {
        listType = newType;
    };

    const addItemAfter = async (index: number) => {
        items = [...items.slice(0, index + 1), '', ...items.slice(index + 1)];
        await focusItem(index + 1);
    };

    const removeItem = async (index: number) => {
        if (items.length === 1) {
            items = [''];
            await focusItem(0);
            return;
        }

        items = [...items.slice(0, index), ...items.slice(index + 1)];
        await focusItem(Math.max(index - 1, 0));
    };

    const handleInput = (index: number, event: Event) => {
        const target = event.currentTarget as HTMLElement | null;
        if (!target) return;
        items = items.map((item, i) => (i === index ? target.textContent ?? '' : item));
    };

    const handleKeyDown = async (index: number, event: KeyboardEvent) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            await addItemAfter(index);
            return;
        }

        if (event.key === 'Backspace') {
            const target = event.currentTarget as HTMLElement | null;
            const value = target?.textContent?.trim() ?? '';
            if (!value) {
                event.preventDefault();
                await removeItem(index);
            }
        }
    };

    const focusItem = async (index: number) => {
        await tick();
        const elements = listContainer?.querySelectorAll<HTMLElement>('[data-list-item]');
        const element = elements?.[index];
        element?.focus();
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            element.select();
        }
    };

    ensureItem();

    let mounted = $state(false);
    onMount(() => {
        if (!editable) return;
        mounted = true;
        blockRegistry.register(componentRef, () => ({ ...content, region: 'content' }), 'content', component);
        return () => blockRegistry.unregister(componentRef);
    });
</script>

{#if editable}
    <div class="editor-item group relative krt-list-block" bind:this={component} style={spacingStyle}>
        {#if mounted}
            <DragHandle />
            <EditorToolbar component={component} show={selectionState.showToolbar} position={selectionState.position} blockContext={getBlockContext()} />
        {/if}

        <div data-type={type} id={id} class="krt-list-body">
            <div id="metadata-{id}" style="display: none;">{JSON.stringify(content)}</div>

            <svelte:element this={listType} class="krt-list krt-list--{listType}" bind:this={listContainer}>
                {#each items as item, index}
                    <li
                        class="krt-list-item"
                        contenteditable
                        data-list-item
                        oninput={(event) => handleInput(index, event)}
                        onkeydown={(event) => handleKeyDown(index, event)}
                    >
                        {item}
                    </li>
                {/each}
            </svelte:element>
        </div>
    </div>
{:else}
    <div data-type={type} id={id} class="krt-list-block krt-list-body" style={spacingStyle}>
        <svelte:element this={listType} class="krt-list krt-list--{listType}">
            {#each items as item}
                <li class="krt-list-item">{item}</li>
            {/each}
        </svelte:element>
    </div>
{/if}

<style>
    .krt-list-block {
        width: 100%;
        min-width: 100%;
    }

    .krt-list-body {
        width: 100%;
    }

    .krt-list {
        margin: 0;
        padding-left: 1.5rem;
    }

    .krt-list--ul {
        list-style-type: disc;
    }

    .krt-list--ol {
        list-style-type: decimal;
    }

    .krt-list-item {
        outline: none;
        line-height: 1.6;
        margin-bottom: 0.25rem;
    }

    .krt-list-item:focus-visible {
        background: rgba(99, 102, 241, 0.05);
        border-radius: 0.25rem;
    }
</style>