<script lang="ts">
  interface Props {
    value?: number;
    max?: number;
    variant?: 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error';
    class?: string;
    indeterminate?: boolean;
  }
  
  let {
    value = 0,
    max = 100,
    variant = 'primary',
    class: className = '',
    indeterminate = false
  }: Props = $props();
  
  const variantClasses = {
    primary: 'progress-primary',
    secondary: 'progress-secondary',
    accent: 'progress-accent',
    info: 'progress-info',
    success: 'progress-success',
    warning: 'progress-warning',
    error: 'progress-error'
  };
  
  const progressClasses = $derived(`
    progress
    ${variantClasses[variant]}
    ${className}
  `.trim().replace(/\s+/g, ' '));
</script>

<progress
  class={progressClasses}
  value={indeterminate ? undefined : value}
  {max}
></progress>
