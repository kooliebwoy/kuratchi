<script lang="ts">
  import type { Snippet } from 'svelte';
  
  interface Props {
    position?: 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end' | 'left-start' | 'left-end' | 'right-start' | 'right-end';
    hover?: boolean;
    open?: boolean;
    class?: string;
    contentClass?: string;
    trigger: Snippet;
    children: Snippet;
  }
  
  let {
    position = 'bottom',
    hover = false,
    open = $bindable(false),
    class: className = '',
    contentClass = '',
    trigger,
    children
  }: Props = $props();
  
  let dropdownElement: HTMLDivElement;
  
  function toggleOpen() {
    if (hover) return;
    open = !open;
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleOpen();
    }
  }
  
  $effect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!dropdownElement?.contains(event.target as Node)) {
        open = false;
      }
    };
    document.addEventListener('pointerdown', onClick);
    return () => document.removeEventListener('pointerdown', onClick);
  });
</script>

<div
  bind:this={dropdownElement}
  class={`kui-dropdown ${className}`.trim()}
  data-open={open ? 'true' : 'false'}
  data-position={position}
  role="presentation"
  onmouseenter={() => hover && (open = true)}
  onmouseleave={() => hover && (open = false)}
>
  <div
    tabindex="0"
    role="button"
    class="kui-dropdown__trigger"
    onclick={toggleOpen}
    onkeydown={handleKeydown}
    aria-expanded={open}
    aria-haspopup="true"
  >
    {@render trigger()}
  </div>
  <div tabindex="-1" class={`kui-dropdown__panel ${contentClass}`.trim()} role="menu">
    {@render children()}
  </div>
</div>
