<script lang="ts">
  import type { Snippet } from 'svelte';
  
  interface Props {
    position?: 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end' | 'left-start' | 'left-end' | 'right-start' | 'right-end';
    hover?: boolean;
    open?: boolean;
    class?: string;
    contentClass?: string;
    trigger: Snippet;
    children: Snippet;
  }
  
  let {
    position = 'bottom',
    hover = false,
    open = $bindable(false),
    class: className = '',
    contentClass = '',
    trigger,
    children
  }: Props = $props();
  
  const positionClasses = {
    'top': 'dropdown-top',
    'bottom': 'dropdown-bottom',
    'left': 'dropdown-left',
    'right': 'dropdown-right',
    'top-start': 'dropdown-top dropdown-start',
    'top-end': 'dropdown-top dropdown-end',
    'bottom-start': 'dropdown-bottom dropdown-start',
    'bottom-end': 'dropdown-bottom dropdown-end',
    'left-start': 'dropdown-left dropdown-start',
    'left-end': 'dropdown-left dropdown-end',
    'right-start': 'dropdown-right dropdown-start',
    'right-end': 'dropdown-right dropdown-end'
  };
  
  const dropdownClasses = $derived(`
    dropdown
    ${positionClasses[position]}
    ${hover ? 'dropdown-hover' : ''}
    ${open ? 'dropdown-open' : ''}
    ${className}
  `.trim().replace(/\s+/g, ' '));
</script>

<div class={dropdownClasses}>
  <div tabindex="0" role="button">
    {@render trigger()}
  </div>
  <ul tabindex="0" class="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow {contentClass}">
    {@render children()}
  </ul>
</div>
