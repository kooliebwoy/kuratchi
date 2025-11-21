<script lang="ts">
  import Button from './Button.svelte';
  interface Props {
    text?: string;
    variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'link' | 'error';
    size?: 'xs' | 'sm' | 'md' | 'lg';
    loading?: boolean;
    class?: string;
    onclick?: (e: MouseEvent) => void;
  }
  
  let {
    text = 'Sign Out',
    variant = 'ghost',
    size = 'md',
    loading = false,
    class: className = '',
    onclick
  }: Props = $props();
</script>

<Button
  type="button"
  {variant}
  size={size}
  class={className}
  {onclick}
  disabled={loading}
>
  {#if loading}
    <span class="kui-button__spinner" aria-hidden="true"></span>
  {/if}
  {text}
</Button>
