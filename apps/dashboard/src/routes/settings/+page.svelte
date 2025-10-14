<script lang="ts">
  import { Settings, User, CreditCard, Shield, AlertTriangle, X, Save, Check, Zap, Crown, Sparkles, Calendar, Receipt } from 'lucide-svelte';
  import {
    getAccountSettings,
    getBillingInfo,
    getSubscriptionDetails,
    getAvailablePlans,
    updateProfile,
    changePassword,
    updateBillingEmail,
    cancelSubscription,
    deleteAccount,
    upgradePlan,
    manageBilling
  } from '$lib/api/settings.remote';

  // Data sources
  const account = getAccountSettings();
  const billing = getBillingInfo();
  const subscription = getSubscriptionDetails();
  const plans = getAvailablePlans();

  // Derived data
  const accountData = $derived(account.current || null);
  const billingData = $derived(billing.current || null);
  const subscriptionData = $derived(subscription.current || null);
  const plansData = $derived(plans.current || []);

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
      <!-- Current Plan Card -->
      <div class="card bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 shadow-lg">
        <div class="card-body">
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-3">
              {#if subscriptionData?.plan === 'free'}
                <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-base-100">
                  <Zap class="h-6 w-6 text-base-content/60" />
                </div>
              {:else if subscriptionData?.plan === 'pro'}
                <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20">
                  <Crown class="h-6 w-6 text-primary" />
                </div>
              {:else}
                <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/20">
                  <Sparkles class="h-6 w-6 text-accent" />
                </div>
              {/if}
              <div>
                <h3 class="text-2xl font-bold capitalize">{subscriptionData?.plan || 'Free'} Plan</h3>
                {#if subscriptionData?.hasSubscription}
                  <div class="flex items-center gap-2 mt-1">
                    <span class="badge badge-success badge-sm">
                      {subscriptionData.status}
                    </span>
                    {#if subscriptionData.cancelAtPeriodEnd}
                      <span class="badge badge-warning badge-sm">Cancels at period end</span>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
            
            {#if !subscriptionData?.hasSubscription}
              <a href="#plans" class="btn btn-primary gap-2">
                <Crown class="h-4 w-4" />
                Upgrade
              </a>
            {:else}
              <form {...manageBilling}>
                <button type="submit" class="btn btn-outline gap-2">
                  <Settings class="h-4 w-4" />
                  Manage Billing
                </button>
              </form>
            {/if}
          </div>

          {#if subscriptionData?.hasSubscription && subscriptionData.currentPeriodEnd}
            <div class="flex items-center gap-2 text-sm text-base-content/70">
              <Calendar class="h-4 w-4" />
              <span>
                {subscriptionData.cancelAtPeriodEnd ? 'Access until' : 'Renews on'}
                {new Date(subscriptionData.currentPeriodEnd).toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </span>
            </div>
          {/if}

          {#if !subscriptionData?.hasSubscription}
            <div class="mt-4 p-4 bg-base-100 rounded-lg">
              <p class="text-sm text-base-content/70 mb-3">
                Upgrade to unlock premium features:
              </p>
              <ul class="space-y-2 text-sm">
                <li class="flex items-center gap-2">
                  <Check class="h-4 w-4 text-success" />
                  <span>Unlimited projects</span>
                </li>
                <li class="flex items-center gap-2">
                  <Check class="h-4 w-4 text-success" />
                  <span>Advanced analytics</span>
                </li>
                <li class="flex items-center gap-2">
                  <Check class="h-4 w-4 text-success" />
                  <span>Priority support</span>
                </li>
                <li class="flex items-center gap-2">
                  <Check class="h-4 w-4 text-success" />
                  <span>Custom integrations</span>
                </li>
              </ul>
            </div>
          {/if}
        </div>
      </div>

      <!-- Plan Comparison (only show if not subscribed) -->
      {#if !subscriptionData?.hasSubscription && plansData.length > 0}
        <div id="plans" class="card bg-base-100 shadow-sm">
          <div class="card-body">
            <h3 class="text-lg font-bold mb-4">Choose Your Plan</h3>
            <div class="grid grid-cols-1 md:grid-cols-{Math.min(plansData.length, 3)} gap-4">
              {#each plansData as plan, index}
                {@const monthlyPrice = plan.prices.find((p: any) => p.interval === 'month')}
                {@const isPopular = index === 1}
                <div class="border {isPopular ? 'border-2 border-primary' : 'border-base-300'} rounded-lg p-6 hover:border-primary transition-colors relative">
                  {#if isPopular}
                    <div class="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span class="badge badge-primary">Most Popular</span>
                    </div>
                  {/if}
                  <div class="flex items-center gap-2 mb-2">
                    {#if index === 0}
                      <Zap class="h-5 w-5 text-base-content/60" />
                    {:else if index === 1}
                      <Crown class="h-5 w-5 text-primary" />
                    {:else}
                      <Sparkles class="h-5 w-5 text-accent" />
                    {/if}
                    <h4 class="font-bold">{plan.name}</h4>
                  </div>
                  {#if monthlyPrice}
                    <div class="mb-4">
                      <span class="text-3xl font-bold">
                        ${(monthlyPrice.amount / 100).toFixed(0)}
                      </span>
                      <span class="text-base-content/60">/month</span>
                    </div>
                  {/if}
                  {#if plan.description}
                    <p class="text-sm text-base-content/60 mb-4">{plan.description}</p>
                  {/if}
                  {#if plan.features.length > 0}
                    <ul class="space-y-2 mb-6 text-sm">
                      {#each plan.features as feature}
                        <li class="flex items-start gap-2">
                          <Check class="h-4 w-4 text-success mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      {/each}
                    </ul>
                  {/if}
                  {#if monthlyPrice}
                    <form {...upgradePlan}>
                      <input type="hidden" name="priceId" value={monthlyPrice.id} />
                      <button type="submit" class="btn {isPopular ? 'btn-primary' : 'btn-outline'} w-full">
                        Choose {plan.name}
                      </button>
                    </form>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        </div>
      {:else if !subscriptionData?.hasSubscription}
        <div class="card bg-base-100 shadow-sm">
          <div class="card-body text-center py-8">
            <p class="text-base-content/60">No plans available. Create products in the Products page.</p>
            <a href="/products" class="btn btn-primary mx-auto mt-4">Manage Products</a>
          </div>
        </div>
      {/if}

      <!-- Billing Email -->
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

      <!-- Billing History -->
      {#if subscriptionData?.hasSubscription}
        <div class="card bg-base-100 shadow-sm">
          <div class="card-body">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-bold">Billing History</h3>
              <form {...manageBilling}>
                <button type="submit" class="btn btn-ghost btn-sm gap-2">
                  <Receipt class="h-4 w-4" />
                  View All Invoices
                </button>
              </form>
            </div>
            <div class="text-center py-8 text-base-content/60">
              <Receipt class="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>View your invoices in the billing portal</p>
            </div>
          </div>
        </div>
      {/if}
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
