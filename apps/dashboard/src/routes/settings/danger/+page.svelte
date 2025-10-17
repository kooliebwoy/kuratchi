<script lang="ts">
  import { AlertTriangle, X } from 'lucide-svelte';
  import { cancelSubscription, deleteAccount } from '$lib/api/settings.remote';

  // Modal state
  let showCancelModal = $state(false);
  let showDeleteModal = $state(false);

  // Form state
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
    // Form will redirect after successful deletion
  }
</script>

<svelte:head>
  <title>Danger Zone - Kuratchi Dashboard</title>
</svelte:head>

<div class="space-y-6">
  <!-- Cancel Subscription -->
  <div class="card bg-error/10 border border-error/20 shadow-sm">
    <div class="card-body">
      <h3 class="text-lg font-bold text-error mb-2">Cancel Subscription</h3>
      <p class="text-base-content/70 mb-4">
        Cancel your subscription and downgrade to the free plan. Your data will be retained.
      </p>
      <button class="btn btn-error btn-outline" onclick={() => showCancelModal = true}>
        Cancel Subscription
      </button>
    </div>
  </div>

  <!-- Delete Account -->
  <div class="card bg-error/10 border border-error/20 shadow-sm">
    <div class="card-body">
      <h3 class="text-lg font-bold text-error mb-2">Delete Account</h3>
      <p class="text-base-content/70 mb-4">
        Permanently delete your account and all associated data. This action cannot be undone.
      </p>
      <button class="btn btn-error" onclick={() => showDeleteModal = true}>
        Delete Account
      </button>
    </div>
  </div>
</div>

<!-- Cancel Subscription Modal -->
{#if showCancelModal}
  <div class="modal modal-open">
    <div class="modal-box">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg">Cancel Subscription</h3>
        <button class="btn btn-ghost btn-sm btn-circle" onclick={() => showCancelModal = false}>
          <X class="h-4 w-4" />
        </button>
      </div>

      <form {...cancelSubscription} onsubmit={handleCancelSubscription} class="space-y-4">
        <p class="text-base-content/70">
          We're sorry to see you go. Can you tell us why you're cancelling?
        </p>

        <div class="form-control">
          <label class="label" for="cancel-reason">
            <span class="label-text">Reason (optional)</span>
          </label>
          <select id="cancel-reason" name="reason" class="select select-bordered" bind:value={cancelForm.reason}>
            <option value="">Select a reason...</option>
            <option value="too-expensive">Too expensive</option>
            <option value="missing-features">Missing features</option>
            <option value="not-using">Not using anymore</option>
            <option value="switching">Switching to another service</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div class="form-control">
          <label class="label" for="cancel-feedback">
            <span class="label-text">Feedback (optional)</span>
          </label>
          <textarea
            id="cancel-feedback"
            name="feedback"
            class="textarea textarea-bordered"
            rows="3"
            placeholder="Help us improve..."
            bind:value={cancelForm.feedback}
          ></textarea>
        </div>

        <div class="modal-action">
          <button type="button" class="btn" onclick={() => showCancelModal = false}>
            Keep Subscription
          </button>
          <button type="submit" class="btn btn-error">
            Confirm Cancellation
          </button>
        </div>
      </form>
    </div>
    <button type="button" class="modal-backdrop" onclick={() => showCancelModal = false} aria-label="Close modal"></button>
  </div>
{/if}

<!-- Delete Account Modal -->
{#if showDeleteModal}
  <div class="modal modal-open">
    <div class="modal-box">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg text-error">Delete Account</h3>
        <button class="btn btn-ghost btn-sm btn-circle" onclick={() => showDeleteModal = false}>
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="alert alert-error mb-4">
        <AlertTriangle class="h-5 w-5" />
        <span>This action is permanent and cannot be undone!</span>
      </div>

      <form {...deleteAccount} onsubmit={handleDeleteAccount} class="space-y-4">
        <p class="text-base-content/70 mb-4">
          Deleting your account will:
        </p>
        <ul class="list-disc list-inside text-sm text-base-content/70 space-y-1 mb-4">
          <li>Permanently delete all your data</li>
          <li>Cancel your subscription immediately</li>
          <li>Remove access for all team members</li>
          <li>Delete all databases and content</li>
        </ul>

        <div class="form-control">
          <label class="label" for="delete-confirmation">
            <span class="label-text">Type <strong>DELETE</strong> to confirm</span>
          </label>
          <input
            id="delete-confirmation"
            type="text"
            name="confirmation"
            class="input input-bordered"
            placeholder="DELETE"
            bind:value={deleteForm.confirmation}
            required
          />
        </div>

        <div class="form-control">
          <label class="label" for="delete-password">
            <span class="label-text">Enter your password</span>
          </label>
          <input
            id="delete-password"
            type="password"
            name="password"
            class="input input-bordered"
            bind:value={deleteForm.password}
            required
          />
        </div>

        <div class="modal-action">
          <button type="button" class="btn" onclick={() => showDeleteModal = false}>
            Cancel
          </button>
          <button type="submit" class="btn btn-error" disabled={deleteForm.confirmation !== 'DELETE'}>
            Delete My Account
          </button>
        </div>
      </form>
    </div>
    <button type="button" class="modal-backdrop" onclick={() => showDeleteModal = false} aria-label="Close modal"></button>
  </div>
{/if}
