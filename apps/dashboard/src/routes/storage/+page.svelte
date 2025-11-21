<script lang="ts">
  import { 
    getAllBuckets, 
    enableBucketPublicDomain, 
    addBucketCustomDomain 
  } from '$lib/functions/storage.remote';
  import { HardDrive, Globe, ExternalLink, Settings, CheckCircle, XCircle, AlertCircle, X, Database } from 'lucide-svelte';
  import { Button, Card, Badge, Dialog, Loading } from '@kuratchi/ui';

  let bucketsQuery = getAllBuckets(undefined);
  let data = $derived(bucketsQuery.current);
  
  let buckets = $derived<any[]>(data?.buckets ?? []);
  let orgBuckets = $derived<any[]>(data?.orgBuckets ?? []);
  let siteBuckets = $derived<any[]>(data?.siteBuckets ?? []);
  let stats = $derived(data?.stats ?? { total: 0, managed: 0, unmanaged: 0, orgLevel: 0, siteLevel: 0 });

  let customDomainDialog: HTMLDialogElement;
  let selectedBucket = $state<any>(null);

  let selectedTab = $state<'all' | 'org' | 'sites'>('all');

  let displayedBuckets = $derived(() => {
    if (selectedTab === 'org') return orgBuckets;
    if (selectedTab === 'sites') return siteBuckets;
    return buckets;
  });

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
  <header class="kui-storage__header">
    <div class="kui-inline">
      <div class="kui-icon-box">
        <Database />
      </div>
      <div>
        <p class="kui-eyebrow">Storage</p>
        <h1>R2 Buckets</h1>
        <p class="kui-subtext">Manage R2 storage buckets and domains</p>
      </div>
    </div>
  </header>

  <div class="kui-tabs">
    <button class:selected={selectedTab === 'all'} onclick={() => selectedTab = 'all'}>All</button>
    <button class:selected={selectedTab === 'org'} onclick={() => selectedTab = 'org'}>Organization</button>
    <button class:selected={selectedTab === 'sites'} onclick={() => selectedTab = 'sites'}>Sites</button>
  </div>

  <Card class="kui-panel">
    <div class="kui-table-scroll">
      {#if bucketsQuery.loading}
        <div class="kui-center"><Loading size="md" /></div>
      {:else if bucketsQuery.error}
        <div class="kui-callout error">Error loading buckets. Please try again.</div>
      {:else if displayedBuckets.length > 0}
        <table class="kui-table">
          <thead>
            <tr>
              <th>Bucket / Site</th>
              <th>Type</th>
              <th>Public Domain</th>
              <th>Custom Domain</th>
              <th>Created</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each displayedBuckets as bucket}
              <tr>
                <td>
                  <div class="kui-inline">
                    <HardDrive class="kui-icon" />
                    <div>
                      <p class="kui-strong">{bucket.name}</p>
                      {#if bucket.metadata?.name}
                        <p class="kui-subtext">
                          {bucket.metadata.name}
                          {#if bucket.metadata.subdomain}
                            · {bucket.metadata.subdomain}.kuratchi.com
                          {/if}
                        </p>
                      {/if}
                    </div>
                  </div>
                </td>
                <td>
                  <Badge variant="ghost" size="xs">
                    {bucket.metadata?.type === 'site' ? 'Site Storage' : 'Storage'}
                  </Badge>
                </td>
                <td>
                  {#if bucket.publicDomain?.enabled}
                    <span class="kui-pill success"><CheckCircle class="kui-icon" /> Enabled</span>
                  {:else}
                    <span class="kui-subtext"><XCircle class="kui-icon" /> Disabled</span>
                  {/if}
                </td>
                <td>
                  {#if bucket.customDomain}
                    <span class="kui-code">{bucket.customDomain}</span>
                  {:else}
                    <span class="kui-pill warning"><AlertCircle class="kui-icon" /> Not configured</span>
                  {/if}
                </td>
                <td class="kui-subtext">{formatDate(bucket.creation_date)}</td>
                <td class="text-right">
                  <div class="kui-inline end">
                    <Button variant="ghost" size="xs" href={`/storage/${bucket.name}`} aria-label="View files">
                      <HardDrive class="kui-icon" />
                    </Button>

                    {#if !bucket.publicDomain?.enabled}
                      <form {...enableBucketPublicDomain}>
                        <input type="hidden" name="bucketName" value={bucket.name} />
                        <Button type="submit" variant="ghost" size="xs" disabled={enableBucketPublicDomain.pending > 0}>
                          {#if enableBucketPublicDomain.pending > 0}
                            <Loading size="xs" />
                          {:else}
                            <Globe class="kui-icon" />
                          {/if}
                          Enable R2.dev
                        </Button>
                      </form>
                    {/if}

                    {#if !bucket.customDomain && bucket.metadata?.subdomain}
                      <Button variant="ghost" size="xs" onclick={() => handleAddCustomDomain(bucket)}>
                        <ExternalLink class="kui-icon" /> Add Domain
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
        <div class="kui-center">
          <HardDrive class="kui-empty__icon" />
          <p class="kui-subtext">No storage buckets found</p>
          <p class="kui-subtext">Buckets are created automatically when you create a site</p>
        </div>
      {/if}
    </div>
  </Card>
</div>

<Dialog bind:open={() => false} bind:this={customDomainDialog} size="md">
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
    gap: var(--kui-spacing-md);
  }

  .kui-storage__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--kui-spacing-md);
    flex-wrap: wrap;
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

  .kui-subtext {
    color: var(--kui-color-muted);
    margin: 0;
  }

  h1 {
    margin: 0.1rem 0 0.2rem;
    font-size: 1.6rem;
  }

  .kui-tabs {
    display: inline-flex;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-lg);
    overflow: hidden;
  }

  .kui-tabs button {
    padding: 0.55rem 0.9rem;
    border: none;
    background: transparent;
    cursor: pointer;
    font-weight: 600;
    color: var(--kui-color-muted);
  }

  .kui-tabs button.selected {
    background: var(--kui-color-primary-weak);
    color: var(--kui-color-primary);
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
    border-bottom: 1px solid var(--kui-color-border);
    text-align: left;
    vertical-align: top;
  }

  .kui-table thead th {
    background: var(--kui-color-surface-muted);
    font-weight: 700;
    font-size: 0.9rem;
  }

  .kui-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }

  .kui-inline.end {
    justify-content: flex-end;
  }

  .kui-strong {
    font-weight: 700;
  }

  .kui-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border-radius: 999px;
    padding: 0.2rem 0.5rem;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .kui-pill.success {
    background: rgba(22, 163, 74, 0.12);
    color: var(--kui-color-success);
  }

  .kui-pill.warning {
    background: rgba(245, 158, 11, 0.12);
    color: var(--kui-color-warning);
  }

  .kui-code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.9rem;
  }

  .text-right {
    text-align: right;
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

  .kui-callout {
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    padding: var(--kui-spacing-sm);
    background: var(--kui-color-surface);
    display: grid;
    gap: 0.25rem;
  }

  .kui-callout.info {
    border-color: color-mix(in srgb, var(--kui-color-info) 40%, var(--kui-color-border) 60%);
    background: rgba(14, 165, 233, 0.08);
  }

  .kui-callout.success {
    border-color: color-mix(in srgb, var(--kui-color-success) 40%, var(--kui-color-border) 60%);
    background: rgba(22, 163, 74, 0.08);
  }

  .kui-callout.warning {
    border-color: color-mix(in srgb, var(--kui-color-warning) 40%, var(--kui-color-border) 60%);
    background: rgba(245, 158, 11, 0.08);
  }

  @media (max-width: 720px) {
    .kui-tabs {
      width: 100%;
    }
  }
</style>
