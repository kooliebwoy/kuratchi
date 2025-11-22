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

<div class="krt-blockActions">
  <button
    class="krt-blockActions__button krt-blockActions__button--drag drag-handle handle"
    type="button"
    title="Drag to reorder"
    draggable="true"
  >
      <GripVertical aria-hidden="true" />
  </button>
  <button
    class="krt-blockActions__button"
    type="button"
    style={`anchor-name:--sizePopover-${popoverId}`}
    popovertarget={`sizePopover-${popoverId}`}
    title="Add block variation"
  >
    <Plus aria-hidden="true" />
  </button>
  <ul
    popover
    id={`sizePopover-${popoverId}`}
    style={`position-anchor:--sizePopover-${popoverId}`}
    class="krt-blockActions__menu"
  >
    {@render children?.()}
    <li>
        <button class="krt-blockActions__menuItem krt-blockActions__menuItem--danger" type="button" onclick={() => deleteElement(component!)}>
            <Trash2 aria-hidden="true" />
            Delete
        </button>
    </li>
  </ul>
</div>

<style>
  .krt-blockActions {
    position: absolute;
    inset-block-start: 50%;
    inset-inline-start: calc(-1 * var(--krt-space-5xl, 3.5rem));
    transform: translateY(-50%);
    display: flex;
    gap: var(--krt-space-xs, 0.25rem);
    opacity: 0;
    pointer-events: none;
    transition: opacity 150ms ease;
    z-index: 4;
  }

  :global(.editor-item:hover) .krt-blockActions,
  :global(.editor-item:focus-within) .krt-blockActions,
  :global(.krt-shellBlock:hover) .krt-blockActions,
  :global(.krt-shellBlock:focus-within) .krt-blockActions {
    opacity: 1;
    pointer-events: auto;
  }

  .krt-blockActions__button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: var(--krt-radius-pill, 999px);
    border: 1px solid rgba(15, 23, 42, 0.18);
    background: rgba(15, 23, 42, 0.85);
    color: #f8fafc;
    cursor: pointer;
    transition: transform 150ms ease, background 150ms ease, border 150ms ease;
  }

  .krt-blockActions__button:hover {
    transform: translateY(-1px);
    background: rgba(15, 23, 42, 0.92);
    border-color: rgba(15, 23, 42, 0.24);
  }

  .krt-blockActions__button:focus-visible {
    outline: 2px solid var(--krt-color-primary, #6366f1);
    outline-offset: 2px;
  }

  .krt-blockActions__button--drag {
    cursor: grab;
  }

  .krt-blockActions__button--drag:active {
    cursor: grabbing;
  }

  .krt-blockActions__button :global(svg) {
    width: 1.1rem;
    height: 1.1rem;
  }

  .krt-blockActions__menu {
    list-style: none;
    margin: 0;
    padding: var(--krt-space-sm, 0.5rem);
    display: flex;
    flex-direction: column;
    gap: var(--krt-space-xs, 0.25rem);
    min-width: 14rem;
    border-radius: var(--krt-radius-lg, 0.75rem);
    border: 1px solid rgba(15, 23, 42, 0.14);
    background: rgba(15, 23, 42, 0.92);
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.28);
    color: #f8fafc;
  }

  .krt-blockActions__menuItem {
    width: 100%;
    display: inline-flex;
    align-items: center;
    gap: var(--krt-space-xs, 0.25rem);
    padding: 0.5rem 0.6rem;
    border-radius: var(--krt-radius-md, 0.5rem);
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
    transition: background 150ms ease, color 150ms ease;
  }

  .krt-blockActions__menuItem:hover {
    background: rgba(148, 163, 184, 0.22);
  }

  .krt-blockActions__menuItem:focus-visible {
    outline: 2px solid var(--krt-color-primary, #6366f1);
    outline-offset: 2px;
  }

  .krt-blockActions__menuItem--danger {
    color: #fecaca;
  }

  .krt-blockActions__menuItem--danger:hover {
    background: rgba(248, 113, 113, 0.18);
  }

  .krt-blockActions__menuItem :global(svg) {
    width: 1rem;
    height: 1rem;
  }
</style>
