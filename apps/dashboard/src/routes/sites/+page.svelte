<script lang="ts">
  import { 
    logRouteActivity, 
    getSites, 
    createSite,
    deleteSite
  } from '$lib/functions/sites.remote';
  import { Layout, Plus, ExternalLink, Settings, Trash2, X, FileText, AlertTriangle, CheckCircle, Database, HardDrive, Mail } from '@lucide/svelte';
  import { Button, Card, Badge, Dialog, Loading, FormField, FormInput } from '@kuratchi/ui';
  import { page } from '$app/state';

  // Get email verification status from layout data
  const isEmailVerified = $derived(page.data.isEmailVerified);

  let createDialog: HTMLDialogElement;
  let createDialogOpen = $state(false);
  let showDeleteConfirm = $state(false);
  let deletingSite = $state<any>(null);
  let isDeleting = $state(false);
  let deleteError = $state<string | null>(null);

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
    deleteError = null;
  }

  async function handleDeleteSubmit(e: Event) {
    e.preventDefault();
    if (!deletingSite) return;
    
    isDeleting = true;
    deleteError = null;
    
    const siteName = deletingSite.name;
    
    try {
      // Submit the form using the native form submission
      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);
      
      // Use fetch to submit to the deleteSite action
      const response = await fetch(deleteSite.action, {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (result?.success) {
        // Send notification about successful deletion
        try {
          await fetch('/api/notifications/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: 'Site Deleted',
              message: `"${siteName}" has been permanently deleted along with all its resources.`,
              category: 'system',
              priority: 'normal'
            })
          });
        } catch (notifyErr) {
          console.warn('Failed to send notification:', notifyErr);
        }
        
        // Refresh the sites list
        await sites.refresh();
        
        showDeleteConfirm = false;
        deletingSite = null;
      } else {
        deleteError = result?.error || 'Failed to delete site. Please try again.';
      }
    } catch (err: any) {
      deleteError = err.message || 'An unexpected error occurred.';
    } finally {
      isDeleting = false;
    }
  }

  function cancelDelete() {
    if (!isDeleting) {
      showDeleteConfirm = false;
      deletingSite = null;
      deleteError = null;
    }
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
    {#if isEmailVerified}
      <Button variant="primary" onclick={() => createDialogOpen = true}>
        <Plus class="kui-icon" />
        New Site
      </Button>
    {:else}
      <Button variant="primary" disabled title="Please verify your email to create sites">
        <Mail class="kui-icon" />
        Verify Email to Create
      </Button>
    {/if}
  </header>

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
  <Dialog bind:open={showDeleteConfirm} size="md" onClose={cancelDelete}>
    {#snippet header()}
      <div class="kui-modal-header">
        <div class="kui-modal-header-title">
          <div class="kui-modal-icon danger">
            <AlertTriangle />
          </div>
          <div>
            <h3>Delete Site</h3>
            <p class="kui-subtext">This action cannot be undone</p>
          </div>
        </div>
        <Button variant="ghost" size="xs" onclick={cancelDelete} disabled={isDeleting}>
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <div class="kui-stack">
        {#if isDeleting}
          <div class="kui-delete-progress">
            <div class="kui-delete-progress__header">
              <Loading size="md" />
              <div>
                <p class="kui-strong">Deleting "{deletingSite.name}"...</p>
                <p class="kui-subtext">Please wait while we remove all resources</p>
              </div>
            </div>
            <div class="kui-delete-progress__steps">
              <div class="kui-delete-step">
                <Database class="kui-icon" />
                <span>Removing database and worker</span>
              </div>
              <div class="kui-delete-step">
                <HardDrive class="kui-icon" />
                <span>Deleting storage bucket</span>
              </div>
              <div class="kui-delete-step">
                <Layout class="kui-icon" />
                <span>Cleaning up site records</span>
              </div>
            </div>
          </div>
        {:else if deleteError}
          <div class="kui-callout error">
            <AlertTriangle class="kui-icon" />
            <div>
              <p class="kui-strong">Failed to delete site</p>
              <p class="kui-subtext">{deleteError}</p>
            </div>
          </div>
          <div class="kui-modal-actions">
            <Button variant="ghost" onclick={cancelDelete}>Cancel</Button>
            <Button variant="error" onclick={handleDeleteSubmit}>
              <Trash2 class="kui-icon" /> Try Again
            </Button>
          </div>
        {:else}
          <div class="kui-delete-warning">
            <p>You are about to permanently delete <strong>{deletingSite.name}</strong>.</p>
            <p class="kui-subtext">The following will be removed:</p>
            <ul class="kui-delete-list">
              <!-- <li><Database class="kui-icon" /> D1 database and worker</li>
              <li><HardDrive class="kui-icon" /> R2 storage bucket and files</li> -->
              <li><Layout class="kui-icon" /> All pages and content</li>
              <li><FileText class="kui-icon" /> Form submissions</li>
            </ul>
          </div>
          <div class="kui-modal-actions">
            <Button variant="ghost" onclick={cancelDelete}>Cancel</Button>
            <form onsubmit={handleDeleteSubmit}>
              <input type="hidden" name="id" value={deletingSite.id} />
              <Button type="submit" variant="error">
                <Trash2 class="kui-icon" /> Delete Site Permanently
              </Button>
            </form>
          </div>
        {/if}
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

  /* Delete Modal Styles */
  .kui-modal-header-title {
    display: flex;
    align-items: center;
    gap: var(--kui-spacing-sm);
  }

  .kui-modal-header-title h3 {
    margin: 0;
  }

  .kui-modal-icon {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: var(--kui-radius-lg);
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  .kui-modal-icon.danger {
    background: color-mix(in srgb, var(--kui-color-error) 15%, transparent);
    color: var(--kui-color-error);
  }

  .kui-delete-progress {
    padding: var(--kui-spacing-md);
    background: var(--kui-color-surface-muted);
    border-radius: var(--kui-radius-lg);
    border: 1px solid var(--kui-color-border);
  }

  .kui-delete-progress__header {
    display: flex;
    align-items: center;
    gap: var(--kui-spacing-sm);
    margin-bottom: var(--kui-spacing-md);
  }

  .kui-delete-progress__steps {
    display: grid;
    gap: 0.5rem;
    padding-left: 0.5rem;
  }

  .kui-delete-step {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--kui-color-muted);
    font-size: 0.9rem;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .kui-delete-step:nth-child(2) {
    animation-delay: 0.3s;
  }

  .kui-delete-step:nth-child(3) {
    animation-delay: 0.6s;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  .kui-delete-warning {
    padding: var(--kui-spacing-md);
    background: color-mix(in srgb, var(--kui-color-error) 5%, var(--kui-color-surface));
    border-radius: var(--kui-radius-lg);
    border: 1px solid color-mix(in srgb, var(--kui-color-error) 20%, var(--kui-color-border));
  }

  .kui-delete-warning p {
    margin: 0 0 0.5rem;
  }

  .kui-delete-list {
    margin: 0.75rem 0 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.5rem;
  }

  .kui-delete-list li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--kui-color-muted);
    font-size: 0.9rem;
  }

  .kui-callout {
    display: flex;
    align-items: flex-start;
    gap: var(--kui-spacing-sm);
    padding: var(--kui-spacing-md);
    border-radius: var(--kui-radius-lg);
    border: 1px solid var(--kui-color-border);
  }

  .kui-callout.error {
    background: color-mix(in srgb, var(--kui-color-error) 10%, var(--kui-color-surface));
    border-color: color-mix(in srgb, var(--kui-color-error) 30%, var(--kui-color-border));
    color: var(--kui-color-error);
  }

  .kui-callout.success {
    background: color-mix(in srgb, var(--kui-color-success) 10%, var(--kui-color-surface));
    border-color: color-mix(in srgb, var(--kui-color-success) 30%, var(--kui-color-border));
    color: var(--kui-color-success);
  }

  .kui-callout.info {
    background: color-mix(in srgb, var(--kui-color-info) 10%, var(--kui-color-surface));
    border-color: color-mix(in srgb, var(--kui-color-info) 30%, var(--kui-color-border));
  }
</style>
