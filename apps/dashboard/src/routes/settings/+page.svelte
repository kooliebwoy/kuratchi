<script lang="ts">
  import { Settings, User, CreditCard, Shield, AlertTriangle, X, Save } from 'lucide-svelte';
  import {
    getAccountSettings,
    getBillingInfo,
    updateProfile,
    changePassword,
    updateBillingEmail,
    cancelSubscription,
    deleteAccount
  } from './settings.remote';

  // Data sources
  const account = getAccountSettings();
  const billing = getBillingInfo();

  // Derived data
  const accountData = $derived(account.current || null);
  const billingData = $derived(billing.current || null);

  // Active tab
  let activeTab = $state<'account' | 'billing' | 'security' | 'danger'>('account');

  // Form state
  let profileForm = $state({
    name: '',
    email: ''
  });

  let passwordForm = $state({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  let billingForm = $state({
    billingEmail: ''
  });

  let cancelForm = $state({
    reason: '',
    feedback: ''
  });

  let deleteForm = $state({
    confirmation: '',
    password: ''
  });

  // Modal state
  let showCancelModal = $state(false);
  let showDeleteModal = $state(false);

  // Load account data into form
  $effect(() => {
    if (accountData) {
      profileForm.name = accountData.name || '';
      profileForm.email = accountData.email || '';
    }
  });

  // Load billing data into form
  $effect(() => {
    if (billingData) {
      billingForm.billingEmail = billingData.billingEmail || '';
    }
  });

  function resetPasswordForm() {
    passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
  }

  function handleCancelSubscription() {
    showCancelModal = false;
    cancelForm = { reason: '', feedback: '' };
  }

  function handleDeleteAccount() {
    // Form will redirect after successful deletion
  }
</script>

<svelte:head>
  <title>Account Settings - Kuratchi Dashboard</title>
</svelte:head>

<div class="p-8">
  <!-- Header -->
  <div class="mb-8 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
        <Settings class="h-6 w-6 text-primary" />
      </div>
      <div>
        <h1 class="text-2xl font-bold">Account Settings</h1>
        <p class="text-sm text-base-content/70">Manage your account, billing, and preferences</p>
      </div>
    </div>
  </div>

  <!-- Tabs -->
  <div class="tabs tabs-boxed mb-6 w-fit">
    <button 
      class="tab {activeTab === 'account' ? 'tab-active' : ''}" 
      onclick={() => activeTab = 'account'}
    >
      <User class="h-4 w-4 mr-2" />
      Account
    </button>
    <button 
      class="tab {activeTab === 'billing' ? 'tab-active' : ''}" 
      onclick={() => activeTab = 'billing'}
    >
      <CreditCard class="h-4 w-4 mr-2" />
      Billing
    </button>
    <button 
      class="tab {activeTab === 'security' ? 'tab-active' : ''}" 
      onclick={() => activeTab = 'security'}
    >
      <Shield class="h-4 w-4 mr-2" />
      Security
    </button>
    <button 
      class="tab {activeTab === 'danger' ? 'tab-active' : ''}" 
      onclick={() => activeTab = 'danger'}
    >
      <AlertTriangle class="h-4 w-4 mr-2" />
      Danger Zone
    </button>
  </div>

  <!-- Account Tab -->
  {#if activeTab === 'account'}
    <div class="space-y-6">
      <div class="card bg-base-100 shadow-sm">
        <div class="card-body">
          <h3 class="text-lg font-bold mb-4">Profile Information</h3>
          <form {...updateProfile} class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="form-control">
                <label class="label" for="profile-name">
                  <span class="label-text">Full Name</span>
                </label>
                <input
                  id="profile-name"
                  type="text"
                  name="name"
                  class="input input-bordered"
                  bind:value={profileForm.name}
                  required
                />
              </div>

              <div class="form-control">
                <label class="label" for="profile-email">
                  <span class="label-text">Email Address</span>
                </label>
                <input
                  id="profile-email"
                  type="email"
                  name="email"
                  class="input input-bordered"
                  bind:value={profileForm.email}
                  required
                />
              </div>
            </div>

            <div class="flex justify-end">
              <button type="submit" class="btn btn-primary">
                <Save class="h-4 w-4 mr-2" />
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>

      <div class="card bg-base-100 shadow-sm">
        <div class="card-body">
          <h3 class="text-lg font-bold mb-2">Account Information</h3>
          <div class="space-y-3">
            <div class="flex justify-between py-2 border-b border-base-200">
              <span class="text-base-content/70">Account ID</span>
              <span class="font-mono text-sm">{accountData?.id}</span>
            </div>
            <div class="flex justify-between py-2 border-b border-base-200">
              <span class="text-base-content/70">Role</span>
              <span class="badge badge-primary badge-sm">{accountData?.role || 'member'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Billing Tab -->
  {#if activeTab === 'billing'}
    <div class="space-y-6">
      <div class="card bg-base-100 shadow-sm">
        <div class="card-body">
          <h3 class="text-lg font-bold mb-4">Current Plan</h3>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-2xl font-bold capitalize">{billingData?.plan || 'Free'} Plan</p>
              <p class="text-sm text-base-content/60">
                Status: <span class="badge badge-success badge-sm">{billingData?.subscriptionStatus || 'active'}</span>
              </p>
            </div>
            <button class="btn btn-primary">Upgrade Plan</button>
          </div>
        </div>
      </div>

      <div class="card bg-base-100 shadow-sm">
        <div class="card-body">
          <h3 class="text-lg font-bold mb-4">Billing Email</h3>
          <form {...updateBillingEmail} class="space-y-4">
            <div class="form-control">
              <label class="label" for="billing-email">
                <span class="label-text">Email for invoices and receipts</span>
              </label>
              <input
                id="billing-email"
                type="email"
                name="billingEmail"
                class="input input-bordered"
                bind:value={billingForm.billingEmail}
                required
              />
            </div>

            <div class="flex justify-end">
              <button type="submit" class="btn btn-primary">
                <Save class="h-4 w-4 mr-2" />
                Update Billing Email
              </button>
            </div>
          </form>
        </div>
      </div>

      <div class="card bg-base-100 shadow-sm">
        <div class="card-body">
          <h3 class="text-lg font-bold mb-4">Payment Method</h3>
          <p class="text-base-content/60 mb-4">No payment method on file</p>
          <button class="btn btn-outline">Add Payment Method</button>
        </div>
      </div>

      <div class="card bg-base-100 shadow-sm">
        <div class="card-body">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold">Billing History</h3>
            <button class="btn btn-ghost btn-sm">View All Invoices</button>
          </div>
          <div class="text-center py-8 text-base-content/60">
            <p>No invoices yet</p>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Security Tab -->
  {#if activeTab === 'security'}
    <div class="space-y-6">
      <div class="card bg-base-100 shadow-sm">
        <div class="card-body">
          <h3 class="text-lg font-bold mb-4">Change Password</h3>
          <form {...changePassword} onsubmit={resetPasswordForm} class="space-y-4">
            <div class="form-control">
              <label class="label" for="current-password">
                <span class="label-text">Current Password</span>
              </label>
              <input
                id="current-password"
                type="password"
                name="currentPassword"
                class="input input-bordered"
                bind:value={passwordForm.currentPassword}
                required
              />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="form-control">
                <label class="label" for="new-password">
                  <span class="label-text">New Password</span>
                </label>
                <input
                  id="new-password"
                  type="password"
                  name="newPassword"
                  class="input input-bordered"
                  bind:value={passwordForm.newPassword}
                  minlength="8"
                  required
                />
              </div>

              <div class="form-control">
                <label class="label" for="confirm-password">
                  <span class="label-text">Confirm New Password</span>
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  name="confirmPassword"
                  class="input input-bordered"
                  bind:value={passwordForm.confirmPassword}
                  minlength="8"
                  required
                />
              </div>
            </div>

            <div class="flex justify-end">
              <button type="submit" class="btn btn-primary">
                Update Password
              </button>
            </div>
          </form>
        </div>
      </div>

      <div class="card bg-base-100 shadow-sm">
        <div class="card-body">
          <h3 class="text-lg font-bold mb-2">Two-Factor Authentication</h3>
          <p class="text-base-content/60 mb-4">Add an extra layer of security to your account</p>
          <button class="btn btn-outline">Enable 2FA</button>
        </div>
      </div>

      <div class="card bg-base-100 shadow-sm">
        <div class="card-body">
          <h3 class="text-lg font-bold mb-2">Active Sessions</h3>
          <p class="text-base-content/60 mb-4">Manage your active sessions across devices</p>
          <a href="/sessions" class="btn btn-outline">View Sessions</a>
        </div>
      </div>
    </div>
  {/if}

  <!-- Danger Zone Tab -->
  {#if activeTab === 'danger'}
    <div class="space-y-6">
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
  {/if}
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
