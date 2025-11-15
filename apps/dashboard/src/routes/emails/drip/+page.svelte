<script lang="ts">
  import { Layers, Clock, Play, Trash2, Edit2, Mail, Loader2, Plus, RefreshCw } from 'lucide-svelte';
  import EmailEditor from '$lib/components/EmailEditor.svelte';
  import {
    listSegments,
    listDripCampaigns,
    saveDripCampaign,
    deleteDripCampaign,
    launchDripCampaign,
    processDripBranches,
    type DripCampaignRecord
  } from '$lib/functions/newsletter.remote';

  type StepInput = {
    id: string;
    label: string;
    subject: string;
    previewText?: string;
    html?: string;
    text?: string;
    delayValue: number;
    delayUnit: 'minutes' | 'hours' | 'days';
    scheduleMode: 'relative' | 'absolute';
    runAt?: string;
    branching: {
      monitor: 'opened' | 'clicked';
      successStepId?: string;
      fallbackStepId?: string;
      evaluateValue: number;
      evaluateUnit: 'minutes' | 'hours' | 'days';
    } | null;
  };

  const segmentsResource = listSegments();
  const dripResource = listDripCampaigns();

  const segments = $derived(Array.isArray(segmentsResource.current) ? segmentsResource.current : []);
  const campaigns = $derived(Array.isArray(dripResource.current) ? dripResource.current : []);

  const activeCampaigns = $derived(campaigns.filter((c) => c.status === 'active'));
  const totalScheduled = $derived(campaigns.reduce((total, campaign) => total + (campaign.metrics?.totalScheduled ?? 0), 0));

  const delayFromMinutes = (minutes: number): { value: number; unit: StepInput['delayUnit'] } => {
    if (minutes % (24 * 60) === 0) {
      return { value: Math.max(minutes / (24 * 60), 0), unit: 'days' };
    }
    if (minutes % 60 === 0) {
      return { value: Math.max(minutes / 60, 0), unit: 'hours' };
    }
    return { value: Math.max(minutes, 0), unit: 'minutes' };
  };

  const createStep = (overrides: Partial<StepInput> = {}): StepInput => ({
    id: crypto.randomUUID(),
    label: 'Email Step',
    subject: 'Untitled email',
    previewText: '',
    html: '<p>Replace with your content.</p>',
    text: '',
    delayValue: 0,
    delayUnit: 'minutes',
    scheduleMode: 'relative',
    runAt: '',
    branching: null,
    ...overrides
  });

  const describeStepSchedule = (step: DripCampaignRecord['steps'][number]) => {
    if (step.scheduleMode === 'absolute' && step.sendAt) {
      return new Date(step.sendAt).toLocaleString();
    }
    const delay = delayFromMinutes(step.delayMinutes ?? 0);
    return `+${delay.value} ${delay.unit}`;
  };

  let showEditor = $state(false);
  let editingId = $state<string | null>(null);
  let formName = $state('');
  let formDescription = $state('');
  let formSegmentId = $state('');
  let formStartAt = $state('');
  let formSteps = $state<StepInput[]>([]);
  let saveError = $state<string | null>(null);
  let saving = $state(false);
  let launchLoadingId = $state<string | null>(null);
  let deletingId = $state<string | null>(null);
  let toastMessage = $state<string | null>(null);
  let syncingBranches = $state(false);
  let currentStep = $state(0);
  let editingStepIndex = $state<number | null>(null);

  $effect(() => {
    if (!formSegmentId && segments.length > 0) {
      formSegmentId = segments[0]?.id ?? '';
    }
  });

  function setToast(message: string | null) {
    toastMessage = message;
    if (message) {
      setTimeout(() => {
        toastMessage = null;
      }, 3000);
    }
  }

  async function syncBranchQueue() {
    syncingBranches = true;
    try {
      await processDripBranches({ limit: 100 });
      await dripResource.refresh();
    } finally {
      syncingBranches = false;
    }
  }

  // Only call on client side
  if (typeof window !== 'undefined') {
    syncBranchQueue();
  }

  const selectedSegmentName = (segmentId: string) => segments.find((seg) => seg.id === segmentId)?.name ?? 'Unknown';

  function resetForm() {
    editingId = null;
    formName = '';
    formDescription = '';
    formSegmentId = segments[0]?.id ?? '';
    formStartAt = '';
    formSteps = [
      createStep({
        label: 'Welcome Email',
        subject: 'Welcome to the community',
        html: '<p>Thanks for joining us!</p>',
        delayValue: 0,
        delayUnit: 'minutes'
      })
    ];
    saveError = null;
  }

  function openCreateModal() {
    resetForm();
    showEditor = true;
  }

  function openEditModal(campaign: DripCampaignRecord) {
    editingId = campaign.id;
    formName = campaign.name;
    formDescription = campaign.description ?? '';
    formSegmentId = campaign.segmentId;
    formStartAt = campaign.startAt ?? '';
    formSteps = campaign.steps.map((step) => {
      const scheduleMode = step.scheduleMode ?? 'relative';
      const delay = delayFromMinutes(step.delayMinutes ?? 0);
      const branchDelay = step.branching ? delayFromMinutes(step.branching.evaluateAfterMinutes ?? 0) : null;
      return createStep({
        id: step.id,
        label: step.label,
        subject: step.subject,
        html: step.html ?? '',
        text: step.text ?? '',
        previewText: step.previewText ?? '',
        delayValue: scheduleMode === 'relative' ? delay.value : 0,
        delayUnit: scheduleMode === 'relative' ? delay.unit : 'minutes',
        scheduleMode,
        runAt: scheduleMode === 'absolute' ? step.sendAt ?? '' : '',
        branching: step.branching
          ? {
              monitor: step.branching.monitor ?? 'opened',
              successStepId: step.branching.successStepId ?? '',
              fallbackStepId: step.branching.fallbackStepId ?? '',
              evaluateValue: branchDelay ? branchDelay.value : 1,
              evaluateUnit: branchDelay ? branchDelay.unit : 'days'
            }
          : null
      });
    });
    saveError = null;
    showEditor = true;
  }

  function addStep() {
    formSteps = [
      ...formSteps,
      createStep({
        label: `Step ${formSteps.length + 1}`,
        subject: 'Follow up',
        html: '<p>Just checking in.</p>',
        delayValue: 1,
        delayUnit: 'days'
      })
    ];
  }

  function removeStep(index: number) {
    if (formSteps.length === 1) return;
    formSteps = formSteps.filter((_, i) => i !== index);
  }

  function moveStep(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= formSteps.length) return;
    const updated = [...formSteps];
    const temp = updated[index];
    updated[index] = updated[target];
    updated[target] = temp;
    formSteps = updated;
  }

  function setScheduleMode(index: number, mode: StepInput['scheduleMode']) {
    formSteps = formSteps.map((step, idx) =>
      idx === index
        ? {
            ...step,
            scheduleMode: mode,
            runAt: mode === 'absolute' ? step.runAt : '',
            delayValue: mode === 'relative' ? step.delayValue : step.delayValue
          }
        : step
    );
  }

  function toggleBranching(index: number, enabled: boolean) {
    formSteps = formSteps.map((step, idx) => {
      if (idx !== index) return step;
      if (!enabled) {
        return { ...step, branching: null };
      }
      return {
        ...step,
        branching: step.branching ?? {
          monitor: 'opened',
          successStepId: '',
          fallbackStepId: '',
          evaluateValue: 2,
          evaluateUnit: 'days'
        }
      };
    });
  }

  async function handleSave() {
    if (!formName.trim() || !formSegmentId) {
      saveError = 'Campaign name and segment are required.';
      return;
    }
    saving = true;
    saveError = null;
    try {
      await saveDripCampaign({
        id: editingId ?? undefined,
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        segmentId: formSegmentId,
        segmentName: selectedSegmentName(formSegmentId),
        startAt: formStartAt || undefined,
        steps: formSteps.map((step) => ({
          id: step.id,
          label: step.label.trim() || 'Email',
          subject: step.subject.trim(),
          html: step.html,
          text: step.text,
          previewText: step.previewText,
          delayValue: step.delayValue,
          delayUnit: step.delayUnit,
          scheduleMode: step.scheduleMode,
          runAt: step.scheduleMode === 'absolute' ? step.runAt || undefined : undefined,
          branching:
            step.branching && (step.branching.successStepId || step.branching.fallbackStepId)
              ? {
                  monitor: step.branching.monitor,
                  successStepId: step.branching.successStepId || undefined,
                  fallbackStepId: step.branching.fallbackStepId || undefined,
                  evaluateValue: step.branching.evaluateValue,
                  evaluateUnit: step.branching.evaluateUnit
                }
              : undefined
        }))
      });
      await dripResource.refresh();
      showEditor = false;
      setToast(editingId ? 'Campaign updated' : 'Campaign saved');
    } catch (err) {
      console.error(err);
      saveError = 'Unable to save campaign. Please try again.';
    } finally {
      saving = false;
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this drip campaign?')) return;
    deletingId = id;
    try {
      await deleteDripCampaign({ id });
      await dripResource.refresh();
    } finally {
      deletingId = null;
    }
  }

  async function handleLaunch(campaign: DripCampaignRecord) {
    if (!confirm('Schedule this drip sequence for the selected audience?')) return;
    launchLoadingId = campaign.id;
    try {
      const response = await launchDripCampaign({
        id: campaign.id,
        startAt: campaign.startAt ?? undefined
      });
      await dripResource.refresh();
      setToast(`Scheduled ${response.contacts} contacts`);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Unable to launch campaign');
    } finally {
      launchLoadingId = null;
    }
  }
</script>

<svelte:head>
  <title>Drip Campaigns - Kuratchi Dashboard</title>
</svelte:head>

<!-- Navigation Tabs -->
<div class="border-b border-base-200 bg-base-100">
  <div class="flex gap-0 px-8">
    <a href="/emails/drip" class="tab tab-active tab-bordered">
      <span class="font-medium">Drip Campaigns</span>
    </a>
    <a href="/emails/segments" class="tab tab-bordered">
      <span class="font-medium">Segments</span>
    </a>
    <a href="/emails/templates" class="tab tab-bordered">
      <span class="font-medium">Templates</span>
    </a>
    <a href="/emails" class="tab tab-bordered">
      <span class="font-medium">Email History</span>
    </a>
  </div>
</div>

<section class="space-y-8 p-8">
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <p class="text-xs font-semibold uppercase tracking-wide text-primary/70">Automation</p>
      <h1 class="text-2xl font-semibold">Drip campaigns</h1>
      <p class="text-sm text-base-content/70">Build automated sequences sent via Resend audiences.</p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <button class="btn btn-ghost btn-sm" onclick={syncBranchQueue} disabled={syncingBranches}>
        {#if syncingBranches}
          <Loader2 class="h-4 w-4 animate-spin" />
        {:else}
          <RefreshCw class="h-4 w-4" />
        {/if}
        Sync branches
      </button>
      <button class="btn btn-primary btn-sm" onclick={openCreateModal}>
        <Plus class="h-4 w-4" />
        New campaign
      </button>
    </div>
  </div>

  {#if toastMessage}
    <div class="alert alert-success shadow-sm">
      <span>{toastMessage}</span>
    </div>
  {/if}

  <div class="grid gap-8 xl:grid-cols-[3fr,2fr]">
    <div class="space-y-6">
      <div class="grid gap-4 md:grid-cols-3">
        <div class="rounded-2xl border border-base-200 bg-base-100/80 p-4 shadow-sm">
          <p class="text-sm text-base-content/70">Total campaigns</p>
          <div class="mt-2 flex items-center gap-3">
            <span class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Layers class="h-5 w-5" />
            </span>
            <span class="text-3xl font-semibold">{campaigns.length}</span>
          </div>
        </div>
        <div class="rounded-2xl border border-base-200 bg-base-100/80 p-4 shadow-sm">
          <p class="text-sm text-base-content/70">Active drips</p>
          <div class="mt-2 flex items-center gap-3">
            <span class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10 text-secondary">
              <Clock class="h-5 w-5" />
            </span>
            <span class="text-3xl font-semibold">{activeCampaigns.length}</span>
          </div>
        </div>
        <div class="rounded-2xl border border-base-200 bg-base-100/80 p-4 shadow-sm">
          <p class="text-sm text-base-content/70">Emails scheduled</p>
          <div class="mt-2 flex items-center gap-3">
            <span class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-info/10 text-info">
              <Mail class="h-5 w-5" />
            </span>
            <span class="text-3xl font-semibold">{totalScheduled}</span>
          </div>
        </div>
      </div>

      <div class="space-y-4">
        {#if dripResource.loading}
          <div class="rounded-2xl border border-base-200 bg-base-100 p-10 text-center shadow-sm">
            <span class="loading loading-spinner loading-lg text-primary"></span>
          </div>
        {:else if campaigns.length === 0}
          <div class="rounded-2xl border border-dashed border-base-300 bg-base-100 p-8 text-center shadow-sm">
            <p class="text-lg font-semibold">No drips yet</p>
            <p class="text-sm text-base-content/70">Kick off your first journey and keep leads warm automatically.</p>
            <button class="btn btn-primary btn-sm mt-4" onclick={openCreateModal}>Create campaign</button>
          </div>
        {:else}
          <div class="space-y-5">
            {#each campaigns as campaign}
              <div class="rounded-2xl border border-base-200 bg-base-100/90 p-6 shadow-sm transition hover:border-primary/40">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p class="text-xs uppercase tracking-wide text-base-content/60">{selectedSegmentName(campaign.segmentId)}</p>
                    <h3 class="text-xl font-semibold">{campaign.name}</h3>
                    <p class="text-sm text-base-content/70">{campaign.description || 'No description provided.'}</p>
                  </div>
                  <div class="flex flex-col items-end gap-1 text-right">
                    <span class="badge badge-outline capitalize">{campaign.status}</span>
                    {#if campaign.lastLaunchAt}
                      <span class="text-xs text-base-content/60">
                        Last launch {new Date(campaign.lastLaunchAt).toLocaleDateString()}
                      </span>
                    {/if}
                  </div>
                </div>

                <div class="mt-4 grid gap-3 md:grid-cols-3">
                  <div class="rounded-xl bg-base-200/50 p-3">
                    <p class="text-xs text-base-content/60">Steps</p>
                    <p class="text-xl font-semibold">{campaign.steps.length}</p>
                  </div>
                  <div class="rounded-xl bg-base-200/50 p-3">
                    <p class="text-xs text-base-content/60">Contacts targeted</p>
                    <p class="text-xl font-semibold">{campaign.metrics?.contactsTargeted ?? 0}</p>
                  </div>
                  <div class="rounded-xl bg-base-200/50 p-3">
                    <p class="text-xs text-base-content/60">Emails scheduled</p>
                    <p class="text-xl font-semibold">{campaign.metrics?.totalScheduled ?? 0}</p>
                  </div>
                </div>

                <div class="mt-6 space-y-3">
                  <p class="text-xs font-semibold uppercase tracking-wide text-base-content/60">Journey</p>
                  <ol class="space-y-3">
                    {#each campaign.steps as step, index}
                      <li class="rounded-xl border border-base-200 bg-base-100/70 p-4">
                        <div class="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p class="text-sm font-semibold">Step {index + 1}: {step.label}</p>
                            <p class="text-xs text-base-content/60">{step.subject}</p>
                          </div>
                          <span class="text-xs font-semibold text-base-content/70">{describeStepSchedule(step)}</span>
                        </div>
                        {#if step.branching && (step.branching.successStepId || step.branching.fallbackStepId)}
                          <p class="mt-2 rounded-lg bg-base-200/60 px-3 py-2 text-xs text-base-content/70">
                            After {delayFromMinutes(step.branching.evaluateAfterMinutes).value}
                            {delayFromMinutes(step.branching.evaluateAfterMinutes).unit}, if {step.branching.monitor} →
                            {campaign.steps.find((s) => s.id === step.branching.successStepId)?.label ?? 'End'}.
                            Otherwise → {campaign.steps.find((s) => s.id === step.branching.fallbackStepId)?.label ?? 'End'}.
                          </p>
                        {/if}
                      </li>
                    {/each}
                  </ol>
                </div>

                <div class="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-base-200 pt-4">
                  <button class="btn btn-ghost btn-sm" onclick={() => openEditModal(campaign)}>
                    <Edit2 class="h-4 w-4" />
                    Edit
                  </button>
                  <button class="btn btn-ghost btn-sm text-error" onclick={() => handleDelete(campaign.id)} disabled={deletingId === campaign.id}>
                    {#if deletingId === campaign.id}
                      <Loader2 class="h-4 w-4 animate-spin" />
                    {:else}
                      <Trash2 class="h-4 w-4" />
                    {/if}
                    Delete
                  </button>
                  <button class="btn btn-primary btn-sm" onclick={() => handleLaunch(campaign)} disabled={launchLoadingId === campaign.id}>
                    {#if launchLoadingId === campaign.id}
                      <Loader2 class="h-4 w-4 animate-spin" />
                      Scheduling…
                    {:else}
                      <Play class="h-4 w-4" />
                      Launch
                    {/if}
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Modern Step-Based Editor Modal -->
    {#if showEditor}
      <div class="fixed inset-0 z-40 bg-black/50"></div>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="w-full max-w-4xl max-h-[90vh] bg-base-100 rounded-2xl shadow-2xl flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-base-200 px-6 py-4">
            <div>
              <p class="text-xs uppercase tracking-wide text-primary/70">{editingId ? 'Edit campaign' : 'New campaign'}</p>
              <h3 class="text-2xl font-bold">{formName || 'Untitled campaign'}</h3>
            </div>
            <button class="btn btn-ghost btn-circle btn-sm" onclick={() => (showEditor = false)} aria-label="Close builder">✕</button>
          </div>

          <!-- Steps Navigation -->
          <div class="border-b border-base-200 px-6 py-4">
            <ul class="steps steps-horizontal w-full">
              <li class="step {currentStep >= 0 ? 'step-primary' : ''}" onclick={() => (currentStep = 0)}>
                <span class="text-sm font-medium cursor-pointer">Details</span>
              </li>
              <li class="step {currentStep >= 1 ? 'step-primary' : ''}" onclick={() => (currentStep = 1)}>
                <span class="text-sm font-medium cursor-pointer">Sequence</span>
              </li>
              <li class="step {currentStep >= 2 ? 'step-primary' : ''}" onclick={() => (currentStep = 2)}>
                <span class="text-sm font-medium cursor-pointer">Review</span>
              </li>
            </ul>
          </div>

          <!-- Content Area -->
          <div class="flex-1 overflow-y-auto px-6 py-6">
            {#if currentStep === 0}
              <!-- Step 1: Campaign Details -->
              <div class="space-y-6 max-w-2xl">
                <div>
                  <h4 class="text-lg font-semibold mb-4">Campaign Details</h4>
                  <div class="space-y-4">
                    <div>
                      <label class="label">
                        <span class="label-text font-medium">Campaign Name</span>
                      </label>
                      <input type="text" class="input input-bordered w-full" bind:value={formName} placeholder="e.g., Welcome Series" />
                    </div>

                    <div>
                      <label class="label">
                        <span class="label-text font-medium">Target Segment</span>
                      </label>
                      <select class="select select-bordered w-full" bind:value={formSegmentId}>
                        {#each segments as segment}
                          <option value={segment.id}>{segment.name}</option>
                        {/each}
                      </select>
                    </div>

                    <div>
                      <label class="label">
                        <span class="label-text font-medium">Description</span>
                      </label>
                      <textarea class="textarea textarea-bordered w-full" rows="3" bind:value={formDescription} placeholder="What's this campaign about?"></textarea>
                    </div>

                    <div>
                      <label class="label">
                        <span class="label-text font-medium">Start Date (Optional)</span>
                      </label>
                      <input type="datetime-local" class="input input-bordered w-full" bind:value={formStartAt} />
                    </div>
                  </div>
                </div>
              </div>

            {:else if currentStep === 1}
              <!-- Step 2: Email Sequence -->
              <div class="space-y-6">
                <div class="flex items-center justify-between">
                  <h4 class="text-lg font-semibold">Email Sequence</h4>
                  <button class="btn btn-primary btn-sm" onclick={addStep}>
                    <Plus class="h-4 w-4" />
                    Add Email
                  </button>
                </div>

                {#if formSteps.length === 0}
                  <div class="alert alert-info">
                    <span>Add emails to build your sequence</span>
                  </div>
                {:else}
                  <div class="space-y-4">
                    {#each formSteps as step, index}
                      <div class="card bg-base-200/30 border border-base-200">
                        <div class="card-body p-4">
                          <div class="flex items-start justify-between gap-4">
                            <div class="flex-1">
                              <h5 class="font-semibold text-lg">Email {index + 1}</h5>
                              <p class="text-sm text-base-content/70 mt-1">{step.subject || 'No subject'}</p>
                              <p class="text-xs text-base-content/60 mt-2">Send: {describeStepSchedule(step)}</p>
                            </div>
                            <div class="flex gap-2">
                              <button class="btn btn-ghost btn-sm" onclick={() => { editingStepIndex = index; currentStep = 1; }}>
                                <Edit2 class="h-4 w-4" />
                              </button>
                              {#if formSteps.length > 1}
                                <button class="btn btn-ghost btn-sm text-error" onclick={() => removeStep(index)}>
                                  <Trash2 class="h-4 w-4" />
                                </button>
                              {/if}
                            </div>
                          </div>
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}

                <!-- Step Editor Drawer -->
                {#if editingStepIndex !== null && formSteps[editingStepIndex]}
                  {@const step = formSteps[editingStepIndex]}
                  {@const idx = editingStepIndex}
                  <div class="divider my-6"></div>
                  <div class="card bg-primary/5 border border-primary/20">
                    <div class="card-body space-y-4">
                      <div class="flex items-center justify-between">
                        <h5 class="font-semibold">Editing Email {idx + 1}</h5>
                        <button class="btn btn-ghost btn-sm" onclick={() => (editingStepIndex = null)}>✕</button>
                      </div>

                      <div>
                        <label class="label">
                          <span class="label-text text-sm font-medium">Subject Line</span>
                        </label>
                        <input type="text" class="input input-bordered w-full" bind:value={step.subject} placeholder="Email subject" />
                      </div>

                      <div>
                        <label class="label">
                          <span class="label-text text-sm font-medium">Email Content</span>
                        </label>
                        <EmailEditor
                          content={step.html}
                          onChange={(html) => (step.html = html)}
                        />
                      </div>

                      <div class="grid grid-cols-2 gap-4">
                        <div>
                          <label class="label">
                            <span class="label-text text-sm font-medium">Schedule Type</span>
                          </label>
                          <select class="select select-bordered w-full select-sm" bind:value={step.scheduleMode}>
                            <option value="relative">After delay</option>
                            <option value="absolute">At specific time</option>
                          </select>
                        </div>

                        {#if step.scheduleMode === 'relative'}
                          <div>
                            <label class="label">
                              <span class="label-text text-sm font-medium">Delay</span>
                            </label>
                            <div class="flex gap-2">
                              <input type="number" class="input input-bordered input-sm flex-1" bind:value={step.delayValue} min="0" placeholder="0" />
                              <select class="select select-bordered select-sm w-24" bind:value={step.delayUnit}>
                                <option value="minutes">min</option>
                                <option value="hours">hrs</option>
                                <option value="days">days</option>
                              </select>
                            </div>
                          </div>
                        {:else}
                          <div>
                            <label class="label">
                              <span class="label-text text-sm font-medium">Send At</span>
                            </label>
                            <input type="datetime-local" class="input input-bordered input-sm w-full" bind:value={step.runAt} />
                          </div>
                        {/if}
                      </div>

                      <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" class="checkbox checkbox-sm" checked={step.branching !== null} onchange={(e) => toggleBranching(idx, e.currentTarget.checked)} />
                        <span class="text-sm font-medium">Add conditional branch</span>
                      </label>

                      {#if step.branching}
                        <div class="bg-base-100 rounded-lg p-4 space-y-3">
                          <div class="grid grid-cols-2 gap-3">
                            <div>
                              <label class="label">
                                <span class="label-text text-xs">If email</span>
                              </label>
                              <select class="select select-bordered select-sm w-full" bind:value={step.branching.monitor}>
                                <option value="opened">Opened</option>
                                <option value="clicked">Clicked</option>
                              </select>
                            </div>
                            <div>
                              <label class="label">
                                <span class="label-text text-xs">Check after</span>
                              </label>
                              <div class="flex gap-1">
                                <input type="number" class="input input-bordered input-sm flex-1" bind:value={step.branching.evaluateValue} min="1" placeholder="1" />
                                <select class="select select-bordered select-sm w-20" bind:value={step.branching.evaluateUnit}>
                                  <option value="minutes">min</option>
                                  <option value="hours">hr</option>
                                  <option value="days">day</option>
                                </select>
                              </div>
                            </div>
                          </div>
                          <div class="grid grid-cols-2 gap-3">
                            <div>
                              <label class="label">
                                <span class="label-text text-xs">Then send</span>
                              </label>
                              <select class="select select-bordered select-sm w-full" bind:value={step.branching.successStepId}>
                                <option value="">End</option>
                                {#each formSteps as s, i}
                                  {#if i !== idx}
                                    <option value={s.id}>Email {i + 1}</option>
                                  {/if}
                                {/each}
                              </select>
                            </div>
                            <div>
                              <label class="label">
                                <span class="label-text text-xs">Otherwise send</span>
                              </label>
                              <select class="select select-bordered select-sm w-full" bind:value={step.branching.fallbackStepId}>
                                <option value="">End</option>
                                {#each formSteps as s, i}
                                  {#if i !== idx}
                                    <option value={s.id}>Email {i + 1}</option>
                                  {/if}
                                {/each}
                              </select>
                            </div>
                          </div>
                        </div>
                      {/if}

                      <button class="btn btn-primary btn-sm w-full" onclick={() => (editingStepIndex = null)}>Done Editing</button>
                    </div>
                  </div>
                {/if}
              </div>

            {:else if currentStep === 2}
              <!-- Step 3: Review -->
              <div class="space-y-6 max-w-2xl">
                <div>
                  <h4 class="text-lg font-semibold mb-4">Campaign Summary</h4>
                  <div class="space-y-3">
                    <div class="bg-base-200/30 rounded-lg p-4">
                      <p class="text-xs text-base-content/60">Campaign Name</p>
                      <p class="font-semibold">{formName || 'Untitled'}</p>
                    </div>
                    <div class="bg-base-200/30 rounded-lg p-4">
                      <p class="text-xs text-base-content/60">Target Segment</p>
                      <p class="font-semibold">{segments.find(s => s.id === formSegmentId)?.name || 'Unknown'}</p>
                    </div>
                    <div class="bg-base-200/30 rounded-lg p-4">
                      <p class="text-xs text-base-content/60">Total Emails</p>
                      <p class="font-semibold">{formSteps.length}</p>
                    </div>
                  </div>
                </div>

                {#if saveError}
                  <div class="alert alert-error">
                    <span>{saveError}</span>
                  </div>
                {/if}
              </div>
            {/if}
          </div>

          <!-- Footer Navigation -->
          <div class="border-t border-base-200 px-6 py-4 flex items-center justify-between">
            <button class="btn btn-ghost" onclick={() => (showEditor = false)}>Cancel</button>
            <div class="flex gap-2">
              {#if currentStep > 0}
                <button class="btn btn-ghost" onclick={() => (currentStep = currentStep - 1)}>Back</button>
              {/if}
              {#if currentStep < 2}
                <button class="btn btn-primary" onclick={() => (currentStep = currentStep + 1)}>Next</button>
              {:else}
                <button class="btn btn-primary" onclick={handleSave} disabled={saving}>
                  {#if saving}
                    <Loader2 class="h-4 w-4 animate-spin" />
                  {:else}
                    Save Campaign
                  {/if}
                </button>
              {/if}
            </div>
          </div>
        </div>
      </div>
    {/if}

    <div class="space-y-4 xl:sticky xl:top-8">
      {#if false}
        <div class="rounded-2xl border border-primary/30 bg-base-100 shadow-xl">
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-base-200 px-6 py-4">
            <div>
              <p class="text-xs uppercase tracking-wide text-primary/70">{editingId ? 'Edit campaign' : 'New campaign'}</p>
              <h3 class="text-lg font-semibold">{formName || 'Untitled campaign'}</h3>
            </div>
            <button class="btn btn-ghost btn-sm" onclick={() => (showEditor = false)} aria-label="Close builder">Close</button>
          </div>

          <div class="max-h-[75vh] space-y-6 overflow-y-auto px-6 py-6">
            <!-- Campaign Basics -->
            <fieldset class="space-y-3">
              <legend class="text-sm font-semibold text-base-content/70 mb-3">Campaign Details</legend>
              
              <label class="input input-bordered flex items-center gap-2">
                <input type="text" class="grow" bind:value={formName} placeholder="Campaign name" />
              </label>

              <select class="select select-bordered w-full" bind:value={formSegmentId}>
                {#each segments as segment}
                  <option value={segment.id}>{segment.name}</option>
                {/each}
              </select>

              <textarea class="textarea textarea-bordered w-full" rows="2" bind:value={formDescription} placeholder="What's this campaign about?"></textarea>

              <label class="input input-bordered flex items-center gap-2">
                <input type="datetime-local" class="grow" bind:value={formStartAt} />
              </label>
            </fieldset>

            <!-- Steps Timeline -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-semibold text-base-content/70">Email Sequence</h4>
                <button class="btn btn-primary btn-xs" onclick={addStep}>
                  <Plus class="h-3 w-3" />
                  Add email
                </button>
              </div>

              <div class="space-y-3">
                {#each formSteps as step, index}
                  <fieldset class="rounded-lg border border-base-200 bg-base-100/50 p-4 space-y-3">
                    <!-- Step Header -->
                    <div class="flex items-center justify-between gap-2">
                      <legend class="text-sm font-semibold">Email {index + 1}</legend>
                      <div class="flex gap-1">
                        {#if index > 0}
                          <button
                            type="button"
                            class="btn btn-ghost btn-xs"
                            onclick={() => moveStep(index, -1)}
                            title="Move up"
                          >
                            ↑
                          </button>
                        {/if}
                        {#if index < formSteps.length - 1}
                          <button
                            type="button"
                            class="btn btn-ghost btn-xs"
                            onclick={() => moveStep(index, 1)}
                            title="Move down"
                          >
                            ↓
                          </button>
                        {/if}
                        {#if formSteps.length > 1}
                          <button
                            type="button"
                            class="btn btn-ghost btn-xs text-error"
                            onclick={() => removeStep(index)}
                            title="Delete"
                          >
                            ✕
                          </button>
                        {/if}
                      </div>
                    </div>

                    <!-- Subject -->
                    <label class="input input-bordered flex items-center gap-2">
                      <input
                        type="text"
                        class="grow"
                        bind:value={step.subject}
                        placeholder="Email subject"
                      />
                    </label>

                    <!-- Content -->
                    <EmailEditor
                      content={step.html}
                      onChange={(html) => (step.html = html)}
                    />

                    <!-- Schedule -->
                    <fieldset class="space-y-2 border-t border-base-200 pt-3">
                      <legend class="text-xs font-semibold text-base-content/70">Schedule</legend>
                      <select class="select select-bordered w-full select-sm" bind:value={step.scheduleMode}>
                        <option value="relative">Send after delay</option>
                        <option value="absolute">Send at specific time</option>
                      </select>

                      {#if step.scheduleMode === 'relative'}
                        <div class="grid grid-cols-2 gap-2">
                          <label class="input input-bordered input-sm flex items-center gap-2">
                            <input
                              type="number"
                              class="grow"
                              bind:value={step.delayValue}
                              min="0"
                              placeholder="0"
                            />
                          </label>
                          <select class="select select-bordered select-sm" bind:value={step.delayUnit}>
                            <option value="minutes">Minutes</option>
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
                          </select>
                        </div>
                      {:else}
                        <label class="input input-bordered input-sm flex items-center gap-2">
                          <input type="datetime-local" class="grow" bind:value={step.runAt} />
                        </label>
                      {/if}
                    </fieldset>

                    <!-- Branching -->
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        class="checkbox checkbox-sm"
                        checked={step.branching !== null}
                        onchange={(e) => toggleBranching(index, e.currentTarget.checked)}
                      />
                      <span class="text-sm font-medium">Add conditional branch</span>
                    </label>

                    {#if step.branching}
                      <fieldset class="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-2">
                        <legend class="text-xs font-semibold text-base-content/70">Branch Logic</legend>
                        
                        <div class="grid grid-cols-2 gap-2">
                          <div>
                            <p class="text-xs text-base-content/60 mb-1">If email</p>
                            <select class="select select-bordered select-sm w-full" bind:value={step.branching.monitor}>
                              <option value="opened">Opened</option>
                              <option value="clicked">Clicked</option>
                            </select>
                          </div>
                          <div>
                            <p class="text-xs text-base-content/60 mb-1">Check after</p>
                            <div class="flex gap-1">
                              <label class="input input-bordered input-sm flex-1 flex items-center gap-2">
                                <input
                                  type="number"
                                  class="grow"
                                  bind:value={step.branching.evaluateValue}
                                  min="1"
                                  placeholder="1"
                                />
                              </label>
                              <select class="select select-bordered select-sm w-16" bind:value={step.branching.evaluateUnit}>
                                <option value="minutes">min</option>
                                <option value="hours">hr</option>
                                <option value="days">day</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        <div class="grid grid-cols-2 gap-2">
                          <div>
                            <p class="text-xs text-base-content/60 mb-1">Then send</p>
                            <select class="select select-bordered select-sm w-full" bind:value={step.branching.successStepId}>
                              <option value="">End</option>
                              {#each formSteps as s, i}
                                {#if i !== index}
                                  <option value={s.id}>Email {i + 1}</option>
                                {/if}
                              {/each}
                            </select>
                          </div>
                          <div>
                            <p class="text-xs text-base-content/60 mb-1">Otherwise send</p>
                            <select class="select select-bordered select-sm w-full" bind:value={step.branching.fallbackStepId}>
                              <option value="">End</option>
                              {#each formSteps as s, i}
                                {#if i !== index}
                                  <option value={s.id}>Email {i + 1}</option>
                                {/if}
                              {/each}
                            </select>
                          </div>
                        </div>
                      </fieldset>
                    {/if}
                  </fieldset>
                {/each}
              </div>
            </div>

            {#if saveError}
              <div class="alert alert-error alert-sm">
                <span>{saveError}</span>
              </div>
            {/if}

            <!-- Action Buttons -->
            <div class="flex gap-2 border-t border-base-200 pt-4">
              <button class="btn btn-ghost btn-sm flex-1" onclick={() => (showEditor = false)}>Cancel</button>
              <button
                class="btn btn-primary btn-sm flex-1"
                onclick={handleSave}
                disabled={saving}
              >
                {#if saving}
                  <Loader2 class="h-4 w-4 animate-spin" />
                {:else}
                  Save
                {/if}
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</section>
