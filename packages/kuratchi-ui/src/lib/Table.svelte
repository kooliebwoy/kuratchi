<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';
  
  interface Column<T> {
    key: string;
    label: string;
    sortable?: boolean;
    render?: (item: T, value: any) => any;
  }
  
  interface Props<T> {
    data: T[];
    columns: Column<T>[];
    loading?: boolean;
    hoverable?: boolean;
    zebra?: boolean;
    pinRows?: boolean;
    pinCols?: boolean;
    compact?: boolean;
    class?: string;
    rowClass?: string | ((item: T) => string);
    emptyState?: Snippet;
    onRowClick?: (item: T) => void;
    sortKey?: string;
    sortDirection?: 'asc' | 'desc';
    onSort?: (key: string, direction: 'asc' | 'desc') => void;
  }
  
  let {
    data,
    columns,
    loading = false,
    hoverable = true,
    zebra = false,
    pinRows = false,
    pinCols = false,
    compact = false,
    class: className = '',
    rowClass = '',
    emptyState,
    onRowClick,
    sortKey = $bindable(''),
    sortDirection = $bindable<'asc' | 'desc'>('asc'),
    onSort
  }: Props<T> = $props();
  
  const tableClasses = $derived([
    'kui-table',
    hoverable ? 'kui-table--hover' : '',
    zebra ? 'kui-table--zebra' : '',
    compact ? 'kui-table--compact' : '',
    pinRows ? 'kui-table--pin-rows' : '',
    pinCols ? 'kui-table--pin-cols' : '',
    className
  ].filter(Boolean).join(' '));
  
  function handleSort(key: string) {
    if (!columns.find(c => c.key === key)?.sortable) return;
    
    const newDirection = sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc';
    sortKey = key;
    sortDirection = newDirection;
    onSort?.(key, newDirection);
  }
  
  function getRowClass(item: T): string {
    if (typeof rowClass === 'function') {
      return rowClass(item);
    }
    return rowClass;
  }
  
  function getCellValue(item: T, column: Column<T>) {
    const value = (item as any)[column.key];
    return column.render ? column.render(item, value) : value;
  }
</script>

<div class="kui-table-wrapper">
  <table class={tableClasses}>
    <thead>
      <tr>
        {#each columns as column}
          <th>
            {#if column.sortable}
              <button
                type="button"
                class="kui-table__sort-button"
                onclick={() => handleSort(column.key)}
              >
                {column.label}
                {#if sortKey === column.key}
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    {#if sortDirection === 'asc'}
                      <path stroke-linecap="round" stroke-linejoin="round" d="m5 15 7-7 7 7" />
                    {:else}
                      <path stroke-linecap="round" stroke-linejoin="round" d="m19 9-7 7-7-7" />
                    {/if}
                  </svg>
                {/if}
              </button>
            {:else}
              {column.label}
            {/if}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#if loading}
        <tr>
          <td colspan={columns.length} class="kui-table__empty">
            <span class="kui-loader" data-type="spinner" data-size="lg" aria-hidden="true"></span>
          </td>
        </tr>
      {:else if data.length === 0}
        <tr>
          <td colspan={columns.length} class="kui-table__empty">
            {#if emptyState}
              {@render emptyState()}
            {:else}
              <p>No data available</p>
            {/if}
          </td>
        </tr>
      {:else}
        {#each data as item, index}
          <tr
            class={`${getRowClass(item)} ${onRowClick ? 'kui-table__row--interactive' : ''}`.trim()}
            onclick={() => onRowClick?.(item)}
          >
            {#each columns as column}
              <td>
                {@html getCellValue(item, column)}
              </td>
            {/each}
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>
</div>
