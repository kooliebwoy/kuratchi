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
  
  const buttonClasses = $derived([
    'kui-button',
    `kui-button--${variant}`,
    size ? `kui-button--size-${size}` : '',
    outline ? 'kui-button--outline' : '',
    wide ? 'kui-button--wide' : '',
    block ? 'kui-button--block' : '',
    circle ? 'kui-button--circle' : '',
    square ? 'kui-button--square' : '',
    glass ? 'kui-button--glass' : '',
    className
  ].filter(Boolean).join(' '));
</script>

<button
  {type}
  class={buttonClasses}
  {disabled}
  {onclick}
  aria-busy={loading ? 'true' : undefined}
  {...restProps}
>
  {#if loading}
    <span class="kui-button__spinner" aria-hidden="true"></span>
  {/if}
  {@render children()}
</button>
