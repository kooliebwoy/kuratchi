<script lang="ts">
  import { getAllBuckets } from '$lib/functions/storage.remote';
  import { HardDrive } from '@lucide/svelte';
  import { Button, Loading } from '@kuratchi/ui';

  let bucketsQuery = getAllBuckets(undefined);
  let data = $derived(bucketsQuery.current);
  
  let buckets = $derived<any[]>(data?.buckets ?? []);

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
</script>

<svelte:head>
  <title>Storage - Kuratchi Dashboard</title>
</svelte:head>

<div class="kui-storage">
  <div class="kui-storage__header">
    <div>
      <h2>Storage</h2>
      <p class="kui-storage__subtitle">Browse and manage site storage buckets</p>
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
            <th>Storage Domain</th>
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
                          · <code>{bucket.metadata.subdomain}.kuratchi.site</code>
                        {/if}
                      </p>
                    {/if}
                  </div>
                </div>
              </td>
              <td>
                {#if bucket.customDomain}
                  <code class="kui-domain-code">{bucket.customDomain}</code>
                {:else}
                  <span class="kui-muted">—</span>
                {/if}
              </td>
              <td class="kui-date">{formatDate(bucket.creation_date)}</td>
              <td class="text-right">
                <Button variant="ghost" size="xs" href={`/storage/${bucket.name}`} title="Browse files">
                  <HardDrive class="kui-icon" />
                  Browse
                </Button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <div class="kui-empty">
        <HardDrive class="kui-icon" />
        <p class="kui-empty__text">No storage buckets found</p>
        <p class="kui-empty__subtext">Buckets are created automatically when you create a site</p>
      </div>
    {/if}
  </div>
</div>

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

  .kui-domain-code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--kui-color-text);
    background: var(--kui-color-surface-muted);
    padding: 0.3rem 0.5rem;
    border-radius: var(--kui-radius-sm);
  }

  .kui-muted {
    color: var(--kui-color-muted);
  }

  :global(.kui-icon) {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }

  .kui-date {
    font-size: 0.85rem;
    color: var(--kui-color-muted);
    white-space: nowrap;
  }

  .text-right {
    text-align: right;
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

  .kui-empty :global(.kui-icon) {
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

  @media (max-width: 768px) {
    .kui-table {
      font-size: 0.85rem;
    }

    .kui-table th,
    .kui-table td {
      padding: 0.5rem 0.75rem;
    }
  }
</style>
