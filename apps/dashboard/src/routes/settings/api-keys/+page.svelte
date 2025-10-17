<script lang="ts">
  import { Key, Plus, Copy, RotateCw, Trash2, X } from 'lucide-svelte';
  import { Dialog, FormField, FormInput, FormTextarea } from '@kuratchi/ui';
  import {
    getApiKeys,
    createApiKey,
    rotateApiKey,
    deleteApiKey
  } from '$lib/api/api-keys.remote';

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

<div class="space-y-6">
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-lg font-bold">Master API Keys</h3>
          <p class="text-sm text-base-content/70">Manage API keys for Kuratchi access</p>
        </div>
        <button class="btn btn-primary btn-sm" onclick={openCreateKeyModal}>
          <Plus class="h-4 w-4 mr-2" />
          Create API Key
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="table">
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
                    <div>
                      <div class="font-medium">{key.name}</div>
                      {#if key.description}
                        <div class="text-sm text-base-content/60">{key.description}</div>
                      {/if}
                    </div>
                  </td>
                  <td>
                    <code class="text-sm bg-base-200 px-2 py-1 rounded">{key.prefix}...</code>
                  </td>
                  <td class="text-sm text-base-content/70">
                    {formatDate(key.created_at)}
                  </td>
                  <td class="text-sm text-base-content/70">
                    {key.last_used_at ? formatDate(key.last_used_at) : 'Never'}
                  </td>
                  <td class="text-right">
                    <div class="flex justify-end gap-2">
                      <button
                        class="btn btn-ghost btn-sm btn-square"
                        onclick={() => openRotateKeyModal(key)}
                        title="Rotate key"
                      >
                        <RotateCw class="h-4 w-4" />
                      </button>
                      <button
                        class="btn btn-ghost btn-sm btn-square text-error"
                        onclick={() => openDeleteKeyModal(key)}
                        title="Delete key"
                      >
                        <Trash2 class="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            {:else}
              <tr>
                <td colspan="5" class="text-center py-8">
                  <div class="flex flex-col items-center gap-2">
                    <Key class="h-12 w-12 text-base-content/30" />
                    <p class="text-base-content/70">No API keys yet</p>
                    <button class="btn btn-sm btn-primary" onclick={openCreateKeyModal}>
                      Create your first API key
                    </button>
                  </div>
                </td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<!-- Create API Key Modal -->
{#if showCreateKeyModal}
  <Dialog bind:open={showCreateKeyModal} size="md" onClose={resetApiKeyForm} class="rounded-2xl border border-base-200 shadow-xl" backdropClass="bg-black/40 backdrop-blur-sm">
    {#snippet header()}
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-lg">Create API Key</h3>
        <button
          class="btn btn-ghost btn-sm btn-circle"
          type="button"
          onclick={() => { showCreateKeyModal = false; resetApiKeyForm(); }}
          aria-label="Close"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    {/snippet}
    {#snippet children()}
      {#if createApiKey.result?.key}
        <div class="space-y-4">
          <div class="alert alert-success">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>API key created successfully!</span>
          </div>

          <div class="bg-warning/10 border border-warning/20 p-4 rounded-lg">
            <p class="text-sm font-semibold text-warning mb-2">⚠️ Save this key now!</p>
            <p class="text-sm text-base-content/70 mb-3">This is the only time you'll see the full key. Store it securely.</p>
            
            <div class="flex gap-2">
              <input 
                type="text" 
                readonly 
                value={createApiKey.result.key}
                class="input input-bordered flex-1 font-mono text-sm"
              />
              <button
                class="btn btn-square"
                onclick={() => copyToClipboard(createApiKey.result.key)}
              >
                <Copy class="h-4 w-4" />
              </button>
            </div>
          </div>

          <div class="bg-info/10 border border-info/20 p-4 rounded-lg">
            <p class="text-sm font-medium mb-2">Next steps:</p>
            <ul class="text-sm space-y-1">
              <li>• Copy this key to a secure location</li>
              <li>• Add it to your environment variables</li>
              <li>• Never commit it to version control</li>
            </ul>
          </div>

          <div class="modal-action">
            <button type="button" class="btn btn-primary" onclick={async () => { 
              showCreateKeyModal = false; 
              resetApiKeyForm();
              await apiKeys.refresh();
            }}>
              I've Saved the Key
            </button>
          </div>
        </div>
      {:else}
        <form {...createApiKey} class="space-y-4">
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

          <div class="modal-action">
            <button type="button" class="btn" onclick={() => { showCreateKeyModal = false; resetApiKeyForm(); }}>
              Cancel
            </button>
            <button type="submit" class="btn btn-primary">
              Create Key
            </button>
          </div>
        </form>
      {/if}
    {/snippet}
  </Dialog>
{/if}

<!-- Rotate Key Modal -->
{#if showRotateKeyModal && selectedKey}
  <Dialog bind:open={showRotateKeyModal} size="sm" onClose={() => selectedKey = null} class="rounded-2xl border border-base-200 shadow-xl" backdropClass="bg-black/40 backdrop-blur-sm">
    {#snippet header()}
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-lg">Rotate API Key</h3>
        <button
          class="btn btn-ghost btn-sm btn-circle"
          type="button"
          onclick={() => { showRotateKeyModal = false; selectedKey = null; }}
          aria-label="Close"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    {/snippet}
    {#snippet children()}
      <form {...rotateApiKey} onsubmit={handleRotateKeySuccess} class="space-y-4">
        <input type="hidden" name="id" value={selectedKey.id} />
        
        <div class="alert alert-warning">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>This will invalidate the old key immediately.</span>
        </div>

        <p class="text-base-content/70">
          Rotating <strong>{selectedKey.name}</strong> will generate a new key and invalidate the old one.
        </p>

        <div class="modal-action">
          <button type="button" class="btn" onclick={() => { showRotateKeyModal = false; selectedKey = null; }}>
            Cancel
          </button>
          <button type="submit" class="btn btn-warning">
            Rotate Key
          </button>
        </div>
      </form>
    {/snippet}
  </Dialog>
{/if}

<!-- Delete Key Modal -->
{#if showDeleteKeyModal && selectedKey}
  <Dialog bind:open={showDeleteKeyModal} size="sm" onClose={() => selectedKey = null} class="rounded-2xl border border-base-200 shadow-xl" backdropClass="bg-black/40 backdrop-blur-sm">
    {#snippet header()}
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-lg text-error">Delete API Key</h3>
        <button
          class="btn btn-ghost btn-sm btn-circle"
          type="button"
          onclick={() => { showDeleteKeyModal = false; selectedKey = null; }}
          aria-label="Close"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    {/snippet}
    {#snippet children()}
      <form {...deleteApiKey} onsubmit={handleDeleteKeySuccess} class="space-y-4">
        <input type="hidden" name="id" value={selectedKey.id} />
        
        <div class="alert alert-error">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>This action cannot be undone.</span>
        </div>

        <p class="text-base-content/70">
          Are you sure you want to delete <strong>{selectedKey.name}</strong>?
        </p>

        <div class="modal-action">
          <button type="button" class="btn" onclick={() => { showDeleteKeyModal = false; selectedKey = null; }}>
            Cancel
          </button>
          <button type="submit" class="btn btn-error">
            Delete Key
          </button>
        </div>
      </form>
    {/snippet}
  </Dialog>
{/if}
