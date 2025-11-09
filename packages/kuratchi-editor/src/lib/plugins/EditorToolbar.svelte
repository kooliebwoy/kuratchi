<script lang="ts">
    import { Wand2, ChevronDown, Undo2, Redo2, Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify, MoreHorizontal } from "@lucide/svelte";

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
</script>

{#if show}
<div class="fixed z-[9999] flex flex-row gap-0.5 rounded-lg border border-base-300 bg-base-100 text-base-content p-0.5 shadow-lg" style:top="{position.y}px" style:left="{position.x}px" style:transform="translate(-50%, calc(-100% - 8px))">
    <!-- AI Tools Dropdown -->
    <div>
        <button popovertarget="aiToolsEditorToolbarDropdown" style="anchor-name:--aiToolsEditorToolbarDropdown" class="btn btn-xs btn-ghost hover:bg-transparent gap-0.5 px-1.5">
            <Wand2 class="size-3.5" />
            <span class="text-xs">AI</span>
            <ChevronDown class="size-3" />
        </button>
        <ul popover="" id="aiToolsEditorToolbarDropdown" style="position-anchor:--aiToolsEditorToolbarDropdown" class="dropdown dropdown-hover menu bg-base-100 text-base-content rounded-lg border border-base-300 rounded-box w-32 p-2 shadow">
            <li><a>Item 1</a></li>
            <li><a>Item 2</a></li>
        </ul>
    </div>

    <div class="divider divider-horizontal my-0 mx-0.5 w-px"></div>

    <!-- History Controls -->
    <div class="join join-horizontal">
        <button 
            onclick={() => document.execCommand('undo')} 
            class="btn btn-xs btn-ghost join-item px-1.5"
        >
            <Undo2 class="size-3.5" />
        </button>
        <button 
            onclick={() => document.execCommand('redo')} 
            class="btn btn-xs btn-ghost join-item px-1.5"
        >
            <Redo2 class="size-3.5" />
        </button>
    </div>

    <div class="divider divider-horizontal my-0 mx-0.5 w-px"></div>

    <!-- Text Formatting -->
    <div class="join join-horizontal gap-0.5">
        <button 
            onclick={() => { document.execCommand('bold'); updateFormatStates(); }} 
            class={"btn btn-xs btn-ghost join-item px-1.5 " + (isBold ? "btn-active" : "")}
        >
            <Bold class="size-3.5" />
        </button>
        <button 
            onclick={() => { document.execCommand('italic'); updateFormatStates(); }} 
            class={"btn btn-xs btn-ghost join-item px-1.5 " + (isItalic ? "btn-active" : "")}
        >
            <Italic class="size-3.5" />
        </button>
        <button 
            onclick={() => { document.execCommand('underline'); updateFormatStates(); }} 
            class={"btn btn-xs btn-ghost join-item px-1.5 " + (isUnderline ? "btn-active" : "")}
        >
            <Underline class="size-3.5" />
        </button>
        <button 
            onclick={() => { document.execCommand('strikethrough'); updateFormatStates(); }} 
            class={"btn btn-xs btn-ghost join-item px-1.5 " + (isStrikethrough ? "btn-active" : "")}
        >
            <Strikethrough class="size-3.5" />
        </button>
    </div>

    <div class="divider divider-horizontal my-0 mx-0.5 w-px"></div>

    <!-- Alignment -->
    <div class="join join-horizontal gap-0.5">
        <button 
            onclick={() => document.execCommand('justifyLeft')} 
            class="btn btn-xs btn-ghost join-item px-1.5"
        >
            <AlignLeft class="size-3.5" />
        </button>
        <button 
            onclick={() => document.execCommand('justifyCenter')} 
            class="btn btn-xs btn-ghost join-item px-1.5"
        >
            <AlignCenter class="size-3.5" />
        </button>
        <button 
            onclick={() => document.execCommand('justifyRight')} 
            class="btn btn-xs btn-ghost join-item px-1.5"
        >
            <AlignRight class="size-3.5" />
        </button>
        <button 
            onclick={() => document.execCommand('justifyFull')} 
            class="btn btn-xs btn-ghost join-item px-1.5"
        >
            <AlignJustify class="size-3.5" />
        </button>
    </div>

    <div class="divider divider-horizontal my-0 mx-0.5 w-px"></div>

    <!-- More Options -->
    <div>
        <button popovertarget="moreOptionsDropdown" style="anchor-name:--moreOptionsDropdown" class="btn btn-xs btn-ghost hover:bg-transparent px-1.5">
            <MoreHorizontal class="size-3.5" />
        </button>
        <ul popover="" id="moreOptionsDropdown" style="position-anchor:--moreOptionsDropdown" class="dropdown dropdown-hover dropdown-end menu bg-base-100 text-base-content rounded-lg border border-base-300 rounded-box w-32 p-2 shadow">
            <li><a>Item 1</a></li>
            <li><a>Item 2</a></li>
        </ul>
    </div>        
</div>
{/if}