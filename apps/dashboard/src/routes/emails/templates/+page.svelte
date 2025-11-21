<script lang="ts">
  import { Plus, Trash2, Eye, Loader2, Code2 } from 'lucide-svelte';
  import { Button, Card, Dialog, Loading, FormField, FormInput, Badge } from '@kuratchi/ui';
  import EmailEditor from '$lib/components/EmailEditor.svelte';
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
      previewTemplate = fullTemplate || template;
    } catch (err) {
      previewTemplate = template;
    } finally {
      loadingPreview = false;
    }
  }
</script>

<svelte:head>
  <title>Email Templates - Kuratchi Dashboard</title>
</svelte:head>

<div class="kui-templates">
  <nav class="kui-tabs">
    <a href="/emails/drip" class="kui-tab">Drip Campaigns</a>
    <a href="/emails/segments" class="kui-tab">Segments</a>
    <a href="/emails/templates" class="kui-tab is-active">Templates</a>
    <a href="/emails" class="kui-tab">Email History</a>
  </nav>

  <header class="kui-templates__header">
    <div>
      <p class="kui-eyebrow">Email Management</p>
      <h1>Templates</h1>
      <p class="kui-subtext">Create and manage reusable email templates.</p>
    </div>
    <Button variant="primary" size="sm" onclick={() => (showCreateModal = true)}>
      <Plus class="kui-icon" />
      New template
    </Button>
  </header>

  {#if templatesResource.loading}
    <Card class="kui-panel center">
      <Loading size="lg" />
    </Card>
  {:else if templates.length === 0}
    <Card class="kui-panel center dashed">
      <p class="kui-strong">No templates yet</p>
      <p class="kui-subtext">Create your first template to get started.</p>
      <Button variant="primary" size="sm" onclick={() => (showCreateModal = true)}>Create template</Button>
    </Card>
  {:else}
    <div class="kui-list">
      {#each templates as template}
        <Card class="kui-panel">
          <div class="kui-template">
            <div>
              <h3>{template.name}</h3>
              <p class="kui-subtext">{template.subject}</p>
              <p class="kui-subtext">
                Created {new Date(template.created_at).toLocaleDateString()}
              </p>
            </div>
            <div class="kui-inline end">
              <Button variant="outline" size="sm" onclick={() => openPreviewModal(template)}>
                <Eye class="kui-icon" /> Preview
              </Button>
              <Button variant="ghost" size="sm" onclick={() => handleDeleteTemplate(template.id)} disabled={deletingId === template.id}>
                {#if deletingId === template.id}
                  <Loader2 class="kui-icon spinning" />
                {:else}
                  <Trash2 class="kui-icon error" />
                {/if}
                Delete
              </Button>
            </div>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
</div>

{#if showCreateModal}
  <div class="kui-overlay">
    <div class="kui-modal">
      <div class="kui-modal__header">
        <h3>Create new template</h3>
        <Button variant="ghost" size="xs" onclick={() => (showCreateModal = false)}>
          <X class="kui-icon" />
        </Button>
      </div>
      <div class="kui-modal__body">
        <FormField label="Template name">
          <FormInput field={{ name: 'name', bind: { value: formName } } as any} placeholder="Template name" />
        </FormField>
        <FormField label="Email subject">
          <FormInput field={{ name: 'subject', bind: { value: formSubject } } as any} placeholder="Email subject" />
        </FormField>
        <FormField label="HTML Content">
          <textarea
            class="kui-textarea font-mono text-sm"
            bind:value={formHtml}
            placeholder="<h1>Hello</h1>"
            rows="8"
          ></textarea>
          <label class="kui-inline">
            <input type="checkbox" bind:checked={showSourceCode} />
            <span class="kui-subtext">Show raw HTML after editing</span>
          </label>
          <EmailEditor content={formHtml} onChange={(html) => (formHtml = html)} />
        </FormField>

        {#if createError}
          <div class="kui-callout error">{createError}</div>
        {/if}
      </div>
      <div class="kui-modal__footer">
        <Button variant="ghost" onclick={() => (showCreateModal = false)}>Cancel</Button>
        <Button variant="primary" onclick={handleCreateTemplate} disabled={creating}>
          {#if creating}
            <Loading size="sm" /> Creating...
          {:else}
            Create Template
          {/if}
        </Button>
      </div>
    </div>
    <div class="kui-overlay__backdrop" onclick={() => (showCreateModal = false)}></div>
  </div>
{/if}

{#if showPreviewModal && previewTemplate}
  <div class="kui-overlay">
    <div class="kui-modal large">
      <div class="kui-modal__header">
        <h3>{previewTemplate.name}</h3>
        <div class="kui-inline">
          <Badge variant="primary" size="xs">
            <Code2 class="kui-icon" /> HTML
          </Badge>
          <Button variant="ghost" size="xs" onclick={() => (showPreviewModal = false)}>
            <X class="kui-icon" />
          </Button>
        </div>
      </div>
      <div class="kui-modal__body">
        {#if loadingPreview}
          <div class="kui-center"><Loading /></div>
        {:else}
          <div class="kui-preview">
            <iframe title="Template Preview" srcdoc={previewTemplate.html}></iframe>
          </div>
        {/if}
      </div>
      <div class="kui-modal__footer end">
        <Button variant="ghost" onclick={() => (showPreviewModal = false)}>Close</Button>
      </div>
    </div>
    <div class="kui-overlay__backdrop" onclick={() => (showPreviewModal = false)}></div>
  </div>
{/if}

<style>
  .kui-templates {
    display: grid;
    gap: var(--kui-spacing-md);
  }

  .kui-tabs {
    display: flex;
    gap: 0.75rem;
    border-bottom: 1px solid var(--kui-color-border);
    padding-bottom: 0.5rem;
  }

  .kui-tab {
    padding: 0.55rem 0.9rem;
    border-radius: var(--kui-radius-md);
    text-decoration: none;
    color: var(--kui-color-muted);
    border: 1px solid transparent;
  }

  .kui-tab.is-active {
    border-color: var(--kui-color-border);
    background: var(--kui-color-surface);
    color: var(--kui-color-text);
    box-shadow: var(--kui-shadow-xs);
  }

  .kui-templates__header {
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

  .kui-icon {
    width: 1rem;
    height: 1rem;
  }

  .kui-panel.center {
    display: grid;
    gap: 0.35rem;
    justify-items: center;
    text-align: center;
    padding: var(--kui-spacing-lg);
  }

  .kui-panel.dashed {
    border-style: dashed;
  }

  .kui-list {
    display: grid;
    gap: var(--kui-spacing-sm);
  }

  .kui-template {
    display: flex;
    justify-content: space-between;
    gap: var(--kui-spacing-md);
    align-items: flex-start;
  }

  .kui-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .kui-inline.end {
    justify-content: flex-end;
  }

  .kui-strong {
    font-weight: 700;
  }

  .kui-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: grid;
    place-items: center;
  }

  .kui-overlay__backdrop {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.35);
    backdrop-filter: blur(4px);
  }

  .kui-modal {
    position: relative;
    z-index: 1;
    background: var(--kui-color-surface);
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-lg);
    box-shadow: var(--kui-shadow-lg);
    width: min(960px, 100% - 32px);
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }

  .kui-modal.large {
    width: min(1080px, 100% - 32px);
  }

  .kui-modal__header,
  .kui-modal__footer {
    padding: var(--kui-spacing-md);
    border-bottom: 1px solid var(--kui-color-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--kui-spacing-sm);
  }

  .kui-modal__footer {
    border-top: 1px solid var(--kui-color-border);
    border-bottom: none;
  }

  .kui-modal__footer.end {
    justify-content: flex-end;
  }

  .kui-modal__body {
    padding: var(--kui-spacing-md);
    overflow-y: auto;
    display: grid;
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
  }

  .kui-callout.error {
    border-color: color-mix(in srgb, var(--kui-color-error) 40%, var(--kui-color-border) 60%);
    background: rgba(239, 68, 68, 0.08);
  }

  .kui-preview {
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    overflow: hidden;
    background: var(--kui-color-surface);
    min-height: 300px;
  }

  .kui-preview iframe {
    width: 100%;
    border: none;
    min-height: 300px;
  }

  .kui-textarea {
    width: 100%;
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    padding: 0.65rem 0.8rem;
    background: var(--kui-color-surface);
    color: var(--kui-color-text);
    font-size: 0.95rem;
  }

  .text-right {
    text-align: right;
  }

  .kui-icon.spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 720px) {
    .kui-template {
      flex-direction: column;
    }
  }
</style>
