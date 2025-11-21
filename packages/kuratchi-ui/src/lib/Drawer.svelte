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

<div
  class={`kui-drawer ${className}`.trim()}
  data-open={open ? 'true' : 'false'}
  data-side={side}
>
  <div class={`kui-drawer__content ${contentClass}`.trim()}>
    {@render children()}
  </div>
  
  <button
    type="button"
    class="kui-drawer__scrim"
    onclick={handleClose}
    aria-label="Close drawer"
  ></button>
  
  <aside
    class={`kui-drawer__panel ${drawerClass}`.trim()}
    aria-hidden={open ? 'false' : 'true'}
  >
    {@render drawer()}
  </aside>
</div>
