<script lang="ts">
  import { page } from '$app/stores';
  import { getDatabase, getDatabaseTables, executeQuery, getDatabaseAnalytics, getTableData, insertTableRow, deleteTableRow } from '$lib/functions/database.remote';

  let deleteRowDialog: HTMLDialogElement;
  let queryResults = $state<any[]>([]);
  let selectedTable = $state<string | null>(null);
  let tableData = $state<any[]>([]);
  let tableSchema = $state<any[]>([]);
  let tableDataLoading = $state(false);
  let rowToDelete = $state<any>(null);
  let newRowData = $state<Record<string, any>>({});
  let addRowDrawerOpen = $state(false);
  let isAddingRow = $state(false);
  let queryPanelOpen = $state(false);
  let sqlQuery = $state('');
  let isExecutingQuery = $state(false);

  const databaseId = $page.params.id;
  const database = getDatabase();
  const tables = getDatabaseTables();
  const analytics = getDatabaseAnalytics();

  // Handle query results
  $effect(() => {
    if (executeQuery.result) {
      queryResults = executeQuery.result.results || [];
      isExecutingQuery = false;
    }
  });

  async function handleExecuteQuery(event: Event) {
    event.preventDefault();
    if (!sqlQuery.trim()) return;
    
    isExecutingQuery = true;
    queryResults = [];
    
    // The form submission will trigger executeQuery
  }

  function formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  async function viewTableData(tableName: string) {
    selectedTable = tableName;
    tableDataLoading = true;
    tableData = [];
    tableSchema = [];
    
    try {
      const result = await getTableData({ tableName, databaseId });
      tableData = result?.rows || [];
      tableSchema = result?.schema || [];
    } catch (err) {
      console.error('Error loading table data:', err);
      tableData = [];
      tableSchema = [];
    } finally {
      tableDataLoading = false;
    }
  }

  function openAddRowDialog() {
    // Initialize newRowData with empty values based on schema
    newRowData = {};
    tableSchema.forEach((col: any) => {
      if (!col.pk) { // Don't include auto-increment primary keys
        newRowData[col.name] = col.dflt_value || '';
      }
    });
    addRowDrawerOpen = true;
  }

  async function handleAddRow() {
    if (!selectedTable) return;
    
    isAddingRow = true;
    try {
      await insertTableRow({ 
        tableName: selectedTable, 
        databaseId,
        rowData: newRowData
      });
      
      // Refresh table data
      await viewTableData(selectedTable);
      addRowDrawerOpen = false;
    } catch (err) {
      console.error('Error adding row:', err);
      alert('Failed to add row');
    } finally {
      isAddingRow = false;
    }
  }

  function confirmDeleteRow(row: any) {
    rowToDelete = row;
    deleteRowDialog.showModal();
  }

  async function handleDeleteRow() {
    if (!selectedTable || !rowToDelete) return;
    
    try {
      // Build WHERE clause from the row data (use all columns for safety)
      const whereColumns = Object.keys(rowToDelete);
      const whereClause = whereColumns.map(col => `${col} = ?`).join(' AND ');
      const whereValues = whereColumns.map(col => rowToDelete[col]);
      
      await deleteTableRow({
        tableName: selectedTable,
        databaseId,
        whereClause,
        whereValues
      });
      
      // Refresh table data
      await viewTableData(selectedTable);
      deleteRowDialog.close();
      rowToDelete = null;
    } catch (err) {
      console.error('Error deleting row:', err);
      alert('Failed to delete row');
    }
  }

  function getSQLType(type: string): string {
    const upperType = type.toUpperCase();
    if (upperType.includes('INT')) return 'number';
    if (upperType.includes('REAL') || upperType.includes('FLOAT') || upperType.includes('DOUBLE')) return 'number';
    if (upperType.includes('BOOL')) return 'checkbox';
    if (upperType.includes('DATE') || upperType.includes('TIME')) return 'datetime-local';
    return 'text';
  }
</script>

<svelte:head>
  <title>Database Details - Kuratchi Dashboard</title>
</svelte:head>

<div class="flex h-screen flex-col bg-base-100">
  <!-- Header -->
  <div class="flex items-center justify-between border-b border-base-200 bg-base-100 px-6 py-4">
    <div class="flex items-center gap-4">
      <a href="/database" class="btn btn-ghost btn-sm" aria-label="Go back to databases">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
        </svg>
      </a>
      <div>
        {#if database.loading}
          <div class="flex items-center gap-2">
            <span class="loading loading-spinner loading-sm"></span>
            <h1 class="text-lg font-semibold">Loading...</h1>
          </div>
        {:else if database.current}
          <h1 class="text-lg font-semibold">{database.current.name}</h1>
        {:else}
          <h1 class="text-lg font-semibold">Database Studio</h1>
        {/if}
      </div>
    </div>
    <div class="flex gap-2">
      <button 
        class="btn btn-sm {queryPanelOpen ? 'btn-primary' : 'btn-outline'}" 
        onclick={() => queryPanelOpen = !queryPanelOpen}
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
          <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
        </svg>
        SQL Query
      </button>
    </div>
  </div>

  <!-- SQL Query Panel (Collapsible) -->
  {#if queryPanelOpen}
    <div class="border-b border-base-200 bg-base-50">
      <div class="px-6 py-4">
        <form {...executeQuery} onsubmit={handleExecuteQuery}>
          <input type="hidden" name="databaseId" value={databaseId} />
          
          <div class="flex items-start gap-4">
            <!-- Query Input -->
            <div class="flex-1">
              <textarea 
                id="sql-query"
                name="sql"
                class="textarea textarea-bordered w-full font-mono text-sm h-20 resize-none focus:h-32 transition-all bg-base-100" 
                placeholder="SELECT * FROM {selectedTable || 'table_name'} LIMIT 10;"
                bind:value={sqlQuery}
                required
              ></textarea>
            </div>

            <!-- Actions -->
            <div class="flex flex-col gap-2 pt-1">
              <button 
                type="submit" 
                class="btn btn-primary btn-sm min-w-32" 
                disabled={isExecutingQuery || !sqlQuery.trim()}
              >
                {#if isExecutingQuery}
                  <span class="loading loading-spinner loading-xs"></span>
                  Running...
                {:else}
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
                  </svg>
                  Execute
                {/if}
              </button>
              
              <div class="flex gap-1">
                <button 
                  type="button" 
                  class="btn btn-xs btn-ghost tooltip tooltip-bottom" 
                  data-tip="Insert example query"
                  onclick={() => {
                    sqlQuery = selectedTable ? `SELECT * FROM ${selectedTable} LIMIT 10;` : 'SELECT * FROM table_name LIMIT 10;';
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
                <button 
                  type="button" 
                  class="btn btn-xs btn-ghost tooltip tooltip-bottom" 
                  data-tip="Clear query & results"
                  onclick={() => {
                    sqlQuery = '';
                    queryResults = [];
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </form>

        <!-- Query Results -->
        {#if queryResults.length > 0}
          <div class="mt-4 pt-4 border-t border-base-200">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-success" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                </svg>
                <span class="text-sm font-medium">{queryResults.length} {queryResults.length === 1 ? 'row' : 'rows'} returned</span>
              </div>
              <button 
                type="button" 
                class="btn btn-xs btn-ghost gap-1"
                onclick={() => queryResults = []}
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
                Close
              </button>
            </div>
            <div class="overflow-x-auto max-h-80 border border-base-200 rounded-lg bg-base-100">
              <table class="table table-sm table-pin-rows table-pin-cols">
                <thead class="bg-base-200/50">
                  <tr>
                    {#each Object.keys(queryResults[0]) as key}
                      <th class="font-semibold text-xs uppercase tracking-wide">{key}</th>
                    {/each}
                  </tr>
                </thead>
                <tbody>
                  {#each queryResults as row, i}
                    <tr class="hover:bg-base-200/30">
                      {#each Object.values(row) as value}
                        <td class="font-mono text-xs">
                          {#if value === null}
                            <span class="text-base-content/40 italic">NULL</span>
                          {:else if typeof value === 'object'}
                            <code class="text-xs bg-base-200/70 px-1.5 py-0.5 rounded">{JSON.stringify(value)}</code>
                          {:else}
                            {value}
                          {/if}
                        </td>
                      {/each}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Main Content Area with Sidebar -->
  <div class="flex flex-1 overflow-hidden">
    <!-- Sidebar - Tables List -->
    <div class="w-64 border-r border-base-200 overflow-y-auto bg-base-100/50">
      <div class="p-4">
        <div class="mb-4">
          <label class="input input-bordered input-sm flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="h-4 w-4 opacity-70">
              <path fill-rule="evenodd" d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" clip-rule="evenodd" />
            </svg>
            <input type="text" class="grow" placeholder="Search tables..." />
          </label>
        </div>
        
        <div class="space-y-1">
          {#if tables.loading}
            <div class="flex justify-center py-8">
              <span class="loading loading-spinner loading-sm"></span>
            </div>
          {:else if tables.error}
            <div class="text-center py-4 text-sm text-error">Error loading tables</div>
          {:else if tables.current && tables.current.length > 0}
            {#each tables.current as table}
              <button
                onclick={() => viewTableData(table.name)}
                class="w-full text-left px-3 py-2 rounded-lg hover:bg-base-200 transition text-sm {selectedTable === table.name ? 'bg-primary text-primary-content font-medium' : 'text-base-content/70 hover:text-base-content'}"
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span class="truncate">{table.name}</span>
                  </div>
                  <span class="text-xs opacity-60 shrink-0 badge badge-ghost badge-sm">{table.columnCount}</span>
                </div>
              </button>
            {/each}
          {:else}
            <div class="text-center py-8 text-sm text-base-content/50">No tables found</div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Main Content - Table Data or Analytics -->
    <div class="flex-1 overflow-y-auto">
      {#if selectedTable}
        <!-- Table Data View -->
        <div class="p-6">
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold">{selectedTable}</h2>
              <div class="flex gap-2">
                <button class="btn btn-sm btn-primary" onclick={openAddRowDialog} disabled={tableDataLoading || tableSchema.length === 0}>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                  </svg>
                  Add Row
                </button>
              </div>
            </div>

            {#if tableDataLoading}
              <div class="flex justify-center py-12">
                <div class="text-center">
                  <span class="loading loading-spinner loading-lg"></span>
                  <p class="mt-2 text-sm text-base-content/60">Loading table data...</p>
                </div>
              </div>
            {:else if tableSchema.length > 0}
              <div class="mb-2">
                <p class="text-sm text-base-content/60">
                  {#if tableData.length > 0}
                    Showing {tableData.length} rows (limited to 100)
                  {:else}
                    Table is empty (0 rows)
                  {/if}
                </p>
              </div>
              <div class="overflow-x-auto border border-base-200 rounded-lg bg-base-100">
                <table class="table table-sm table-zebra">
                  <thead class="bg-base-200 sticky top-0">
                    <tr>
                      <th class="w-12">#</th>
                      {#each tableSchema as column}
                        <th class="text-left">
                          <div class="flex items-center gap-1.5">
                            <span class="font-semibold">{column.name}</span>
                            {#if column.pk}
                              <span class="badge badge-xs badge-primary">PK</span>
                            {/if}
                          </div>
                          <div class="text-xs font-normal opacity-50 mt-0.5">
                            {column.type}
                            {#if column.notnull && !column.pk}
                              · NOT NULL
                            {/if}
                          </div>
                        </th>
                      {/each}
                      <th class="w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#if tableData.length > 0}
                      {#each tableData as row, i}
                        <tr class="hover">
                          <td class="font-mono text-xs opacity-60">{i + 1}</td>
                          {#each tableSchema as column}
                            <td class="max-w-xs truncate text-sm">
                              {#if row[column.name] === null}
                                <span class="text-base-content/40 italic">NULL</span>
                              {:else if typeof row[column.name] === 'object'}
                                <code class="text-xs bg-base-200 px-2 py-1 rounded">{JSON.stringify(row[column.name]).substring(0, 50)}</code>
                              {:else}
                                <span>{row[column.name]}</span>
                              {/if}
                            </td>
                          {/each}
                          <td class="text-center">
                            <button 
                              class="btn btn-ghost btn-xs text-error" 
                              onclick={() => confirmDeleteRow(row)}
                              aria-label="Delete row"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      {/each}
                    {:else}
                      <tr>
                        <td colspan={tableSchema.length + 2} class="text-center py-8 text-base-content/50">
                          <div class="flex flex-col items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p class="font-medium">No rows in this table</p>
                            <button class="btn btn-sm btn-primary" onclick={openAddRowDialog}>
                              Add your first row
                            </button>
                          </div>
                        </td>
                      </tr>
                    {/if}
                  </tbody>
                </table>
              </div>
            {:else}
              <div class="text-center py-12 text-base-content/50">
                <p>Unable to load table structure</p>
              </div>
            {/if}
          </div>
        </div>
      {:else}
        <!-- Analytics View -->
        <div class="p-6">
          <h2 class="text-2xl font-semibold mb-6">Database Analytics</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="card border border-base-200 bg-base-200/30">
              <div class="card-body">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-xs text-base-content/60 uppercase tracking-wider">Read Queries</p>
                    {#if analytics.loading}
                      <span class="loading loading-spinner loading-sm mt-2"></span>
                    {:else if analytics.current}
                      <p class="text-3xl font-bold mt-1">{formatNumber(analytics.current.readQueries || 0)}</p>
                    {:else}
                      <p class="text-3xl font-bold mt-1">0</p>
                    {/if}
                  </div>
                  <div class="p-3 bg-info/10 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                </div>
                <p class="text-xs text-base-content/50 mt-2">Last 7 days</p>
              </div>
            </div>

            <div class="card border border-base-200 bg-base-200/30">
              <div class="card-body">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-xs text-base-content/60 uppercase tracking-wider">Write Queries</p>
                    {#if analytics.loading}
                      <span class="loading loading-spinner loading-sm mt-2"></span>
                    {:else if analytics.current}
                      <p class="text-3xl font-bold mt-1">{formatNumber(analytics.current.writeQueries || 0)}</p>
                    {:else}
                      <p class="text-3xl font-bold mt-1">0</p>
                    {/if}
                  </div>
                  <div class="p-3 bg-success/10 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                </div>
                <p class="text-xs text-base-content/50 mt-2">Last 7 days</p>
              </div>
            </div>

            <div class="card border border-base-200 bg-base-200/30">
              <div class="card-body">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-xs text-base-content/60 uppercase tracking-wider">Rows Read</p>
                    {#if analytics.loading}
                      <span class="loading loading-spinner loading-sm mt-2"></span>
                    {:else if analytics.current}
                      <p class="text-3xl font-bold mt-1">{formatNumber(analytics.current.rowsRead || 0)}</p>
                    {:else}
                      <p class="text-3xl font-bold mt-1">0</p>
                    {/if}
                  </div>
                  <div class="p-3 bg-warning/10 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                  </div>
                </div>
                <p class="text-xs text-base-content/50 mt-2">Last 7 days</p>
              </div>
            </div>

            <div class="card border border-base-200 bg-base-200/30">
              <div class="card-body">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-xs text-base-content/60 uppercase tracking-wider">Rows Written</p>
                    {#if analytics.loading}
                      <span class="loading loading-spinner loading-sm mt-2"></span>
                    {:else if analytics.current}
                      <p class="text-3xl font-bold mt-1">{formatNumber(analytics.current.rowsWritten || 0)}</p>
                    {:else}
                      <p class="text-3xl font-bold mt-1">0</p>
                    {/if}
                  </div>
                  <div class="p-3 bg-primary/10 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
                <p class="text-xs text-base-content/50 mt-2">Last 7 days</p>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Add Row Drawer -->
<div class="drawer drawer-end z-50">
  <input type="checkbox" bind:checked={addRowDrawerOpen} class="drawer-toggle" />
  <div class="drawer-side">
    <label for="add-row-drawer" class="drawer-overlay"></label>
    <div class="bg-base-100 w-full max-w-2xl h-full flex flex-col">
      <!-- Drawer Header -->
      <div class="sticky top-0 bg-base-100 border-b border-base-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h3 class="font-bold text-xl">Add Row</h3>
          <p class="text-sm text-base-content/60 mt-1">
            Add a new row to <span class="font-semibold text-primary">{selectedTable}</span>
          </p>
        </div>
        <button 
          class="btn btn-sm btn-circle btn-ghost" 
          onclick={() => addRowDrawerOpen = false}
          aria-label="Close drawer"
        >
          ✕
        </button>
      </div>

      <!-- Drawer Content -->
      <div class="flex-1 overflow-y-auto px-6 py-6">
        <div class="space-y-6">
          {#each tableSchema as column}
            {#if !column.pk || !column.dflt_value}
              <div class="form-control">
                <label class="label" for="add-{column.name}">
                  <span class="label-text font-semibold">
                    {column.name}
                    {#if column.notnull && !column.dflt_value}
                      <span class="text-error ml-1">*</span>
                    {/if}
                  </span>
                  <span class="label-text-alt text-xs opacity-60">
                    {column.type}
                    {#if column.pk}
                      · Primary Key
                    {/if}
                  </span>
                </label>
                
                {#if getSQLType(column.type) === 'checkbox'}
                  <div class="flex items-center gap-2 mt-2">
                    <input
                      id="add-{column.name}"
                      type="checkbox"
                      class="toggle toggle-primary"
                      bind:checked={newRowData[column.name]}
                    />
                    <span class="text-sm opacity-60">
                      {newRowData[column.name] ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                {:else if getSQLType(column.type) === 'number'}
                  <input
                    id="add-{column.name}"
                    type="number"
                    class="input input-bordered w-full"
                    bind:value={newRowData[column.name]}
                    required={column.notnull && !column.dflt_value}
                    step="any"
                    placeholder={column.dflt_value ? `Default: ${column.dflt_value}` : 'Enter a number'}
                  />
                {:else if column.type.toUpperCase().includes('TEXT') && column.name.toLowerCase().includes('description')}
                  <textarea
                    id="add-{column.name}"
                    class="textarea textarea-bordered w-full h-24"
                    bind:value={newRowData[column.name]}
                    required={column.notnull && !column.dflt_value}
                    placeholder={column.dflt_value ? `Default: ${column.dflt_value}` : 'Enter text...'}
                  ></textarea>
                {:else}
                  <input
                    id="add-{column.name}"
                    type={getSQLType(column.type)}
                    class="input input-bordered w-full"
                    bind:value={newRowData[column.name]}
                    required={column.notnull && !column.dflt_value}
                    placeholder={column.dflt_value ? `Default: ${column.dflt_value}` : `Enter ${column.type.toLowerCase()}...`}
                  />
                {/if}
                
                {#if column.dflt_value}
                  <div class="label">
                    <span class="label-text-alt text-xs opacity-50">
                      Default value: <code class="bg-base-200 px-1 rounded">{column.dflt_value}</code>
                    </span>
                  </div>
                {/if}
              </div>
            {/if}
          {/each}
        </div>
      </div>

      <!-- Drawer Footer -->
      <div class="sticky bottom-0 bg-base-100 border-t border-base-200 px-6 py-4 flex items-center justify-between gap-4">
        <button 
          type="button" 
          class="btn btn-ghost" 
          onclick={() => addRowDrawerOpen = false}
          disabled={isAddingRow}
        >
          Cancel
        </button>
        <button 
          type="button" 
          class="btn btn-primary" 
          onclick={handleAddRow}
          disabled={isAddingRow}
        >
          {#if isAddingRow}
            <span class="loading loading-spinner loading-sm"></span>
            Adding...
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
            </svg>
            Add Row
          {/if}
        </button>
      </div>
    </div>
  </div>
</div>

<!-- Delete Row Confirmation Dialog -->
<dialog bind:this={deleteRowDialog} class="modal">
  <div class="modal-box">
    <form method="dialog">
      <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
    </form>
    
    <h3 class="font-bold text-lg mb-4 text-error">Delete Row</h3>
    
    <div class="alert alert-warning mb-4">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span>This action cannot be undone!</span>
    </div>
    
    {#if rowToDelete}
      <p class="mb-4">Are you sure you want to delete this row?</p>
      <div class="bg-base-200 p-4 rounded-lg max-h-48 overflow-y-auto">
        <table class="table table-xs">
          <tbody>
            {#each Object.entries(rowToDelete) as [key, value]}
              <tr>
                <td class="font-semibold">{key}</td>
                <td class="font-mono text-xs">
                  {#if value === null}
                    <span class="text-base-content/40 italic">NULL</span>
                  {:else if typeof value === 'object'}
                    {JSON.stringify(value)}
                  {:else}
                    {value}
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
    
    <div class="modal-action">
      <button type="button" class="btn" onclick={() => deleteRowDialog.close()}>Cancel</button>
      <button type="button" class="btn btn-error" onclick={handleDeleteRow}>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        Delete Row
      </button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button>close</button>
  </form>
</dialog>
