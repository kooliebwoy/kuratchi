<script lang="ts">
  import { 
    getAllBuckets, 
    enableBucketPublicDomain, 
    addBucketCustomDomain 
  } from '$lib/functions/storage.remote';
  import { HardDrive, Globe, ExternalLink, Settings, CheckCircle, XCircle, AlertCircle, X } from '@lucide/svelte';
  import { Button, Dialog, Loading } from '@kuratchi/ui';

  let bucketsQuery = getAllBuckets(undefined);
  let data = $derived(bucketsQuery.current);
  
  let buckets = $derived<any[]>(data?.buckets ?? []);

  let customDomainDialog: any;
  let selectedBucket = $state<any>(null);
  let dialogOpen = $state(false);

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  function handleAddCustomDomain(bucket: any) {
    selectedBucket = bucket;
    customDomainDialog.showModal();
  }
</script>

<svelte:head>
  <title>Storage - Kuratchi Dashboard</title>
</svelte:head>

<div class="kui-storage">
  <div class="kui-storage__header">
    <div>
      <h2>Storage</h2>
      <p class="kui-storage__subtitle">Manage R2 buckets and configure domains</p>
    </div>
  </div>

  <div class="kui-table-scroll">
    {#if bucketsQuery.loading}
      <div class="kui-center"><Loading size="md" /></div>
    {:else if bucketsQuery.error}
      <div class="kui-callout error">Error loading buckets. Please try again.</div>
    {:else if buckets.length > 0}
      <table class="kui-table">
        <thead>
          <tr>
            <th>Bucket / Site</th>
            <th>Public Domain</th>
            <th>Custom Domain</th>
            <th>Created</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each buckets as bucket}
            <tr>
              <td>
                <div class="kui-bucket-cell">
                  <HardDrive class="kui-icon" />
                  <div>
                    <p class="kui-bucket-name">{bucket.name}</p>
                    {#if bucket.metadata?.name}
                      <p class="kui-bucket-meta">
                        {bucket.metadata.name}
                        {#if bucket.metadata.subdomain}
                          · <code>{bucket.metadata.subdomain}.kuratchi.com</code>
                        {/if}
                      </p>
                    {/if}
                  </div>
                </div>
              </td>
              <td>
                {#if bucket.publicDomain?.enabled}
                  <div class="kui-status success">
                    <CheckCircle class="kui-icon" />
                    Enabled
                  </div>
                {:else}
                  <div class="kui-status disabled">
                    <XCircle class="kui-icon" />
                    Disabled
                  </div>
                {/if}
              </td>
              <td>
                {#if bucket.customDomain}
                  <code class="kui-domain-code">{bucket.customDomain}</code>
                {:else}
                  <div class="kui-status warning">
                    <AlertCircle class="kui-icon" />
                    Not configured
                  </div>
                {/if}
              </td>
              <td class="kui-date">{formatDate(bucket.creation_date)}</td>
              <td class="text-right">
                <div class="kui-actions">
                  <Button variant="ghost" size="xs" href={`/storage/${bucket.name}`} title="Browse files">
                    <HardDrive class="kui-icon" />
                  </Button>

                  {#if !bucket.publicDomain?.enabled}
                    <form {...enableBucketPublicDomain}>
                      <input type="hidden" name="bucketName" value={bucket.name} />
                      <Button type="submit" variant="ghost" size="xs" disabled={enableBucketPublicDomain.pending > 0} title="Enable public domain">
                        {#if enableBucketPublicDomain.pending > 0}
                          <Loading size="xs" />
                        {:else}
                          <Globe class="kui-icon" />
                        {/if}
                      </Button>
                    </form>
                  {/if}

                  {#if !bucket.customDomain && bucket.metadata?.subdomain}
                    <Button variant="ghost" size="xs" onclick={() => handleAddCustomDomain(bucket)} title="Add custom domain">
                      <ExternalLink class="kui-icon" />
                    </Button>
                  {/if}

                  <Button variant="ghost" size="xs" aria-label="Settings">
                    <Settings class="kui-icon" />
                  </Button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <div class="kui-empty">
        <HardDrive class="kui-empty__icon" />
        <p class="kui-empty__text">No storage buckets found</p>
        <p class="kui-empty__subtext">Buckets are created automatically when you create a site</p>
      </div>
    {/if}
  </div>
</div>

<Dialog bind:open={dialogOpen} bind:this={customDomainDialog} size="md">
  {#snippet header()}
    <div class="kui-modal-header">
      <h3>Add Custom Domain</h3>
      <Button variant="ghost" size="xs" onclick={() => customDomainDialog.close()} aria-label="Close">
        <X class="kui-icon" />
      </Button>
    </div>
  {/snippet}
  {#snippet children()}
    {#if selectedBucket}
      <div class="kui-stack">
        <div class="kui-callout info">
          <p class="kui-strong">Suggested Domain</p>
          <p class="kui-subtext">{selectedBucket.suggestedCustomDomain}</p>
        </div>

        {#if addBucketCustomDomain.result?.success}
          <div class="kui-callout success">Custom domain added successfully!</div>
        {/if}

        {#if addBucketCustomDomain.pending > 0}
          <div class="kui-callout warning">
            <Loading size="sm" />
            Adding custom domain...
          </div>
        {/if}

        <form {...addBucketCustomDomain} class="kui-stack" onsubmit={() => setTimeout(() => customDomainDialog.close(), 1000)}>
          <input type="hidden" name="bucketName" value={selectedBucket.name} />

          <FormField label="Custom Domain">
            <FormInput
              field={{
                name: 'customDomain',
                value: selectedBucket.suggestedCustomDomain
              } as any}
              placeholder="cdn.example.com"
            />
            <span class="kui-subtext">This will be your public storage URL</span>
          </FormField>

          <div class="kui-callout warning">
            <AlertCircle class="kui-icon" />
            <div>
              <p class="kui-strong">DNS Configuration Required</p>
              <p class="kui-subtext">Add a CNAME record pointing to your R2 bucket.</p>
            </div>
          </div>

          <div class="kui-modal-actions">
            <Button variant="ghost" type="button" onclick={() => customDomainDialog.close()}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={addBucketCustomDomain.pending > 0}>
              {#if addBucketCustomDomain.pending > 0}
                <Loading size="sm" /> Adding...
              {:else}
                Add Domain
              {/if}
            </Button>
          </div>
        </form>
      </div>
    {/if}
  {/snippet}
</Dialog>

<Dialog bind:open={dialogOpen} bind:this={customDomainDialog} size="md">
  {#snippet header()}
    <div class="kui-modal-header">
      <h3>Add Custom Domain</h3>
      <Button variant="ghost" size="xs" onclick={() => customDomainDialog.close()} aria-label="Close">
        <X class="kui-icon" />
      </Button>
    </div>
  {/snippet}
  {#snippet children()}
    {#if selectedBucket}
      <div class="kui-stack">
        <div class="kui-callout info">
          <p class="kui-strong">Suggested Domain</p>
          <p class="kui-subtext">{selectedBucket.suggestedCustomDomain}</p>
        </div>

        {#if addBucketCustomDomain.result?.success}
          <div class="kui-callout success">Custom domain added successfully!</div>
        {/if}

        {#if addBucketCustomDomain.pending > 0}
          <div class="kui-callout warning">
            <Loading size="sm" />
            Adding custom domain...
          </div>
        {/if}

        <form {...addBucketCustomDomain} class="kui-stack" onsubmit={() => setTimeout(() => customDomainDialog.close(), 1000)}>
          <input type="hidden" name="bucketName" value={selectedBucket.name} />

          <FormField label="Custom Domain">
            <FormInput
              field={{
                name: 'customDomain',
                value: selectedBucket.suggestedCustomDomain
              } as any}
              placeholder="cdn.example.com"
            />
            <span class="kui-subtext">This will be your public storage URL</span>
          </FormField>

          <div class="kui-callout warning">
            <AlertCircle class="kui-icon" />
            <div>
              <p class="kui-strong">DNS Configuration Required</p>
              <p class="kui-subtext">Add a CNAME record pointing to your R2 bucket.</p>
            </div>
          </div>

          <div class="kui-modal-actions">
            <Button variant="ghost" type="button" onclick={() => customDomainDialog.close()}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={addBucketCustomDomain.pending > 0}>
              {#if addBucketCustomDomain.pending > 0}
                <Loading size="sm" /> Adding...
              {:else}
                Add Domain
              {/if}
            </Button>
          </div>
        </form>
      </div>
    {/if}
  {/snippet}
</Dialog>

<Dialog bind:open={dialogOpen} bind:this={customDomainDialog} size="md">
  {#snippet header()}
    <div class="kui-modal-header">
      <h3>Add Custom Domain</h3>
      <Button variant="ghost" size="xs" onclick={() => customDomainDialog.close()} aria-label="Close">
        <X class="kui-icon" />
      </Button>
    </div>
  {/snippet}
  {#snippet children()}
    {#if selectedBucket}
      <div class="kui-stack">
        <div class="kui-callout info">
          <p class="kui-strong">Suggested Domain</p>
          <p class="kui-subtext">{selectedBucket.suggestedCustomDomain}</p>
        </div>

        {#if addBucketCustomDomain.result?.success}
          <div class="kui-callout success">Custom domain added successfully!</div>
        {/if}

        {#if addBucketCustomDomain.pending > 0}
          <div class="kui-callout warning">
            <Loading size="sm" />
            Adding custom domain...
          </div>
        {/if}

        <form {...addBucketCustomDomain} class="kui-stack" onsubmit={() => setTimeout(() => customDomainDialog.close(), 1000)}>
          <input type="hidden" name="bucketName" value={selectedBucket.name} />

          <FormField label="Custom Domain">
            <FormInput
              field={{
                name: 'customDomain',
                value: selectedBucket.suggestedCustomDomain
              } as any}
              placeholder="cdn.example.com"
            />
            <span class="kui-subtext">This will be your public storage URL</span>
          </FormField>

          <div class="kui-callout warning">
            <AlertCircle class="kui-icon" />
            <div>
              <p class="kui-strong">DNS Configuration Required</p>
              <p class="kui-subtext">Add a CNAME record pointing to your R2 bucket.</p>
            </div>
          </div>

          <div class="kui-modal-actions">
            <Button variant="ghost" type="button" onclick={() => customDomainDialog.close()}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={addBucketCustomDomain.pending > 0}>
              {#if addBucketCustomDomain.pending > 0}
                <Loading size="sm" /> Adding...
              {:else}
                Add Domain
              {/if}
            </Button>
          </div>
        </form>
      </div>
    {/if}
  {/snippet}
</Dialog>

<style>
  .kui-storage {
    display: grid;
    gap: 1.5rem;
  }

  .kui-storage__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .kui-storage__header h2 {
    margin: 0 0 0.25rem 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .kui-storage__subtitle {
    margin: 0;
    font-size: 0.9rem;
    color: var(--kui-color-muted);
  }

  .kui-table-scroll {
    overflow-x: auto;
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
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--kui-color-border);
    text-align: left;
    vertical-align: middle;
  }

  .kui-table thead th {
    background: var(--kui-color-surface-muted);
    font-weight: 600;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--kui-color-muted);
  }

  .kui-table tbody tr {
    transition: background 150ms ease;
  }

  .kui-table tbody tr:hover {
    background: var(--kui-color-surface-muted);
  }

  .kui-bucket-cell {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .kui-bucket-name {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--kui-color-text);
  }

  .kui-bucket-meta {
    margin: 0;
    font-size: 0.8rem;
    color: var(--kui-color-muted);
  }

  .kui-bucket-meta code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .kui-status {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .kui-status.success {
    color: var(--kui-color-success);
  }

  .kui-status.disabled {
    color: var(--kui-color-muted);
  }

  .kui-status.warning {
    color: var(--kui-color-warning);
  }

  .kui-domain-code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--kui-color-text);
    background: var(--kui-color-surface-muted);
    padding: 0.3rem 0.5rem;
    border-radius: var(--kui-radius-sm);
  }

  .kui-date {
    font-size: 0.85rem;
    color: var(--kui-color-muted);
    white-space: nowrap;
  }

  .text-right {
    text-align: right;
  }

  .kui-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .kui-actions form {
    display: contents;
  }

  .kui-empty {
    display: grid;
    gap: 0.75rem;
    justify-items: center;
    text-align: center;
    padding: 3rem 1.5rem;
    background: var(--kui-color-surface);
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-lg);
  }

  .kui-empty__icon {
    width: 3rem;
    height: 3rem;
    color: var(--kui-color-muted);
  }

  .kui-empty__text {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--kui-color-text);
  }

  .kui-empty__subtext {
    margin: 0;
    font-size: 0.85rem;
    color: var(--kui-color-muted);
  }

  .kui-center {
    display: grid;
    place-items: center;
    gap: 1rem;
    text-align: center;
    padding: 3rem 1.5rem;
  }

  .kui-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .kui-modal-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .kui-stack {
    display: grid;
    gap: 1rem;
  }

  .kui-modal-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .kui-callout {
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    padding: 1rem;
    background: var(--kui-color-surface-muted);
    color: var(--kui-color-text);
    font-size: 0.9rem;
  }

  .kui-callout.error {
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.08);
  }

  .kui-callout.info {
    border-color: rgba(14, 165, 233, 0.3);
    background: rgba(14, 165, 233, 0.08);
  }

  .kui-callout.success {
    border-color: rgba(22, 163, 74, 0.3);
    background: rgba(22, 163, 74, 0.08);
  }

  .kui-callout.warning {
    border-color: rgba(245, 158, 11, 0.3);
    background: rgba(245, 158, 11, 0.08);
  }

  .kui-icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }

  .kui-strong {
    font-weight: 600;
  }

  .kui-subtext {
    margin: 0;
    font-size: 0.85rem;
    color: var(--kui-color-muted);
  }

  @media (max-width: 768px) {
    .kui-table {
      font-size: 0.85rem;
    }

    .kui-table th,
    .kui-table td {
      padding: 0.5rem 0.75rem;
    }

    .kui-actions {
      gap: 0.25rem;
    }
  }
</style>
