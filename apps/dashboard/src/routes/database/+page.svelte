<script lang="ts">
  import { Alert, Badge, Button, Dialog, Dropdown, Loading, Card } from '@kuratchi/ui';
  import { 
    logRouteActivity, 
    getDatabases, 
    createDatabase
  } from '$lib/functions/database.remote';
  import { EllipsisVertical, Plus, Database } from 'lucide-svelte';

  logRouteActivity();
  const databases = getDatabases();

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  const isSiteDb = (db: any) => !!db?.siteId;
  let createDialogOpen = $state(false);
</script>

<svelte:head>
  <title>Databases - Kuratchi Dashboard</title>
</svelte:head>

<section class="kui-dbs">
  <header class="kui-dbs__header">
    <div class="kui-inline">
      <div class="kui-icon-box">
        <Database />
      </div>
      <div>
        <p class="kui-eyebrow">Data</p>
        <h1>Databases</h1>
        <p class="kui-subtext">Manage your organization databases</p>
      </div>
    </div>
    <Button variant="primary" size="sm" onclick={() => createDialogOpen = true}>
      <Plus class="kui-icon" />
      New Database
    </Button>
  </header>

  <Card class="kui-panel">
    <div class="kui-table-scroll">
      <table class="kui-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Status</th>
            <th>Created</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#if databases.loading}
            <tr><td colspan="5" class="kui-center"><Loading /></td></tr>
          {:else if databases.error}
            <tr><td colspan="5" class="kui-center text-error">Error loading databases</td></tr>
          {:else if databases.current && databases.current.length > 0}
            {#each databases.current as db}
              <tr>
                <td>
                  <div class="kui-inline">
                    <a href="/database/{db.id}" class="kui-strong">{db.name}</a>
                    <Badge variant="ghost" size="xs">{isSiteDb(db) ? 'Site DB' : 'Org DB'}</Badge>
                  </div>
                </td>
                <td class="kui-subtext">{db.description || '-'}</td>
                <td>
                  <Badge variant={db.status ? 'success' : 'error'} size="sm">
                    {db.status ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td class="kui-subtext">{formatDate(db.created_at)}</td>
                <td class="text-right">
                  <Dropdown position="bottom-end">
                    {#snippet trigger()}
                      <Button variant="ghost" size="xs" aria-label="Open actions">
                        <EllipsisVertical class="kui-icon" />
                      </Button>
                    {/snippet}
                    <div class="kui-menu">
                      <a href="/database/{db.id}">View Details</a>
                      {#if !isSiteDb(db)}
                        <button type="button" class="text-error">Delete</button>
                      {/if}
                    </div>
                  </Dropdown>
                </td>
              </tr>
            {/each}
          {:else}
            <tr>
              <td colspan="5" class="kui-center">
                <div class="kui-stack center">
                  <Database class="kui-empty__icon" />
                  <p class="kui-subtext">No databases yet</p>
                  <p class="kui-subtext">Create your first database to get started</p>
                  <Button variant="primary" size="sm" onclick={() => createDialogOpen = true}>
                    Create Database
                  </Button>
                </div>
              </td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  </Card>
</section>

<Dialog bind:open={createDialogOpen} size="md">
  {#snippet header()}
    <h3 class="kui-strong">Create New Database</h3>
  {/snippet}

  {#if createDatabase.result?.success}
    <Alert type="success" class="mb-4">
      Database created successfully!
    </Alert>
  {/if}

  {#if createDatabase.pending > 0}
    <Alert type="info" class="mb-4">
      <div>
        <div class="kui-strong">Creating D1 database...</div>
        <div class="kui-subtext">This may take 5-10 seconds as we deploy your dedicated worker</div>
      </div>
    </Alert>
  {/if}
  
  <form {...createDatabase} class="kui-stack" enctype="multipart/form-data">
    <label class="kui-form-control" for="db-name">
      <span class="kui-label">Database Name</span>
      <input 
        id="db-name"
        type="text" 
        name="name"
        placeholder="my-database" 
        class="kui-input" 
        pattern="[a-z0-9-]+"
        required
      />
      <span class="kui-helper-text">Use lowercase letters, numbers, and hyphens only</span>
    </label>

    <label class="kui-form-control" for="db-description">
      <span class="kui-label">Description</span>
      <textarea 
        id="db-description"
        name="description"
        class="kui-textarea" 
        placeholder="Describe your database..."
        required
      ></textarea>
    </label>

    <label class="kui-form-control" for="db-type">
      <span class="kui-label">Database Type</span>
      <select class="kui-select" name="type" id="db-type" required>
        <option value="standard">Standard (3 replicas)</option>
        <option value="edge">Edge Optimized</option>
      </select>
    </label>

    <div class="dialog-checkboxes">
      <label class="kui-checkbox-field">
        <input type="checkbox" class="kui-checkbox" name="backups" checked />
        <span class="kui-label">Enable automated backups</span>
      </label>
      <label class="kui-checkbox-field">
        <input type="checkbox" class="kui-checkbox" name="global_replicas" />
        <span class="kui-label">Enable global read replicas</span>
      </label>
    </div>

    {#snippet actions(close)}
      <Button variant="ghost" type="button" onclick={close}>Cancel</Button>
      <Button variant="primary" type="submit" disabled={createDatabase.pending > 0}>
        {#if createDatabase.pending > 0}
          <Loading />
          Creating...
        {:else}
          Create Database
        {/if}
      </Button>
    {/snippet}
  </form>
</Dialog>

<style>
  .kui-dbs {
    display: grid;
    gap: var(--kui-spacing-md);
  }

  .kui-dbs__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--kui-spacing-md);
    flex-wrap: wrap;
  }

  .kui-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }

  .kui-icon-box {
    width: 3rem;
    height: 3rem;
    border-radius: var(--kui-radius-lg);
    background: var(--kui-color-primary-weak);
    color: var(--kui-color-primary);
    display: grid;
    place-items: center;
  }

  .kui-eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--kui-color-muted);
    font-weight: 700;
    margin: 0;
    font-size: 0.8rem;
  }

  h1 {
    margin: 0.1rem 0 0.2rem;
    font-size: 1.6rem;
  }

  .kui-subtext {
    color: var(--kui-color-muted);
    margin: 0;
  }

  .kui-panel .kui-card__body {
    gap: var(--kui-spacing-md);
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

  .kui-strong {
    font-weight: 700;
  }

  .kui-menu {
    display: grid;
    gap: 0.25rem;
    padding: 0.35rem 0.5rem;
  }

  .kui-menu a,
  .kui-menu button {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.5rem;
    border: none;
    background: transparent;
    border-radius: var(--kui-radius-md, 0.5rem);
    font-size: 0.9rem;
    cursor: pointer;
    color: inherit;
  }

  .kui-menu a:hover,
  .kui-menu button:hover {
    background-color: rgba(80, 70, 228, 0.08);
  }

  .dialog-checkboxes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .text-right {
    text-align: right;
  }
</style>
