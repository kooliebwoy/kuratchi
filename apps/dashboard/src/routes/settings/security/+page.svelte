<script lang="ts">
  import { changePassword } from '$lib/functions/settings.remote';

  // Form state
  let passwordForm = $state({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  function resetPasswordForm() {
    passwordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };
  }
</script>

<svelte:head>
  <title>Security - Kuratchi Dashboard</title>
</svelte:head>

<div class="space-y-6">
  <!-- Change Password -->
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

  <!-- Two-Factor Authentication -->
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body">
      <h3 class="text-lg font-bold mb-2">Two-Factor Authentication</h3>
      <p class="text-base-content/60 mb-4">Add an extra layer of security to your account</p>
      <button class="btn btn-outline">Enable 2FA</button>
    </div>
  </div>

  <!-- Active Sessions -->
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body">
      <h3 class="text-lg font-bold mb-2">Active Sessions</h3>
      <p class="text-base-content/60 mb-4">Manage your active sessions across devices</p>
      <a href="/sessions" class="btn btn-outline">View Sessions</a>
    </div>
  </div>
</div>
