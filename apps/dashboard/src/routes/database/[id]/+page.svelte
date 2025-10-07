<script lang="ts">
  import { page } from '$app/stores';
  import { getDatabaseTables, executeQuery } from '../database.remote';

  let queryDialog: HTMLDialogElement;
  let queryResults = $state<any[]>([]);

  const databaseId = $page.params.id;
  const tables = getDatabaseTables();

  // Handle query results
  $effect(() => {
    if (executeQuery.result) {
      queryResults = executeQuery.result.results || [];
    }
  });
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
