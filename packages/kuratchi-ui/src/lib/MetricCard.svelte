<script lang="ts">
  interface Props {
    label: string;
    value: string | number;
    subvalue?: string;
    variant?: 'default' | 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error';
    class?: string;
  }
  
  let {
    label,
    value,
    subvalue,
    variant = 'default',
    class: className = ''
  }: Props = $props();
  
  const variantClasses = {
    default: 'kui-metric-card--default',
    primary: 'kui-metric-card--primary',
    secondary: 'kui-metric-card--secondary',
    accent: 'kui-metric-card--accent',
    info: 'kui-metric-card--info',
    success: 'kui-metric-card--success',
    warning: 'kui-metric-card--warning',
    error: 'kui-metric-card--error'
  };
</script>

<article class={`kui-card kui-metric-card ${variantClasses[variant]} ${className}`.trim()}>
  <div class="kui-card__body">
    <p class="kui-metric-card__label">{label}</p>
    <p class="kui-metric-card__value">{value}</p>
    {#if subvalue}
      <p class="kui-metric-card__subvalue">{subvalue}</p>
    {/if}
  </div>
</article>
