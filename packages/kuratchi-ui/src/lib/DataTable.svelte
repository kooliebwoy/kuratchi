<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';
  import Table from './Table.svelte';
  import TableSearch from './TableSearch.svelte';
  import TablePagination from './TablePagination.svelte';
  import TableFilters from './TableFilters.svelte';
  
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
    searchable?: boolean;
    searchPlaceholder?: string;
    paginated?: boolean;
    pageSize?: number;
    currentPage?: number;
    totalItems?: number;
    class?: string;
    tableClass?: string;
    filters?: Snippet;
    emptyState?: Snippet;
    onSearch?: (query: string) => void;
    onPageChange?: (page: number) => void;
    onSort?: (key: string, direction: 'asc' | 'desc') => void;
    onRowClick?: (item: T) => void;
  }
  
  let {
    data,
    columns,
    loading = false,
    searchable = true,
    searchPlaceholder = 'Search...',
    paginated = true,
    pageSize = 10,
    currentPage = $bindable(1),
    totalItems,
    class: className = '',
    tableClass = '',
    filters,
    emptyState,
    onSearch,
    onPageChange,
    onSort,
    onRowClick
  }: Props<T> = $props();
  
  let searchQuery = $state('');
  let sortKey = $state('');
  let sortDirection = $state<'asc' | 'desc'>('asc');
  
  const computedTotalItems = $derived(totalItems || data.length);
  
  function handleSearch(query: string) {
    searchQuery = query;
    currentPage = 1; // Reset to first page on search
    onSearch?.(query);
  }
  
  function handlePageChange(page: number) {
    currentPage = page;
    onPageChange?.(page);
  }
  
  function handleSort(key: string, direction: 'asc' | 'desc') {
    sortKey = key;
    sortDirection = direction;
    onSort?.(key, direction);
  }
</script>

<div class="space-y-4 {className}">
  <!-- Search and Filters -->
  {#if searchable || filters}
    <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
      {#if searchable}
        <TableSearch
          bind:value={searchQuery}
          placeholder={searchPlaceholder}
          onSearch={handleSearch}
          class="w-full sm:w-64"
        />
      {/if}
      
      {#if filters}
        <div class="w-full sm:w-auto">
          {@render filters()}
        </div>
      {/if}
    </div>
  {/if}
  
  <!-- Table -->
  <Table
    {data}
    {columns}
    {loading}
    bind:sortKey
    bind:sortDirection
    onSort={handleSort}
    {onRowClick}
    {emptyState}
    class={tableClass}
  />
  
  <!-- Pagination -->
  {#if paginated}
    <TablePagination
      totalItems={computedTotalItems}
      {pageSize}
      bind:currentPage
      onPageChange={handlePageChange}
    />
  {/if}
</div>
