<script lang="ts">
  interface Props {
    value?: string;
    placeholder?: string;
    debounce?: number;
    class?: string;
    inputClass?: string;
    onSearch?: (value: string) => void;
  }
  
  let {
    value = $bindable(''),
    placeholder = 'Search...',
    debounce = 300,
    class: className = '',
    inputClass = '',
    onSearch
  }: Props = $props();
  
  let debounceTimer: ReturnType<typeof setTimeout>;
  
  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    const newValue = target.value;
    
    clearTimeout(debounceTimer);
    
    debounceTimer = setTimeout(() => {
      value = newValue;
      onSearch?.(newValue);
    }, debounce);
  }
  
  function handleClear() {
    value = '';
    onSearch?.('');
    const input = document.getElementById('table-search') as HTMLInputElement;
    if (input) input.value = '';
  }
</script>

<div class={`kui-table-search ${className}`.trim()}>
  <span class="kui-table-search__icon" aria-hidden="true">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z" />
    </svg>
  </span>
  <input
    id="table-search"
    type="text"
    {placeholder}
    class={`kui-table-search__input ${inputClass}`.trim()}
    value={value}
    oninput={handleInput}
  />
  {#if value}
    <button
      type="button"
      class="kui-table-search__button"
      onclick={handleClear}
      aria-label="Clear search"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
      </svg>
    </button>
  {/if}
</div>
