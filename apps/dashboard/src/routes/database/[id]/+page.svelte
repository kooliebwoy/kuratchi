<script lang="ts">
  import { page } from '$app/stores';
  import { Button, Card, Loading, Badge } from '@kuratchi/ui';
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
    // remote function submission handles execution
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
    newRowData = {};
    tableSchema.forEach((col: any) => {
      if (!col.pk) {
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
      const whereColumns = Object.keys(rowToDelete);
      const whereClause = whereColumns.map(col => `${col} = ?`).join(' AND ');
      const whereValues = whereColumns.map(col => rowToDelete[col]);

      await deleteTableRow({
        tableName: selectedTable,
        databaseId,
        whereClause,
        whereValues
      });

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

<div class="kui-db">
  <header class="kui-db__header">
    <div class="kui-inline">
      <a class="kui-button kui-button--ghost kui-button--size-sm" href="/database" aria-label="Go back">
        ← Back
      </a>
      <div>
        {#if database.loading}
          <div class="kui-inline">
            <Loading size="sm" />
            <h1>Loading...</h1>
          </div>
        {:else if database.current}
          <h1>{database.current.name}</h1>
          <p class="kui-subtext">Database Studio</p>
        {:else}
          <h1>Database Studio</h1>
        {/if}
      </div>
    </div>
    <Button variant={queryPanelOpen ? 'primary' : 'ghost'} size="sm" onclick={() => queryPanelOpen = !queryPanelOpen}>
      SQL Query
    </Button>
  </header>

  {#if queryPanelOpen}
    <Card class="kui-panel">
      <form {...executeQuery} onsubmit={handleExecuteQuery} class="kui-stack">
        <input type="hidden" name="databaseId" value={databaseId} />
        <div class="kui-query">
          <textarea
            id="sql-query"
            name="sql"
            class="kui-textarea kui-textarea--code"
            placeholder={`SELECT * FROM ${selectedTable || 'table_name'} LIMIT 10;`}
            bind:value={sqlQuery}
            required
          ></textarea>
          <div class="kui-query__actions">
            <Button type="submit" variant="primary" size="sm" disabled={isExecutingQuery || !sqlQuery.trim()}>
              {#if isExecutingQuery}
                <Loading size="sm" />
                Running...
              {:else}
                Execute
              {/if}
            </Button>
            <div class="kui-inline">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onclick={() => sqlQuery = selectedTable ? `SELECT * FROM ${selectedTable} LIMIT 10;` : 'SELECT * FROM table_name LIMIT 10;'}
              >
                Example
              </Button>
              <Button type="button" variant="ghost" size="xs" onclick={() => { sqlQuery = ''; queryResults = []; }}>
                Clear
              </Button>
            </div>
          </div>
        </div>
      </form>

      {#if queryResults.length > 0}
        <div class="kui-query__results">
          <div class="kui-query__results-header">
            <div class="kui-inline">
              <Badge variant="success" size="sm">{queryResults.length} {queryResults.length === 1 ? 'row' : 'rows'} returned</Badge>
            </div>
            <Button variant="ghost" size="xs" onclick={() => queryResults = []}>Close</Button>
          </div>
          <div class="kui-table-scroll">
            <table class="kui-table">
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
                      <td class="kui-code">
                        {#if value === null}
                          <span class="muted">NULL</span>
                        {:else if typeof value === 'object'}
                          {JSON.stringify(value)}
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
    </Card>
  {/if}

  <div class="kui-db__layout">
    <Card class="kui-panel kui-panel--sidebar" title="Tables">
      <div class="kui-stack">
        <div class="kui-input-group">
          <input class="kui-input" type="text" placeholder="Search tables..." />
        </div>
        <div class="kui-table-list">
          {#if tables.loading}
            <div class="kui-center">
              <Loading size="sm" />
            </div>
          {:else if tables.error}
            <p class="kui-subtext">Error loading tables</p>
          {:else if tables.current && tables.current.length > 0}
            {#each tables.current as table}
              <button
                class={`kui-table-list__item ${selectedTable === table.name ? 'is-active' : ''}`}
                onclick={() => viewTableData(table.name)}
              >
                <span class="truncate">{table.name}</span>
                <Badge variant="ghost" size="xs">{table.columnCount}</Badge>
              </button>
            {/each}
          {:else}
            <p class="kui-subtext">No tables found</p>
          {/if}
        </div>
      </div>
    </Card>

    <div class="kui-db__main">
      {#if selectedTable}
        <Card class="kui-panel">
          <div class="kui-panel__header">
            <div>
              <h2>{selectedTable}</h2>
              <p class="kui-subtext">Showing up to 100 rows</p>
            </div>
            <Button variant="primary" size="sm" onclick={openAddRowDialog} disabled={tableDataLoading || tableSchema.length === 0}>
              Add Row
            </Button>
          </div>

          {#if tableDataLoading}
            <div class="kui-center">
              <Loading size="lg" />
              <p class="kui-subtext">Loading table data...</p>
            </div>
          {:else if tableSchema.length > 0}
            <div class="kui-subtext">
              {#if tableData.length > 0}
                Showing {tableData.length} rows (limited to 100)
              {:else}
                Table is empty (0 rows)
              {/if}
            </div>

            <div class="kui-table-scroll">
              <table class="kui-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {#each tableSchema as column}
                      <th>
                        <div class="kui-inline">
                          <span>{column.name}</span>
                          {#if column.pk}
                            <Badge variant="primary" size="xs">PK</Badge>
                          {/if}
                        </div>
                        <div class="kui-subtext">
                          {column.type}{#if column.notnull && !column.pk} · NOT NULL{/if}
                        </div>
                      </th>
                    {/each}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {#if tableData.length > 0}
                    {#each tableData as row, i}
                      <tr>
                        <td class="kui-code muted">{i + 1}</td>
                        {#each tableSchema as column}
                          <td class="truncate">
                            {#if row[column.name] === null}
                              <span class="muted">NULL</span>
                            {:else if typeof row[column.name] === 'object'}
                              <span class="kui-code">{JSON.stringify(row[column.name]).substring(0, 80)}</span>
                            {:else}
                              {row[column.name]}
                            {/if}
                          </td>
                        {/each}
                        <td>
                          <Button variant="ghost" size="xs" onclick={() => confirmDeleteRow(row)}>
                            Delete
                          </Button>
                        </td>
                      </tr>
                    {/each}
                  {:else}
                    <tr>
                      <td colspan={tableSchema.length + 2} class="kui-center">
                        <div>
                          <p class="kui-subtext">No rows in this table</p>
                          <Button variant="primary" size="sm" onclick={openAddRowDialog}>Add your first row</Button>
                        </div>
                      </td>
                    </tr>
                  {/if}
                </tbody>
              </table>
            </div>
          {:else}
            <p class="kui-subtext">Unable to load table structure</p>
          {/if}
        </Card>
      {:else}
        <div class="kui-grid">
          <Card class="kui-panel">
            <div class="kui-analytics">
              <div>
                <p class="kui-eyebrow">Read Queries</p>
                {#if analytics.loading}
                  <Loading size="sm" />
                {:else if analytics.current}
                  <h3>{formatNumber(analytics.current.readQueries || 0)}</h3>
                {:else}
                  <h3>0</h3>
                {/if}
                <p class="kui-subtext">Last 7 days</p>
              </div>
            </div>
          </Card>
          <Card class="kui-panel">
            <div class="kui-analytics">
              <div>
                <p class="kui-eyebrow">Write Queries</p>
                {#if analytics.loading}
                  <Loading size="sm" />
                {:else if analytics.current}
                  <h3>{formatNumber(analytics.current.writeQueries || 0)}</h3>
                {:else}
                  <h3>0</h3>
                {/if}
                <p class="kui-subtext">Last 7 days</p>
              </div>
            </div>
          </Card>
          <Card class="kui-panel">
            <div class="kui-analytics">
              <div>
                <p class="kui-eyebrow">Rows Read</p>
                {#if analytics.loading}
                  <Loading size="sm" />
                {:else if analytics.current}
                  <h3>{formatNumber(analytics.current.rowsRead || 0)}</h3>
                {:else}
                  <h3>0</h3>
                {/if}
                <p class="kui-subtext">Last 7 days</p>
              </div>
            </div>
          </Card>
          <Card class="kui-panel">
            <div class="kui-analytics">
              <div>
                <p class="kui-eyebrow">Rows Written</p>
                {#if analytics.loading}
                  <Loading size="sm" />
                {:else if analytics.current}
                  <h3>{formatNumber(analytics.current.rowsWritten || 0)}</h3>
                {:else}
                  <h3>0</h3>
                {/if}
                <p class="kui-subtext">Last 7 days</p>
              </div>
            </div>
          </Card>
        </div>
      {/if}
    </div>
  </div>
</div>

{#if addRowDrawerOpen}
  <div class="kui-drawer">
    <div class="kui-drawer__panel">
      <div class="kui-drawer__header">
        <div>
          <h3>Add Row</h3>
          <p class="kui-subtext">Add a new row to <strong>{selectedTable}</strong></p>
        </div>
        <Button variant="ghost" size="sm" onclick={() => addRowDrawerOpen = false}>Close</Button>
      </div>

      <div class="kui-drawer__body">
        {#each tableSchema as column}
          {#if !column.pk || !column.dflt_value}
            <div class="kui-stack">
              <label class="kui-label" for="add-{column.name}">
                {column.name}
                {#if column.notnull && !column.dflt_value}
                  <span class="kui-required">*</span>
                {/if}
                <span class="kui-subtext">{column.type}{column.pk ? ' · Primary Key' : ''}</span>
              </label>

              {#if getSQLType(column.type) === 'checkbox'}
                <div class="kui-inline">
                  <input
                    id="add-{column.name}"
                    type="checkbox"
                    class="kui-checkbox"
                    bind:checked={newRowData[column.name]}
                  />
                  <span class="kui-subtext">{newRowData[column.name] ? 'Enabled' : 'Disabled'}</span>
                </div>
              {:else if getSQLType(column.type) === 'number'}
                <input
                  id="add-{column.name}"
                  type="number"
                  class="kui-input"
                  bind:value={newRowData[column.name]}
                  required={column.notnull && !column.dflt_value}
                  step="any"
                  placeholder={column.dflt_value ? `Default: ${column.dflt_value}` : 'Enter a number'}
                />
              {:else if column.type.toUpperCase().includes('TEXT') && column.name.toLowerCase().includes('description')}
                <textarea
                  id="add-{column.name}"
                  class="kui-textarea"
                  bind:value={newRowData[column.name]}
                  required={column.notnull && !column.dflt_value}
                  placeholder={column.dflt_value ? `Default: ${column.dflt_value}` : 'Enter text...'}
                ></textarea>
              {:else}
                <input
                  id="add-{column.name}"
                  type={getSQLType(column.type)}
                  class="kui-input"
                  bind:value={newRowData[column.name]}
                  required={column.notnull && !column.dflt_value}
                  placeholder={column.dflt_value ? `Default: ${column.dflt_value}` : `Enter ${column.type.toLowerCase()}...`}
                />
              {/if}

              {#if column.dflt_value}
                <p class="kui-subtext">Default value: <code>{column.dflt_value}</code></p>
              {/if}
            </div>
          {/if}
        {/each}
      </div>

      <div class="kui-drawer__footer">
        <Button variant="ghost" onclick={() => addRowDrawerOpen = false} disabled={isAddingRow}>Cancel</Button>
        <Button variant="primary" onclick={handleAddRow} disabled={isAddingRow}>
          {#if isAddingRow}
            <Loading size="sm" />
            Adding...
          {:else}
            Add Row
          {/if}
        </Button>
      </div>
    </div>
    <div class="kui-drawer__backdrop" onclick={() => addRowDrawerOpen = false}></div>
  </div>
{/if}

<dialog bind:this={deleteRowDialog} class="kui-modal">
  <div class="kui-modal__box">
    <div class="kui-modal__header">
      <h3>Delete Row</h3>
      <Button variant="ghost" size="sm" onclick={() => deleteRowDialog.close()}>Close</Button>
    </div>

    <div class="kui-modal__body">
      <p class="kui-subtext">This action cannot be undone.</p>
      {#if rowToDelete}
        <div class="kui-table-scroll">
          <table class="kui-table">
            <tbody>
              {#each Object.entries(rowToDelete) as [key, value]}
                <tr>
                  <td class="kui-code">{key}</td>
                  <td class="kui-code">
                    {#if value === null}
                      <span class="muted">NULL</span>
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
    </div>

    <div class="kui-modal__footer">
      <Button variant="ghost" onclick={() => deleteRowDialog.close()}>Cancel</Button>
      <Button variant="error" onclick={handleDeleteRow}>Delete Row</Button>
    </div>
  </div>
</dialog>

<style>
  .kui-db {
    display: grid;
    gap: var(--kui-spacing-md);
  }

  .kui-db__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--kui-spacing-md);
    flex-wrap: wrap;
  }

  .kui-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  h1 {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 700;
  }

  .kui-subtext {
    color: var(--kui-color-muted);
    margin: 0;
  }

  .kui-panel .kui-card__body {
    gap: var(--kui-spacing-md);
  }

  .kui-stack {
    display: grid;
    gap: var(--kui-spacing-sm);
  }

  .kui-query {
    display: grid;
    gap: var(--kui-spacing-sm);
  }

  .kui-textarea {
    width: 100%;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    padding: 0.75rem;
    background: var(--kui-color-surface);
    font-size: 0.95rem;
  }

  .kui-textarea--code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    min-height: 140px;
  }

  .kui-query__actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--kui-spacing-sm);
    flex-wrap: wrap;
  }

  .kui-query__results {
    border-top: 1px solid var(--kui-color-border);
    padding-top: var(--kui-spacing-md);
    display: grid;
    gap: var(--kui-spacing-sm);
  }

  .kui-query__results-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .kui-table-scroll {
    overflow: auto;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-lg);
    background: var(--kui-color-surface);
  }

  .kui-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 100%;
  }

  .kui-table th,
  .kui-table td {
    padding: 0.65rem;
    text-align: left;
    border-bottom: 1px solid var(--kui-color-border);
    vertical-align: top;
  }

  .kui-table thead th {
    background: var(--kui-color-surface-muted);
    font-weight: 700;
    font-size: 0.9rem;
  }

  .kui-code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.85rem;
    word-break: break-word;
  }

  .muted {
    color: var(--kui-color-muted);
  }

  .kui-db__layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: var(--kui-spacing-md);
    align-items: start;
  }

  .kui-panel--sidebar .kui-card__body {
    gap: var(--kui-spacing-sm);
  }

  .kui-input-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    padding: 0.35rem 0.6rem;
    background: var(--kui-color-surface);
  }

  .kui-input {
    width: 100%;
    border: none;
    outline: none;
    background: transparent;
    font-size: 0.95rem;
    color: var(--kui-color-text);
  }

  .kui-table-list {
    display: grid;
    gap: 0.35rem;
  }

  .kui-table-list__item {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    background: var(--kui-color-surface);
    padding: 0.55rem 0.75rem;
    cursor: pointer;
    transition: border-color var(--kui-duration-base) ease, box-shadow var(--kui-duration-base) ease, transform var(--kui-duration-base) ease;
  }

  .kui-table-list__item:hover {
    border-color: color-mix(in srgb, var(--kui-color-primary) 35%, var(--kui-color-border) 65%);
    box-shadow: var(--kui-shadow-xs);
    transform: translateY(-1px);
  }

  .kui-table-list__item.is-active {
    border-color: color-mix(in srgb, var(--kui-color-primary) 50%, var(--kui-color-border) 50%);
    background: rgba(88, 76, 217, 0.06);
  }

  .kui-db__main {
    display: grid;
    gap: var(--kui-spacing-md);
  }

  .kui-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--kui-spacing-sm);
    flex-wrap: wrap;
  }

  .kui-grid {
    display: grid;
    gap: var(--kui-spacing-md);
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .kui-analytics h3 {
    margin: 0.2rem 0;
    font-size: 1.6rem;
  }

  .kui-drawer {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: grid;
    justify-items: end;
  }

  .kui-drawer__panel {
    width: min(640px, 100%);
    height: 100%;
    background: var(--kui-color-surface);
    border-left: 1px solid var(--kui-color-border);
    display: flex;
    flex-direction: column;
    gap: var(--kui-spacing-md);
    padding: var(--kui-spacing-lg);
    box-shadow: -12px 0 32px rgba(15, 23, 42, 0.12);
    position: relative;
    z-index: 1;
  }

  .kui-drawer__header,
  .kui-drawer__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--kui-spacing-sm);
  }

  .kui-drawer__body {
    flex: 1;
    overflow-y: auto;
    display: grid;
    gap: var(--kui-spacing-md);
  }

  .kui-drawer__backdrop {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.35);
    backdrop-filter: blur(4px);
  }

  .kui-label {
    font-weight: 700;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .kui-required {
    color: var(--kui-color-error);
    margin-left: 0.25rem;
  }

  .kui-checkbox {
    width: 1rem;
    height: 1rem;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-xs);
  }

  .kui-modal {
    width: 100%;
    height: 100%;
    border: none;
    background: transparent;
    display: grid;
    place-items: center;
  }

  .kui-modal::backdrop {
    background: rgba(15, 23, 42, 0.35);
    backdrop-filter: blur(4px);
  }

  .kui-modal__box {
    width: min(540px, 100% - 32px);
    background: var(--kui-color-surface);
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-lg);
    box-shadow: var(--kui-shadow-lg);
    padding: var(--kui-spacing-md);
    display: grid;
    gap: var(--kui-spacing-md);
  }

  .kui-modal__header,
  .kui-modal__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--kui-spacing-sm);
  }

  .kui-modal__body {
    display: grid;
    gap: var(--kui-spacing-sm);
  }

  @media (max-width: 960px) {
    .kui-db__layout {
      grid-template-columns: 1fr;
    }

    .kui-panel--sidebar {
      position: relative;
    }
  }
</style>
