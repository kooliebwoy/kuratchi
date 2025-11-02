<script lang="ts">
  import { deleteElement } from "../../utils/editor.svelte.js";
  import { GripVertical, Plus, Trash2 } from "@lucide/svelte";

  interface Props {
    children?: any;
    component?: HTMLElement;
  }

  let { children, component }: Props = $props();
  
  // Generate unique ID for this instance's popover
  const popoverId = crypto.randomUUID();
</script>

<div class="absolute -left-14 top-1/2 -translate-y-1/2 opacity-0 z-[1] group-hover:opacity-100 transition-opacity flex flex-row gap-1">
  <button class="btn btn-xs btn-circle btn-ghost bg-base-100 border border-base-300 shadow-sm hover:bg-base-200 cursor-grab active:cursor-grabbing drag-handle handle">
      <GripVertical class="text-base text-base-content/70" />
  </button>
  <button class="btn btn-xs btn-circle btn-ghost bg-base-100 border border-base-300 shadow-sm hover:bg-base-200" style={`anchor-name:--sizePopover-${popoverId}`} popovertarget={`sizePopover-${popoverId}`}>
    <Plus class="text-base text-base-content" />
  </button>
  <ul popover id={`sizePopover-${popoverId}`} style={`position-anchor:--sizePopover-${popoverId}`} class="dropdown menu w-52 rounded-box bg-base-100 shadow-sm">
    {@render children?.()}
    <li>
        <button onclick={() => deleteElement(component!)} class="btn btn-soft btn-error">
            <Trash2 class="text-xl font-semibold" />
            Delete
        </button>
    </li>
  </ul>
</div>