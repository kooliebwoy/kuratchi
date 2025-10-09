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
  
  const positionClasses = {
    'top': 'toast-top toast-center',
    'top-start': 'toast-top toast-start',
    'top-end': 'toast-top toast-end',
    'middle': 'toast-middle toast-center',
    'middle-start': 'toast-middle toast-start',
    'middle-end': 'toast-middle toast-end',
    'bottom': 'toast-bottom toast-center',
    'bottom-start': 'toast-bottom toast-start',
    'bottom-end': 'toast-bottom toast-end'
  };
  
  const typeClasses = {
    info: 'alert-info',
    success: 'alert-success',
    warning: 'alert-warning',
    error: 'alert-error'
  };
  
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
  <div class="toast {positionClasses[position]} {className} z-50">
    {#each toasts as toast (toast.id)}
      <div class="alert {typeClasses[toast.type]} shadow-lg">
        <span>{toast.message}</span>
        <button
          type="button"
          class="btn btn-sm btn-ghost btn-circle"
          onclick={() => removeToast(toast.id)}
          aria-label="Close toast"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    {/each}
  </div>
{/if}
