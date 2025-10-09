<script lang="ts">
  import type { Snippet } from 'svelte';
  
  interface Props {
    open?: boolean;
    class?: string;
    boxClass?: string;
    backdropClass?: string;
    children: Snippet;
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
  <div class="modal modal-open {className}">
    <div class="modal-box {boxClass}">
      {@render children()}
      
      {#if actions}
        <div class="modal-action">
          {@render actions()}
        </div>
      {/if}
    </div>
    
    <button
      type="button"
      class="modal-backdrop {backdropClass}"
      onclick={handleBackdropClick}
      aria-label="Close modal"
    ></button>
  </div>
{/if}
