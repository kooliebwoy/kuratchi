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
  
  const loadingClasses = $derived([
    'kui-loader',
    className
  ].filter(Boolean).join(' '));
</script>

<span
  class={loadingClasses}
  data-type={type}
  data-size={size}
  data-variant={variant || 'primary'}
  aria-live="polite"
  aria-busy="true"
>
  {#if type === 'dots'}
    <span></span>
    <span></span>
    <span></span>
  {:else if type === 'bars'}
    <span></span>
    <span></span>
    <span></span>
  {/if}
</span>
