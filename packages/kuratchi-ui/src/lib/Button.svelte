<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
  
  type AnchorOnlyAttributes = Omit<HTMLAnchorAttributes, keyof HTMLButtonAttributes>;

  interface Props extends HTMLButtonAttributes, AnchorOnlyAttributes {
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
    href?: string;
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
    href,
    type,
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

  const resolvedType = $derived(href ? undefined : type ?? 'button');

  const handleClick = (event: MouseEvent) => {
    if (disabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    onclick?.(event);
  };
</script>

{#if href}
  <a
    class={buttonClasses}
    href={disabled ? undefined : href}
    aria-disabled={disabled ? 'true' : undefined}
    aria-busy={loading ? 'true' : undefined}
    tabindex={disabled ? -1 : undefined}
    onclick={handleClick}
    {...(restProps as HTMLAnchorAttributes)}
  >
    {#if loading}
      <span class="kui-button__spinner" aria-hidden="true"></span>
    {/if}
    {@render children()}
  </a>
{:else}
  <button
    type={resolvedType}
    class={buttonClasses}
    {disabled}
    onclick={handleClick}
    aria-busy={loading ? 'true' : undefined}
    {...(restProps as HTMLButtonAttributes)}
  >
    {#if loading}
      <span class="kui-button__spinner" aria-hidden="true"></span>
    {/if}
    {@render children()}
  </button>
{/if}
