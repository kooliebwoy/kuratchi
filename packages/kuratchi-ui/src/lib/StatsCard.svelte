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
    primary: 'kui-stats-card__icon--primary',
    secondary: 'kui-stats-card__icon--secondary',
    accent: 'kui-stats-card__icon--accent',
    info: 'kui-stats-card__icon--info',
    success: 'kui-stats-card__icon--success',
    warning: 'kui-stats-card__icon--warning',
    error: 'kui-stats-card__icon--error'
  };
  
  const trendClasses = {
    up: 'kui-stats-card__trend--up',
    down: 'kui-stats-card__trend--down',
    neutral: 'kui-stats-card__trend--neutral'
  };
</script>

<article class={`kui-card kui-stats-card ${className}`.trim()}>
  <div class="kui-card__body">
    {#if loading}
      <div class="kui-stats-card__loading">
        <span class="kui-loader" data-type="spinner" data-size="lg" aria-hidden="true"></span>
      </div>
    {:else}
      <div class="kui-stats-card__layout">
        <div class="kui-stats-card__content">
          <p class="kui-stats-card__label">{title}</p>
          <p class="kui-stats-card__value">{value}</p>
          
          {#if description}
            <p class="kui-stats-card__description">{description}</p>
          {/if}
          
          {#if change !== undefined && trend}
            <div class="kui-stats-card__trend {trendClasses[trend]}">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                {#if trend === 'up'}
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8-8 8-4-4-6 6" />
                {:else if trend === 'down'}
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13 17h8m0 0V9m0 8-8-8-4 4-6-6" />
                {:else}
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14" />
                {/if}
              </svg>
              <span class="kui-stats-card__trend-value">
                {change > 0 ? '+' : ''}{change}%
              </span>
              {#if changeLabel}
                <span class="kui-stats-card__trend-label">{changeLabel}</span>
              {/if}
            </div>
          {/if}
        </div>
        
        {#if icon}
          <div class={`kui-stats-card__icon ${variantClasses[variant]}`.trim()} aria-hidden="true">
            {@render icon()}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</article>
