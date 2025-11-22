<script lang="ts">
  import { Send, Trash2, Loader2, Plus, Eye, X, ChevronRight, ChevronLeft } from '@lucide/svelte';
  import EmailEditor from '$lib/components/EmailEditor.svelte';
  import { Button, Card, Badge, Loading } from '@kuratchi/ui';
  import {
    listBroadcasts,
    createBroadcast,
    sendBroadcast,
    deleteBroadcast
  } from '$lib/functions/broadcasts.remote';
  import { listSegments } from '$lib/functions/newsletter.remote';

  const broadcastsResource = listBroadcasts();
  const segmentsResource = listSegments();

  const broadcasts = $derived(Array.isArray(broadcastsResource.current) ? broadcastsResource.current : []);
  const segments = $derived(Array.isArray(segmentsResource.current) ? segmentsResource.current : []);

  let showCreateModal = $state(false);
  let currentStep = $state(0);
  let formName = $state('');
  let formSubject = $state('');
  let formHtml = $state('');
  let formAudienceId = $state('');
  let creating = $state(false);
  let createError = $state<string | null>(null);

  let deletingId = $state<string | null>(null);
  let sendingId = $state<string | null>(null);
  let selectedBroadcast = $state<any>(null);
  let showPreviewModal = $state(false);

  const steps = [
    { title: 'Details', description: 'Name and audience' },
    { title: 'Content', description: 'Subject and message' },
    { title: 'Review', description: 'Preview and confirm' }
  ];

  $effect(() => {
    if (!formAudienceId && segments.length > 0) {
      formAudienceId = segments[0]?.id ?? '';
    }
  });

  function resetForm() {
    formName = '';
    formSubject = '';
    formHtml = '';
    formAudienceId = segments[0]?.id ?? '';
    createError = null;
    currentStep = 0;
  }

  function openCreateModal() {
    resetForm();
    showCreateModal = true;
  }

  function closeCreateModal() {
    showCreateModal = false;
    resetForm();
  }

  function canProceedToNextStep(): boolean {
    if (currentStep === 0) return formName.trim().length > 0 && formAudienceId.length > 0;
    if (currentStep === 1) return formSubject.trim().length > 0 && formHtml.trim().length > 0;
    return true;
  }

  function nextStep() {
    if (canProceedToNextStep() && currentStep < steps.length - 1) {
      currentStep++;
      createError = null;
    }
  }

  function prevStep() {
    if (currentStep > 0) {
      currentStep--;
      createError = null;
    }
  }

  async function handleCreateBroadcast() {
    if (!canProceedToNextStep()) {
      createError = 'All fields are required';
      return;
    }

    creating = true;
    createError = null;

    try {
      await createBroadcast({
        name: formName.trim(),
        subject: formSubject.trim(),
        html: formHtml.trim(),
        segmentId: formAudienceId
      });
      await broadcastsResource.refresh();
      closeCreateModal();
    } catch (err) {
      createError = err instanceof Error ? err.message : 'Failed to create broadcast';
    } finally {
      creating = false;
    }
  }

  async function handleSendBroadcast(id: string) {
    if (!confirm('Send this broadcast to the selected audience?')) return;
    sendingId = id;
    try {
      await sendBroadcast({ broadcastId: id });
      await broadcastsResource.refresh();
    } catch (err) {
      alert('Failed to send broadcast');
    } finally {
      sendingId = null;
    }
  }

  async function handleDeleteBroadcast(id: string) {
    if (!confirm('Delete this broadcast?')) return;
    deletingId = id;
    try {
      await deleteBroadcast({ broadcastId: id });
      await broadcastsResource.refresh();
    } catch (err) {
      alert('Failed to delete broadcast');
    } finally {
      deletingId = null;
    }
  }

  function openPreviewModal(broadcast: any) {
    selectedBroadcast = broadcast;
    showPreviewModal = true;
  }

  function getSegmentName(id: string) {
    return segments.find(s => s.id === id)?.name || 'Unknown';
  }

  function getStatusVariant(status: string) {
    switch (status) {
      case 'sent': return { variant: 'success', label: 'Sent' };
      case 'draft': return { variant: 'warning', label: 'Draft' };
      case 'scheduled': return { variant: 'info', label: 'Scheduled' };
      default: return { variant: 'neutral', label: status };
    }
  }
</script>

<svelte:head>
  <title>Broadcasts - Kuratchi Dashboard</title>
</svelte:head>

<div class="kui-broadcast">
  <div class="kui-broadcast__header">
    <div>
      <h2>Broadcasts</h2>
      <p class="kui-broadcast__subtitle">Send direct emails to your audiences</p>
    </div>
    <Button variant="primary" onclick={openCreateModal}>
      <Plus class="kui-icon" />
      New Broadcast
    </Button>
  </div>

  {#if broadcasts.length === 0}
    <div class="kui-empty">
      <Send class="kui-empty__icon" />
      <p class="kui-empty__text">No broadcasts yet</p>
      <p class="kui-empty__subtext">Create your first broadcast to get started</p>
    </div>
  {:else}
    <div class="kui-list">
      {#each broadcasts as broadcast}
        {@const badge = getStatusVariant(broadcast.status)}
        <div class="kui-broadcast-item">
          <div class="kui-broadcast-item__content">
            <h3 class="kui-broadcast-item__title">{broadcast.name}</h3>
            <p class="kui-broadcast-item__subject">{broadcast.subject}</p>
            <div class="kui-broadcast-item__meta">
              <Badge variant={badge.variant} size="xs">{badge.label}</Badge>
              <span class="kui-broadcast-item__audience">{getSegmentName(broadcast.segmentId)}</span>
            </div>
          </div>
          <div class="kui-broadcast-item__actions">
            <Button variant="ghost" size="sm" onclick={() => openPreviewModal(broadcast)} title="Preview">
              <Eye class="kui-icon" />
            </Button>
            {#if broadcast.status === 'draft'}
              <Button variant="primary" size="sm" onclick={() => handleSendBroadcast(broadcast.id)} disabled={sendingId === broadcast.id}>
                {#if sendingId === broadcast.id}
                  <Loader2 class="kui-icon spinning" />
                {:else}
                  <Send class="kui-icon" />
                {/if}
              </Button>
            {/if}
            <Button variant="ghost" size="sm" onclick={() => handleDeleteBroadcast(broadcast.id)} disabled={deletingId === broadcast.id} title="Delete">
              {#if deletingId === broadcast.id}
                <Loader2 class="kui-icon spinning" />
              {:else}
                <Trash2 class="kui-icon" />
              {/if}
            </Button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if showCreateModal}
  <div class="kui-overlay">
    <div class="kui-modal">
      <div class="kui-modal__header">
        <div>
          <h3>Create Broadcast</h3>
          <p class="kui-subtext">{steps[currentStep].description}</p>
        </div>
        <Button variant="ghost" size="xs" onclick={closeCreateModal} aria-label="Close">
          <X class="kui-icon" />
        </Button>
      </div>

      <div class="kui-steps">
        {#each steps as step, idx}
          <div class="kui-step">
            <div class={`kui-step__badge ${idx === currentStep ? 'is-active' : idx < currentStep ? 'is-done' : ''}`}>
              {idx < currentStep ? '✓' : idx + 1}
            </div>
            <p>{step.title}</p>
            {#if idx < steps.length - 1}
              <div class={`kui-step__bar ${idx < currentStep ? 'is-done' : ''}`}></div>
            {/if}
          </div>
        {/each}
      </div>

      <div class="kui-modal__body">
        {#if currentStep === 0}
          <div class="kui-stack">
            <label class="kui-label">
              Broadcast Name
              <input class="kui-input" type="text" bind:value={formName} placeholder="e.g., Holiday Sale Announcement" />
              <span class="kui-subtext">Give your broadcast a descriptive name</span>
            </label>

            <label class="kui-label">
              Target Audience
              <select class="kui-select" bind:value={formAudienceId}>
                {#each segments as segment}
                  <option value={segment.id}>{segment.name} ({segment.subscriberCount ?? 0} contacts)</option>
                {/each}
              </select>
              <span class="kui-subtext">Select the segment to send this broadcast to</span>
            </label>
          </div>
        {:else if currentStep === 1}
          <div class="kui-stack">
            <label class="kui-label">
              Subject Line
              <input class="kui-input" type="text" bind:value={formSubject} placeholder="Email subject" />
              <span class="kui-subtext">This is what recipients will see in their inbox</span>
            </label>

            <label class="kui-label">
              Email Content
              <EmailEditor content={formHtml} onChange={(html) => (formHtml = html)} />
              <span class="kui-subtext">Use the builder to format your email.</span>
            </label>
          </div>
        {:else}
          <div class="kui-review">
            <div>
              <p class="kui-eyebrow">Broadcast Name</p>
              <p class="kui-strong">{formName}</p>
            </div>
              <p class="kui-eyebrow">Target Audience</p>
              <p class="kui-strong">{getSegmentName(formAudienceId)}</p>
            <div>
              <p class="kui-eyebrow">Subject Line</p>
              <p class="kui-strong">{formSubject}</p>
            </div>
            <div>
              <p class="kui-eyebrow">Preview</p>
              <div class="kui-preview">
                <iframe title="Email Preview" srcdoc={formHtml}></iframe>
              </div>
            </div>
          </div>
        {/if}

        {#if createError}
          <div class="kui-callout error">{createError}</div>
        {/if}
      </div>

      <div class="kui-modal__footer">
        <Button variant="ghost" onclick={prevStep} disabled={currentStep === 0}>
          <ChevronLeft class="kui-icon" />
          Back
        </Button>
        <div class="kui-inline end">
          <Button variant="ghost" onclick={closeCreateModal}>Cancel</Button>
          {#if currentStep < steps.length - 1}
            <Button variant="primary" onclick={nextStep} disabled={!canProceedToNextStep()}>
              Next
              <ChevronRight class="kui-icon" />
            </Button>
          {:else}
            <Button variant="primary" onclick={handleCreateBroadcast} disabled={creating || !canProceedToNextStep()}>
              {#if creating}
                <Loading size="sm" />
                Creating...
              {:else}
                Create Broadcast
              {/if}
            </Button>
          {/if}
        </div>
      </div>
    </div>
    <div class="kui-overlay__backdrop" onclick={closeCreateModal}></div>
  </div>
{/if}

{#if showPreviewModal && selectedBroadcast}
  <div class="kui-overlay">
    <div class="kui-preview-modal">
      <div class="kui-modal__header">
        <div>
          <h2>{selectedBroadcast.name}</h2>
          <p class="kui-subtext">To: {getSegmentName(selectedBroadcast.segmentId)}</p>
        </div>
        <Button variant="ghost" size="xs" onclick={() => (showPreviewModal = false)}>
          <X class="kui-icon" />
        </Button>
      </div>

      <div class="kui-preview-body">
        <div class="kui-review">
          <div>
            <p class="kui-eyebrow">Subject</p>
            <p class="kui-strong">{selectedBroadcast.subject}</p>
          </div>
          <div class="kui-preview-frame">
            <iframe title="Email Preview" srcdoc={selectedBroadcast.html}></iframe>
          </div>
        </div>
      </div>

      <div class="kui-modal__footer end">
        <Button variant="ghost" onclick={() => (showPreviewModal = false)}>Close</Button>
      </div>
    </div>
    <div class="kui-overlay__backdrop" onclick={() => (showPreviewModal = false)}></div>
  </div>
{/if}

<style>
  .kui-broadcast {
    display: grid;
    gap: 1.5rem;
  }

  .kui-broadcast__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .kui-broadcast__header h2 {
    margin: 0 0 0.25rem 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .kui-broadcast__subtitle {
    margin: 0;
    font-size: 0.9rem;
    color: var(--kui-color-muted);
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

  .kui-list {
    display: grid;
    gap: 0.75rem;
  }

  .kui-broadcast-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.25rem;
    background: var(--kui-color-surface);
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    transition: all 150ms ease;
  }

  .kui-broadcast-item:hover {
    border-color: var(--kui-color-primary);
    box-shadow: var(--kui-shadow-xs);
  }

  .kui-broadcast-item__content {
    flex: 1;
    min-width: 0;
  }

  .kui-broadcast-item__title {
    margin: 0 0 0.25rem 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--kui-color-text);
  }

  .kui-broadcast-item__subject {
    margin: 0 0 0.5rem 0;
    font-size: 0.85rem;
    color: var(--kui-color-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .kui-broadcast-item__meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .kui-broadcast-item__audience {
    font-size: 0.8rem;
    color: var(--kui-color-muted);
  }

  .kui-broadcast-item__actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .kui-icon {
    width: 1rem;
    height: 1rem;
  }

  .kui-icon.spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Modal styles */
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

  .kui-modal,
  .kui-preview-modal {
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

  .kui-modal__header,
  .kui-modal__footer {
    padding: 1.5rem;
    border-bottom: 1px solid var(--kui-color-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .kui-modal__footer {
    border-top: 1px solid var(--kui-color-border);
    border-bottom: none;
  }

  .kui-modal__body {
    padding: 1.5rem;
    overflow-y: auto;
    display: grid;
    gap: 1rem;
  }

  .kui-steps {
    display: flex;
    gap: 1rem;
    padding: 1.5rem;
    border-bottom: 1px solid var(--kui-color-border);
    flex-wrap: wrap;
  }

  .kui-step {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .kui-step__badge {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--kui-color-surface-muted);
    color: var(--kui-color-text);
    font-weight: 600;
    font-size: 0.875rem;
  }

  .kui-step__badge.is-active {
    background: var(--kui-color-primary);
    color: #fff;
  }

  .kui-step__badge.is-done {
    background: var(--kui-color-success);
    color: #fff;
  }

  .kui-step__bar {
    width: 2.5rem;
    height: 3px;
    border-radius: 999px;
    background: var(--kui-color-border);
  }

  .kui-step__bar.is-done {
    background: var(--kui-color-success);
  }

  .kui-stack {
    display: grid;
    gap: 1rem;
  }

  .kui-label {
    display: grid;
    gap: 0.35rem;
    font-weight: 500;
    font-size: 0.9rem;
  }

  .kui-input,
  .kui-select {
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    padding: 0.65rem 0.75rem;
    font-size: 0.9rem;
    background: var(--kui-color-surface);
    color: var(--kui-color-text);
  }

  .kui-select {
    appearance: none;
  }

  .kui-review {
    display: grid;
    gap: 1.5rem;
  }

  .kui-preview {
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    overflow: hidden;
    background: var(--kui-color-surface);
  }

  .kui-preview iframe {
    width: 100%;
    min-height: 260px;
    border: none;
  }

  .kui-preview-modal {
    width: min(960px, 100% - 32px);
  }

  .kui-preview-body {
    padding: 1.5rem;
    overflow-y: auto;
  }

  .kui-preview-frame {
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-md);
    overflow: hidden;
    background: var(--kui-color-surface);
  }

  .kui-preview-frame iframe {
    width: 100%;
    min-height: 300px;
    border: none;
  }

  .kui-eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--kui-color-muted);
    margin: 0;
  }

  .kui-strong {
    font-weight: 600;
    color: var(--kui-color-text);
    margin: 0;
  }

  .kui-subtext {
    color: var(--kui-color-muted);
    margin: 0;
    font-size: 0.85rem;
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
    .kui-broadcast-item {
      flex-direction: column;
      align-items: flex-start;
    }

    .kui-broadcast-item__actions {
      width: 100%;
      justify-content: flex-start;
    }

    .kui-modal,
    .kui-preview-modal {
      width: min(90vw, calc(100vw - 32px));
    }
  }
</style>
