<script lang="ts">
  import type { Snippet } from 'svelte';
  
  interface Props {
    type?: 'info' | 'success' | 'warning' | 'error';
    class?: string;
    icon?: Snippet;
    children: Snippet;
    onClose?: () => void;
    dismissible?: boolean;
  }
  
  let {
    type = 'info',
    class: className = '',
    icon,
    children,
    onClose,
    dismissible = false
  }: Props = $props();
  
  let visible = $state(true);
  
  const typeClasses = {
    info: 'alert-info',
    success: 'alert-success',
    warning: 'alert-warning',
    error: 'alert-error'
  };
  
  function handleClose() {
    visible = false;
    onClose?.();
  }
</script>

{#if visible}
  <div class="alert {typeClasses[type]} {className}" role="alert">
    {#if icon}
      {@render icon()}
    {/if}
    
    <div class="flex-1">
      {@render children()}
    </div>
    
    {#if dismissible}
      <button
        type="button"
        class="btn btn-sm btn-ghost btn-circle"
        onclick={handleClose}
        aria-label="Close alert"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    {/if}
  </div>
{/if}
