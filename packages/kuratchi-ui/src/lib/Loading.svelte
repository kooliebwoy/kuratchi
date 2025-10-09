<script lang="ts">
  interface Props {
    type?: 'spinner' | 'dots' | 'ring' | 'ball' | 'bars' | 'infinity';
    size?: 'xs' | 'sm' | 'md' | 'lg';
    variant?: 'primary' | 'secondary' | 'accent' | 'neutral' | 'info' | 'success' | 'warning' | 'error';
    class?: string;
  }
  
  let {
    type = 'spinner',
    size = 'md',
    variant,
    class: className = ''
  }: Props = $props();
  
  const typeClasses = {
    spinner: 'loading-spinner',
    dots: 'loading-dots',
    ring: 'loading-ring',
    ball: 'loading-ball',
    bars: 'loading-bars',
    infinity: 'loading-infinity'
  };
  
  const sizeClasses = {
    xs: 'loading-xs',
    sm: 'loading-sm',
    md: 'loading-md',
    lg: 'loading-lg'
  };
  
  const variantClasses = variant ? {
    primary: 'text-primary',
    secondary: 'text-secondary',
    accent: 'text-accent',
    neutral: 'text-neutral',
    info: 'text-info',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error'
  }[variant] : '';
  
  const loadingClasses = $derived(`
    loading
    ${typeClasses[type]}
    ${sizeClasses[size]}
    ${variantClasses}
    ${className}
  `.trim().replace(/\s+/g, ' '));
</script>

<span class={loadingClasses}></span>
