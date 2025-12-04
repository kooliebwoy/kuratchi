<script lang="ts">
    import { Undo2, Redo2, Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify, ChevronUp, ChevronDown, Type, Trash2 } from "@lucide/svelte";
    import { BLOCK_SPACING_OPTIONS, type BlockSpacing } from "../utils/block-spacing.js";
    import { deleteElement } from "../utils/editor.svelte.js";
    import type { Snippet } from "svelte";

    interface BlockContext {
        type: 'heading' | 'paragraph' | 'list' | 'checklist' | 'generic';
        // Block element reference for deletion
        blockElement?: HTMLElement;
        // Heading specific
        headingSize?: string;
        onHeadingSizeChange?: (size: string) => void;
        // Font size (for paragraph)
        fontSize?: string;
        onFontSizeChange?: (size: string) => void;
        // Spacing controls
        spacingTop?: BlockSpacing;
        spacingBottom?: BlockSpacing;
        onSpacingTopChange?: (spacing: BlockSpacing) => void;
        onSpacingBottomChange?: (spacing: BlockSpacing) => void;
    }

    interface Props {
        component?: HTMLElement;
        show?: boolean;
        position?: { x: number; y: number };
        blockContext?: BlockContext;
    }

    let { component, show = false, position = { x: 0, y: 0 }, blockContext }: Props = $props();

    // Format states
    let isBold = $state(false);
    let isItalic = $state(false);
    let isUnderline = $state(false);
    let isStrikethrough = $state(false);

    // Dropdown states
    let showHeadingDropdown = $state(false);
    let showFontSizeDropdown = $state(false);
    let showSpacingDropdown = $state(false);

    function updateFormatStates() {
        isBold = document.queryCommandState('bold');
        isItalic = document.queryCommandState('italic');
        isUnderline = document.queryCommandState('underline');
        isStrikethrough = document.queryCommandState('strikethrough');
    }

    // Update format states when toolbar is shown
    $effect(() => {
        if (show) {
            updateFormatStates();
            // Close dropdowns when toolbar reopens
            showHeadingDropdown = false;
            showFontSizeDropdown = false;
            showSpacingDropdown = false;
        }
    });

    const applyFormat = (command: string) => {
        document.execCommand(command);
        updateFormatStates();
    }

    // Heading sizes
    const headingSizes = [
        { value: 'h1', label: 'H1', description: 'Large title' },
        { value: 'h2', label: 'H2', description: 'Section heading' },
        { value: 'h3', label: 'H3', description: 'Subsection' },
        { value: 'h4', label: 'H4', description: 'Small heading' },
        { value: 'h5', label: 'H5', description: 'Minor heading' },
        { value: 'h6', label: 'H6', description: 'Smallest heading' },
    ];

    // Font sizes for paragraph
    const fontSizes = [
        { value: '0.875rem', label: 'Small' },
        { value: '1rem', label: 'Normal' },
        { value: '1.125rem', label: 'Large' },
        { value: '1.25rem', label: 'X-Large' },
    ];

    function cycleSpacing(current: BlockSpacing, direction: 'up' | 'down'): BlockSpacing {
        const currentIndex = BLOCK_SPACING_OPTIONS.findIndex(opt => opt.value === current);
        if (direction === 'up') {
            const nextIndex = Math.min(currentIndex + 1, BLOCK_SPACING_OPTIONS.length - 1);
            return BLOCK_SPACING_OPTIONS[nextIndex].value;
        } else {
            const prevIndex = Math.max(currentIndex - 1, 0);
            return BLOCK_SPACING_OPTIONS[prevIndex].value;
        }
    }

    function getSpacingLabel(spacing: BlockSpacing): string {
        return BLOCK_SPACING_OPTIONS.find(opt => opt.value === spacing)?.label ?? 'Normal';
    }

    function handleDelete() {
        if (blockContext?.blockElement) {
            deleteElement(blockContext.blockElement);
        }
    }
</script>

{#if show}
<div class="krt-editorToolbar" style:top="{position.y}px" style:left="{position.x}px">
    <!-- History Controls -->
    <div class="krt-editorToolbar__group">
        <button 
            type="button"
            class="krt-editorToolbar__button"
            onclick={() => applyFormat('undo')}
            title="Undo (Ctrl+Z)"
        >
            <Undo2 />
        </button>
        <button 
            type="button"
            class="krt-editorToolbar__button"
            onclick={() => applyFormat('redo')}
            title="Redo (Ctrl+Y)"
        >
            <Redo2 />
        </button>
    </div>

    <div class="krt-editorToolbar__divider"></div>

    <!-- Block-specific: Heading Size -->
    {#if blockContext?.type === 'heading' && blockContext.onHeadingSizeChange}
        <div class="krt-editorToolbar__group krt-editorToolbar__dropdown-container">
            <button 
                type="button"
                class="krt-editorToolbar__button krt-editorToolbar__button--wide"
                onclick={() => showHeadingDropdown = !showHeadingDropdown}
                title="Heading size"
            >
                <span class="krt-editorToolbar__buttonLabel">{blockContext.headingSize?.toUpperCase() ?? 'H2'}</span>
                <ChevronDown class="krt-editorToolbar__chevron" />
            </button>
            {#if showHeadingDropdown}
                <div class="krt-editorToolbar__dropdown">
                    {#each headingSizes as hs}
                        <button 
                            type="button"
                            class="krt-editorToolbar__dropdown-item {blockContext.headingSize === hs.value ? 'is-active' : ''}"
                            onclick={() => {
                                blockContext.onHeadingSizeChange?.(hs.value);
                                showHeadingDropdown = false;
                            }}
                        >
                            <span class="krt-editorToolbar__dropdown-label">{hs.label}</span>
                            <span class="krt-editorToolbar__dropdown-desc">{hs.description}</span>
                        </button>
                    {/each}
                </div>
            {/if}
        </div>
        <div class="krt-editorToolbar__divider"></div>
    {/if}

    <!-- Block-specific: Font Size (for paragraph) -->
    {#if blockContext?.type === 'paragraph' && blockContext.onFontSizeChange}
        <div class="krt-editorToolbar__group krt-editorToolbar__dropdown-container">
            <button 
                type="button"
                class="krt-editorToolbar__button krt-editorToolbar__button--wide"
                onclick={() => showFontSizeDropdown = !showFontSizeDropdown}
                title="Font size"
            >
                <Type class="krt-editorToolbar__icon-sm" />
                <ChevronDown class="krt-editorToolbar__chevron" />
            </button>
            {#if showFontSizeDropdown}
                <div class="krt-editorToolbar__dropdown">
                    {#each fontSizes as fs}
                        <button 
                            type="button"
                            class="krt-editorToolbar__dropdown-item {blockContext.fontSize === fs.value ? 'is-active' : ''}"
                            onclick={() => {
                                blockContext.onFontSizeChange?.(fs.value);
                                showFontSizeDropdown = false;
                            }}
                        >
                            <span class="krt-editorToolbar__dropdown-label">{fs.label}</span>
                        </button>
                    {/each}
                </div>
            {/if}
        </div>
        <div class="krt-editorToolbar__divider"></div>
    {/if}

    <!-- Text Formatting -->
    <div class="krt-editorToolbar__group">
        <button 
            type="button"
            class="krt-editorToolbar__button {isBold ? 'is-active' : ''}"
            onclick={() => applyFormat('bold')}
            title="Bold (Ctrl+B)"
        >
            <Bold />
        </button>
        <button 
            type="button"
            class="krt-editorToolbar__button {isItalic ? 'is-active' : ''}"
            onclick={() => applyFormat('italic')}
            title="Italic (Ctrl+I)"
        >
            <Italic />
        </button>
        <button 
            type="button"
            class="krt-editorToolbar__button {isUnderline ? 'is-active' : ''}"
            onclick={() => applyFormat('underline')}
            title="Underline (Ctrl+U)"
        >
            <Underline />
        </button>
        <button 
            type="button"
            class="krt-editorToolbar__button {isStrikethrough ? 'is-active' : ''}"
            onclick={() => applyFormat('strikethrough')}
            title="Strikethrough"
        >
            <Strikethrough />
        </button>
    </div>

    <div class="krt-editorToolbar__divider"></div>

    <!-- Alignment -->
    <div class="krt-editorToolbar__group">
        <button 
            type="button"
            class="krt-editorToolbar__button"
            onclick={() => applyFormat('justifyLeft')}
            title="Align Left"
        >
            <AlignLeft />
        </button>
        <button 
            type="button"
            class="krt-editorToolbar__button"
            onclick={() => applyFormat('justifyCenter')}
            title="Align Center"
        >
            <AlignCenter />
        </button>
        <button 
            type="button"
            class="krt-editorToolbar__button"
            onclick={() => applyFormat('justifyRight')}
            title="Align Right"
        >
            <AlignRight />
        </button>
        <button 
            type="button"
            class="krt-editorToolbar__button"
            onclick={() => applyFormat('justifyFull')}
            title="Justify"
        >
            <AlignJustify />
        </button>
    </div>

    <!-- Delete Block -->
    {#if blockContext?.blockElement}
        <div class="krt-editorToolbar__divider"></div>
        <div class="krt-editorToolbar__group">
            <button 
                type="button"
                class="krt-editorToolbar__button krt-editorToolbar__button--danger"
                onclick={handleDelete}
                title="Delete block"
            >
                <Trash2 />
            </button>
        </div>
    {/if}

    <!-- Spacing Controls -->
    {#if blockContext?.onSpacingTopChange || blockContext?.onSpacingBottomChange}
        <div class="krt-editorToolbar__divider"></div>
        <div class="krt-editorToolbar__group krt-editorToolbar__dropdown-container">
            <button 
                type="button"
                class="krt-editorToolbar__button krt-editorToolbar__button--wide"
                onclick={() => showSpacingDropdown = !showSpacingDropdown}
                title="Block spacing"
            >
                <span class="krt-editorToolbar__buttonLabel krt-editorToolbar__buttonLabel--spacing">↕</span>
                <ChevronDown class="krt-editorToolbar__chevron" />
            </button>
            {#if showSpacingDropdown}
                <div class="krt-editorToolbar__dropdown krt-editorToolbar__dropdown--spacing">
                    {#if blockContext.onSpacingTopChange}
                        <div class="krt-editorToolbar__spacing-row">
                            <span class="krt-editorToolbar__spacing-label">Top</span>
                            <div class="krt-editorToolbar__spacing-controls">
                                <button
                                    type="button"
                                    class="krt-editorToolbar__spacing-btn"
                                    onclick={() => blockContext.onSpacingTopChange?.(cycleSpacing(blockContext.spacingTop ?? 'normal', 'down'))}
                                >
                                    <ChevronDown />
                                </button>
                                <span class="krt-editorToolbar__spacing-value">{getSpacingLabel(blockContext.spacingTop ?? 'normal')}</span>
                                <button
                                    type="button"
                                    class="krt-editorToolbar__spacing-btn"
                                    onclick={() => blockContext.onSpacingTopChange?.(cycleSpacing(blockContext.spacingTop ?? 'normal', 'up'))}
                                >
                                    <ChevronUp />
                                </button>
                            </div>
                        </div>
                    {/if}
                    {#if blockContext.onSpacingBottomChange}
                        <div class="krt-editorToolbar__spacing-row">
                            <span class="krt-editorToolbar__spacing-label">Bottom</span>
                            <div class="krt-editorToolbar__spacing-controls">
                                <button
                                    type="button"
                                    class="krt-editorToolbar__spacing-btn"
                                    onclick={() => blockContext.onSpacingBottomChange?.(cycleSpacing(blockContext.spacingBottom ?? 'normal', 'down'))}
                                >
                                    <ChevronDown />
                                </button>
                                <span class="krt-editorToolbar__spacing-value">{getSpacingLabel(blockContext.spacingBottom ?? 'normal')}</span>
                                <button
                                    type="button"
                                    class="krt-editorToolbar__spacing-btn"
                                    onclick={() => blockContext.onSpacingBottomChange?.(cycleSpacing(blockContext.spacingBottom ?? 'normal', 'up'))}
                                >
                                    <ChevronUp />
                                </button>
                            </div>
                        </div>
                    {/if}
                </div>
            {/if}
        </div>
    {/if}
</div>
{/if}

<style>
    .krt-editorToolbar {
        position: fixed;
        z-index: 9999;
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 0;
        padding: 0.5rem;
        border-radius: 0.5rem;
        border: 1px solid rgba(0, 0, 0, 0.12);
        background: #ffffff;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1);
        transform: translate(-50%, calc(-100% - 0.75rem));
        animation: slideUp 200ms ease;
    }

    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translate(-50%, calc(-100% - 0.5rem));
        }
        to {
            opacity: 1;
            transform: translate(-50%, calc(-100% - 0.75rem));
        }
    }

    .krt-editorToolbar__group {
        display: flex;
        flex-direction: row;
        gap: 0;
    }

    .krt-editorToolbar__button {
        width: 2rem;
        height: 2rem;
        border: none;
        background: transparent;
        color: rgba(0, 0, 0, 0.6);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 150ms ease;
        border-radius: 0.375rem;
    }

    .krt-editorToolbar__button--wide {
        width: auto;
        padding: 0 0.5rem;
        gap: 0.25rem;
    }

    .krt-editorToolbar__button:hover {
        background: rgba(59, 130, 246, 0.1);
        color: rgba(59, 130, 246, 0.9);
    }

    .krt-editorToolbar__button.is-active {
        background: rgba(59, 130, 246, 0.15);
        color: rgba(59, 130, 246, 1);
        border: 1px solid rgba(59, 130, 246, 0.3);
    }

    .krt-editorToolbar__button--danger {
        color: rgba(239, 68, 68, 0.7);
    }

    .krt-editorToolbar__button--danger:hover {
        background: rgba(239, 68, 68, 0.1);
        color: rgba(220, 38, 38, 1);
    }

    .krt-editorToolbar__button :global(svg) {
        width: 1rem;
        height: 1rem;
    }

    .krt-editorToolbar__buttonLabel {
        font-size: 0.75rem;
        font-weight: 600;
    }

    .krt-editorToolbar__buttonLabel--spacing {
        font-size: 0.875rem;
    }

    .krt-editorToolbar__button--wide :global(.krt-editorToolbar__chevron),
    :global(.krt-editorToolbar__chevron) {
        width: 0.75rem !important;
        height: 0.75rem !important;
        opacity: 0.5;
    }

    .krt-editorToolbar__button--wide :global(.krt-editorToolbar__icon-sm),
    :global(.krt-editorToolbar__icon-sm) {
        width: 0.875rem !important;
        height: 0.875rem !important;
    }

    .krt-editorToolbar__divider {
        width: 1px;
        height: 1.5rem;
        background: rgba(0, 0, 0, 0.1);
        margin: 0 0.25rem;
    }

    /* Dropdown */
    .krt-editorToolbar__dropdown-container {
        position: relative;
    }

    .krt-editorToolbar__dropdown {
        position: absolute;
        top: calc(100% + 0.5rem);
        left: 50%;
        transform: translateX(-50%);
        min-width: 140px;
        background: #ffffff;
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 0.5rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        padding: 0.25rem;
        z-index: 10;
    }

    .krt-editorToolbar__dropdown--spacing {
        min-width: 180px;
        padding: 0.5rem;
    }

    .krt-editorToolbar__dropdown-item {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        width: 100%;
        padding: 0.5rem 0.75rem;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: 0.375rem;
        transition: background 150ms ease;
    }

    .krt-editorToolbar__dropdown-item:hover {
        background: rgba(59, 130, 246, 0.1);
    }

    .krt-editorToolbar__dropdown-item.is-active {
        background: rgba(59, 130, 246, 0.15);
    }

    .krt-editorToolbar__dropdown-label {
        font-size: 0.875rem;
        font-weight: 600;
        color: rgba(0, 0, 0, 0.8);
    }

    .krt-editorToolbar__dropdown-desc {
        font-size: 0.7rem;
        color: rgba(0, 0, 0, 0.5);
    }

    /* Spacing controls in dropdown */
    .krt-editorToolbar__spacing-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.375rem 0;
    }

    .krt-editorToolbar__spacing-row + .krt-editorToolbar__spacing-row {
        border-top: 1px solid rgba(0, 0, 0, 0.08);
        margin-top: 0.25rem;
        padding-top: 0.5rem;
    }

    .krt-editorToolbar__spacing-label {
        font-size: 0.75rem;
        font-weight: 500;
        color: rgba(0, 0, 0, 0.6);
    }

    .krt-editorToolbar__spacing-controls {
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }

    .krt-editorToolbar__spacing-btn {
        width: 1.5rem;
        height: 1.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(0, 0, 0, 0.1);
        background: #fff;
        border-radius: 0.25rem;
        cursor: pointer;
        transition: all 150ms ease;
    }

    .krt-editorToolbar__spacing-btn:hover {
        background: rgba(59, 130, 246, 0.1);
        border-color: rgba(59, 130, 246, 0.3);
    }

    .krt-editorToolbar__spacing-btn :global(svg) {
        width: 0.75rem;
        height: 0.75rem;
        color: rgba(0, 0, 0, 0.5);
    }

    .krt-editorToolbar__spacing-value {
        font-size: 0.7rem;
        font-weight: 500;
        min-width: 3.5rem;
        text-align: center;
        color: rgba(0, 0, 0, 0.7);
    }
</style>