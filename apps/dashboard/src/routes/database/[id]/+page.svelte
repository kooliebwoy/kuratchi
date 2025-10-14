<script lang="ts">
  import { page } from '$app/stores';
  import { getDatabaseTables, executeQuery, getDatabaseAnalytics } from '$lib/api/database.remote';

  let queryDialog: HTMLDialogElement;
  let queryResults = $state<any[]>([]);

  const databaseId = $page.params.id;
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
</script>

<svelte:head>
  <title>Database Details - Kuratchi Dashboard</title>
</svelte:head>

<section class="space-y-8">
  <!-- Header -->
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div class="flex items-center gap-4">
      <a href="/database" class="btn btn-ghost btn-sm">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
        </svg>
        Back
      </a>
      <div>
        <h1 class="text-2xl font-semibold">Database Overview</h1>
        <p class="text-sm text-base-content/60">{databaseId}</p>
      </div>
    </div>
    <div class="flex gap-2">
      <button class="btn btn-outline btn-sm" onclick={() => queryDialog.showModal()}>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd" />
        </svg>
        Run Query
      </button>
    </div>
  </div>

  <!-- Analytics Stats -->
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

  <!-- Tables Explorer -->
  <div class="card border border-base-200 bg-base-200/30">
    <div class="card-body gap-6">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold">Tables</h3>
          <p class="text-xs text-base-content/60">Database schema and structure</p>
        </div>
      </div>
      <div class="overflow-hidden rounded-xl border border-base-200/60">
        <table class="table">
          <thead class="bg-base-200/50 text-xs uppercase tracking-widest text-base-content/40">
            <tr>
              <th>Table</th>
              <th>Columns</th>
              <th>Indexes</th>
              <th>Replication</th>
            </tr>
          </thead>
          <tbody>
            {#if tables.loading}
              <tr>
                <td colspan="4" class="text-center py-8">
                  <span class="loading loading-spinner loading-md"></span>
                </td>
              </tr>
            {:else if tables.error}
              <tr>
                <td colspan="4" class="text-center py-8 text-error">
                  Error loading tables
                </td>
              </tr>
            {:else if tables.current && tables.current.length > 0}
              {#each tables.current as table}
                <tr class="text-sm">
                  <td class="font-semibold text-primary">{table.name}</td>
                  <td>{table.columnCount}</td>
                  <td>{table.indexCount}</td>
                  <td>{table.replication}</td>
                </tr>
              {/each}
            {:else}
              <tr>
                <td colspan="4" class="text-center py-8 text-base-content/60">
                  No tables found in this database.
                </td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</section>

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
