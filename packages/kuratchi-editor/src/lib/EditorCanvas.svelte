<script lang="ts">
    import { onDestroy, onMount, tick } from "svelte";
    import { blocks, getBlock } from "./registry/blocks.svelte";
    import type { BlockDefinition } from "./registry/blocks.svelte";
import { addComponentToEditor, saveEditorBlocks, saveEditorFooterBlocks, saveEditorHeaderBlocks } from "./utils/editor.svelte";
    import { imageConfig } from './stores/imageConfig';
    import { PanelsTopLeft, Plus } from "@lucide/svelte";
    import { layoutPresets } from "./presets/layouts.js";
    import PresetPreview from "./presets/PresetPreview.svelte";
    import type { SiteRegionState } from "./presets/types.js";

    interface Props {
        editor?: HTMLElement | null;
        content?: Array<Record<string, unknown>>;
        editable?: boolean;
        isWebpage?: boolean;
        backgroundColor?: string;
        header?: SiteRegionState | null;
        footer?: SiteRegionState | null;
        layoutsEnabled?: boolean;
        imageConfig?: { uploadEndpoint?: string };
        onContentChange?: (content: Array<Record<string, unknown>>) => void;
        onHeaderChange?: (header: SiteRegionState | null) => void;
        onFooterChange?: (footer: SiteRegionState | null) => void;
        navigation?: {
            header?: { visible?: boolean; useMobileMenuOnDesktop?: boolean; items?: any[] };
            footer?: { visible?: boolean; items?: any[] };
        };
    }

    let { 
        editor = $bindable(null),
        content = $bindable([]),
        editable = true,
        isWebpage = true,
        backgroundColor = $bindable('#000000'),
        header = $bindable<SiteRegionState | null>(null),
        footer = $bindable<SiteRegionState | null>(null),
        layoutsEnabled = true,
        imageConfig: editorImageConfig = {},
        onContentChange,
        onHeaderChange,
        onFooterChange,
        navigation
    }: Props = $props();
    
    let editorBlocks = $state(content);
    let blockSearchTerm = $state('');
    let inlineBlockSearchInput: HTMLInputElement;
    let inlineBlockSearch = $state('');
    let inlineFilteredBlocks = $state([]);
    let inlineDropdown = $state({ open: false });
    const paletteBlocks = blocks.filter((block) => block.showInPalette !== false);

    const filteredBlocks = $derived(
        blockSearchTerm === ""
        ? paletteBlocks
        : paletteBlocks.filter((block) =>
            block.name.toLowerCase().includes(blockSearchTerm.toLowerCase())
        )
    );

    const getDragAfterElement = (container: HTMLElement, clientY: number) => {
        const draggableElements = Array.from(
            container.querySelectorAll<HTMLElement>('.editor-block:not(.dragging)')
        );

        const result = draggableElements.reduce(
            (closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = clientY - box.top - box.height / 2;

                if (offset < 0 && offset > closest.offset) {
                    return { offset, element: child };
                }

                return closest;
            },
            { offset: Number.NEGATIVE_INFINITY, element: null as HTMLElement | null }
        );

        return result.element;
    };

    const updateEditorData = async () => {
        const blocks = await saveEditorBlocks(editor);
        if (JSON.stringify(blocks) !== JSON.stringify(content)) {
            content = blocks;
            onContentChange?.(blocks);
        }
    }

    const blockKey = (block: Record<string, unknown>, index: number) => {
        if (typeof block.id === 'string' && block.id.length > 0) return block.id;
        if (typeof block.type === 'string' && block.type.length > 0) return `${block.type}-${index}`;
        return `block-${index}`;
    };

    const updateHeaderData = async () => {
        if (!headerElement) return;
        const blocks = await saveEditorHeaderBlocks(headerElement);
        if (!blocks) return;
        if (JSON.stringify(blocks) !== JSON.stringify(header?.blocks)) {
            const next = { presetId: header?.presetId ?? null, blocks };
            header = next;
            onHeaderChange?.(next);
        }
    };

    const updateFooterData = async () => {
        if (!footerElement) return;
        const blocks = await saveEditorFooterBlocks(footerElement);
        if (!blocks) return;
        if (JSON.stringify(blocks) !== JSON.stringify(footer?.blocks)) {
            const next = { presetId: footer?.presetId ?? null, blocks };
            footer = next;
            onFooterChange?.(next);
        }
    };

    const addComponent = (definition: BlockDefinition, initialProps?: Record<string, unknown>) => {
        addComponentToEditor(editor, definition.component, initialProps);
        blockSearchTerm = '';
        inlineDropdown.open = false;
        inlineBlockSearch = '';
        inlineBlockSearchInput?.focus();
    }

    const loadEditorBlock = (type: string) => getBlock(type);

    const insertLayoutPreset = (presetId: string) => {
        const preset = layoutPresets.find((candidate) => candidate.id === presetId);
        if (!preset) return;
        preset.create().forEach((snapshot) => {
            const definition = getBlock(snapshot.type);
            if (!definition) return;
            addComponent(definition, { ...snapshot });
        });
    };

    const handleInlineSearch = () => {
        inlineDropdown.open = false;
        const inputText = inlineBlockSearch;

        if (inputText === '' || !inputText.startsWith('/')) {
            inlineBlockSearch = '';
            inlineBlockSearchInput.placeholder = 'Type / to browse blocks';
        }

        if (inputText.startsWith('/')) {
            inlineDropdown.open = true;
            const blockName = inputText.slice(1).trim();
            inlineFilteredBlocks = filteredBlocks.filter((block) =>
                block.name.toLowerCase().includes(blockName.toLowerCase())
            );
        }
    }

    let headerElement = $state<HTMLElement>();
    let footerElement = $state<HTMLElement>();
    let contentUpdateTimeout: number;
    let headerUpdateTimeout: number;
    let footerUpdateTimeout: number;

    let cleanupEditorDragAndDrop: (() => void) | null = null;
    let dropIndicator: HTMLDivElement | null = null;

    const initEditorDragAndDrop = async () => {
        cleanupEditorDragAndDrop?.();
        dropIndicator?.remove();
        dropIndicator = null;
        if (!editable) return;
        await tick();

        if (!(editor instanceof HTMLElement)) {
            cleanupEditorDragAndDrop = null;
            return;
        }

        let draggedElement: HTMLElement | null = null;
        dropIndicator = document.createElement('div');
        dropIndicator.className = 'editor-drop-indicator';
        dropIndicator.setAttribute('aria-hidden', 'true');

        const resetDragging = () => {
            draggedElement?.classList.remove('dragging');
            draggedElement = null;
            dropIndicator?.remove();
            editor.classList.remove('is-reordering');
        };

        const handleDragStart = (event: DragEvent) => {
            const target = event.target as HTMLElement | null;
            const handle = target?.closest('.drag-handle, .handle');
            if (!handle) return;
            const block = handle.closest<HTMLElement>('.editor-block');
            if (!block) return;

            draggedElement = block;
            block.classList.add('dragging');
            editor.classList.add('is-reordering');
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = 'move';
                const dragOffsetX = block.clientWidth / 2;
                const dragOffsetY = Math.min(event.offsetY ?? block.clientHeight / 2, block.clientHeight / 2);
                event.dataTransfer.setDragImage(block, dragOffsetX, dragOffsetY);
                event.dataTransfer.setData('text/plain', block.id ?? 'block');
            }
        };

        const handleDragOver = (event: DragEvent) => {
            if (!draggedElement || !(editor instanceof HTMLElement)) return;
            event.preventDefault();
            const afterElement = getDragAfterElement(editor, event.clientY);
            if (!afterElement) {
                if (dropIndicator) {
                    editor.appendChild(dropIndicator);
                }
                editor.appendChild(draggedElement);
                return;
            }

            if (dropIndicator) {
                editor.insertBefore(dropIndicator, afterElement);
            }
            if (afterElement !== draggedElement) {
                editor.insertBefore(draggedElement, afterElement);
            }
        };

        const handleDrop = (event: DragEvent) => {
            if (!draggedElement) return;
            event.preventDefault();
            resetDragging();
            clearTimeout(contentUpdateTimeout);
            contentUpdateTimeout = setTimeout(updateEditorData, 300);
        };

        const handleDragEnd = () => resetDragging();

        editor.addEventListener('dragstart', handleDragStart);
        editor.addEventListener('dragover', handleDragOver);
        editor.addEventListener('drop', handleDrop);
        editor.addEventListener('dragend', handleDragEnd);

        cleanupEditorDragAndDrop = () => {
            editor.removeEventListener('dragstart', handleDragStart);
            editor.removeEventListener('dragover', handleDragOver);
            editor.removeEventListener('drop', handleDrop);
            editor.removeEventListener('dragend', handleDragEnd);
            dropIndicator?.remove();
        };
    };

    onMount(() => {
        imageConfig.set(editorImageConfig);
        initEditorDragAndDrop();

        const observer = new MutationObserver(() => {
            clearTimeout(contentUpdateTimeout);
            contentUpdateTimeout = setTimeout(updateEditorData, 1500);
        });

        if (editor) {
            observer.observe(editor, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }

        if (headerElement) {
            const headerObserver = new MutationObserver(() => {
                clearTimeout(headerUpdateTimeout);
                headerUpdateTimeout = setTimeout(updateHeaderData, 1500);
            });
            
            headerObserver.observe(headerElement, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true
            });
        }
        
        if (footerElement) {
            const footerObserver = new MutationObserver(() => {
                clearTimeout(footerUpdateTimeout);
                footerUpdateTimeout = setTimeout(updateFooterData, 1500);
            });
            
            footerObserver.observe(footerElement, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true
            });
        }
        
        return () => {
            cleanupEditorDragAndDrop?.();
            clearTimeout(contentUpdateTimeout);
            clearTimeout(headerUpdateTimeout);
            clearTimeout(footerUpdateTimeout);
        };
    });

    onDestroy(() => {
        cleanupEditorDragAndDrop?.();
    });

    let layoutModal: HTMLDialogElement;

    const headerBlocksState = $derived(header?.blocks ?? []);
    const footerBlocksState = $derived(footer?.blocks ?? []);

    const headerMenuHidden = $derived(
        navigation?.header?.visible === false
    );
    const footerMenuHidden = $derived(
        navigation?.footer?.visible === false
    );
</script>

<div class="h-full bg-base-100 flex flex-col max-w-8xl mx-auto rounded-3xl shadow-sm" style:background-color={backgroundColor}>
    {#if isWebpage}
        <div bind:this={headerElement} class="flex-none space-y-4">
            {#if headerBlocksState.length === 0}
                <div class="text-center text-sm text-base-content/60 py-4 border-b border-base-300">Select a header preset to get started</div>
            {:else}
                {#each headerBlocksState as block, index (blockKey(block, index))}
                    {@const blockDefinition = loadEditorBlock(block.type)}
                    {#if blockDefinition}
                        <blockDefinition.component
                            {...block}
                            menu={navigation?.header?.items ?? (block as any)?.menu}
                            useMobileMenuOnDesktop={navigation?.header?.useMobileMenuOnDesktop ?? (block as any)?.useMobileMenuOnDesktop}
                            menuHidden={headerMenuHidden}
                        />
                    {/if}
                {/each}
            {/if}
        </div> 
    {/if}

    <div class="flex grow overflow-hidden hover:overflow-y-scroll pb-52 mb-8" role="application">
        <div class="w-full px-16">
            <article 
                bind:this={editor} 
                role="application" 
                class="prose lg:prose-lg py-8 text-base-content w-full max-w-none relative space-y-3"
            >
                {#each editorBlocks as block, index (blockKey(block, index))}
                    {@const editorBlock = loadEditorBlock(block.type)}
                    {#if editorBlock}
                        <div class="relative editor-block">
                            <editorBlock.component {...block} />
                        </div>
                    {/if}
                {/each}
            </article>
            <div class="relative group">
                <div class="absolute -left-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-row gap-1 z-10">
                    {#if layoutsEnabled}
                        <button class="btn btn-xs btn-square" onclick={() => layoutModal.showModal()}>
                            <PanelsTopLeft class="text-base" />
                        </button>
                    {/if}     
                    <button popovertarget="searchBlocksPopover" style="anchor-name:--searchBlocksPopover" class="btn btn-xs btn-square" >
                        <Plus class="text-base" />
                    </button>
                    <ul popover="" id="searchBlocksPopover" style="position-anchor:--searchBlocksPopover" class="dropdown dropdown-end dropdown-start menu !bg-base-300 rounded-box w-50 p-2 shadow">
                        <li>
                            <label class="input input-bordered flex items-center gap-2 w-44 h-8 rounded-md">
                                <input type="text" class="input-xs" placeholder="Search" bind:value={blockSearchTerm} />
                            </label>
                        </li>
                        {#if filteredBlocks.length > 0}
                            {#each filteredBlocks as component}
                                <li>
                                    <button class="btn btn-ghost" onclick={() => addComponent(component)}>
                                        <component.icon class="text-lg" />
                                        <span>{component.name}</span>
                                    </button> 
                                </li>
                            {/each}
                        {/if}
                    </ul>
                </div>
                <div class="relative">
                    <input 
                        class="input w-full !border-0 !outline-none bg-transparent focus:!outline-none px-0 placeholder:opacity-30" 
                        style="{backgroundColor === '#ffffff' || !backgroundColor ? 'color: rgba(0,0,0,0.8)' : 'color: rgba(255,255,255,0.8)'}" 
                        bind:value={inlineBlockSearch} 
                        bind:this={inlineBlockSearchInput} 
                        oninput={handleInlineSearch} 
                        placeholder="Type / to browse blocks" 
                        class:placeholder-black={backgroundColor === '#ffffff' || !backgroundColor}
                        class:placeholder-white={backgroundColor !== '#ffffff' && backgroundColor}
                    />
                    {#if inlineDropdown?.open && inlineFilteredBlocks.length > 0}
                        <div class="absolute top-full left-0 mt-2 menu bg-base-100 rounded-box w-52 p-2 shadow-lg z-50 border border-base-300">
                            {#each inlineFilteredBlocks as component}
                                <li>
                                    <button class="btn btn-ghost justify-start" onclick={() => addComponent(component)}>
                                        <component.icon class="text-lg" />
                                        <span>{component.name}</span>
                                    </button> 
                                </li>
                            {/each}
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    </div>

    {#if layoutsEnabled}
        <dialog id="layoutModal" class="modal" bind:this={layoutModal}>
            <div class="modal-box w-11/12 max-w-5xl">
                <form method="dialog">
                    <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
                </form>
                <h3 class="text-2xl font-bold mb-4">Select Layout</h3>
                <div class="grid grid-cols-3 gap-4 w-full overflow-y-scroll">
                    {#each layoutPresets as preset}
                        <button
                            class="card card-side bg-base-100 shadow-xl text-left p-3 hover:ring-2 hover:ring-primary transition flex flex-col gap-2"
                            onclick={() => {
                                insertLayoutPreset(preset.id);
                                layoutModal.close();
                            }}
                        >
                            <PresetPreview {preset} />
                            <div class="w-full text-sm font-semibold">{preset.name}</div>
                        </button>
                    {/each}
                </div> 
            </div>
        </dialog>
    {/if}

    {#if isWebpage}
        <div bind:this={footerElement} class="flex-none space-y-4"> 
            {#if footerBlocksState.length === 0}
                <div class="text-center text-sm text-base-content/60 py-4 border-t border-base-300">Select a footer preset to get started</div>
            {:else}
                {#each footerBlocksState as block, index (blockKey(block, index))}
                    {@const blockDefinition = loadEditorBlock(block.type)}
                    {#if blockDefinition}
                        <blockDefinition.component
                            {...block}
                            menu={navigation?.footer?.items ?? (block as any)?.menu}
                            menuHidden={footerMenuHidden}
                        />
                    {/if}
                {/each}
            {/if}
        </div>
    {/if}
</div>

<style>
    :global(.editor-block.dragging) {
        opacity: 0.45;
        transition: opacity 150ms ease;
    }

    :global(.editor-drop-indicator) {
        height: 4px;
        border-radius: 9999px;
        background: color-mix(in srgb, var(--fallback-p, #6366f1) 70%, transparent);
        margin: 0.75rem 0;
        pointer-events: none;
        box-shadow: 0 0 0 1px color-mix(in srgb, currentColor 35%, transparent);
        transition: transform 120ms ease;
    }
</style>
