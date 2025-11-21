<script lang="ts">
  import type { Snippet } from 'svelte';
  
  interface Props {
    variant?: 'neutral' | 'primary' | 'secondary' | 'accent' | 'ghost' | 'info' | 'success' | 'warning' | 'error';
    size?: 'xs' | 'sm' | 'md' | 'lg';
    outline?: boolean;
    class?: string;
    children: Snippet;
  }
  
  let {
    variant = 'neutral',
    size = 'md',
    outline = false,
    class: className = '',
    children
  }: Props = $props();
  
  const badgeClasses = $derived([
    'kui-badge',
    `kui-badge--${variant}`,
    `kui-badge--size-${size}`,
    outline ? 'kui-badge--outline' : '',
    className
  ].filter(Boolean).join(' '));
</script>

<span class={badgeClasses}>
  {@render children()}
</span>
