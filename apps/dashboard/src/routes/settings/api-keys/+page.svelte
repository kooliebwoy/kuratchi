<script lang="ts">
  import { Key, Plus, Copy, RotateCw, Trash2, X } from '@lucide/svelte';
  import { Dialog, FormField, FormInput, FormTextarea, Button, Card, Badge, Loading } from '@kuratchi/ui';
  import {
    getApiKeys,
    createApiKey,
    rotateApiKey,
    deleteApiKey
  } from '$lib/functions/api-keys.remote';

  const apiKeys = getApiKeys();
  const apiKeysData = $derived(apiKeys.current || []);

  // Modal state
  let showCreateKeyModal = $state(false);
  let showRotateKeyModal = $state(false);
  let showDeleteKeyModal = $state(false);
  let selectedKey = $state<any>(null);

  function resetApiKeyForm() {
    selectedKey = null;
  }

  function openCreateKeyModal() {
    resetApiKeyForm();
    showCreateKeyModal = true;
  }

  function openRotateKeyModal(key: any) {
    selectedKey = key;
    showRotateKeyModal = true;
  }

  function openDeleteKeyModal(key: any) {
    selectedKey = key;
    showDeleteKeyModal = true;
  }

  async function handleRotateKeySuccess() {
    showRotateKeyModal = false;
    selectedKey = null;
    await apiKeys.refresh();
  }

  async function handleDeleteKeySuccess() {
    showDeleteKeyModal = false;
    selectedKey = null;
    await apiKeys.refresh();
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
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
  <title>API Keys - Kuratchi Dashboard</title>
</svelte:head>

<div class="kui-api-keys">
  <Card class="kui-panel">
    <div class="kui-panel__header">
      <div>
        <p class="kui-eyebrow">Credentials</p>
        <h3>Master API Keys</h3>
        <p class="kui-subtext">Manage API keys for Kuratchi access</p>
      </div>
      <Button variant="primary" size="sm" onclick={openCreateKeyModal}>
        <Plus class="kui-icon" />
        Create API Key
      </Button>
    </div>

    <div class="kui-table-scroll">
      <table class="kui-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Key</th>
            <th>Created</th>
            <th>Last Used</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#if apiKeysData && apiKeysData.length > 0}
            {#each apiKeysData as key}
              <tr>
                <td>
                  <div class="kui-stack">
                    <div class="kui-inline">
                      <span class="kui-strong">{key.name}</span>
                      {#if key.description}
                        <Badge variant="ghost" size="xs">Desc</Badge>
                      {/if}
                    </div>
                    {#if key.description}
                      <p class="kui-subtext">{key.description}</p>
                    {/if}
                  </div>
                </td>
                <td><span class="kui-code">{key.prefix}...</span></td>
                <td class="kui-subtext">{formatDate(key.created_at)}</td>
                <td class="kui-subtext">{key.last_used_at ? formatDate(key.last_used_at) : 'Never'}</td>
                <td class="text-right">
                  <div class="kui-inline end">
                    <Button variant="ghost" size="xs" onclick={() => openRotateKeyModal(key)} aria-label="Rotate key">
                      <RotateCw class="kui-icon" />
                    </Button>
                    <Button variant="ghost" size="xs" onclick={() => openDeleteKeyModal(key)} aria-label="Delete key">
                      <Trash2 class="kui-icon error" />
                    </Button>
                  </div>
                </td>
              </tr>
            {/each}
          {:else}
            <tr>
              <td colspan="5" class="kui-center">
                <div class="kui-stack center">
                  <Key class="kui-empty__icon" />
                  <p class="kui-subtext">No API keys yet</p>
                  <Button variant="primary" size="sm" onclick={openCreateKeyModal}>Create your first API key</Button>
                </div>
              </td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  </Card>
</div>

<!-- Create API Key Modal -->
{#if showCreateKeyModal}
  <Dialog bind:open={showCreateKeyModal} size="md" onClose={resetApiKeyForm}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3>Create API Key</h3>
        <Button variant="ghost" size="xs" onclick={() => { showCreateKeyModal = false; resetApiKeyForm(); }} aria-label="Close">
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      {#if createApiKey.result?.key}
          <div class="kui-stack">
            <div class="kui-alert success">
            <span>API key created successfully!</span>
          </div>

          <div class="kui-callout warning">
            <p class="kui-strong">Save this key now!</p>
            <p class="kui-subtext">This is the only time you'll see the full key. Store it securely.</p>
            
            <div class="kui-input-copy">
              <input 
                type="text" 
                readonly 
                value={createApiKey.result.key}
                class="kui-input kui-code"
              />
              <Button variant="ghost" size="sm" onclick={() => copyToClipboard(createApiKey.result.key)}>
                <Copy class="kui-icon" />
              </Button>
            </div>
          </div>

          <div class="kui-callout info">
            <p class="kui-strong">Next steps</p>
            <ul class="kui-list">
              <li>Copy this key to a secure location</li>
              <li>Add it to your environment variables</li>
              <li>Never commit it to version control</li>
            </ul>
          </div>

          <div class="kui-modal-actions">
            <Button type="button" variant="primary" onclick={async () => { 
              showCreateKeyModal = false; 
              resetApiKeyForm();
              await apiKeys.refresh();
            }}>
              I've Saved the Key
            </Button>
          </div>
        </div>
      {:else}
        <form {...createApiKey} class="kui-stack">
          <FormField 
            label="Name" 
            issues={createApiKey.fields.name.issues()}
            hint="A descriptive name for this API key"
          >
            <FormInput 
              field={createApiKey.fields.name} 
              placeholder="Production API Key"
            />
          </FormField>

          <FormField 
            label="Description (optional)" 
            issues={createApiKey.fields.description?.issues()}
          >
            <FormTextarea 
              field={createApiKey.fields.description} 
              placeholder="Used for production environment..."
              rows={3}
            />
          </FormField>

          <div class="kui-modal-actions">
            <Button type="button" variant="ghost" onclick={() => { showCreateKeyModal = false; resetApiKeyForm(); }}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create Key
            </Button>
          </div>
        </form>
      {/if}
    {/snippet}
  </Dialog>
{/if}

<style>
  .kui-api-keys {
    display: grid;
    gap: var(--kui-spacing-md);
  }

  .kui-panel__header h3 {
    margin: 0.1rem 0;
  }

  .kui-strong {
    font-weight: 700;
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
    font-size: 0.9rem;
  }

  .kui-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  .kui-inline.end {
    justify-content: flex-end;
  }

  .kui-stack {
    display: grid;
    gap: var(--kui-spacing-sm);
  }

  .kui-center {
    text-align: center;
    padding: var(--kui-spacing-md);
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

  .kui-alert {
    padding: 0.65rem 0.75rem;
    border-radius: var(--kui-radius-md);
    font-weight: 600;
    background: var(--kui-color-surface-muted);
    color: var(--kui-color-text);
  }

  .kui-alert.success {
    background: rgba(22, 163, 74, 0.1);
    color: var(--kui-color-success);
  }

  .kui-callout {
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    padding: var(--kui-spacing-sm);
    background: var(--kui-color-surface);
  }

  .kui-callout.warning {
    border-color: color-mix(in srgb, var(--kui-color-warning) 40%, var(--kui-color-border) 60%);
    background: rgba(245, 158, 11, 0.08);
  }

  .kui-callout.info {
    border-color: color-mix(in srgb, var(--kui-color-info) 40%, var(--kui-color-border) 60%);
    background: rgba(14, 165, 233, 0.08);
  }

  .kui-callout.error {
    border-color: color-mix(in srgb, var(--kui-color-error) 40%, var(--kui-color-border) 60%);
    background: rgba(239, 68, 68, 0.08);
  }

  .kui-list {
    padding-left: 1rem;
    margin: 0.35rem 0 0;
    color: var(--kui-color-text);
  }

  .kui-list li + li {
    margin-top: 0.15rem;
  }

  .kui-input-copy {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.35rem;
    align-items: center;
  }

  .kui-empty__icon {
    width: 3rem;
    height: 3rem;
    color: var(--kui-color-muted);
  }

  .text-right {
    text-align: right;
  }
</style>

<!-- Rotate Key Modal -->
{#if showRotateKeyModal && selectedKey}
  <Dialog bind:open={showRotateKeyModal} size="sm" onClose={() => selectedKey = null}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3>Rotate API Key</h3>
        <Button variant="ghost" size="xs" onclick={() => { showRotateKeyModal = false; selectedKey = null; }} aria-label="Close">
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <form {...rotateApiKey} onsubmit={handleRotateKeySuccess} class="kui-stack">
        <input type="hidden" name="id" value={selectedKey.id} />
        
        <div class="kui-callout warning">
          <span>This will invalidate the old key immediately.</span>
        </div>

        <p class="kui-subtext">
          Rotating <strong>{selectedKey.name}</strong> will generate a new key and invalidate the old one.
        </p>

        <div class="kui-modal-actions">
          <Button type="button" variant="ghost" onclick={() => { showRotateKeyModal = false; selectedKey = null; }}>
            Cancel
          </Button>
          <Button type="submit" variant="warning">
            Rotate Key
          </Button>
        </div>
      </form>
    {/snippet}
  </Dialog>
{/if}

<!-- Delete Key Modal -->
{#if showDeleteKeyModal && selectedKey}
  <Dialog bind:open={showDeleteKeyModal} size="sm" onClose={() => selectedKey = null}>
    {#snippet header()}
      <div class="kui-modal-header">
        <h3 class="text-error">Delete API Key</h3>
        <Button variant="ghost" size="xs" onclick={() => { showDeleteKeyModal = false; selectedKey = null; }} aria-label="Close">
          <X class="kui-icon" />
        </Button>
      </div>
    {/snippet}
    {#snippet children()}
      <form {...deleteApiKey} onsubmit={handleDeleteKeySuccess} class="kui-stack">
        <input type="hidden" name="id" value={selectedKey.id} />
        
        <div class="kui-callout error">
          <span>This action cannot be undone.</span>
        </div>

        <p class="kui-subtext">
          Are you sure you want to delete <strong>{selectedKey.name}</strong>?
        </p>

        <div class="kui-modal-actions">
          <Button type="button" variant="ghost" onclick={() => { showDeleteKeyModal = false; selectedKey = null; }}>
            Cancel
          </Button>
          <Button type="submit" variant="error">
            Delete Key
          </Button>
        </div>
      </form>
    {/snippet}
  </Dialog>
{/if}
