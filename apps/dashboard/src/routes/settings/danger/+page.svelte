<script lang="ts">
  import { AlertTriangle, Shield, Trash2, X } from '@lucide/svelte';
  import { Button, Card, Dialog } from '@kuratchi/ui';
  import { deleteAccount } from '$lib/functions/settings.remote';

  let showDeleteModal = $state(false);

  let deleteForm = $state({
    confirmation: ''
  });

  function resetDeleteForm() {
    deleteForm = { confirmation: '' };
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
        <p class="kui-subtext">Permanently delete your account and all associated data.</p>
      </div>
    </div>
  </header>

  <Card class="kui-danger__card critical">
    <div class="kui-inline between">
      <div>
        <p class="kui-eyebrow danger">Account</p>
        <h3>Delete account</h3>
        <p class="kui-subtext">Permanently remove your organization, all users, sites, forms, and content.</p>
      </div>
      <div class="kui-pill critical">Irreversible</div>
    </div>
    
    <div class="kui-callout error">
      <AlertTriangle class="kui-icon" />
      <div>
        <p class="kui-strong">This action is permanent and cannot be undone</p>
        <p class="kui-subtext">During beta, we do not offer data recovery or backups. Once deleted, everything is gone forever.</p>
      </div>
    </div>

    <div class="kui-warning-list">
      <p class="kui-strong">The following will be permanently deleted:</p>
      <ul class="danger-list">
        <li>Your organization and all settings</li>
        <li>All team members and their access</li>
        <li>All sites, pages, and published content</li>
        <li>All forms and form submissions</li>
        <li>All uploaded files and media</li>
        <li>Activity logs and analytics data</li>
      </ul>
    </div>

    <div class="kui-actions">
      <Button variant="primary" class="danger-cta" onclick={() => showDeleteModal = true}>
        <Trash2 class="kui-icon" /> Delete my account
      </Button>
    </div>
  </Card>
</div>

<Dialog bind:open={showDeleteModal} size="md" onClose={resetDeleteForm}>
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

  {#snippet children()}
    <div class="kui-callout error">
      <AlertTriangle class="kui-icon" />
      <div>
        <p class="kui-strong">Final warning: This cannot be undone</p>
        <p class="kui-subtext">You are about to permanently delete your entire account. There is no way to recover your data after this action.</p>
      </div>
    </div>

    <form {...deleteAccount} class="kui-stack" onsubmit={handleDeleteAccount}>
      <div class="kui-beta-notice">
        <p class="kui-strong">Beta Notice</p>
        <p class="kui-subtext">We're currently in beta and do not offer data backups or account restoration. Once you delete your account, all data is permanently erased from our systems.</p>
      </div>

      <label class="kui-form-control" for="delete-confirmation">
        <span class="kui-label">Type <strong>DELETE</strong> to confirm</span>
        <input
          id="delete-confirmation"
          type="text"
          name="confirmation"
          class="kui-input"
          placeholder="DELETE"
          bind:value={deleteForm.confirmation}
          autocomplete="off"
        />
      </label>

      <div class="kui-modal-actions">
        <Button variant="ghost" type="button" onclick={() => { showDeleteModal = false; resetDeleteForm(); }}>
          Cancel
        </Button>
        <Button
          variant="primary"
          class="danger-cta"
          type="submit"
          disabled={deleteForm.confirmation !== 'DELETE'}
        >
          <Trash2 class="kui-icon" /> Permanently delete account
        </Button>
      </div>
    </form>
  {/snippet}
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

  .kui-warning-list {
    margin-top: 12px;
    padding: 12px;
    background: rgba(239, 68, 68, 0.04);
    border-radius: 8px;
  }

  .kui-beta-notice {
    padding: 12px;
    background: #fffbeb;
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 8px;
    color: #92400e;
  }

  .kui-modal-header h3 {
    margin: 0;
  }

  .kui-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
  }
</style>
