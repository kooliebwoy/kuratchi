<script lang="ts">
  import type { Snippet } from 'svelte';
  
  interface Filter {
    key: string;
    label: string;
    type: 'select' | 'multiselect' | 'daterange' | 'range';
    options?: { value: string; label: string }[];
    min?: number;
    max?: number;
  }
  
  interface Props {
    filters?: Filter[];
    values?: Record<string, any>;
    class?: string;
    children?: Snippet;
    onFilterChange?: (key: string, value: any) => void;
    onClear?: () => void;
  }
  
  let {
    filters = [],
    values = $bindable({}),
    class: className = '',
    children,
    onFilterChange,
    onClear
  }: Props = $props();
  
  function handleFilterChange(key: string, value: any) {
    values = { ...values, [key]: value };
    onFilterChange?.(key, value);
  }
  
  function handleClearFilters() {
    values = {};
    onClear?.();
  }
  
  const hasActiveFilters = $derived(Object.keys(values).some(key => values[key] !== undefined && values[key] !== ''));
</script>

<div class={`kui-table-filters ${className}`.trim()}>
  {#if children}
    {@render children()}
  {:else if filters.length > 0}
    {#each filters as filter}
      {#if filter.type === 'select'}
        <select
          class="kui-select kui-select--sm"
          value={values[filter.key] || ''}
          onchange={(e) => handleFilterChange(filter.key, (e.target as HTMLSelectElement).value)}
        >
          <option value="">{filter.label}</option>
          {#if filter.options}
            {#each filter.options as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          {/if}
        </select>
      {:else if filter.type === 'range'}
        <label class="kui-form-control" for="filter-{filter.key}">
          <span class="kui-label">{filter.label}</span>
          <input
            id="filter-{filter.key}"
            type="range"
            min={filter.min || 0}
            max={filter.max || 100}
            value={values[filter.key] || filter.min || 0}
            class="kui-range"
            oninput={(e) => handleFilterChange(filter.key, (e.target as HTMLInputElement).value)}
          />
        </label>
      {/if}
    {/each}
    
    {#if hasActiveFilters}
      <button
        type="button"
        class="kui-button kui-button--ghost kui-button--size-sm"
        onclick={handleClearFilters}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
        Clear Filters
      </button>
    {/if}
  {/if}
</div>
