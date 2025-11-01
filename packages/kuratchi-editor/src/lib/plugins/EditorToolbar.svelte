<script lang="ts">
    import { Wand2, ChevronDown, Undo2, Redo2, Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify, MoreHorizontal } from "@lucide/svelte";

    interface Props {
        editor?: any;
    }

    let { editor }: Props = $props();

    // Format states
    let isBold = $state(false);
    let isItalic = $state(false);
    let isUnderline = $state(false);
    let isStrikethrough = $state(false);
    let canUndo = $state(false);
    let canRedo = $state(false);

    let showToolbar = $state(false);
</script>

{#if showToolbar}
<div class="absolute z-50 flex flex-row gap-1.5 rounded-lg border border-white/50 bg-black p-1">
    <!-- AI Tools Dropdown -->
    <div>
        <button popovertarget="aiToolsEditorToolbarDropdown" style="anchor-name:--aiToolsEditorToolbarDropdown" class="btn btn-sm btn-ghost hover:bg-transparent">
            <Wand2 class="text-lg" />
            AI
            <ChevronDown class="text-lg" />
        </button>
        <ul popover="" id="aiToolsEditorToolbarDropdown" style="position-anchor:--aiToolsEditorToolbarDropdown" class="dropdown dropdown-hover menu !bg-black rounded-lg border border-white/50 rounded-box w-32 p-2 shadow">
            <li><a>Item 1</a></li>
            <li><a>Item 2</a></li>
        </ul>
    </div>

    <div class="divider divider-horizontal my-0.5 mx-0.5"></div>

    <!-- History Controls -->
    <div class="join join-horizontal">
        <button 
            onclick={() => editor?.dispatchCommand(UNDO_COMMAND)} 
            class="btn btn-xs btn-ghost join-item px-1"
            disabled={!canUndo}
        >
            <Undo2 class="text-lg" />
        </button>
        <button 
            onclick={() => editor?.dispatchCommand(REDO_COMMAND)} 
            class="btn btn-xs btn-ghost join-item px-1"
            disabled={!canRedo}
        >
            <Redo2 class="text-lg" />
        </button>
    </div>

    <div class="divider divider-horizontal my-0.5 mx-0.5"></div>

    <!-- Text Formatting -->
    <div class="join join-horizontal p-1 gap-1.5">
        <button 
            onclick={() => editor?.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')} 
            class={"btn btn-xs btn-ghost join-item px-1 " + (isBold ? "btn-active" : "")}
        >
            <Bold class="text-lg" />
        </button>
        <button 
            onclick={() => editor?.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')} 
            class={"btn btn-xs btn-ghost join-item px-1 " + (isItalic ? "btn-active" : "")}
        >
            <Italic class="text-lg" />
        </button>
        <button 
            onclick={() => editor?.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')} 
            class={"btn btn-xs btn-ghost join-item px-1 " + (isUnderline ? "btn-active" : "")}
        >
            <Underline class="text-lg" />
        </button>
        <button 
            onclick={() => editor?.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')} 
            class={"btn btn-xs btn-ghost join-item px-1 " + (isStrikethrough ? "btn-active" : "")}
        >
            <Strikethrough class="text-lg" />
        </button>
    </div>

    <div class="divider divider-horizontal my-0.5 mx-0.5"></div>

    <!-- Alignment -->
    <div class="join join-horizontal">
        <button 
            onclick={() => editor?.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left')} 
            class="btn btn-xs btn-ghost join-item px-1"
        >
            <AlignLeft class="text-lg" />
        </button>
        <button 
            onclick={() => editor?.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center')} 
            class="btn btn-xs btn-ghost join-item px-1"
        >
            <AlignCenter class="text-lg" />
        </button>
        <button 
            onclick={() => editor?.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right')} 
            class="btn btn-xs btn-ghost join-item px-1"
        >
            <AlignRight class="text-lg" />
        </button>
        <button 
            onclick={() => editor?.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'justify')} 
            class="btn btn-xs btn-ghost join-item px-1"
        >
            <AlignJustify class="text-lg" />
        </button>
    </div>

    <div class="divider divider-horizontal my-0.5 mx-0.5"></div>

    <!-- More Options -->
    <div>
        <button popovertarget="moreOptionsDropdown" style="anchor-name:--moreOptionsDropdown" class="btn btn-sm btn-ghost hover:bg-transparent">
            <MoreHorizontal class="text-lg" />
        </button>
        <ul popover="" id="moreOptionsDropdown" style="position-anchor:--moreOptionsDropdown" class="dropdown dropdown-hover dropdown-end menu !bg-black rounded-lg border border-white/50 rounded-box w-32 p-2 shadow">
            <li><a>Item 1</a></li>
            <li><a>Item 2</a></li>
        </ul>
    </div>        
</div>
{/if}