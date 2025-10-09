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
  
  const positionClasses = {
    top: 'tooltip-top',
    bottom: 'tooltip-bottom',
    left: 'tooltip-left',
    right: 'tooltip-right'
  };
  
  const variantClasses = variant ? {
    primary: 'tooltip-primary',
    secondary: 'tooltip-secondary',
    accent: 'tooltip-accent',
    info: 'tooltip-info',
    success: 'tooltip-success',
    warning: 'tooltip-warning',
    error: 'tooltip-error'
  }[variant] : '';
  
  const tooltipClasses = $derived(`
    tooltip
    ${positionClasses[position]}
    ${variantClasses}
    ${open ? 'tooltip-open' : ''}
    ${className}
  `.trim().replace(/\s+/g, ' '));
</script>

<div class={tooltipClasses} data-tip={text}>
  {@render children()}
</div>
