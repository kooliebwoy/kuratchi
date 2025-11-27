<script lang="ts">
  import { 
    logRouteActivity, 
    getSites, 
    createSite,
    deleteSite
  } from '$lib/functions/sites.remote';
  import { Layout, Plus, ExternalLink, Settings, Trash2, X, FileText } from '@lucide/svelte';
  import { Button, Card, Badge, Dialog, Loading, FormField, FormInput } from '@kuratchi/ui';

  let createDialog: HTMLDialogElement;
  let createDialogOpen = $state(false);
  let showDeleteConfirm = $state(false);
  let deletingSite = $state<any>(null);

  logRouteActivity();
  const sites = getSites();

  function handleCreateSiteSubmit() {
    if (createSite.result?.success) {
      createDialogOpen = false;
      createDialog?.close();
    }
  }

  function handleDeleteClick(site: any) {
    deletingSite = site;
    showDeleteConfirm = true;
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
</script>

<svelte:head>
  <title>Sites - Kuratchi Dashboard</title>
</svelte:head>

<div class="kui-sites">
  <header class="kui-sites__header">
    <div>
      <p class="kui-eyebrow">Sites</p>
      <h1>Manage your Kuratchi websites</h1>
      <p class="kui-subtext">Create, manage, and access each site.</p>
    </div>
    <Button variant="primary" onclick={() => createDialogOpen = true}>
      <Plus class="kui-icon" />
      New Site
    </Button>
  </header>

  <Card class="kui-panel">
    <div class="kui-table-scroll">
      {#if sites.loading}
        <div class="kui-center"><Loading size="md" /></div>
      {:else if sites.error}
        <div class="kui-callout error">Error loading sites. Please try again.</div>
      {:else if sites.current && sites.current.length > 0}
        <table class="kui-table">
          <thead>
            <tr>
              <th>Site Name</th>
              <th>Subdomain</th>
              <th>Theme</th>
              <th>Created</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each sites.current as site}
              <tr>
                <td>
                  <div class="kui-inline">
                    <Layout class="kui-icon" />
                    <div>
                      <p class="kui-strong">{site.name}</p>
                      {#if site.description}
                        <p class="kui-subtext">{site.description}</p>
                      {/if}
                    </div>
                  </div>
                </td>
                <td><span class="kui-code">{site.subdomain}.kuratchi.site</span></td>
                <td><Badge variant="ghost" size="xs">{site.theme || 'Default'}</Badge></td>
                <td class="kui-subtext">{formatDate(site.created_at)}</td>
                <td class="text-right">
                  <div class="kui-inline end">
                    <Button variant="ghost" size="xs" href={`/sites/${site.id}`} aria-label="Edit site">
                      <Settings class="kui-icon" />
                    </Button>
                    <Button variant="ghost" size="xs" href={`/sites/${site.id}/forms`} aria-label="Manage forms">
                      <FileText class="kui-icon" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      href={`https://${site.subdomain}.kuratchi.site`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Visit site"
                    >
                      <ExternalLink class="kui-icon" />
                    </Button>
                    <Button variant="ghost" size="xs" onclick={() => handleDeleteClick(site)} aria-label="Delete site">
                      <Trash2 class="kui-icon error" />
                    </Button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <div class="kui-center">
          <Layout class="kui-empty__icon" />
          <p class="kui-subtext">No sites found</p>
          <Button variant="primary" size="sm" onclick={() => createDialogOpen = true}>
            <Plus class="kui-icon" />
            Create Your First Site
          </Button>
        </div>
      {/if}
    </div>
  </Card>
</div>

<Dialog bind:open={createDialogOpen} bind:this={createDialog} size="md">
  {#snippet header()}
    <div class="kui-modal-header">
      <h3>Create New Site</h3>
      <Button variant="ghost" size="xs" onclick={() => { createDialogOpen = false; createDialog.close(); }}>
        <X class="kui-icon" />
      </Button>
    </div>
  {/snippet}
  {#snippet children()}
    <div class="kui-stack">
      {#if createSite.result?.success}
        <div class="kui-callout success">Site created successfully!</div>
      {/if}
      {#if createSite.pending > 0}
        <div class="kui-callout info">
          <Loading size="sm" />
          <div>
            <p class="kui-strong">Creating your site...</p>
            <p class="kui-subtext">Setting up your Kuratchi website</p>
          </div>
        </div>
      {/if}

      <form {...createSite} class="kui-stack" enctype="multipart/form-data" onsubmit={handleCreateSiteSubmit}>
        <FormField label="Site Name" issues={createSite.fields.name.issues()}>
          <FormInput field={createSite.fields.name} placeholder="My Awesome Site" />
          <span class="kui-subtext">A friendly name for your site</span>
        </FormField>

        <div class="kui-modal-actions">
          <Button variant="ghost" type="button" onclick={() => { createDialogOpen = false; createDialog.close(); }}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={createSite.pending > 0}>
            {#if createSite.pending > 0}
              <Loading size="sm" /> Creating...
            {:else}
              Create Site
            {/if}
          </Button>
        </div>
      </form>
    </div>
  {/snippet}
</Dialog>

{#if showDeleteConfirm && deletingSite}
  <Dialog bind:open={showDeleteConfirm} size="sm" onClose={() => { showDeleteConfirm = false; deletingSite = null; }}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3 class="text-error">Confirm Delete</h3>
        <Button variant="ghost" size="xs" onclick={() => { showDeleteConfirm = false; deletingSite = null; }}>
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="kui-stack">
        <p class="kui-subtext">Are you sure you want to delete <strong>{deletingSite.name}</strong>?</p>
        <p class="kui-subtext">This will permanently delete the site and its data.</p>
        <div class="kui-modal-actions">
          <Button variant="ghost" onclick={() => { showDeleteConfirm = false; deletingSite = null; }}>Cancel</Button>
          <form {...deleteSite} onsubmit={() => { showDeleteConfirm = false; deletingSite = null; }}>
            <input type="hidden" name="id" value={deletingSite.id} />
            <Button type="submit" variant="error">
              <Trash2 class="kui-icon" /> Delete Site
            </Button>
          </form>
        </div>
      </div>
    {/snippet}
  </Dialog>
{/if}

<style>
  .kui-sites {
    display: grid;
    gap: var(--kui-spacing-md);
  }

  .kui-sites__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--kui-spacing-md);
    flex-wrap: wrap;
  }

  h1 {
    margin: 0.1rem 0 0.2rem;
    font-size: 1.6rem;
  }

  .kui-eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--kui-color-muted);
    font-weight: 700;
    margin: 0;
    font-size: 0.8rem;
  }

  .kui-subtext {
    color: var(--kui-color-muted);
    margin: 0;
  }

  .kui-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }

  .kui-inline.end {
    justify-content: flex-end;
  }

  .kui-icon {
    width: 1rem;
    height: 1rem;
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
    border-bottom: 1px solid var(--kui-color-border);
    text-align: left;
    vertical-align: middle;
  }

  .kui-table thead th {
    background: var(--kui-color-surface-muted);
    font-weight: 700;
    font-size: 0.9rem;
  }

  .kui-strong {
    font-weight: 700;
  }

  .kui-code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.9rem;
  }

  .kui-center {
    display: grid;
    place-items: center;
    gap: 0.35rem;
    text-align: center;
    padding: var(--kui-spacing-lg);
  }

  .kui-empty__icon {
    width: 3rem;
    height: 3rem;
    color: var(--kui-color-muted);
  }

  .kui-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--kui-spacing-sm);
  }

  .kui-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--kui-spacing-sm);
  }

  .kui-stack {
    display: grid;
    gap: var(--kui-spacing-sm);
  }

  .text-right {
    text-align: right;
  }
</style>
