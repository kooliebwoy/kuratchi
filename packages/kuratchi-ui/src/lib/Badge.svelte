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
  
  const variantClasses = {
    neutral: 'badge-neutral',
    primary: 'badge-primary',
    secondary: 'badge-secondary',
    accent: 'badge-accent',
    ghost: 'badge-ghost',
    info: 'badge-info',
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error'
  };
  
  const sizeClasses = {
    xs: 'badge-xs',
    sm: 'badge-sm',
    md: '',
    lg: 'badge-lg'
  };
  
  const badgeClasses = $derived(`
    badge badge-soft
    ${variantClasses[variant]}
    ${sizeClasses[size]}
    ${outline ? 'badge-outline' : ''}
    ${className}
  `.trim().replace(/\s+/g, ' '));
</script>

<span class={badgeClasses}>
  {@render children()}
</span>
