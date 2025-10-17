<script lang="ts">
  import { Save, User } from 'lucide-svelte';
  import { getAccountSettings, updateProfile } from '$lib/api/settings.remote';

  // Data source
  const account = getAccountSettings();
  const accountData = $derived(account.current || null);

  // Form state
  let profileForm = $state({
    name: '',
    email: ''
  });

  // Load account data into form
  $effect(() => {
    if (accountData) {
      profileForm.name = accountData.name || '';
      profileForm.email = accountData.email || '';
    }
  });
</script>

<svelte:head>
  <title>Account Settings - Kuratchi Dashboard</title>
</svelte:head>

<div class="space-y-6">
  <!-- Profile Information -->
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

  <!-- Account Information -->
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
        <div class="flex justify-between py-2 border-b border-base-200">
          <span class="text-base-content/70">Member Since</span>
          <span class="text-sm">{accountData?.created_at ? new Date(accountData.created_at).toLocaleDateString() : '-'}</span>
        </div>
      </div>
    </div>
  </div>
</div>
