<script lang="ts">
  import type { Snippet } from 'svelte';
  
  interface Props {
    id?: string;
    open?: boolean;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    class?: string;
    backdropClass?: string;
    trigger?: Snippet<[() => void]>;
    header?: Snippet;
    children: Snippet;
    actions?: Snippet<[() => void]>;
    onOpen?: () => void;
    onClose?: () => void;
  }
  
  let {
    id = `dialog-${Math.random().toString(36).substr(2, 9)}`,
    open = $bindable(false),
    size = 'md',
    class: className = '',
    backdropClass = '',
    trigger,
    header,
    children,
    actions,
    onOpen,
    onClose
  }: Props = $props();
  
  let dialogElement: HTMLDialogElement;
  
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full'
  };
  
  function openDialog() {
    open = true;
    dialogElement?.showModal();
    onOpen?.();
  }
  
  function closeDialog() {
    open = false;
    dialogElement?.close();
    onClose?.();
  }
  
  $effect(() => {
    if (open && dialogElement && !dialogElement.open) {
      dialogElement.showModal();
    } else if (!open && dialogElement?.open) {
      dialogElement.close();
    }
  });
</script>

{#if trigger}
  {@render trigger(openDialog)}
{/if}

<dialog
  bind:this={dialogElement}
  {id}
  class="modal"
  onclose={() => {
    open = false;
    onClose?.();
  }}
>
  <div class="modal-box {sizeClasses[size]} {className}">
    {#if header}
      <div class="mb-4">
        {@render header()}
      </div>
    {/if}
    
    <div class="modal-content">
      {@render children()}
    </div>
    
    {#if actions}
      <div class="modal-action">
        {@render actions(closeDialog)}
      </div>
    {/if}
  </div>
  
  <form method="dialog" class="modal-backdrop {backdropClass}">
    <button type="button">close</button>
  </form>
</dialog>
