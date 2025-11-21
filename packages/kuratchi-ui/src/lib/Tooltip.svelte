<script lang="ts">
  import type { Snippet } from 'svelte';
  
  interface Props {
    text: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    variant?: 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error';
    class?: string;
    open?: boolean;
    children: Snippet;
  }
  
  let {
    text,
    position = 'top',
    variant,
    class: className = '',
    open = false,
    children
  }: Props = $props();
  
  const tooltipClasses = $derived([
    'kui-tooltip',
    className
  ].filter(Boolean).join(' '));
</script>

<div
  class={tooltipClasses}
  data-tip={text}
  data-position={position}
  data-variant={variant || undefined}
  data-open={open ? 'true' : 'false'}
>
  {@render children()}
</div>
