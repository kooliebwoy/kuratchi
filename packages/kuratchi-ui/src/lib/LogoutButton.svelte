<script lang="ts">
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

<button
  type="button"
  class="btn btn-{variant} btn-{size} {className}"
  {onclick}
  disabled={loading}
>
  {#if loading}
    <span class="loading loading-spinner"></span>
  {/if}
  {text}
</button>
