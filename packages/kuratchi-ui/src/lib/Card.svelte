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
  
  const cardClasses = $derived(`
    card
    ${bordered ? 'card-bordered' : ''}
    ${compact ? 'card-compact' : ''}
    ${side ? 'card-side' : ''}
    ${glass ? 'glass' : ''}
    ${imageFull ? 'image-full' : ''}
    ${className}
  `.trim().replace(/\s+/g, ' '));
</script>

<div class={cardClasses}>
  {#if image}
    <figure>
      {@render image()}
    </figure>
  {/if}
  
  <div class="card-body {bodyClass}">
    {#if header}
      {@render header()}
    {:else if title}
      <h2 class="card-title">{title}</h2>
    {/if}
    
    {@render children()}
    
    {#if actions}
      <div class="card-actions justify-end">
        {@render actions()}
      </div>
    {/if}
  </div>
</div>
