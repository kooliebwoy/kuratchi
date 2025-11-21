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
    info: 'kui-alert--info',
    success: 'kui-alert--success',
    warning: 'kui-alert--warning',
    error: 'kui-alert--error'
  };
  
  function handleClose() {
    visible = false;
    onClose?.();
  }
</script>

{#if visible}
  <div class={`kui-alert ${typeClasses[type]} ${className}`.trim()} role="alert">
    {#if icon}
      <div class="kui-alert__icon" aria-hidden="true">
        {@render icon()}
      </div>
    {/if}
    
    <div class="kui-alert__content">
      {@render children()}
    </div>
    
    {#if dismissible}
      <button
        type="button"
        class="kui-alert__close"
        onclick={handleClose}
        aria-label="Close alert"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    {/if}
  </div>
{/if}
