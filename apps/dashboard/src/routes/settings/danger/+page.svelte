<script lang="ts">
  import { AlertTriangle, Shield, Trash2, X } from '@lucide/svelte';
  import { Button, Card, Dialog } from '@kuratchi/ui';
  import { cancelSubscription, deleteAccount } from '$lib/functions/settings.remote';

  let showCancelModal = $state(false);
  let showDeleteModal = $state(false);

  let cancelForm = $state({
    reason: '',
    feedback: ''
  });

  let deleteForm = $state({
    confirmation: '',
    password: ''
  });

  function handleCancelSubscription() {
    showCancelModal = false;
    cancelForm = { reason: '', feedback: '' };
  }

  function handleDeleteAccount() {
    // handled server-side
  }
</script>

<svelte:head>
  <title>Danger Zone - Kuratchi Dashboard</title>
</svelte:head>

<div class="kui-danger">
  <header class="kui-danger__header">
    <div class="kui-inline">
      <div class="kui-icon-pill danger">
        <Shield />
      </div>
      <div>
        <p class="kui-eyebrow">Account safety</p>
        <h1>Danger Zone</h1>
        <p class="kui-subtext">Cancel your subscription or permanently delete your account.</p>
      </div>
    </div>
  </header>

  <div class="kui-danger__grid">
    <Card class="kui-danger__card">
      <div class="kui-inline between">
        <div>
          <p class="kui-eyebrow danger">Billing</p>
          <h3>Cancel subscription</h3>
          <p class="kui-subtext">Downgrade to the free plan. Your data is kept and you can re-upgrade any time.</p>
        </div>
        <div class="kui-pill danger">High impact</div>
      </div>
      <div class="kui-actions">
        <Button variant="outline" class="danger-button" onclick={() => showCancelModal = true}>
          Cancel subscription
        </Button>
      </div>
    </Card>

    <Card class="kui-danger__card critical">
      <div class="kui-inline between">
        <div>
          <p class="kui-eyebrow danger">Account</p>
          <h3>Delete account</h3>
          <p class="kui-subtext">Remove your organization, users, databases, and content. This cannot be undone.</p>
        </div>
        <div class="kui-pill critical">Irreversible</div>
      </div>
      <div class="kui-callout error">
        <AlertTriangle class="kui-icon" />
        <div>
          <p class="kui-strong">All data will be removed</p>
          <p class="kui-subtext">We recommend exporting any data you need before proceeding.</p>
        </div>
      </div>
      <div class="kui-actions">
        <Button variant="primary" class="danger-cta" onclick={() => showDeleteModal = true}>
          <Trash2 class="kui-icon" /> Delete account
        </Button>
      </div>
    </Card>
  </div>
</div>

<Dialog bind:open={showCancelModal} size="sm">
  {#snippet header()}
    <div class="kui-modal-header">
      <div>
        <p class="kui-eyebrow danger">Billing</p>
        <h3>Cancel subscription</h3>
      </div>
      <Button variant="ghost" size="xs" onclick={() => showCancelModal = false} aria-label="Close">
        <X class="kui-icon" />
      </Button>
    </div>
  {/snippet}

  <form {...cancelSubscription} class="kui-stack" onsubmit={handleCancelSubscription}>
    <p class="kui-subtext">We appreciate the feedback—help us understand why you’re leaving.</p>

    <label class="kui-form-control" for="cancel-reason">
      <span class="kui-label">Reason (optional)</span>
      <select id="cancel-reason" name="reason" class="kui-select" bind:value={cancelForm.reason}>
        <option value="">Select a reason...</option>
        <option value="too-expensive">Too expensive</option>
        <option value="missing-features">Missing features</option>
        <option value="not-using">Not using anymore</option>
        <option value="switching">Switching to another service</option>
        <option value="other">Other</option>
      </select>
    </label>

    <label class="kui-form-control" for="cancel-feedback">
      <span class="kui-label">Feedback (optional)</span>
      <textarea
        id="cancel-feedback"
        name="feedback"
        class="kui-textarea"
        rows="3"
        placeholder="Help us improve..."
        bind:value={cancelForm.feedback}
      ></textarea>
    </label>

    {#snippet actions(close)}
      <Button variant="ghost" type="button" onclick={() => { close(); showCancelModal = false; }}>
        Keep subscription
      </Button>
      <Button variant="primary" class="danger-cta" type="submit">
        Confirm cancellation
      </Button>
    {/snippet}
  </form>
</Dialog>

<Dialog bind:open={showDeleteModal} size="md">
  {#snippet header()}
    <div class="kui-modal-header">
      <div>
        <p class="kui-eyebrow danger">Account</p>
        <h3>Delete account</h3>
      </div>
      <Button variant="ghost" size="xs" onclick={() => showDeleteModal = false} aria-label="Close">
        <X class="kui-icon" />
      </Button>
    </div>
  {/snippet}

  <div class="kui-callout error">
    <AlertTriangle class="kui-icon" />
    <div>
      <p class="kui-strong">This action is permanent</p>
      <p class="kui-subtext">All data, users, files, and databases will be removed immediately.</p>
    </div>
  </div>

  <form {...deleteAccount} class="kui-stack" onsubmit={handleDeleteAccount}>
    <div>
      <p class="kui-strong">Before you proceed:</p>
      <ul class="danger-list">
        <li>Permanently delete all your data</li>
        <li>Cancel your subscription immediately</li>
        <li>Remove access for all team members</li>
        <li>Delete all databases and content</li>
      </ul>
    </div>

    <label class="kui-form-control" for="delete-confirmation">
      <span class="kui-label">Type DELETE to confirm</span>
      <input
        id="delete-confirmation"
        type="text"
        name="confirmation"
        class="kui-input"
        placeholder="DELETE"
        bind:value={deleteForm.confirmation}
        required
      />
    </label>

    <label class="kui-form-control" for="delete-password">
      <span class="kui-label">Enter your password</span>
      <input
        id="delete-password"
        type="password"
        name="password"
        class="kui-input"
        bind:value={deleteForm.password}
        required
      />
    </label>

    {#snippet actions(close)}
      <Button variant="ghost" type="button" onclick={() => { close(); showDeleteModal = false; }}>
        Cancel
      </Button>
      <Button
        variant="primary"
        class="danger-cta"
        type="submit"
        disabled={deleteForm.confirmation !== 'DELETE'}
      >
        Delete my account
      </Button>
    {/snippet}
  </form>
</Dialog>

<style>
  .kui-danger {
    display: grid;
    gap: 16px;
  }

  .kui-danger__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .kui-danger__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 16px;
  }

  .kui-danger__card {
    border: 1px solid rgba(210, 57, 80, 0.15);
    background: linear-gradient(135deg, rgba(210, 57, 80, 0.05), rgba(210, 57, 80, 0.02));
  }

  .kui-danger__card.critical {
    border-color: rgba(180, 35, 24, 0.25);
    background: linear-gradient(135deg, rgba(180, 35, 24, 0.08), rgba(210, 57, 80, 0.03));
  }

  .kui-inline {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .kui-inline.between {
    justify-content: space-between;
    align-items: flex-start;
  }

  .kui-icon-pill {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--kui-surface-2, #0f172a);
    color: white;
  }

  .kui-icon-pill.danger {
    background: linear-gradient(135deg, #f87171, #b91c1c);
  }

  .kui-eyebrow {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--kui-muted, #6b7280);
    margin: 0 0 6px;
  }

  .kui-eyebrow.danger {
    color: #b91c1c;
  }

  h1 {
    margin: 0;
    font-size: 26px;
  }

  h3 {
    margin: 0 0 8px;
    font-size: 18px;
  }

  .kui-subtext {
    color: var(--kui-muted, #6b7280);
    margin: 0;
  }

  .kui-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    background: #f4f4f5;
    color: #3f3f46;
  }

  .kui-pill.danger {
    background: rgba(190, 24, 93, 0.08);
    color: #9f1239;
  }

  .kui-pill.critical {
    background: rgba(239, 68, 68, 0.12);
    color: #b91c1c;
  }

  .kui-callout {
    border-radius: 12px;
    padding: 12px;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px;
    align-items: start;
    background: #fef2f2;
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #b91c1c;
  }

  .kui-strong {
    font-weight: 600;
    margin: 0;
  }

  .kui-actions {
    margin-top: 12px;
    display: flex;
    justify-content: flex-end;
  }

  .danger-button {
    color: #b91c1c;
    border-color: rgba(239, 68, 68, 0.35);
  }

  .danger-button:hover {
    background: rgba(239, 68, 68, 0.08);
  }

  .danger-cta {
    background: linear-gradient(135deg, #ef4444, #b91c1c);
    color: white;
    border: none;
  }

  .kui-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .kui-stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .kui-form-control {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .kui-label {
    font-weight: 600;
    font-size: 14px;
  }

  .kui-input,
  .kui-textarea,
  .kui-select {
    width: 100%;
    border-radius: 10px;
    border: 1px solid #e4e4e7;
    padding: 10px 12px;
    font-size: 14px;
    background: white;
  }

  .kui-input:focus,
  .kui-textarea:focus,
  .kui-select:focus {
    outline: 2px solid rgba(239, 68, 68, 0.25);
    border-color: rgba(239, 68, 68, 0.35);
  }

  .danger-list {
    margin: 8px 0 0;
    padding-left: 18px;
    color: #6b7280;
    display: grid;
    gap: 6px;
  }

  .kui-modal-header h3 {
    margin: 0;
  }
</style>
