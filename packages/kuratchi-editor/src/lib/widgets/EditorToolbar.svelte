<script lang="ts">
    import { Undo2, Redo2, Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify } from "@lucide/svelte";

    interface Props {
        component?: HTMLElement;
        show?: boolean;
        position?: { x: number; y: number };
    }

    let { component, show = false, position = { x: 0, y: 0 } }: Props = $props();

    // Format states
    let isBold = $state(false);
    let isItalic = $state(false);
    let isUnderline = $state(false);
    let isStrikethrough = $state(false);

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
        }
    });

    const applyFormat = (command: string) => {
        document.execCommand(command);
        updateFormatStates();
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

    .krt-editorToolbar__button:hover {
        background: rgba(59, 130, 246, 0.1);
        color: rgba(59, 130, 246, 0.9);
    }

    .krt-editorToolbar__button.is-active {
        background: rgba(59, 130, 246, 0.15);
        color: rgba(59, 130, 246, 1);
        border: 1px solid rgba(59, 130, 246, 0.3);
    }

    .krt-editorToolbar__button :global(svg) {
        width: 1rem;
        height: 1rem;
    }

    .krt-editorToolbar__divider {
        width: 1px;
        height: 1.5rem;
        background: rgba(0, 0, 0, 0.1);
        margin: 0 0.25rem;
    }
</style>