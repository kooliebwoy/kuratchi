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

<div class="flex flex-wrap items-center gap-3 {className}">
  {#if children}
    {@render children()}
  {:else if filters.length > 0}
    {#each filters as filter}
      {#if filter.type === 'select'}
        <select
          class="select select-bordered select-sm"
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
        <div class="form-control">
          <label class="label" for="filter-{filter.key}">
            <span class="label-text text-xs">{filter.label}</span>
          </label>
          <input
            id="filter-{filter.key}"
            type="range"
            min={filter.min || 0}
            max={filter.max || 100}
            value={values[filter.key] || filter.min || 0}
            class="range range-sm"
            oninput={(e) => handleFilterChange(filter.key, (e.target as HTMLInputElement).value)}
          />
        </div>
      {/if}
    {/each}
    
    {#if hasActiveFilters}
      <button
        type="button"
        class="btn btn-ghost btn-sm"
        onclick={handleClearFilters}
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Clear Filters
      </button>
    {/if}
  {/if}
</div>
