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
    primary: 'text-primary bg-primary/10',
    secondary: 'text-secondary bg-secondary/10',
    accent: 'text-accent bg-accent/10',
    info: 'text-info bg-info/10',
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    error: 'text-error bg-error/10'
  };
  
  const buttonVariantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    accent: 'btn-accent',
    ghost: 'btn-ghost'
  };
</script>

<div class="card bg-base-100 shadow-sm hover:shadow-md transition-shadow {className}">
  <div class="card-body">
    <div class="flex items-start gap-4">
      {#if icon}
        <div class="w-12 h-12 rounded-lg {iconVariantClasses[iconVariant]} flex items-center justify-center flex-shrink-0">
          {@render icon()}
        </div>
      {/if}
      
      <div class="flex-1">
        <h3 class="card-title text-lg">{title}</h3>
        {#if description}
          <p class="text-sm text-base-content/70 mt-1">{description}</p>
        {/if}
      </div>
    </div>
    
    {#if buttonText}
      <div class="card-actions justify-end mt-4">
        {#if href}
          <a
            {href}
            class="btn btn-sm {buttonVariantClasses[buttonVariant]} {disabled ? 'btn-disabled' : ''}"
          >
            {buttonText}
          </a>
        {:else}
          <button
            type="button"
            class="btn btn-sm {buttonVariantClasses[buttonVariant]}"
            {onclick}
            {disabled}
          >
            {buttonText}
          </button>
        {/if}
      </div>
    {/if}
  </div>
</div>
