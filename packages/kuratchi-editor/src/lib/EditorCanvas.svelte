<script lang="ts">
    import { onDestroy, onMount, tick } from "svelte";
    import { blocks, getBlock } from "./registry/blocks.svelte";
    import type { BlockDefinition } from "./registry/blocks.svelte";
    import { getHeader } from "./registry/headers.svelte";
    import { getFooter } from "./registry/footers.svelte";
    import { getSection } from "./registry/sections.svelte";
    import { addComponentToEditor, saveEditorBlocks, saveEditorFooterBlocks, saveEditorHeaderBlocks, setupEditorDragAndDrop } from "./utils/editor.svelte";
    import { imageConfig } from './stores/imageConfig';
    import { PanelsTopLeft, Plus } from "@lucide/svelte";
    import type { SiteRegionState } from "./types.js";

    interface Props {
        editor?: HTMLElement | null;
        headerElement?: HTMLElement | undefined;
        footerElement?: HTMLElement | undefined;
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
        headerElement = $bindable<HTMLElement | undefined>(undefined),
        footerElement = $bindable<HTMLElement | undefined>(undefined),
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


    const updateEditorData = async () => {
        if (!editor) return;
        const blocks = await saveEditorBlocks(editor);
        if (JSON.stringify(blocks) !== JSON.stringify(content)) {
            content = blocks;
            onContentChange?.(blocks);
        }
    }

    const updateHeaderData = async () => {
        if (!headerElement) return;
        const blocks = await saveEditorHeaderBlocks(headerElement);
        if (JSON.stringify(blocks) !== JSON.stringify(header?.blocks)) {
            const next: SiteRegionState = { blocks: blocks as any };
            header = next;
            onHeaderChange?.(next);
        }
    };

    const updateFooterData = async () => {
        if (!footerElement) return;
        const blocks = await saveEditorFooterBlocks(footerElement);
        if (JSON.stringify(blocks) !== JSON.stringify(footer?.blocks)) {
            const next: SiteRegionState = { blocks: blocks as any };
            footer = next;
            onFooterChange?.(next);
        }
    };

    const addComponent = async (definition: BlockDefinition, initialProps?: Record<string, unknown>) => {
        // Add directly to content array instead of mounting to DOM
        const newBlock = {
            type: definition.type,
            ...initialProps
        };
        
        content = [...content, newBlock];
        onContentChange?.(content);
        
        blockSearchTerm = '';
        inlineDropdown.open = false;
        inlineBlockSearch = '';
        await tick();
        inlineBlockSearchInput?.focus();
    }

    const loadEditorBlock = (type: string) => {
        // Only blocks and sections are allowed in the editor
        return getSection(type) || getBlock(type);
    };

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

    let contentUpdateTimeout: ReturnType<typeof setTimeout>;
    let cleanupEditorDragAndDrop: (() => void) | null = null;

    const initEditorDragAndDrop = async () => {
        cleanupEditorDragAndDrop?.();
        if (!editable) return;
        await tick();

        if (!(editor instanceof HTMLElement)) {
            cleanupEditorDragAndDrop = null;
            return;
        }

        cleanupEditorDragAndDrop = setupEditorDragAndDrop({
            editor,
            onReorder: () => {
                clearTimeout(contentUpdateTimeout);
                contentUpdateTimeout = setTimeout(updateEditorData, 300);
            }
        });
    };

    onMount(() => {
        imageConfig.set(editorImageConfig);
        initEditorDragAndDrop();
        
        return () => {
            cleanupEditorDragAndDrop?.();
            clearTimeout(contentUpdateTimeout);
        };
    });

    onDestroy(() => {
        cleanupEditorDragAndDrop?.();
    });

    const headerBlocksState = $derived(header?.blocks ?? []);
    const footerBlocksState = $derived(footer?.blocks ?? []);

    const headerMenuHidden = $derived(
        navigation?.header?.visible === false
    );
    const footerMenuHidden = $derived(
        navigation?.footer?.visible === false
    );
</script>

<div class="krt-editorCanvas" style:background-color={backgroundColor}>
    {#if isWebpage}
        <div bind:this={headerElement} class="krt-editorCanvas__header">
            {#if headerBlocksState.length === 0 && (!headerElement || headerElement.children.length === 0)}
                <div class="krt-editorCanvas__emptyState">Select a header preset to get started</div>
            {/if}
            {#each headerBlocksState as block, index (block.type ? `header-${block.type}-${index}` : `header-${index}`)}
                {@const blockDefinition = getHeader(block.type)}
                {#if blockDefinition}
                    <blockDefinition.component
                        {...block}
                        menu={navigation?.header?.items ?? (block as any)?.menu}
                        useMobileMenuOnDesktop={navigation?.header?.useMobileMenuOnDesktop ?? (block as any)?.useMobileMenuOnDesktop}
                        menuHidden={headerMenuHidden}
                    />
                {/if}
            {/each}
        </div> 
    {/if}

    <div class="krt-editorCanvas__main" role="application">
        <div class="krt-editorCanvas__container">
            <article 
                bind:this={editor} 
                role="application" class="krt-editorCanvas__article"
            >
                {#each content as block, index (block.type ? `editor-${block.type}-${index}` : `editor-${index}`)}
                    {@const editorBlock = loadEditorBlock(block.type)}
                    {#if editorBlock}
                        <div class="krt-editorCanvas__block editor-block">
                            <editorBlock.component {...block} editable={editable} />
                        </div>
                    {/if}
                {/each}
            </article>
            <div class="krt-editorCanvas__addBlock">
                <!-- <div class="krt-editorCanvas__addBlock__buttons">
                    {#if layoutsEnabled}
                        <button class="krt-editorCanvas__iconButton" aria-label="Add section" title="Section presets coming soon">
                            <PanelsTopLeft />
                        </button>
                    {/if}     
                    <button class="krt-editorCanvas__iconButton" popovertarget="searchBlocksPopover" style="anchor-name:--searchBlocksPopover" aria-label="Add block">
                        <Plus />
                    </button>
                    <ul popover="auto" id="searchBlocksPopover" style="position-anchor:--searchBlocksPopover" class="krt-editorCanvas__blockMenu">
                        <li>
                            <label class="krt-editorCanvas__searchLabel">
                                <input type="text" class="krt-editorCanvas__searchInput" placeholder="Search" bind:value={blockSearchTerm} />
                            </label>
                        </li>
                        {#if filteredBlocks.length > 0}
                            {#each filteredBlocks as component}
                                <li>
                                    <button class="krt-editorCanvas__menuButton" onclick={() => addComponent(component)}>
                                        <component.icon />
                                        <span>{component.name}</span>
                                    </button> 
                                </li>
                            {/each}
                        {/if}
                    </ul>
                </div> -->
                <div class="krt-editorCanvas__inlineSearch">
                    <input 
                        class="krt-editorCanvas__inlineInput" 
                        style="{backgroundColor === '#ffffff' || !backgroundColor ? 'color: rgba(0,0,0,0.8)' : 'color: rgba(255,255,255,0.8)'}" 
                        bind:value={inlineBlockSearch} 
                        bind:this={inlineBlockSearchInput} 
                        oninput={handleInlineSearch} 
                        placeholder="Type / to browse blocks"
                    />
                    {#if inlineDropdown?.open && inlineFilteredBlocks.length > 0}
                        <div class="krt-editorCanvas__inlineDropdown">
                            {#each inlineFilteredBlocks as component}
                                <button class="krt-editorCanvas__inlineButton" onclick={() => addComponent(component)}>
                                    <component.icon />
                                    <span>{component.name}</span>
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    </div>

    

    {#if isWebpage}
        <div bind:this={footerElement} class="krt-editorCanvas__footer"> 
            {#if footerBlocksState.length === 0 && (!footerElement || footerElement.children.length === 0)}
                <div class="krt-editorCanvas__emptyState krt-editorCanvas__emptyState--footer">Select a footer preset to get started</div>
            {/if}
            {#each footerBlocksState as block, index (block.type ? `footer-${block.type}-${index}` : `footer-${index}`)}
                {@const blockDefinition = getFooter(block.type)}
                {#if blockDefinition}
                    <blockDefinition.component
                        {...block}
                        menu={navigation?.footer?.items ?? (block as any)?.menu}
                        menuHidden={footerMenuHidden}
                    />
                {/if}
            {/each}
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

    :global(.editor-item) {
        transition: border-color 150ms ease, box-shadow 150ms ease;
        border: 2px solid transparent;
        border-radius: 0.75rem;
    }

    :global(.editor-item:hover),
    :global(.editor-item:focus-within) {
        border-color: rgba(99, 102, 241, 0.3);
        box-shadow: inset 0 0 0 1px rgba(99, 102, 241, 0.2), 0 0 0 3px rgba(99, 102, 241, 0.1);
    }

    .krt-editorCanvas {
        height: 100%;
        background: #f5f5f5;
        display: flex;
        flex-direction: column;
        max-width: 96rem;
        margin: 0 auto;
        border-radius: 1.5rem;
        box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
    }

    .krt-editorCanvas__header,
    .krt-editorCanvas__footer {
        flex: none;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .krt-editorCanvas__emptyState {
        text-align: center;
        font-size: 0.875rem;
        color: rgba(0, 0, 0, 0.6);
        padding: 1rem 0;
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    }

    .krt-editorCanvas__emptyState--footer {
        border-top: 1px solid rgba(0, 0, 0, 0.1);
        border-bottom: none;
    }

    .krt-editorCanvas__main {
        display: flex;
        flex: 1 1 0%;
        overflow: hidden;
        padding-bottom: 13rem;
        margin-bottom: 2rem;
    }

    .krt-editorCanvas__main:hover {
        overflow-y: scroll;
    }

    .krt-editorCanvas__container {
        width: 100%;
        padding: 0 4rem;
    }

    .krt-editorCanvas__article {
        padding: 2rem 0;
        color: inherit;
        width: 100%;
        max-width: none;
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .krt-editorCanvas__block {
        position: relative;
    }

    .krt-editorCanvas__addBlock {
        position: relative;
    }

    .krt-editorCanvas__addBlock:hover .krt-editorCanvas__addBlock__buttons {
        opacity: 1;
    }

    .krt-editorCanvas__addBlock__buttons {
        position: absolute;
        left: -3.5rem;
        top: 50%;
        transform: translateY(-50%);
        opacity: 0;
        transition: opacity 150ms ease;
        display: flex;
        flex-direction: row;
        gap: 0.25rem;
        z-index: 10;
    }

    .krt-editorCanvas__iconButton {
        width: 1.75rem;
        height: 1.75rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 0.375rem;
        border: 1px solid rgba(0, 0, 0, 0.2);
        background: white;
        cursor: pointer;
        transition: all 150ms ease;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
    }

    .krt-editorCanvas__iconButton:is(:hover, :focus-visible) {
        background: rgba(0, 0, 0, 0.05);
        border-color: rgba(0, 0, 0, 0.3);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12);
        transform: translateY(-2px);
    }

    .krt-editorCanvas__iconButton :global(svg) {
        width: 1rem;
        height: 1rem;
    }

    .krt-editorCanvas__blockMenu {
        list-style: none;
        padding: 0.5rem;
        margin: 0;
        display: none;
        background: rgba(0, 0, 0, 0.05);
        border-radius: 0.5rem;
        min-width: 12.5rem;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }

    .krt-editorCanvas__blockMenu:popover-open {
        display: flex;
        flex-direction: column;
    }

    .krt-editorCanvas__searchLabel {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 11rem;
        height: 2rem;
        border-radius: 0.375rem;
        border: 1px solid rgba(0, 0, 0, 0.2);
        padding: 0 0.5rem;
        background: white;
    }

    .krt-editorCanvas__searchInput {
        border: none;
        outline: none;
        background: transparent;
        width: 100%;
        font-size: 0.75rem;
    }

    .krt-editorCanvas__menuButton {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        padding: 0.5rem;
        background: transparent;
        border: none;
        border-radius: 0.375rem;
        cursor: pointer;
        transition: background 150ms ease;
        text-align: left;
    }

    .krt-editorCanvas__menuButton:hover {
        background: rgba(0, 0, 0, 0.05);
    }

    .krt-editorCanvas__menuButton :global(svg) {
        width: 1.125rem;
        height: 1.125rem;
    }

    .krt-editorCanvas__inlineSearch {
        position: relative;
        width: 100%;
    }

    .krt-editorCanvas__inlineInput {
        width: 100%;
        border: 0;
        outline: none;
        background: transparent;
        padding: 0.5rem 0;
        font-size: 1rem;
        font-weight: 500;
    }

    .krt-editorCanvas__inlineInput::placeholder {
        opacity: 0.4;
    }

    .krt-editorCanvas__inlineInput:focus {
        outline: none;
    }

    .krt-editorCanvas__inlineDropdown {
        position: absolute;
        top: 100%;
        left: 0;
        margin-top: 0.75rem;
        background: white;
        border-radius: 0.5rem;
        width: 14rem;
        padding: 0.5rem;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15);
        z-index: 50;
        border: 1px solid rgba(0, 0, 0, 0.1);
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .krt-editorCanvas__inlineButton {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.6rem;
        background: transparent;
        border: none;
        border-radius: 0.375rem;
        cursor: pointer;
        transition: all 160ms ease;
        text-align: left;
        width: 100%;
        font-size: 0.9rem;
        color: rgba(0, 0, 0, 0.8);
        font-family: inherit;
    }

    .krt-editorCanvas__inlineButton:is(:hover, :focus-visible) {
        background: rgba(99, 102, 241, 0.08);
        color: rgba(0, 0, 0, 0.95);
    }

    .krt-editorCanvas__inlineButton :global(svg) {
        width: 1.125rem;
        height: 1.125rem;
        flex-shrink: 0;
    }

    .krt-editorCanvas__modal {
        border: none;
        padding: 0;
        background: transparent;
        max-width: 100vw;
        max-height: 100vh;
    }

    .krt-editorCanvas__modal::backdrop {
        background: rgba(0, 0, 0, 0.5);
    }

    .krt-editorCanvas__modalBox {
        width: 91.666667%;
        max-width: 64rem;
        background: white;
        border-radius: 0.5rem;
        padding: 1.5rem;
        position: relative;
    }

    .krt-editorCanvas__closeButton {
        position: absolute;
        right: 0.5rem;
        top: 0.5rem;
        width: 2rem;
        height: 2rem;
        border-radius: 50%;
        border: none;
        background: transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 150ms ease;
    }

    .krt-editorCanvas__closeButton:hover {
        background: rgba(0, 0, 0, 0.05);
    }

    .krt-editorCanvas__modalTitle {
        font-size: 1.5rem;
        font-weight: bold;
        margin-bottom: 1rem;
    }

    .krt-editorCanvas__layoutGrid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
        width: 100%;
        overflow-y: scroll;
        max-height: 60vh;
    }

    .krt-editorCanvas__layoutCard {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        background: white;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        text-align: left;
        padding: 0.75rem;
        border-radius: 0.5rem;
        cursor: pointer;
        border: 2px solid transparent;
        transition: all 150ms ease;
    }

    .krt-editorCanvas__layoutCard:hover {
        border-color: #6366f1;
    }

    .krt-editorCanvas__layoutName {
        width: 100%;
        font-size: 0.875rem;
        font-weight: 600;
    }

    .krt-editorCanvas__modalBackdrop {
        position: fixed;
        inset: 0;
        background: transparent;
    }

    .krt-editorCanvas__modalBackdrop button {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border: none;
        background: transparent;
        cursor: default;
        color: transparent;
    }
</style>
