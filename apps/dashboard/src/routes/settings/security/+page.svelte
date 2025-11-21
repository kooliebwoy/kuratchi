<script lang="ts">
  import { changePassword } from '$lib/functions/settings.remote';
  import { Button, Card, FormField } from '@kuratchi/ui';

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

<div class="kui-security">
  <Card class="kui-panel" title="Change Password">
    <form {...changePassword} onsubmit={resetPasswordForm} class="kui-stack">
      <FormField label="Current Password" for="current-password">
        <input
          id="current-password"
          class="kui-input"
          type="password"
          name="currentPassword"
          bind:value={passwordForm.currentPassword}
          placeholder="••••••••"
          required
        />
      </FormField>

      <div class="kui-grid">
        <FormField label="New Password" for="new-password">
          <input
            id="new-password"
            class="kui-input"
            type="password"
            name="newPassword"
            bind:value={passwordForm.newPassword}
            placeholder="At least 8 characters"
            minlength="8"
            required
          />
        </FormField>

        <FormField label="Confirm New Password" for="confirm-password">
          <input
            id="confirm-password"
            class="kui-input"
            type="password"
            name="confirmPassword"
            bind:value={passwordForm.confirmPassword}
            placeholder="Match your new password"
            minlength="8"
            required
          />
        </FormField>
      </div>

      <div class="kui-actions">
        <Button type="submit" variant="primary">Update Password</Button>
      </div>
    </form>
  </Card>

  <Card class="kui-panel" title="Two-Factor Authentication">
    <p class="kui-subtext">Add an extra layer of security to your account</p>
    <Button variant="outline">Enable 2FA</Button>
  </Card>

  <Card class="kui-panel" title="Active Sessions">
    <p class="kui-subtext">Manage your active sessions across devices</p>
    <a class="kui-button kui-button--outline" href="/sessions">View Sessions</a>
  </Card>
</div>

<style>
  .kui-security {
    display: grid;
    gap: var(--kui-spacing-md);
  }

  .kui-panel .kui-card__body {
    gap: var(--kui-spacing-md);
  }

  .kui-stack {
    display: grid;
    gap: var(--kui-spacing-md);
  }

  .kui-grid {
    display: grid;
    gap: var(--kui-spacing-sm);
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }

  .kui-actions {
    display: flex;
    justify-content: flex-end;
  }

  .kui-subtext {
    margin: 0 0 0.5rem;
    color: var(--kui-color-muted);
  }
</style>
