<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  
  interface Props extends HTMLButtonAttributes {
    variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'link' | 'neutral' | 'success' | 'warning' | 'error';
    size?: 'xs' | 'sm' | 'md' | 'lg';
    outline?: boolean;
    wide?: boolean;
    block?: boolean;
    circle?: boolean;
    square?: boolean;
    glass?: boolean;
    loading?: boolean;
    disabled?: boolean;
    class?: string;
    children: Snippet;
    onclick?: (event: MouseEvent) => void;
  }
  
  let {
    variant = 'primary',
    size = 'md',
    outline = false,
    wide = false,
    block = false,
    circle = false,
    square = false,
    glass = false,
    loading = false,
    disabled = false,
    class: className = '',
    children,
    onclick,
    type = 'button',
    ...restProps
  }: Props = $props();
  
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    accent: 'btn-accent',
    ghost: 'btn-ghost',
    link: 'btn-link',
    neutral: 'btn-neutral',
    success: 'btn-success',
    warning: 'btn-warning',
    error: 'btn-error'
  };
  
  const sizeClasses = {
    xs: 'btn-xs',
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg'
  };
  
  const buttonClasses = $derived(`
    btn
    ${variantClasses[variant]}
    ${sizeClasses[size]}
    ${outline ? 'btn-outline' : ''}
    ${wide ? 'btn-wide' : ''}
    ${block ? 'btn-block' : ''}
    ${circle ? 'btn-circle' : ''}
    ${square ? 'btn-square' : ''}
    ${glass ? 'glass' : ''}
    ${className}
  `.trim().replace(/\s+/g, ' '));
</script>

<button
  {type}
  class={buttonClasses}
  {disabled}
  {onclick}
  {...restProps}
>
  {#if loading}
    <span class="loading loading-spinner"></span>
  {/if}
  {@render children()}
</button>
