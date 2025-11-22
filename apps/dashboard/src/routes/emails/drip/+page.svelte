<script lang="ts">
  import { Layers, Clock, Play, Trash2, Edit2, Mail, Loader2, Plus, RefreshCw, AlertTriangle, ArrowRight, X } from '@lucide/svelte';
  import EmailEditor from '$lib/components/EmailEditor.svelte';
  import { Button, Card, Dialog, Badge, Loading, FormField, FormInput, FormSelect, FormTextarea } from '@kuratchi/ui';
  import {
    listSegments,
    listDripCampaigns,
    saveDripCampaign,
    deleteDripCampaign,
    launchDripCampaign,
    processDripBranches,
    type DripCampaignRecord
  } from '$lib/functions/newsletter.remote';
  import { getEmailDomains } from '$lib/functions/emailDomains.remote';

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
  const domainsResource = getEmailDomains();

  const segments = $derived(Array.isArray(segmentsResource.current) ? segmentsResource.current : []);
  const campaigns = $derived(Array.isArray(dripResource.current) ? dripResource.current : []);
  const domains = $derived(Array.isArray(domainsResource.current) ? domainsResource.current : []);
  const verifiedDomains = $derived(domains.filter(d => d.emailVerified));
  const hasVerifiedDomain = $derived(verifiedDomains.length > 0);

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
    currentStep = 0;
    editingStepIndex = null;
  }

  function openCreateModal() {
    if (!hasVerifiedDomain) return;
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
    [updated[index], updated[target]] = [updated[target], updated[index]];
    formSteps = updated;
  }

  function setScheduleMode(index: number, mode: StepInput['scheduleMode']) {
    formSteps = formSteps.map((step, idx) =>
      idx === index
        ? { ...step, scheduleMode: mode, runAt: mode === 'absolute' ? step.runAt : '', delayValue: mode === 'relative' ? step.delayValue : step.delayValue }
        : step
    );
  }

  function toggleBranching(index: number, enabled: boolean) {
    formSteps = formSteps.map((step, idx) => {
      if (idx !== index) return step;
      if (!enabled) return { ...step, branching: null };
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
      alert(err instanceof Error ? err.message : 'Unable to launch campaign');
    } finally {
      launchLoadingId = null;
    }
  }
</script>

<svelte:head>
  <title>Drip Campaigns - Kuratchi Dashboard</title>
</svelte:head>

<div class="kui-drip">
  {#if toastMessage}
    <div class="kui-toast success">{toastMessage}</div>
  {/if}

  <header class="kui-drip__header">
    <div>
      <p class="kui-eyebrow">Automation</p>
      <h1>Drip Campaigns</h1>
      <p class="kui-subtext">Automate multi-step email sequences.</p>
    </div>
    <div class="kui-inline end">
      {#if !hasVerifiedDomain}
        <Badge variant="warning" size="sm">Verify a sending domain first</Badge>
      {/if}
      <Button variant="ghost" size="sm" onclick={syncBranchQueue} disabled={syncingBranches}>
        {#if syncingBranches}
          <Loading size="sm" /> Syncing
        {:else}
          <RefreshCw class="kui-icon" /> Sync Branch Queue
        {/if}
      </Button>
      <Button variant="primary" size="sm" onclick={() => openCreateModal()} disabled={!hasVerifiedDomain}>
        <Plus class="kui-icon" /> New Campaign
      </Button>
    </div>
  </header>

  <Card class="kui-panel">
    {#if campaigns.length === 0}
      <div class="kui-center">
        <Layers class="kui-empty__icon" />
        <p class="kui-subtext">No drip campaigns yet.</p>
        {#if hasVerifiedDomain}
          <Button variant="primary" size="sm" onclick={() => openCreateModal()}>Create Campaign</Button>
        {/if}
      </div>
    {:else}
      <div class="kui-list">
        {#each campaigns as campaign}
          <Card class="kui-panel">
            <div class="kui-campaign">
              <div>
                <h3>{campaign.name}</h3>
                <p class="kui-subtext">{campaign.description || 'No description provided'}</p>
                <div class="kui-inline">
                  <Badge variant={campaign.status === 'active' ? 'success' : 'neutral'} size="xs">
                    {campaign.status}
                  </Badge>
                  <span class="kui-subtext">{campaign.steps.length} steps</span>
                </div>
              </div>
              <div class="kui-inline end">
                <Button variant="ghost" size="sm" onclick={() => openEditModal(campaign)}>
                  <Edit2 class="kui-icon" /> Edit
                </Button>
                <Button variant="ghost" size="sm" onclick={() => handleDelete(campaign.id)} disabled={deletingId === campaign.id}>
                  {#if deletingId === campaign.id}
                    <Loader2 class="kui-icon spinning" />
                  {:else}
                    <Trash2 class="kui-icon error" />
                  {/if}
                </Button>
                {#if campaign.status !== 'active'}
                  <Button variant="primary" size="sm" onclick={() => handleLaunch(campaign)} disabled={launchLoadingId === campaign.id}>
                    {#if launchLoadingId === campaign.id}
                      <Loader2 class="kui-icon spinning" /> Launching...
                    {:else}
                      <Play class="kui-icon" /> Launch
                    {/if}
                  </Button>
                {/if}
              </div>
            </div>
          </Card>
        {/each}
      </div>
    {/if}
  </Card>
</div>

{#if showEditor}
  <div class="kui-overlay">
    <div class="kui-builder">
      <div class="kui-builder__header">
        <div>
          <p class="kui-eyebrow">{editingId ? 'Edit Campaign' : 'New Campaign'}</p>
          <h3>{formName || 'Untitled campaign'}</h3>
          <p class="kui-subtext">Configure audience and schedule, then craft your email steps.</p>
        </div>
        <Button variant="ghost" size="sm" onclick={() => (showEditor = false)} aria-label="Close builder">
          <X class="kui-icon" />
        </Button>
      </div>

      <div class="kui-builder__body">
        <div class="kui-builder__sidebar">
          <div class="kui-stack">
            <FormField label="Campaign Name">
              <FormInput field={{ name: 'campaignName', bind: { value: formName } } as any} placeholder="Onboarding sequence" />
            </FormField>

            <FormField label="Description">
              <FormTextarea field={{ name: 'campaignDescription', bind: { value: formDescription } } as any} placeholder="What is this sequence about?" rows={2} />
            </FormField>

            <FormField label="Target Segment">
              <FormSelect field={{ name: 'segment', bind: { value: formSegmentId } } as any}>
                {#each segments as segment}
                  <option value={segment.id}>{segment.name}</option>
                {/each}
              </FormSelect>
            </FormField>

            <FormField label="Start at (optional)">
              <FormInput field={{ name: 'startAt', bind: { value: formStartAt } } as any} type="datetime-local" />
            </FormField>

            {#if saveError}
              <div class="kui-callout error">{saveError}</div>
            {/if}

            <div class="kui-inline end">
              <Button variant="ghost" onclick={() => { showEditor = false; }}>Cancel</Button>
              <Button variant="primary" onclick={handleSave} disabled={saving}>
                {#if saving}
                  <Loading size="sm" /> Saving...
                {:else}
                  Save Campaign
                {/if}
              </Button>
            </div>
          </div>
        </div>

        <div class="kui-builder__steps">
          <div class="kui-builder__steps-header">
            <h4>Steps ({formSteps.length})</h4>
            <Button variant="primary" size="sm" onclick={addStep}>Add Step</Button>
          </div>

          <div class="kui-steps-list">
            {#each formSteps as step, index}
              <Card class="kui-panel">
                <div class="kui-step">
                  <div class="kui-step__header">
                    <div class="kui-inline">
                      <span class="kui-badge">Step {index + 1}</span>
                      <FormInput field={{ name: `step-label-${step.id}`, bind: { value: step.label } } as any} placeholder="Email Step" />
                    </div>
                    <div class="kui-inline end">
                      <Button variant="ghost" size="xs" onclick={() => moveStep(index, -1)} disabled={index === 0}>↑</Button>
                      <Button variant="ghost" size="xs" onclick={() => moveStep(index, 1)} disabled={index === formSteps.length - 1}>↓</Button>
                      <Button variant="ghost" size="xs" onclick={() => removeStep(index)} disabled={formSteps.length === 1}>
                        <Trash2 class="kui-icon error" />
                      </Button>
                    </div>
                  </div>

                  <div class="kui-grid">
                    <FormField label="Subject">
                      <FormInput field={{ name: `step-subject-${step.id}`, bind: { value: step.subject } } as any} placeholder="Email subject" />
                    </FormField>
                    <FormField label="Preview Text">
                      <FormInput field={{ name: `step-preview-${step.id}`, bind: { value: step.previewText } } as any} placeholder="Optional preview text" />
                    </FormField>
                  </div>

                  <div class="kui-grid">
                    <FormField label="Schedule">
                      <div class="kui-inline">
                        <Button variant={step.scheduleMode === 'relative' ? 'primary' : 'ghost'} size="xs" onclick={() => setScheduleMode(index, 'relative')}>Relative</Button>
                        <Button variant={step.scheduleMode === 'absolute' ? 'primary' : 'ghost'} size="xs" onclick={() => setScheduleMode(index, 'absolute')}>Absolute</Button>
                      </div>
                      {#if step.scheduleMode === 'relative'}
                        <div class="kui-inline">
                          <FormInput field={{ name: `delay-${step.id}`, bind: { value: step.delayValue } } as any} type="number" min="0" step="1" class="kui-input--sm" />
                          <FormSelect field={{ name: `delay-unit-${step.id}`, bind: { value: step.delayUnit } } as any} class="kui-select--sm">
                            <option value="minutes">Minutes</option>
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
                          </FormSelect>
                          <ArrowRight class="kui-icon" />
                          <span class="kui-subtext">{describeStepSchedule(step)}</span>
                        </div>
                      {:else}
                        <FormInput field={{ name: `runat-${step.id}`, bind: { value: step.runAt } } as any} type="datetime-local" />
                      {/if}
                    </FormField>
                    <FormField label="Branching (optional)">
                      <label class="kui-inline">
                        <input type="checkbox" checked={!!step.branching} onchange={(e) => toggleBranching(index, (e.target as HTMLInputElement).checked)} />
                        <span class="kui-subtext">Enable conditional branch</span>
                      </label>
                      {#if step.branching}
                        <div class="kui-grid">
                          <FormField label="Monitor">
                            <FormSelect field={{ name: `monitor-${step.id}`, bind: { value: step.branching.monitor } } as any}>
                              <option value="opened">Opened</option>
                              <option value="clicked">Clicked</option>
                            </FormSelect>
                          </FormField>
                          <FormField label="Evaluate after">
                            <div class="kui-inline">
                              <FormInput field={{ name: `eval-${step.id}`, bind: { value: step.branching.evaluateValue } } as any} type="number" min="1" class="kui-input--sm" />
                              <FormSelect field={{ name: `eval-unit-${step.id}`, bind: { value: step.branching.evaluateUnit } } as any} class="kui-select--sm">
                                <option value="minutes">Minutes</option>
                                <option value="hours">Hours</option>
                                <option value="days">Days</option>
                              </FormSelect>
                            </div>
                          </FormField>
                          <FormField label="Success Step ID">
                            <FormInput field={{ name: `success-${step.id}`, bind: { value: step.branching.successStepId } } as any} placeholder="Step ID" />
                          </FormField>
                          <FormField label="Fallback Step ID">
                            <FormInput field={{ name: `fallback-${step.id}`, bind: { value: step.branching.fallbackStepId } } as any} placeholder="Step ID" />
                          </FormField>
                        </div>
                      {/if}
                    </FormField>
                  </div>

                  <FormField label="Email Content">
                    <EmailEditor content={step.html || ''} onChange={(html) => { step.html = html; formSteps = [...formSteps]; }} />
                  </FormField>
                </div>
              </Card>
            {/each}
          </div>
        </div>
      </div>
    </div>
    <div class="kui-overlay__backdrop" onclick={() => (showEditor = false)}></div>
  </div>
{/if}

<style>
  .kui-drip {
    display: grid;
    gap: var(--kui-spacing-md);
  }

  .kui-drip__header {
    display: flex;
    justify-content: space-between;
    gap: var(--kui-spacing-md);
    flex-wrap: wrap;
    align-items: center;
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

  .kui-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .kui-inline.end {
    justify-content: flex-end;
  }

  .kui-icon {
    width: 1rem;
    height: 1rem;
  }

  .kui-icon.spinning {
    animation: spin 1s linear infinite;
  }

  .kui-panel .kui-card__body {
    gap: var(--kui-spacing-md);
  }

  .kui-center {
    display: grid;
    place-items: center;
    gap: 0.35rem;
    padding: var(--kui-spacing-lg);
    text-align: center;
  }

  .kui-empty__icon {
    width: 3rem;
    height: 3rem;
    color: var(--kui-color-muted);
  }

  .kui-list {
    display: grid;
    gap: var(--kui-spacing-sm);
  }

  .kui-campaign {
    display: flex;
    justify-content: space-between;
    gap: var(--kui-spacing-md);
    align-items: center;
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

  .kui-builder {
    position: relative;
    z-index: 1;
    width: min(1200px, 100% - 32px);
    max-height: 90vh;
    background: var(--kui-color-surface);
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-lg);
    display: grid;
    grid-template-rows: auto 1fr;
    box-shadow: var(--kui-shadow-lg);
    overflow: hidden;
  }

  .kui-builder__header {
    padding: var(--kui-spacing-md);
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--kui-color-border);
  }

  .kui-builder__body {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: var(--kui-spacing-md);
    padding: var(--kui-spacing-md);
    overflow: hidden;
  }

  .kui-builder__sidebar {
    background: var(--kui-color-surface-muted);
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-lg);
    padding: var(--kui-spacing-sm);
    overflow-y: auto;
  }

  .kui-builder__steps {
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-lg);
    padding: var(--kui-spacing-sm);
    overflow: hidden;
    display: grid;
    gap: var(--kui-spacing-sm);
    background: var(--kui-color-surface);
  }

  .kui-builder__steps-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 0.4rem;
    border-bottom: 1px solid var(--kui-color-border);
  }

  .kui-steps-list {
    overflow-y: auto;
    display: grid;
    gap: var(--kui-spacing-sm);
    padding: var(--kui-spacing-sm);
  }

  .kui-step {
    display: grid;
    gap: var(--kui-spacing-sm);
  }

  .kui-step__header {
    display: flex;
    justify-content: space-between;
    gap: var(--kui-spacing-sm);
    align-items: center;
  }

  .kui-badge {
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    background: var(--kui-color-primary-weak);
    color: var(--kui-color-primary);
    font-weight: 700;
    font-size: 0.85rem;
  }

  .kui-grid {
    display: grid;
    gap: var(--kui-spacing-sm);
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .kui-input--sm {
    max-width: 90px;
  }

  .kui-select--sm {
    max-width: 120px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 900px) {
    .kui-builder__body {
      grid-template-columns: 1fr;
    }
  }
</style>
