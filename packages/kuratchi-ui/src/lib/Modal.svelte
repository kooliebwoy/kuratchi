<script lang="ts">
  import type { Snippet } from 'svelte';
  
  interface Props {
    open?: boolean;
    class?: string;
    boxClass?: string;
    backdropClass?: string;
    children: Snippet;
    header?: Snippet;
    actions?: Snippet;
    onClose?: () => void;
    closeOnBackdrop?: boolean;
  }
  
  let {
    open = $bindable(false),
    class: className = '',
    boxClass = '',
    backdropClass = '',
    children,
    header,
    actions,
    onClose,
    closeOnBackdrop = true
  }: Props = $props();
  
  function handleClose() {
    open = false;
    onClose?.();
  }
  
  function handleBackdropClick() {
    if (closeOnBackdrop) {
      handleClose();
    }
  }
</script>

{#if open}
  <div class={`kui-modal ${className}`.trim()} role="dialog" aria-modal="true">
    <div class={`kui-modal__panel ${boxClass}`.trim()}>
      {#if header}
        {@render header()}
      {/if}
      {@render children()}
      
      {#if actions}
        <div class="kui-modal__actions">
          {@render actions()}
        </div>
      {/if}
    </div>
    
    <button
      type="button"
      class={`kui-modal__backdrop ${backdropClass}`.trim()}
      onclick={handleBackdropClick}
      aria-label="Close modal"
    ></button>
  </div>
{/if}
