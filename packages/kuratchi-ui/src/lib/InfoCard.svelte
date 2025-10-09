<script lang="ts">
  import type { Snippet } from 'svelte';
  
  interface Props {
    title?: string;
    bordered?: boolean;
    compact?: boolean;
    hover?: boolean;
    class?: string;
    header?: Snippet;
    children: Snippet;
    footer?: Snippet;
  }
  
  let {
    title,
    bordered = false,
    compact = false,
    hover = false,
    class: className = '',
    header,
    children,
    footer
  }: Props = $props();
  
  const cardClasses = $derived(`
    card bg-base-100 shadow-sm
    ${bordered ? 'card-bordered' : ''}
    ${compact ? 'card-compact' : ''}
    ${hover ? 'hover:shadow-md transition-shadow' : ''}
    ${className}
  `.trim().replace(/\s+/g, ' '));
</script>

<div class={cardClasses}>
  <div class="card-body">
    {#if header}
      {@render header()}
    {:else if title}
      <h3 class="card-title">{title}</h3>
    {/if}
    
    {@render children()}
    
    {#if footer}
      <div class="card-actions justify-end mt-4">
        {@render footer()}
      </div>
    {/if}
  </div>
</div>
