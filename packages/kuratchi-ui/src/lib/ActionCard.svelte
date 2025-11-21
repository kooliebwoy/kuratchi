<script lang="ts">
  import type { Snippet } from 'svelte';
  
  interface Props {
    title: string;
    description?: string;
    icon?: Snippet;
    iconVariant?: 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error';
    buttonText?: string;
    buttonVariant?: 'primary' | 'secondary' | 'accent' | 'ghost';
    href?: string;
    onclick?: () => void;
    class?: string;
    disabled?: boolean;
  }
  
  let {
    title,
    description,
    icon,
    iconVariant = 'primary',
    buttonText,
    buttonVariant = 'primary',
    href,
    onclick,
    class: className = '',
    disabled = false
  }: Props = $props();
  
  const iconVariantClasses = {
    primary: 'kui-action-card__icon--primary',
    secondary: 'kui-action-card__icon--secondary',
    accent: 'kui-action-card__icon--accent',
    info: 'kui-action-card__icon--info',
    success: 'kui-action-card__icon--success',
    warning: 'kui-action-card__icon--warning',
    error: 'kui-action-card__icon--error'
  };
</script>

<article class={`kui-card kui-action-card ${className}`.trim()}>
  <div class="kui-card__body">
    <div class="kui-action-card__header">
      {#if icon}
        <div class={`kui-action-card__icon ${iconVariantClasses[iconVariant]}`.trim()} aria-hidden="true">
          {@render icon()}
        </div>
      {/if}
      
      <div class="kui-action-card__copy">
        <h3 class="kui-card__title">{title}</h3>
        {#if description}
          <p class="kui-action-card__description">{description}</p>
        {/if}
      </div>
    </div>
    
    {#if buttonText}
      <div class="kui-card__actions">
        {#if href}
          <a
            {href}
            class={`kui-button kui-button--${buttonVariant} kui-button--size-sm`.trim()}
            aria-disabled={disabled}
            tabindex={disabled ? -1 : undefined}
          >
            {buttonText}
          </a>
        {:else}
          <button
            type="button"
            class={`kui-button kui-button--${buttonVariant} kui-button--size-sm`.trim()}
            {onclick}
            {disabled}
          >
            {buttonText}
          </button>
        {/if}
      </div>
    {/if}
  </div>
</article>
