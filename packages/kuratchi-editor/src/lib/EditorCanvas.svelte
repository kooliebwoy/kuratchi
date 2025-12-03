<script lang="ts">
    import { onDestroy, onMount, tick } from "svelte";
    import { blocks, getBlock } from "./registry/blocks.svelte";
    import type { BlockDefinition } from "./registry/blocks.svelte";
    import { getHeader } from "./registry/headers.svelte";
    import { getFooter } from "./registry/footers.svelte";
    import { sections, getSection } from "./registry/sections.svelte";
    import type { SectionDefinition } from "./registry/sections.svelte";
    import { addComponentToEditor, saveEditorBlocks, saveEditorFooterBlocks, saveEditorHeaderBlocks, setupEditorDragAndDrop, setupEditorObserver } from "./utils/editor.svelte";
    import { imageConfig } from './stores/imageConfig';
    import { PanelsTopLeft, Plus } from "@lucide/svelte";
    import type { SiteRegionState } from "./types.js";
import type { ThemeSettings } from "./plugins/context";
import { DEFAULT_THEME_SETTINGS } from "./plugins/context";

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
        themeSettings?: ThemeSettings;
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
        navigation,
        themeSettings = DEFAULT_THEME_SETTINGS
    }: Props = $props();

    
    let inlineBlockSearchInput: HTMLInputElement;
    let inlineBlockSearch = $state('');
    let inlineFilteredItems = $state<Array<BlockDefinition>>([]);
    let inlineDropdown = $state({ open: false });
    // Flag to prevent observer feedback loop during programmatic updates
    let isProgrammaticUpdate = false;
    
    // Only show blocks in the inline search (not sections)
    const allBlocks: Array<BlockDefinition> = blocks.filter((block) => block.showInPalette !== false);

    // Deduplicate content by ID to prevent "each_key_duplicate" errors
    // This handles race conditions where the same block might appear twice
    const deduplicatedContent = $derived.by(() => {
        const seen = new Set<string>();
        return content.filter((block) => {
            const key = block.id as string | undefined;
            if (!key) return true; // Allow blocks without IDs (will use fallback key)
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    });


    const updateEditorData = async () => {
        // Skip if we're in the middle of a programmatic update to prevent feedback loops
        if (isProgrammaticUpdate) return;
        if (!editor) return;
        const blocks = await saveEditorBlocks(editor);
        if (JSON.stringify(blocks) !== JSON.stringify(content)) {
            content = blocks;
            onContentChange?.(blocks);
        }
    }

    const updateHeaderData = async () => {
        console.log('[EditorCanvas] updateHeaderData called');
        if (!headerElement) {
            console.log('[EditorCanvas] updateHeaderData: no headerElement');
            return;
        }
        const blocks = await saveEditorHeaderBlocks(headerElement);
        console.log('[EditorCanvas] updateHeaderData: extracted blocks:', blocks);
        if (JSON.stringify(blocks) !== JSON.stringify(header?.blocks)) {
            const next: SiteRegionState = { blocks: blocks as any };
            console.log('[EditorCanvas] updateHeaderData: blocks changed, calling onHeaderChange with:', next);
            header = next;
            onHeaderChange?.(next);
        } else {
            console.log('[EditorCanvas] updateHeaderData: blocks unchanged, skipping onHeaderChange');
        }
    };

    const updateFooterData = async () => {
        console.log('[EditorCanvas] updateFooterData called');
        if (!footerElement) {
            console.log('[EditorCanvas] updateFooterData: no footerElement');
            return;
        }
        const blocks = await saveEditorFooterBlocks(footerElement);
        console.log('[EditorCanvas] updateFooterData: extracted blocks:', blocks);
        if (JSON.stringify(blocks) !== JSON.stringify(footer?.blocks)) {
            const next: SiteRegionState = { blocks: blocks as any };
            console.log('[EditorCanvas] updateFooterData: blocks changed, calling onFooterChange with:', next);
            footer = next;
            onFooterChange?.(next);
        } else {
            console.log('[EditorCanvas] updateFooterData: blocks unchanged, skipping onFooterChange');
        }
    };

    const addComponent = async (definition: BlockDefinition, initialProps?: Record<string, unknown>) => {
        // Set flag to prevent observer feedback loop
        isProgrammaticUpdate = true;
        
        // Add directly to content array instead of mounting to DOM
        // Generate a stable unique ID for the block to prevent remounting
        const newBlock = {
            id: crypto.randomUUID(),
            type: definition.type,
            ...initialProps
        };
        
        content = [...content, newBlock];
        onContentChange?.(content);
        
        inlineDropdown.open = false;
        inlineBlockSearch = '';
        
        await tick();
        
        // Clear the flag after DOM has settled
        // Use a small delay to ensure MutationObserver callbacks have fired
        setTimeout(() => {
            isProgrammaticUpdate = false;
        }, 100);
        
        inlineBlockSearchInput?.focus();
    }

    const loadEditorBlock = (type: string) => {
        // Only blocks and sections are allowed in the editor
        return getSection(type) || getBlock(type);
    };

    const handleInlineSearch = () => {
        inlineDropdown.open = false;
        const inputText = inlineBlockSearch;

        if (inputText === '' || !inputText.startsWith('/')) {
            inlineBlockSearch = '';
            inlineBlockSearchInput.placeholder = 'Type / to add blocks or sections';
        }

        if (inputText.startsWith('/')) {
            inlineDropdown.open = true;
            const searchTerm = inputText.slice(1).trim().toLowerCase();
            inlineFilteredItems = allBlocks.filter((item) =>
                item.name.toLowerCase().includes(searchTerm)
            );
        }
    }

    let contentUpdateTimeout: ReturnType<typeof setTimeout>;
    let cleanupEditorDragAndDrop: (() => void) | null = null;

interface RegionObserverParams {
    enabled: boolean;
    onUpdate: () => void;
    debounceMs?: number;
}

function regionObserver(node: HTMLElement, params: RegionObserverParams) {
    let teardown = () => {};

    const init = (current: RegionObserverParams) => {
        teardown();
        if (!current?.enabled) {
            teardown = () => {};
            return;
        }

        teardown = setupEditorObserver({
            element: node,
            onUpdate: current.onUpdate,
            debounceMs: current.debounceMs ?? 600
        });
    };

    init(params);

    return {
        update(next: RegionObserverParams) {
            init(next);
        },
        destroy() {
            teardown();
        }
    };
}

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

<div 
    class="krt-editorCanvas" 
    style:background-color={themeSettings.backgroundColor || backgroundColor}
    style:color={themeSettings.textColor}
    style:--krt-theme-max-width={themeSettings.maxWidth === 'full' ? '100%' : themeSettings.maxWidth === 'wide' ? '1440px' : themeSettings.maxWidth === 'medium' ? '1200px' : '960px'}
    style:--krt-theme-section-spacing={themeSettings.sectionSpacing === 'none' ? '0' : themeSettings.sectionSpacing === 'small' ? '1rem' : themeSettings.sectionSpacing === 'large' ? '4rem' : '2rem'}
    style:--krt-theme-bg={themeSettings.backgroundColor}
    style:--krt-theme-primary={themeSettings.primaryColor}
    style:--krt-theme-secondary={themeSettings.secondaryColor}
    style:--krt-theme-text={themeSettings.textColor}
    style:--krt-theme-radius={themeSettings.borderRadius === 'none' ? '0' : themeSettings.borderRadius === 'small' ? '0.25rem' : themeSettings.borderRadius === 'large' ? '1rem' : '0.5rem'}
>
    {#if isWebpage}
        <div
            bind:this={headerElement}
            class="krt-editorCanvas__header"
            use:regionObserver={{ enabled: editable, onUpdate: updateHeaderData }}
        >
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
                use:regionObserver={{ enabled: editable, onUpdate: updateEditorData }}
            >
                {#each deduplicatedContent as block, index (block.id ?? `fallback-${block.type}-${index}`)}
                    {@const editorBlock = loadEditorBlock(block.type as string)}
                    {#if editorBlock}
                        <div class="krt-editorCanvas__block editor-block">
                            <editorBlock.component {...block} editable={editable} />
                        </div>
                    {/if}
                {/each}
            </article>
            <div class="krt-editorCanvas__addBlock">
                <div class="krt-editorCanvas__inlineSearch">
                    <input 
                        class="krt-editorCanvas__inlineInput" 
                        bind:value={inlineBlockSearch} 
                        bind:this={inlineBlockSearchInput} 
                        oninput={handleInlineSearch} 
                        placeholder="Type / to add blocks or sections"
                    />
                    {#if inlineDropdown?.open && inlineFilteredItems.length > 0}
                        <div class="krt-editorCanvas__inlineDropdown" class:krt-editorCanvas__inlineDropdown--top={deduplicatedContent.length === 0}>
                            {#each inlineFilteredItems as item}
                                <button class="krt-editorCanvas__inlineButton" onclick={() => addComponent(item)}>
                                    <item.icon />
                                    <span>{item.name}</span>
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    </div>

    {#if isWebpage}
        <div
            bind:this={footerElement}
            class="krt-editorCanvas__footer"
            use:regionObserver={{ enabled: editable, onUpdate: updateFooterData }}
        > 
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
        display: flex;
        flex-direction: column;
        width: 100%;
        border-radius: 1.5rem;
        box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
        overflow: hidden;
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
        max-width: var(--krt-theme-max-width, 100%);
        margin: 0 auto;
        padding: 0 4rem;
    }

    .krt-editorCanvas__article {
        padding: var(--krt-theme-section-spacing, 2rem) 0;
        color: inherit;
        width: 100%;
        max-width: none;
        position: relative;
        display: flex;
        flex-direction: column;
        gap: var(--krt-theme-section-spacing, 0.75rem);
    }

    .krt-editorCanvas__block {
        position: relative;
    }

    .krt-editorCanvas__addBlock {
        position: relative;
        overflow: visible;
    }

    .krt-editorCanvas__inlineSearch {
        position: relative;
        width: 100%;
        overflow: visible;
    }

    .krt-editorCanvas__inlineInput {
        width: 100%;
        border: 0;
        outline: none;
        background: transparent;
        padding: 0.5rem 0;
        font-size: 1rem;
        font-weight: 500;
        color: var(--krt-editor-text-color, #1f2937);
        caret-color: var(--krt-editor-text-color, #1f2937);
    }

    .krt-editorCanvas__inlineInput::placeholder {
        opacity: 0.4;
        color: var(--krt-editor-text-color, #1f2937);
    }

    .krt-editorCanvas__inlineInput:focus {
        outline: none;
    }

    .krt-editorCanvas__inlineDropdown {
        position: absolute;
        bottom: 100%;
        left: 0;
        margin-bottom: 0.5rem;
        background: white;
        border-radius: 0.5rem;
        width: 14rem;
        max-height: 20rem;
        overflow-y: auto;
        padding: 0.5rem;
        box-shadow: 0 -10px 25px -5px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        z-index: 9999;
        border: 1px solid rgba(0, 0, 0, 0.1);
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    /* When no content, show dropdown below the input instead of above */
    .krt-editorCanvas__inlineDropdown--top {
        bottom: auto;
        top: 100%;
        margin-bottom: 0;
        margin-top: 0.5rem;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
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
</style>
