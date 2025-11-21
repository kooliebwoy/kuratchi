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
  
  const cardClasses = $derived([
    'kui-card kui-info-card',
    bordered ? 'kui-card--bordered' : '',
    compact ? 'kui-card--compact' : '',
    hover ? 'kui-info-card--hoverable' : '',
    className
  ].filter(Boolean).join(' '));
</script>

<article class={cardClasses}>
  <div class="kui-card__body">
    {#if header}
      {@render header()}
    {:else if title}
      <h3 class="kui-card__title">{title}</h3>
    {/if}
    
    {@render children()}
    
    {#if footer}
      <div class="kui-card__actions">
        {@render footer()}
      </div>
    {/if}
  </div>
</article>
