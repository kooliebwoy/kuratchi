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

<div class="form-control {className}">
  <div class="input-group">
    <span class="bg-base-200 flex items-center justify-center px-3">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </span>
    <input
      id="table-search"
      type="text"
      {placeholder}
      class="input input-bordered flex-1 {inputClass}"
      value={value}
      oninput={handleInput}
    />
    {#if value}
      <button
        type="button"
        class="btn btn-ghost btn-square"
        onclick={handleClear}
        aria-label="Clear search"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    {/if}
  </div>
</div>
