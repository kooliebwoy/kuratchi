<script lang="ts">
    import { onMount } from "svelte";
    import { blocks, getBlock } from "./registry/blocks.svelte";
    import { layouts, getLayout } from "./registry/layouts.svelte";
    import { addComponentToEditor, saveEditorBlocks, saveEditorFooterBlocks, saveEditorHeaderBlocks } from "./utils/editor.svelte";
    import { getFooterBlock } from "./registry/footerBlocks.svelte";
    import { getHeaderBlock } from "./registry/headerBlocks.svelte";
    import type { EditorOptions } from "./types.js";
    import { defaultEditorOptions } from "./types.js";
    import Sortable from "sortablejs";
    import { imageConfig } from './stores/imageConfig';
    import { PanelsTopLeft, Plus } from "@lucide/svelte";

    type Props = EditorOptions;

    let { 
        editor = $bindable(defaultEditorOptions.editor),
        editorData = $bindable(defaultEditorOptions.editorData),
        editable = defaultEditorOptions.editable,
        isWebpage = defaultEditorOptions.isWebpage,
        backgroundColor = $bindable(defaultEditorOptions.backgroundColor),
        headerBlock = $bindable(defaultEditorOptions.headerBlock),
        footerBlock = $bindable(defaultEditorOptions.footerBlock),
        layoutsEnabled = defaultEditorOptions.layoutsEnabled,
        imageConfig: editorImageConfig = defaultEditorOptions.imageConfig
    }: Props = $props();
    
    let editorBlocks = $state(editorData); // Local state for editor blocks

    // let searchBlocks: HTMLDetailsElement;
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
        // Update editorData only if blocks have changed
        if (JSON.stringify(blocks) !== JSON.stringify(editorData)) {
            editorData = blocks;
        }
        console.log('Editor data updated:', editorData);
    }

    const updateHeaderData = async () => {
        const blocks = await saveEditorHeaderBlocks(header);

        // Update editorData only if blocks have changed
        if (JSON.stringify(blocks) !== JSON.stringify(headerBlock)) {
            headerBlock = blocks;
        }
    }

    const updateFooterData = async () => {
        const blocks = await saveEditorFooterBlocks(footer);
        // Update editorData only if blocks have changed
        if (JSON.stringify(blocks) !== JSON.stringify(footerBlock)) {
            footerBlock = blocks;
        }
    }

    const addComponent = (component: any) => {
        addComponentToEditor(editor, component);
        // searchBlocks.open = false;
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

    let header: HTMLElement;
    let footer: HTMLElement;
    let headerUpdateTimeout: number;
    let footerUpdateTimeout: number;

    onMount(() => {
        imageConfig.set(editorImageConfig);
        new Sortable(editor, {
            handle: '.handle', // handle's class
            animation: 150
        });

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

        // Add content change observers for header and footer
        if (header) {
            const headerObserver = new MutationObserver((mutations) => {
                // Debounce the update to avoid too frequent saves
                clearTimeout(headerUpdateTimeout);
                headerUpdateTimeout = setTimeout(updateHeaderData, 500);
            });
            
            headerObserver.observe(header, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true
            });
        }
        
        if (footer) {
            const footerObserver = new MutationObserver((mutations) => {
                // Debounce the update to avoid too frequent saves
                clearTimeout(footerUpdateTimeout);
                footerUpdateTimeout = setTimeout(updateFooterData, 500);
            });
            
            footerObserver.observe(footer, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true
            });
        }
        
        return () => {
            clearTimeout(headerUpdateTimeout);
            clearTimeout(footerUpdateTimeout);
        };
    });

    let layoutModal: HTMLDialogElement;

    const headerComponent = getHeaderBlock(headerBlock?.type) ?? getHeaderBlock('saige-blake-header'); // Default to SaigeBlakeHeader
    const footerComponent = getFooterBlock(footerBlock?.type) ?? getFooterBlock('saige-blake-footer'); // Default to SaigeBlakeFooter
</script>

<div class="h-full bg-base-100 flex flex-col max-w-8xl mx-auto rounded-3xl shadow-sm" style:background-color={backgroundColor}>
    {#if isWebpage}
        <!-- Header Nav Top Bar -->
        <div bind:this={header} class="flex-none">
            <headerComponent.component {...headerBlock} />
        </div> 
    {/if}

    <!-- Editor -->
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
            <!-- Bottom inline dropdown and actions -->
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
        <!-- Footer -->
        <div bind:this={footer} class="flex-none"> 
            <footerComponent.component {...footerBlock} />
        </div>
    {/if}
</div>
