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
    sm: 'kui-dialog--sm',
    md: 'kui-dialog--md',
    lg: 'kui-dialog--lg',
    xl: 'kui-dialog--xl',
    full: 'kui-dialog--full'
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
  class={`kui-dialog ${sizeClasses[size]} ${className}`.trim()}
  data-backdrop={backdropClass || undefined}
  onclose={() => {
    open = false;
    onClose?.();
  }}
>
  <div class="kui-dialog__box">
    {#if header}
      <div class="mb-4">
        {@render header()}
      </div>
    {/if}
    
    <div class="kui-dialog__content">
      {@render children()}
    </div>
    
    {#if actions}
      <div class="kui-dialog__actions">
        {@render actions(closeDialog)}
      </div>
    {/if}
  </div>
</dialog>
