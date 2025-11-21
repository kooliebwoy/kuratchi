<script lang="ts">
  import { Button, Card, Badge } from '@kuratchi/ui';
  import { Save, User } from 'lucide-svelte';
  import { getAccountSettings, updateProfile } from '$lib/functions/settings.remote';

  const account = getAccountSettings();
  const accountData = $derived(account.current || null);

  let profileForm = $state({
    name: '',
    email: ''
  });

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

<div class="kui-settings-page">
  <header class="kui-settings-header">
    <div class="kui-inline">
      <div class="kui-avatar">
        <User />
      </div>
      <div>
        <p class="kui-eyebrow">Profile</p>
        <h1>Account settings</h1>
        <p class="kui-subtext">Update your name and email, and review your account details.</p>
      </div>
    </div>
  </header>

  <Card class="kui-card">
    <div class="kui-inline between">
      <div>
        <p class="kui-eyebrow">Profile</p>
        <h3>Profile information</h3>
        <p class="kui-subtext">Keep your details up to date for notifications and billing.</p>
      </div>
    </div>

    <form {...updateProfile} class="kui-form-grid">
      <label class="kui-form-control" for="profile-name">
        <span class="kui-label">Full name</span>
        <input
          id="profile-name"
          type="text"
          name="name"
          class="kui-input"
          bind:value={profileForm.name}
          required
        />
      </label>

      <label class="kui-form-control" for="profile-email">
        <span class="kui-label">Email address</span>
        <input
          id="profile-email"
          type="email"
          name="email"
          class="kui-input"
          bind:value={profileForm.email}
          required
        />
      </label>

      <div class="kui-actions">
        <Button type="submit" variant="primary">
          <Save class="kui-icon" />
          Save changes
        </Button>
      </div>
    </form>
  </Card>

  <Card class="kui-card">
    <p class="kui-eyebrow">Account</p>
    <h3>Account information</h3>

    <div class="kui-data-grid">
      <div>
        <p class="kui-subtext">Account ID</p>
        <code>{accountData?.id}</code>
      </div>
      <div>
        <p class="kui-subtext">Role</p>
        <Badge variant="primary" size="xs">{accountData?.role || 'member'}</Badge>
      </div>
      <div>
        <p class="kui-subtext">Member since</p>
        <p>{accountData?.created_at ? new Date(accountData.created_at).toLocaleDateString() : '-'}</p>
      </div>
    </div>
  </Card>
</div>

<style>
  .kui-settings-page {
    display: grid;
    gap: 16px;
  }

  .kui-settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .kui-inline {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .kui-inline.between {
    justify-content: space-between;
    align-items: flex-start;
  }

  h1 {
    margin: 0;
    font-size: 26px;
  }

  h3 {
    margin: 0 0 4px;
    font-size: 18px;
  }

  .kui-avatar {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #dbeafe, #1d4ed8);
    color: white;
  }

  .kui-eyebrow {
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #6b7280;
    margin: 0 0 6px;
  }

  .kui-subtext {
    color: #6b7280;
    margin: 0;
  }

  .kui-card {
    display: grid;
    gap: 12px;
    padding: 16px;
  }

  .kui-form-grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  }

  .kui-form-control {
    display: grid;
    gap: 6px;
  }

  .kui-label {
    font-weight: 600;
    font-size: 14px;
  }

  .kui-input {
    width: 100%;
    border-radius: 10px;
    border: 1px solid #e4e4e7;
    padding: 10px 12px;
    background: white;
  }

  .kui-input:focus {
    border-color: #a5b4fc;
    outline: 2px solid rgba(129, 140, 248, 0.35);
  }

  .kui-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    margin-top: 6px;
  }

  .kui-data-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }

  code {
    background: #f4f4f5;
    padding: 6px 8px;
    border-radius: 8px;
    display: inline-block;
  }

  .kui-icon {
    width: 16px;
    height: 16px;
  }
</style>
