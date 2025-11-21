<script lang="ts">
  import type { Snippet } from 'svelte';
  
  interface Toast {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    duration?: number;
  }
  
  interface Props {
    position?: 'top' | 'top-start' | 'top-end' | 'middle' | 'middle-start' | 'middle-end' | 'bottom' | 'bottom-start' | 'bottom-end';
    toasts?: Toast[];
    class?: string;
  }
  
  let {
    position = 'top-end',
    toasts = $bindable([]),
    class: className = ''
  }: Props = $props();
  
  function removeToast(id: string) {
    toasts = toasts.filter(t => t.id !== id);
  }
  
  // Auto-remove toasts after duration
  $effect(() => {
    toasts.forEach(toast => {
      if (toast.duration) {
        setTimeout(() => removeToast(toast.id), toast.duration);
      }
    });
  });
</script>

{#if toasts.length > 0}
  <div class={`kui-toast ${className}`.trim()} data-position={position}>
    {#each toasts as toast (toast.id)}
      <div class="kui-toast__item" data-type={toast.type} role="status">
        <span>{toast.message}</span>
        <button
          type="button"
          class="kui-toast__close"
          onclick={() => removeToast(toast.id)}
          aria-label="Close toast"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    {/each}
  </div>
{/if}
