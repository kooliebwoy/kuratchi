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
    default: 'border-base-200',
    primary: 'border-primary border-l-4',
    secondary: 'border-secondary border-l-4',
    accent: 'border-accent border-l-4',
    info: 'border-info border-l-4',
    success: 'border-success border-l-4',
    warning: 'border-warning border-l-4',
    error: 'border-error border-l-4'
  };
  
  const valueColors = {
    default: 'text-base-content',
    primary: 'text-primary',
    secondary: 'text-secondary',
    accent: 'text-accent',
    info: 'text-info',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error'
  };
</script>

<div class="card bg-base-100 border {variantClasses[variant]} shadow-sm {className}">
  <div class="card-body p-4">
    <p class="text-sm text-base-content/60">{label}</p>
    <p class="text-2xl font-bold {valueColors[variant]}">{value}</p>
    {#if subvalue}
      <p class="text-xs text-base-content/50 mt-1">{subvalue}</p>
    {/if}
  </div>
</div>
