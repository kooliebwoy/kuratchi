<script lang="ts">
    import { onDestroy, onMount, tick } from "svelte";
    import { blocks, getBlock } from "./registry/blocks.svelte";
    import { layouts, getLayout } from "./registry/layouts.svelte";
    import { addComponentToEditor, saveEditorBlocks, saveEditorFooterBlocks, saveEditorHeaderBlocks } from "./utils/editor.svelte";
    import { getFooterBlock } from "./registry/footerBlocks.svelte";
    import { getHeaderBlock } from "./registry/headerBlocks.svelte";
    import Sortable from "sortablejs";
    import { imageConfig } from './stores/imageConfig';
    import { PanelsTopLeft, Plus } from "@lucide/svelte";

    interface Props {
        editor?: HTMLElement | null;
        content?: Array<Record<string, unknown>>;
        editable?: boolean;
        isWebpage?: boolean;
        backgroundColor?: string;
        header?: Record<string, unknown> | null;
        footer?: Record<string, unknown> | null;
        layoutsEnabled?: boolean;
        imageConfig?: { uploadEndpoint?: string };
        onContentChange?: (content: Array<Record<string, unknown>>) => void;
        onHeaderChange?: (header: Record<string, unknown> | null) => void;
        onFooterChange?: (footer: Record<string, unknown> | null) => void;
    }

    let { 
        editor = $bindable(null),
        content = $bindable([]),
        editable = true,
        isWebpage = true,
        backgroundColor = $bindable('#000000'),
        header = $bindable(null),
        footer = $bindable(null),
        layoutsEnabled = true,
        imageConfig: editorImageConfig = {},
        onContentChange,
        onHeaderChange,
        onFooterChange
    }: Props = $props();
    
    let editorBlocks = $state(content);
    let blockSearchTerm = $state('');
    let inlineBlockSearchInput: HTMLInputElement;
    let inlineBlockSearch = $state('');
    let inlineFilteredBlocks = $state([]);
    let inlineDropdown: HTMLDetailsElement;
    let inlineDropdownPosition = $state({ top: 0 });

    const updateInlinePosition = () => {
        if (inlineDropdown) {
            const rect = inlineDropdown.getBoundingClientRect();
            inlineDropdownPosition.top = rect.top;
        }
    };

    $effect(() => {
        updateInlinePosition();
    });

    const filteredBlocks = $derived(
        blockSearchTerm === ""
        ? blocks
        : blocks.filter((block) =>
            block.name.toLowerCase().includes(blockSearchTerm.toLowerCase())
        )
    );

    const updateEditorData = async () => {
        const blocks = await saveEditorBlocks(editor);
        if (JSON.stringify(blocks) !== JSON.stringify(content)) {
            content = blocks;
            onContentChange?.(blocks);
        }
    }

    const updateHeaderData = async () => {
        if (!headerElement) return;
        const blocks = await saveEditorHeaderBlocks(headerElement);
        if (JSON.stringify(blocks) !== JSON.stringify(header)) {
            header = blocks;
            onHeaderChange?.(blocks);
        }
    }

    const updateFooterData = async () => {
        if (!footerElement) return;
        const blocks = await saveEditorFooterBlocks(footerElement);
        if (JSON.stringify(blocks) !== JSON.stringify(footer)) {
            footer = blocks;
            onFooterChange?.(blocks);
        }
    }

    const addComponent = (component: any) => {
        addComponentToEditor(editor, component);
        blockSearchTerm = '';
        inlineDropdown.open = false;
        inlineBlockSearch = '';
    }

    const loadEditorBlock = (type: string) => getBlock(type) || getLayout(type);

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
    let headerUpdateTimeout: number;
    let footerUpdateTimeout: number;

    let sortableInstance: Sortable | null = null;

    onMount(() => {
        imageConfig.set(editorImageConfig);

        const initSortable = async () => {
            await tick();
            if (editor instanceof HTMLElement) {
                sortableInstance = new Sortable(editor, {
                    handle: '.handle',
                    animation: 150
                });
            }
        };

        initSortable();

        const observer = new MutationObserver(() => {
            updateEditorData();
            if (isWebpage) {
                updateHeaderData();
                updateFooterData();
            }
            updateInlinePosition();
        });

        if (editor) {
            observer.observe(editor, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }

        if (headerElement) {
            const headerObserver = new MutationObserver((mutations) => {
                clearTimeout(headerUpdateTimeout);
                headerUpdateTimeout = setTimeout(updateHeaderData, 500);
            });
            
            headerObserver.observe(headerElement, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true
            });
        }
        
        if (footerElement) {
            const footerObserver = new MutationObserver((mutations) => {
                clearTimeout(footerUpdateTimeout);
                footerUpdateTimeout = setTimeout(updateFooterData, 500);
            });
            
            footerObserver.observe(footerElement, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true
            });
        }
        
        return () => {
            sortableInstance?.destroy();
            sortableInstance = null;
            clearTimeout(headerUpdateTimeout);
            clearTimeout(footerUpdateTimeout);
        };
    });

    onDestroy(() => {
        sortableInstance?.destroy();
        sortableInstance = null;
    });

    let layoutModal: HTMLDialogElement;

    const headerComponent = getHeaderBlock((header as any)?.type) ?? getHeaderBlock('saige-blake-header');
    const footerComponent = getFooterBlock((footer as any)?.type) ?? getFooterBlock('saige-blake-footer');
</script>

<div class="h-full bg-base-100 flex flex-col max-w-8xl mx-auto rounded-3xl shadow-sm" style:background-color={backgroundColor}>
    {#if isWebpage}
        <div bind:this={headerElement} class="flex-none">
            <headerComponent.component {...header} />
        </div> 
    {/if}

    <div class="flex grow overflow-hidden hover:overflow-y-scroll pb-52 mb-8" role="application">
        <div class="w-full px-16">
            <article 
                bind:this={editor} 
                role="application" 
                class="prose lg:prose-lg py-8 text-base-content w-full max-w-none relative space-y-3"
            >
                {#each editorBlocks as block (block.id)}
                    {@const editorBlock = loadEditorBlock(block.type)}
                    {#if editorBlock}
                        <div class="relative">
                            <editorBlock.component {...block} />
                        </div>
                    {/if}
                {/each}
            </article>
            <div class="relative group">
                <div class="absolute -left-14 top-1/2 -translate-y-1/2 opacity-0 z-[1] group-hover:opacity-100 transition-opacity flex flex-row gap-1">
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
                                    <button class="btn btn-ghost" onclick={() => addComponent(component.component)}>
                                        <component.icon class="text-lg" />
                                        <span>{component.name}</span>
                                    </button> 
                                </li>
                            {/each}
                        {/if}
                    </ul>
                </div>
                <details class="dropdown dropdown-bottom w-full group/dropdown relative" bind:this={inlineDropdown}>
                    <summary class="px-0 cursor-text">
                        <input 
                            class="input input-lg w-full mt-0 !border-0 !border-none !outline-none !ring-0 !ring-offset-0 rounded-none focus:!outline-none focus:!ring-0 focus:!ring-offset-0 px-0 placeholder:opacity-30" 
                            style="background: transparent; {backgroundColor === '#ffffff' || !backgroundColor ? 'color: rgba(0,0,0,0.8)' : 'color: rgba(255,255,255,0.8)'}" 
                            bind:value={inlineBlockSearch} 
                            bind:this={inlineBlockSearchInput} 
                            oninput={handleInlineSearch} 
                            placeholder="Type / to browse blocks" 
                            class:placeholder-black={backgroundColor === '#ffffff' || !backgroundColor}
                            class:placeholder-white={backgroundColor !== '#ffffff' && backgroundColor}
                        />
                    </summary>
                    <div tabindex="0" role="menu" class="menu dropdown-content rounded-box w-52 p-3 m-3 shadow z-50 opacity-0 group-hover/dropdown:opacity-100 transition-opacity" style="background-color: {backgroundColor === '#ffffff' || !backgroundColor ? '#f8f8f8' : '#1a1a1a'}; color: {backgroundColor === '#ffffff' || !backgroundColor ? '#000000' : '#ffffff'}">
                        <div class="flex flex-col gap-1 w-full mt-2">
                            {#if inlineFilteredBlocks.length > 0}
                                {#each inlineFilteredBlocks as component, i}
                                    <div class="flex gap-2 w-full">
                                        <button class="btn btn-ghost" onclick={() => addComponent(component.component)}>
                                            <component.icon class="text-lg" />
                                            <span>{component.name}</span>
                                        </button> 
                                    </div>
                                {/each}
                            {/if}
                        </div>
                    </div>
                </details>
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
                    {#each layouts as block}
                        <div class="card card-side bg-base-100 shadow-xl hover:cursor-pointer" role="button" onclick={() => {
                            addComponent(block.component);
                            layoutModal.close();
                        }}>
                            <figure>
                                <img src={block.image} alt={block.name} class="object-contain" />
                            </figure>
                        </div>
                    {/each}
                </div> 
            </div>
        </dialog>
    {/if}

    {#if isWebpage}
        <div bind:this={footerElement} class="flex-none"> 
            <footerComponent.component {...footer} />
        </div>
    {/if}
</div>
