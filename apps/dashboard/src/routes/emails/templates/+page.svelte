<script lang="ts">
  import { Plus, Trash2, Eye, Loader2, Code2 } from 'lucide-svelte';
  import {
    listTemplates,
    createTemplate,
    deleteTemplate,
    getTemplate,
    type EmailTemplate
  } from '$lib/functions/newsletter.remote';

  const templatesResource = listTemplates();
  const templates = $derived(Array.isArray(templatesResource.current) ? templatesResource.current : []);

  let showCreateModal = $state(false);
  let showPreviewModal = $state(false);
  let previewTemplate = $state<EmailTemplate | null>(null);

  let formName = $state('');
  let formSubject = $state('');
  let formHtml = $state('');
  let creating = $state(false);
  let createError = $state<string | null>(null);

  let deletingId = $state<string | null>(null);
  let loadingPreview = $state(false);
  let showSourceCode = $state(false);

  async function handleCreateTemplate() {
    if (!formName.trim() || !formSubject.trim() || !formHtml.trim()) {
      createError = 'All fields are required';
      return;
    }
    creating = true;
    createError = null;
    try {
      await createTemplate({
        name: formName.trim(),
        subject: formSubject.trim(),
        html: formHtml.trim()
      });
      formName = '';
      formSubject = '';
      formHtml = '';
      showCreateModal = false;
    } catch (err) {
      console.error(err);
      createError = err instanceof Error ? err.message : 'Failed to create template';
    } finally {
      creating = false;
    }
  }

  async function handleDeleteTemplate(id: string) {
    if (!confirm('Delete this template? This cannot be undone.')) return;
    deletingId = id;
    try {
      await deleteTemplate({ templateId: id });
    } finally {
      deletingId = null;
    }
  }

  async function openPreviewModal(template: EmailTemplate) {
    loadingPreview = true;
    showPreviewModal = true;
    try {
      const fullTemplate = await getTemplate({ templateId: template.id });
      if (fullTemplate) {
        previewTemplate = fullTemplate;
      } else {
        previewTemplate = template;
      }
    } catch (err) {
      console.error('Error loading template:', err);
      previewTemplate = template;
    } finally {
      loadingPreview = false;
    }
  }
</script>

<svelte:head>
  <title>Email Templates - Kuratchi Dashboard</title>
</svelte:head>

<!-- Navigation Tabs -->
<div class="border-b border-base-200 bg-base-100">
  <div class="flex gap-0 px-8">
    <a href="/emails/drip" class="tab tab-bordered">
      <span class="font-medium">Drip Campaigns</span>
    </a>
    <a href="/emails/segments" class="tab tab-bordered">
      <span class="font-medium">Segments</span>
    </a>
    <a href="/emails/templates" class="tab tab-active tab-bordered">
      <span class="font-medium">Templates</span>
    </a>
    <a href="/emails" class="tab tab-bordered">
      <span class="font-medium">Email History</span>
    </a>
  </div>
</div>

<section class="space-y-8 p-8">
  <!-- Header -->
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <p class="text-xs font-semibold uppercase tracking-wide text-primary/70">Email Management</p>
      <h1 class="text-2xl font-semibold">Email Templates</h1>
      <p class="text-sm text-base-content/70">Create and manage reusable email templates with HTML.</p>
    </div>
    <button class="btn btn-primary btn-sm" onclick={() => (showCreateModal = true)}>
      <Plus class="h-4 w-4" />
      New template
    </button>
  </div>

  <!-- Templates List -->
  <div class="space-y-4">
    {#if templatesResource.loading}
      <div class="rounded-2xl border border-base-200 bg-base-100 p-10 text-center shadow-sm">
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>
    {:else if templates.length === 0}
      <div class="rounded-2xl border border-dashed border-base-300 bg-base-100 p-8 text-center shadow-sm">
        <p class="text-lg font-semibold">No templates yet</p>
        <p class="text-sm text-base-content/70">Create your first template to get started.</p>
        <button class="btn btn-primary btn-sm mt-4" onclick={() => (showCreateModal = true)}>Create template</button>
      </div>
    {:else}
      <div class="space-y-3">
        {#each templates as template}
          <div class="rounded-2xl border border-base-200 bg-base-100/90 p-6 shadow-sm transition hover:border-primary/40">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="flex-1">
                <h3 class="text-lg font-semibold">{template.name}</h3>
                <p class="text-sm text-base-content/70">{template.subject}</p>
                <p class="text-xs text-base-content/50 mt-2">
                  Created {new Date(template.created_at).toLocaleDateString()}
                </p>
              </div>
              <div class="flex gap-2">
                <button
                  class="btn btn-outline btn-sm"
                  onclick={() => openPreviewModal(template)}
                >
                  <Eye class="h-4 w-4" />
                  Preview
                </button>
                <button
                  class="btn btn-ghost btn-sm text-error"
                  onclick={() => handleDeleteTemplate(template.id)}
                  disabled={deletingId === template.id}
                >
                  {#if deletingId === template.id}
                    <Loader2 class="h-4 w-4 animate-spin" />
                  {:else}
                    <Trash2 class="h-4 w-4" />
                  {/if}
                  Delete
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</section>

<!-- Create Template Modal -->
{#if showCreateModal}
  <div class="modal modal-open">
    <div class="modal-box w-full max-w-2xl">
      <h3 class="text-lg font-semibold">Create new template</h3>
      <div class="mt-4 space-y-4 max-h-[70vh] overflow-y-auto">
        <label class="input input-bordered flex items-center gap-2">
          <input
            type="text"
            class="grow"
            bind:value={formName}
            placeholder="Template name"
          />
        </label>

        <label class="input input-bordered flex items-center gap-2">
          <input
            type="text"
            class="grow"
            bind:value={formSubject}
            placeholder="Email subject"
          />
        </label>

        <div class="form-control">
          <label class="label">
            <span class="label-text">HTML Content</span>
          </label>
          <textarea
            class="textarea textarea-bordered font-mono text-sm"
            rows="12"
            bind:value={formHtml}
            placeholder="Enter your HTML email template..."
          ></textarea>
        </div>

        {#if createError}
          <div class="alert alert-error alert-sm">
            <span>{createError}</span>
          </div>
        {/if}
      </div>
      <div class="modal-action mt-6">
        <button class="btn btn-ghost" onclick={() => (showCreateModal = false)}>Cancel</button>
        <button class="btn btn-primary" onclick={handleCreateTemplate} disabled={creating}>
          {#if creating}
            <Loader2 class="h-4 w-4 animate-spin" />
          {:else}
            Create
          {/if}
        </button>
      </div>
    </div>
    <button class="modal-backdrop" onclick={() => (showCreateModal = false)} aria-label="Close modal"></button>
  </div>
{/if}

<!-- Preview Modal - Full Screen -->
{#if showPreviewModal && previewTemplate}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div class="w-full h-full max-w-7xl flex flex-col bg-base-100 rounded-lg shadow-2xl">
      <!-- Header -->
      <div class="border-b border-base-200 bg-base-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold">{previewTemplate.name}</h2>
          <p class="text-sm text-base-content/60 mt-1">Subject: {previewTemplate.subject}</p>
        </div>
        <div class="flex items-center gap-3">
          {#if previewTemplate.html}
            <div class="join border border-base-300 rounded-lg">
              <button
                class="join-item px-4 py-2 text-sm font-medium transition {!showSourceCode ? 'bg-primary text-primary-content' : 'bg-base-100 text-base-content hover:bg-base-200'}"
                onclick={() => (showSourceCode = false)}
              >
                Preview
              </button>
              <button
                class="join-item px-4 py-2 text-sm font-medium transition {showSourceCode ? 'bg-primary text-primary-content' : 'bg-base-100 text-base-content hover:bg-base-200'}"
                onclick={() => (showSourceCode = true)}
              >
                Code
              </button>
            </div>
          {/if}
          <button
            class="btn btn-ghost btn-sm"
            onclick={() => (showPreviewModal = false)}
          >
            ✕
          </button>
        </div>
      </div>

      {#if loadingPreview}
        <div class="flex-1 flex items-center justify-center">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
      {:else if previewTemplate.html}
        <!-- Main Content -->
        <div class="flex-1 overflow-auto bg-white">
          {#if !showSourceCode}
            <!-- Preview View -->
            <div class="w-full h-full flex items-center justify-center p-8">
              <div class="w-full max-w-2xl bg-white rounded-lg border border-base-200 overflow-hidden shadow-lg">
                <iframe
                  title="Email Preview"
                  class="w-full"
                  style="min-height: 800px; height: 100%;"
                  srcdoc={previewTemplate.html}
                ></iframe>
              </div>
            </div>
          {:else}
            <!-- Code View -->
            <div class="p-8 h-full overflow-auto">
              <pre class="bg-base-900 text-base-50 p-6 rounded-lg text-xs leading-relaxed font-mono whitespace-pre-wrap break-words"><code>{previewTemplate.html}</code></pre>
            </div>
          {/if}
        </div>
      {:else}
        <div class="flex-1 flex items-center justify-center">
          <div class="alert alert-warning">
            <span>HTML content not available. The template may need to be refreshed or re-created.</span>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
