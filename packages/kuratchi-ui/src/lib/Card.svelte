<script lang="ts">
  import type { Snippet } from 'svelte';
  
  interface Props {
    title?: string;
    bordered?: boolean;
    compact?: boolean;
    side?: boolean;
    glass?: boolean;
    imageFull?: boolean;
    class?: string;
    bodyClass?: string;
    image?: Snippet;
    header?: Snippet;
    children: Snippet;
    actions?: Snippet;
  }
  
  let {
    title,
    bordered = false,
    compact = false,
    side = false,
    glass = false,
    imageFull = false,
    class: className = '',
    bodyClass = '',
    image,
    header,
    children,
    actions
  }: Props = $props();
  
  const cardClasses = $derived([
    'kui-card',
    bordered ? 'kui-card--bordered' : '',
    compact ? 'kui-card--compact' : '',
    side ? 'kui-card--side' : '',
    glass ? 'kui-card--glass' : '',
    imageFull ? 'kui-card--image' : '',
    className
  ].filter(Boolean).join(' '));
</script>

<div class={cardClasses}>
  {#if image}
    <figure>
      {@render image()}
    </figure>
  {/if}
  
  <div class={`kui-card__body ${bodyClass}`.trim()}>
    {#if header}
      {@render header()}
    {:else if title}
      <h2 class="kui-card__title">{title}</h2>
    {/if}
    
    {@render children()}
    
    {#if actions}
      <div class="kui-card__actions">
        {@render actions()}
      </div>
    {/if}
  </div>
</div>
