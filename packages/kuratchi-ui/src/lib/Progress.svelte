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
  
  const percentage = $derived(() => {
    const ratio = Math.max(0, Math.min(value / max, 1));
    return Math.round(ratio * 100);
  });
</script>

<div
  class={`kui-progress ${className}`.trim()}
  role="progressbar"
  aria-valuemin="0"
  aria-valuemax={max}
  aria-valuenow={indeterminate ? undefined : value}
  data-variant={variant}
  data-indeterminate={indeterminate ? 'true' : 'false'}
>
  <span
    class="kui-progress__value"
    style={`width: ${indeterminate ? '35%' : `${percentage}%`}`}
  ></span>
</div>
