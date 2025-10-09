<script lang="ts">
  import type { Snippet } from 'svelte';
  
  interface Props {
    title: string;
    value: string | number;
    change?: number;
    changeLabel?: string;
    trend?: 'up' | 'down' | 'neutral';
    variant?: 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error';
    icon?: Snippet;
    description?: string;
    class?: string;
    loading?: boolean;
  }
  
  let {
    title,
    value,
    change,
    changeLabel,
    trend,
    variant = 'primary',
    icon,
    description,
    class: className = '',
    loading = false
  }: Props = $props();
  
  const variantClasses = {
    primary: 'text-primary bg-primary/10',
    secondary: 'text-secondary bg-secondary/10',
    accent: 'text-accent bg-accent/10',
    info: 'text-info bg-info/10',
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    error: 'text-error bg-error/10'
  };
  
  const trendColors = {
    up: 'text-success',
    down: 'text-error',
    neutral: 'text-base-content/60'
  };
</script>

<div class="card bg-base-100 shadow-sm {className}">
  <div class="card-body p-6">
    {#if loading}
      <div class="flex justify-center items-center h-24">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
    {:else}
      <div class="flex items-center justify-between">
        <div class="flex-1">
          <p class="text-xs text-base-content/60 uppercase font-semibold mb-1">{title}</p>
          <p class="text-3xl font-bold">{value}</p>
          
          {#if description}
            <p class="text-sm text-base-content/60 mt-1">{description}</p>
          {/if}
          
          {#if change !== undefined && trend}
            <div class="flex items-center gap-1 mt-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 {trendColors[trend]}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {#if trend === 'up'}
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                {:else if trend === 'down'}
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                {:else}
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14" />
                {/if}
              </svg>
              <span class="text-sm font-medium {trendColors[trend]}">
                {change > 0 ? '+' : ''}{change}%
              </span>
              {#if changeLabel}
                <span class="text-sm text-base-content/60">{changeLabel}</span>
              {/if}
            </div>
          {/if}
        </div>
        
        {#if icon}
          <div class="w-12 h-12 rounded-lg {variantClasses[variant]} flex items-center justify-center flex-shrink-0">
            {@render icon()}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
