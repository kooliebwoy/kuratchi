<script lang="ts">
  import type { Snippet } from 'svelte';
  
  interface Props {
    open?: boolean;
    side?: 'left' | 'right';
    class?: string;
    drawerClass?: string;
    contentClass?: string;
    children: Snippet;
    drawer: Snippet;
    onClose?: () => void;
  }
  
  let {
    open = $bindable(false),
    side = 'left',
    class: className = '',
    drawerClass = '',
    contentClass = '',
    children,
    drawer,
    onClose
  }: Props = $props();
  
  function handleClose() {
    open = false;
    onClose?.();
  }
</script>

<div class="drawer {side === 'right' ? 'drawer-end' : ''} {className}">
  <input
    type="checkbox"
    class="drawer-toggle"
    bind:checked={open}
  />
  
  <div class="drawer-content {contentClass}">
    {@render children()}
  </div>
  
  <div class="drawer-side">
    <label
      class="drawer-overlay"
      onclick={handleClose}
      aria-label="Close drawer"
    ></label>
    <div class="menu min-h-full w-80 bg-base-200 p-4 {drawerClass}">
      {@render drawer()}
    </div>
  </div>
</div>
