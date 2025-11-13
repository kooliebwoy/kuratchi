<script lang="ts">
  import { page } from '$app/stores';
  import { getDatabase, getDatabaseTables, executeQuery, getDatabaseAnalytics } from '$lib/api/database.remote';

  let queryDialog: HTMLDialogElement;
  let tableBrowserDialog: HTMLDialogElement;
  let queryResults = $state<any[]>([]);
  let selectedTable = $state<string | null>(null);
  let tableData = $state<any[]>([]);
  let tableDataLoading = $state(false);

  const databaseId = $page.params.id;
  const database = getDatabase();
  const tables = getDatabaseTables();
  const analytics = getDatabaseAnalytics();

  // Handle query results
  $effect(() => {
    if (executeQuery.result) {
      queryResults = executeQuery.result.results || [];
    }
  });

  function formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  async function viewTableData(tableName: string) {
    selectedTable = tableName;
    tableData = [];
    tableDataLoading = true;
    
    // Open dialog immediately
    tableBrowserDialog?.showModal();
    
    try {
      // Fetch table data via fetch API directly
      const response = await fetch(`/api/database/table-data?databaseId=${databaseId}&tableName=${encodeURIComponent(tableName)}`);
      if (response.ok) {
        const data = await response.json();
        tableData = data.results || [];
      }
    } catch (err) {
      console.error('Error loading table data:', err);
    } finally {
      tableDataLoading = false;
    }
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
      <button class="btn btn-outline btn-sm" onclick={() => queryDialog.showModal()}>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd" />
        </svg>
        Query
      </button>
    </div>
  </div>

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
                <div class="flex items-center justify-between">
                  <span>{table.name}</span>
                  <span class="text-xs opacity-60">{table.columnCount}</span>
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
                <button class="btn btn-sm btn-outline">Add row</button>
                <button class="btn btn-sm btn-outline">Delete row</button>
              </div>
            </div>

            {#if tableDataLoading}
              <div class="flex justify-center py-12">
                <span class="loading loading-spinner loading-lg"></span>
              </div>
            {:else if tableData.length > 0}
              <div class="overflow-x-auto border border-base-200 rounded-lg bg-base-100">
                <table class="table table-sm table-zebra">
                  <thead class="bg-base-200 sticky top-0">
                    <tr>
                      <th class="w-12">#</th>
                      {#each Object.keys(tableData[0]) as column}
                        <th class="text-left">{column}</th>
                      {/each}
                      <th class="w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each tableData as row, i}
                      <tr class="hover">
                        <td class="font-mono text-xs opacity-60">{i + 1}</td>
                        {#each Object.keys(tableData[0]) as column}
                          <td class="max-w-xs truncate text-sm">
                            {#if row[column] === null}
                              <span class="text-base-content/40 italic">NULL</span>
                            {:else if typeof row[column] === 'object'}
                              <code class="text-xs bg-base-200 px-2 py-1 rounded">{JSON.stringify(row[column]).substring(0, 50)}</code>
                            {:else}
                              <span>{row[column]}</span>
                            {/if}
                          </td>
                        {/each}
                        <td class="text-center">
                          <button class="btn btn-ghost btn-xs" aria-label="Edit row">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10.5 1.5H5.8A2.3 2.3 0 003.5 3.8v10.4a2.3 2.3 0 002.3 2.3h8.4a2.3 2.3 0 002.3-2.3V9.5M14 4v5m2.5-2.5h-5" stroke="currentColor" stroke-width="1.5" fill="none"/>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {:else}
              <div class="text-center py-12 text-base-content/50">
                <p>No data in this table</p>
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

<!-- Query Dialog -->
<dialog bind:this={queryDialog} class="modal">
  <div class="modal-box max-w-4xl">
    <form method="dialog">
      <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
    </form>
    
    <h3 class="font-bold text-lg mb-4">Run SQL Query</h3>
    
    <form {...executeQuery} class="space-y-4">
      <input type="hidden" name="databaseId" value={databaseId} />
      
      <div class="form-control">
        <label class="label" for="sql-query">
          <span class="label-text">SQL Query</span>
        </label>
        <textarea 
          id="sql-query"
          name="sql"
          class="textarea textarea-bordered font-mono text-sm h-32" 
          placeholder="SELECT * FROM users LIMIT 10;"
          required
        ></textarea>
      </div>

      <div class="modal-action">
        <button type="button" class="btn" onclick={() => queryDialog.close()}>Cancel</button>
        <button type="submit" class="btn btn-primary" disabled={executeQuery.pending > 0}>
          {#if executeQuery.pending > 0}
            <span class="loading loading-spinner loading-sm"></span>
            Executing...
          {:else}
            Execute Query
          {/if}
        </button>
      </div>
    </form>

    {#if queryResults.length > 0}
      <div class="mt-4">
        <h4 class="font-semibold mb-2">Results ({queryResults.length} rows)</h4>
        <div class="overflow-x-auto max-h-96 border border-base-300 rounded-lg">
          <table class="table table-sm table-pin-rows">
            <thead>
              <tr>
                {#each Object.keys(queryResults[0]) as key}
                  <th>{key}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each queryResults as row}
                <tr>
                  {#each Object.values(row) as value}
                    <td>{value}</td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  </div>
  <form method="dialog" class="modal-backdrop">
    <button>close</button>
  </form>
</dialog>

<!-- Table Browser Dialog -->
<dialog bind:this={tableBrowserDialog} class="modal">
  <div class="modal-box max-w-6xl">
    <form method="dialog">
      <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
    </form>
    
    <h3 class="font-bold text-lg mb-4">
      Table: <span class="text-primary">{selectedTable}</span>
    </h3>
    
    {#if tableDataLoading}
      <div class="text-center py-8 text-base-content/60">
        <span class="loading loading-spinner loading-md"></span>
        <p class="mt-2">Loading table data...</p>
      </div>
    {:else if tableData.length > 0}
      <div class="mb-4">
        <p class="text-sm text-base-content/60">Showing {tableData.length} rows (limited to 100)</p>
      </div>
      <div class="overflow-x-auto max-h-96 border border-base-300 rounded-lg">
        <table class="table table-sm table-pin-rows table-pin-cols">
          <thead class="bg-base-200">
            <tr>
              <th class="bg-base-200">#</th>
              {#each Object.keys(tableData[0]) as column}
                <th class="bg-base-200">{column}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each tableData as row, i}
              <tr class="hover">
                <td class="bg-base-200 font-mono text-xs">{i + 1}</td>
                {#each Object.keys(tableData[0]) as column}
                  <td class="font-mono text-xs">
                    {#if row[column] === null}
                      <span class="text-base-content/40 italic">NULL</span>
                    {:else if typeof row[column] === 'object'}
                      <span class="text-info">{JSON.stringify(row[column])}</span>
                    {:else}
                      {row[column]}
                    {/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <div class="text-center py-8 text-base-content/60">
        <p>No data found in this table</p>
      </div>
    {/if}
    
    <div class="modal-action">
      <button class="btn" onclick={() => tableBrowserDialog?.close()}>Close</button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button>close</button>
  </form>
</dialog>
