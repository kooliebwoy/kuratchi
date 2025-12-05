<script lang="ts">
  import type { Snippet } from 'svelte';
  
  interface Props {
    /** Control panel visibility */
    open?: boolean;
    /** Panel title */
    title?: string;
    /** Panel subtitle/description */
    subtitle?: string;
    /** Panel width */
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    /** Which side the panel slides from */
    side?: 'left' | 'right';
    /** Close on backdrop click - defaults to true */
    closeOnBackdrop?: boolean;
    /** Close on escape key - defaults to true */
    closeOnEscape?: boolean;
    /** Show close button - defaults to true */
    showCloseButton?: boolean;
    /** Custom class for the panel */
    class?: string;
    /** Header snippet (replaces title/subtitle) */
    header?: Snippet;
    /** Main content */
    children: Snippet;
    /** Footer content (typically action buttons) */
    footer?: Snippet;
    /** Called when panel requests to close */
    onclose?: () => void;
  }
  
  let {
    open = $bindable(false),
    title = '',
    subtitle = '',
    size = 'md',
    side = 'right',
    closeOnBackdrop = true,
    closeOnEscape = true,
    showCloseButton = true,
    class: className = '',
    header,
    children,
    footer,
    onclose
  }: Props = $props();
  
  const sizeWidths: Record<string, string> = {
    sm: '320px',
    md: '480px',
    lg: '640px',
    xl: '800px',
    full: '100%'
  };
  
  function requestClose() {
    onclose?.();
    open = false;
  }
  
  function handleBackdropClick() {
    if (closeOnBackdrop) {
      requestClose();
    }
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && closeOnEscape && open) {
      event.preventDefault();
      requestClose();
    }
  }
  
  // Focus trap - keep focus inside panel when open
  let panelElement = $state<HTMLElement | null>(null);
  
  $effect(() => {
    if (open && panelElement) {
      // Focus the panel when it opens
      const firstFocusable = panelElement.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }
  });
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div 
    class="kui-slide-panel"
    data-side={side}
    role="dialog"
    aria-modal="true"
    aria-labelledby={title ? 'slide-panel-title' : undefined}
  >
    <!-- Backdrop -->
    <button
      type="button"
      class="kui-slide-panel__backdrop"
      onclick={handleBackdropClick}
      aria-label="Close panel"
      tabindex="-1"
    ></button>
    
    <!-- Panel -->
    <aside
      bind:this={panelElement}
      class={`kui-slide-panel__panel ${className}`.trim()}
      style="--panel-width: {sizeWidths[size]}"
    >
      <!-- Header -->
      <header class="kui-slide-panel__header">
        {#if header}
          {@render header()}
        {:else}
          <div class="kui-slide-panel__header-content">
            {#if title}
              <h2 id="slide-panel-title" class="kui-slide-panel__title">{title}</h2>
            {/if}
            {#if subtitle}
              <p class="kui-slide-panel__subtitle">{subtitle}</p>
            {/if}
          </div>
        {/if}
        
        {#if showCloseButton}
          <button
            type="button"
            class="kui-slide-panel__close"
            onclick={requestClose}
            aria-label="Close panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18"></path>
              <path d="m6 6 12 12"></path>
            </svg>
          </button>
        {/if}
      </header>
      
      <!-- Content -->
      <div class="kui-slide-panel__content">
        {@render children()}
      </div>
      
      <!-- Footer -->
      {#if footer}
        <footer class="kui-slide-panel__footer">
          {@render footer()}
        </footer>
      {/if}
    </aside>
  </div>
{/if}

<style>
  .kui-slide-panel {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
  }
  
  .kui-slide-panel[data-side="right"] {
    justify-content: flex-end;
  }
  
  .kui-slide-panel[data-side="left"] {
    justify-content: flex-start;
  }
  
  /* Backdrop */
  .kui-slide-panel__backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    border: none;
    cursor: pointer;
    animation: kui-fade-in 0.2s ease-out;
  }
  
  @keyframes kui-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  /* Panel */
  .kui-slide-panel__panel {
    position: relative;
    display: flex;
    flex-direction: column;
    width: min(var(--panel-width, 480px), 100vw);
    max-width: 100vw;
    height: 100%;
    background: var(--kui-color-surface, #ffffff);
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
    animation: kui-slide-in-right 0.25s ease-out;
  }
  
  [data-side="left"] .kui-slide-panel__panel {
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.15);
    animation: kui-slide-in-left 0.25s ease-out;
  }
  
  @keyframes kui-slide-in-right {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
  
  @keyframes kui-slide-in-left {
    from { transform: translateX(-100%); }
    to { transform: translateX(0); }
  }
  
  /* Header */
  .kui-slide-panel__header {
    flex-shrink: 0;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 24px;
    border-bottom: 1px solid var(--kui-color-border, #e5e7eb);
  }
  
  .kui-slide-panel__header-content {
    flex: 1;
    min-width: 0;
  }
  
  .kui-slide-panel__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--kui-color-text, #111827);
    line-height: 1.4;
  }
  
  .kui-slide-panel__subtitle {
    margin: 4px 0 0;
    font-size: 14px;
    color: var(--kui-color-text-secondary, #6b7280);
    line-height: 1.5;
  }
  
  .kui-slide-panel__close {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--kui-color-text-secondary, #6b7280);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  
  .kui-slide-panel__close:hover {
    background: var(--kui-color-hover, #f3f4f6);
    color: var(--kui-color-text, #111827);
  }
  
  .kui-slide-panel__close:focus-visible {
    outline: 2px solid var(--kui-color-primary, #3b82f6);
    outline-offset: 2px;
  }
  
  /* Content */
  .kui-slide-panel__content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }
  
  /* Footer */
  .kui-slide-panel__footer {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid var(--kui-color-border, #e5e7eb);
    background: var(--kui-color-surface-alt, #f9fafb);
  }
  
  /* Responsive */
  @media (max-width: 640px) {
    .kui-slide-panel__panel {
      width: 100vw;
    }
    
    .kui-slide-panel__header {
      padding: 16px 20px;
    }
    
    .kui-slide-panel__content {
      padding: 20px;
    }
    
    .kui-slide-panel__footer {
      padding: 12px 20px;
    }
  }
</style>
