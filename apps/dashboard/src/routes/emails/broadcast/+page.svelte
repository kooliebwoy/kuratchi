<script lang="ts">
  import { Send, Trash2, Loader2, Plus, Eye, X, ChevronRight, ChevronLeft } from 'lucide-svelte';
  import EmailEditor from '$lib/components/EmailEditor.svelte';
  import {
    listBroadcasts,
    createBroadcast,
    sendBroadcast,
    deleteBroadcast,
    listSegments
  } from '$lib/functions/newsletter.remote';

  const broadcastsResource = listBroadcasts();
  const segmentsResource = listSegments();

  const broadcasts = $derived(Array.isArray(broadcastsResource.current) ? broadcastsResource.current : []);
  const segments = $derived(Array.isArray(segmentsResource.current) ? segmentsResource.current : []);

  // Create modal state
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
    if (currentStep === 0) {
      return formName.trim().length > 0 && formAudienceId.length > 0;
    } else if (currentStep === 1) {
      return formSubject.trim().length > 0 && formHtml.trim().length > 0;
    }
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
    if (!formName.trim() || !formSubject.trim() || !formHtml.trim() || !formAudienceId) {
      createError = 'All fields are required';
      return;
    }

    creating = true;
    createError = null;

    try {
      console.log('Creating broadcast with:', {
        name: formName.trim(),
        subject: formSubject.trim(),
        html: formHtml.trim(),
        audienceId: formAudienceId
      });
      const result = await createBroadcast({
        name: formName.trim(),
        subject: formSubject.trim(),
        html: formHtml.trim(),
        audienceId: formAudienceId
      });
      console.log('Broadcast created:', result);
      await broadcastsResource.refresh();
      closeCreateModal();
    } catch (err) {
      console.error('Broadcast creation error:', err);
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
      console.error(err);
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
      console.error(err);
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

  function getStatusBadge(status: string) {
    switch (status) {
      case 'sent':
        return { class: 'badge-success', label: 'Sent' };
      case 'draft':
        return { class: 'badge-warning', label: 'Draft' };
      case 'scheduled':
        return { class: 'badge-info', label: 'Scheduled' };
      default:
        return { class: 'badge-neutral', label: status };
    }
  }
</script>

<svelte:head>
  <title>Broadcasts - Kuratchi Dashboard</title>
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
    <a href="/emails/templates" class="tab tab-bordered">
      <span class="font-medium">Templates</span>
    </a>
    <a href="/emails/broadcast" class="tab tab-active tab-bordered">
      <span class="font-medium">Broadcasts</span>
    </a>
  </div>
</div>

<section class="space-y-8 p-8">
  <div class="flex items-center justify-between">
    <div>
      <p class="text-xs font-semibold uppercase tracking-wide text-primary/70">Direct Email</p>
      <h1 class="text-2xl font-semibold">Broadcasts</h1>
      <p class="text-sm text-base-content/70">Send emails directly to your audiences.</p>
    </div>
    <button class="btn btn-primary" onclick={openCreateModal}>
      <Plus class="h-4 w-4" />
      New Broadcast
    </button>
  </div>

  {#if broadcasts.length === 0}
    <div class="card bg-base-100 shadow-sm border border-base-200">
      <div class="card-body items-center justify-center py-12">
        <Send class="h-12 w-12 text-base-content/30" />
        <p class="text-base-content/70 mt-4">No broadcasts yet</p>
        <p class="text-sm text-base-content/50">Create your first broadcast to get started</p>
      </div>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-4">
      {#each broadcasts as broadcast}
        {@const badge = getStatusBadge(broadcast.status)}
        <div class="card bg-base-100 shadow-sm border border-base-200">
          <div class="card-body">
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1">
                <h3 class="card-title text-lg">{broadcast.name}</h3>
                <p class="text-sm text-base-content/70 mt-1">{broadcast.subject}</p>
                <div class="flex items-center gap-2 mt-3">
                  <span class={`badge ${badge.class} badge-sm`}>{badge.label}</span>
                  <span class="text-xs text-base-content/60">{getSegmentName(broadcast.audienceId)}</span>
                </div>
              </div>
              <div class="flex gap-2">
                <button
                  class="btn btn-ghost btn-sm"
                  onclick={() => openPreviewModal(broadcast)}
                  title="Preview"
                >
                  <Eye class="h-4 w-4" />
                </button>
                {#if broadcast.status === 'draft'}
                  <button
                    class="btn btn-primary btn-sm"
                    onclick={() => handleSendBroadcast(broadcast.id)}
                    disabled={sendingId === broadcast.id}
                  >
                    {#if sendingId === broadcast.id}
                      <Loader2 class="h-4 w-4 animate-spin" />
                    {:else}
                      <Send class="h-4 w-4" />
                    {/if}
                    Send
                  </button>
                {/if}
                <button
                  class="btn btn-ghost btn-sm text-error"
                  onclick={() => handleDeleteBroadcast(broadcast.id)}
                  disabled={deletingId === broadcast.id}
                >
                  {#if deletingId === broadcast.id}
                    <Loader2 class="h-4 w-4 animate-spin" />
                  {:else}
                    <Trash2 class="h-4 w-4" />
                  {/if}
                </button>
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</section>

<!-- Create Broadcast Modal - Step Based -->
{#if showCreateModal}
  <div class="modal modal-open">
    <div class="modal-box max-w-3xl max-h-[90vh] flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 border-b border-base-200">
        <div>
          <h3 class="font-bold text-lg">Create Broadcast</h3>
          <p class="text-xs text-base-content/60 mt-1">{steps[currentStep].description}</p>
        </div>
        <button class="btn btn-ghost btn-sm btn-circle" onclick={closeCreateModal}>
          <X class="h-4 w-4" />
        </button>
      </div>

      <!-- Steps Indicator -->
      <div class="py-6 px-4">
        <div class="flex items-center justify-between">
          {#each steps as step, idx}
            <div class="flex flex-col items-center flex-1">
              <div class={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition ${
                idx === currentStep 
                  ? 'bg-primary text-primary-content' 
                  : idx < currentStep 
                  ? 'bg-success text-success-content' 
                  : 'bg-base-200 text-base-content/60'
              }`}>
                {idx < currentStep ? '✓' : idx + 1}
              </div>
              <p class="text-xs font-medium mt-2 text-center">{step.title}</p>
            </div>
            {#if idx < steps.length - 1}
              <div class={`h-1 flex-1 mx-2 rounded transition ${
                idx < currentStep ? 'bg-success' : 'bg-base-200'
              }`}></div>
            {/if}
          {/each}
        </div>
      </div>

      <!-- Step Content -->
      <div class="flex-1 overflow-y-auto px-4 py-4">
        {#if currentStep === 0}
          <!-- Step 1: Details -->
          <div class="space-y-4">
            <div>
              <label class="label">
                <span class="label-text font-medium">Broadcast Name</span>
              </label>
              <input
                type="text"
                class="input input-bordered w-full"
                bind:value={formName}
                placeholder="e.g., Holiday Sale Announcement"
              />
              <p class="text-xs text-base-content/60 mt-1">Give your broadcast a descriptive name</p>
            </div>

            <div>
              <label class="label">
                <span class="label-text font-medium">Target Audience</span>
              </label>
              <select class="select select-bordered w-full" bind:value={formAudienceId}>
                {#each segments as segment}
                  <option value={segment.id}>{segment.name} ({segment.subscriberCount ?? 0} contacts)</option>
                {/each}
              </select>
              <p class="text-xs text-base-content/60 mt-1">Select the segment to send this broadcast to</p>
            </div>
          </div>
        {:else if currentStep === 1}
          <!-- Step 2: Content -->
          <div class="space-y-4">
            <div>
              <label class="label">
                <span class="label-text font-medium">Subject Line</span>
              </label>
              <input
                type="text"
                class="input input-bordered w-full"
                bind:value={formSubject}
                placeholder="Email subject"
              />
              <p class="text-xs text-base-content/60 mt-1">This is what recipients will see in their inbox</p>
            </div>

            <div>
              <label class="label">
                <span class="label-text font-medium">Email Content</span>
              </label>
              <EmailEditor
                content={formHtml}
                onChange={(html) => (formHtml = html)}
              />
              <p class="text-xs text-base-content/60 mt-2">✨ Use the toolbar to format your email. The content is automatically converted to HTML for Resend.</p>
            </div>
          </div>
        {:else if currentStep === 2}
          <!-- Step 3: Review -->
          <div class="space-y-4">
            <div class="bg-base-200/50 rounded-lg p-4 space-y-3">
              <div>
                <p class="text-xs text-base-content/60 uppercase font-semibold">Broadcast Name</p>
                <p class="text-sm font-medium mt-1">{formName}</p>
              </div>
              <div class="divider my-2"></div>
              <div>
                <p class="text-xs text-base-content/60 uppercase font-semibold">Target Audience</p>
                <p class="text-sm font-medium mt-1">{getSegmentName(formAudienceId)}</p>
              </div>
              <div class="divider my-2"></div>
              <div>
                <p class="text-xs text-base-content/60 uppercase font-semibold">Subject Line</p>
                <p class="text-sm font-medium mt-1">{formSubject}</p>
              </div>
              <div class="divider my-2"></div>
              <div>
                <p class="text-xs text-base-content/60 uppercase font-semibold">Preview</p>
                <div class="bg-white rounded border border-base-200 mt-2 p-4 max-h-48 overflow-y-auto">
                  <iframe
                    title="Email Preview"
                    class="w-full"
                    style="min-height: 200px; height: 100%;"
                    srcdoc={formHtml}
                  ></iframe>
                </div>
              </div>
            </div>
          </div>
        {/if}

        {#if createError}
          <div class="alert alert-error alert-sm mt-4">
            <span>{createError}</span>
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between pt-4 border-t border-base-200">
        <button class="btn btn-ghost" onclick={prevStep} disabled={currentStep === 0}>
          <ChevronLeft class="h-4 w-4" />
          Back
        </button>

        <div class="flex gap-2">
          <button class="btn btn-ghost" onclick={closeCreateModal}>Cancel</button>
          {#if currentStep < steps.length - 1}
            <button 
              class="btn btn-primary" 
              onclick={nextStep}
              disabled={!canProceedToNextStep()}
            >
              Next
              <ChevronRight class="h-4 w-4" />
            </button>
          {:else}
            <button 
              class="btn btn-primary" 
              onclick={handleCreateBroadcast}
              disabled={creating || !canProceedToNextStep()}
            >
              {#if creating}
                <Loader2 class="h-4 w-4 animate-spin" />
                Creating...
              {:else}
                Create Broadcast
              {/if}
            </button>
          {/if}
        </div>
      </div>
    </div>
    <button class="modal-backdrop" onclick={closeCreateModal} aria-label="Close modal"></button>
  </div>
{/if}

<!-- Preview Modal -->
{#if showPreviewModal && selectedBroadcast}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div class="w-full max-w-4xl max-h-[90vh] bg-base-100 rounded-2xl shadow-2xl flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-base-200 px-6 py-4">
        <div>
          <h2 class="text-2xl font-bold">{selectedBroadcast.name}</h2>
          <p class="text-sm text-base-content/60 mt-1">To: {getSegmentName(selectedBroadcast.audienceId)}</p>
        </div>
        <button
          class="btn btn-ghost btn-circle btn-sm"
          onclick={() => (showPreviewModal = false)}
        >
          ✕
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-auto bg-white p-8">
        <div class="max-w-2xl mx-auto">
          <div class="mb-6">
            <p class="text-xs text-base-content/60 uppercase font-semibold">Subject</p>
            <p class="text-lg font-semibold mt-1">{selectedBroadcast.subject}</p>
          </div>
          <div class="bg-white rounded-lg border border-base-200 overflow-hidden">
            <iframe
              title="Email Preview"
              class="w-full"
              style="min-height: 600px; height: 100%;"
              srcdoc={selectedBroadcast.html}
            ></iframe>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="border-t border-base-200 px-6 py-4 flex justify-end">
        <button class="btn btn-ghost" onclick={() => (showPreviewModal = false)}>Close</button>
      </div>
    </div>
  </div>
{/if}
