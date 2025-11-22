<script lang="ts">
  import { Button, Card, Badge } from '@kuratchi/ui';
  import { Save, User, Copy, Check } from 'lucide-svelte';
  import { getAccountSettings, updateProfile } from '$lib/functions/settings.remote';

  const account = getAccountSettings();
  const accountData = $derived(account.current || null);

  let profileForm = $state({
    name: '',
    email: ''
  });

  let copiedId = $state(false);

  $effect(() => {
    if (accountData) {
      profileForm.name = accountData.name || '';
      profileForm.email = accountData.email || '';
    }
  });

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    copiedId = true;
    setTimeout(() => {
      copiedId = false;
    }, 2000);
  }
</script>

<svelte:head>
  <title>Account Settings - Kuratchi Dashboard</title>
</svelte:head>

<div class="kui-settings-page">
  <div class="kui-settings-hero">
    <div class="kui-settings-hero__icon">
      <User />
    </div>
    <div class="kui-settings-hero__content">
      <h1>Account settings</h1>
      <p>Update your name and email, and review your account details.</p>
    </div>
  </div>

  <!-- Profile Information Section -->
  <section class="kui-settings-section">
    <div class="kui-settings-section__header">
      <div>
        <h2>Profile information</h2>
        <p class="kui-settings-section__description">Keep your details up to date for notifications and billing.</p>
      </div>
    </div>

    <form {...updateProfile} class="kui-settings-form">
      <div class="kui-form-row">
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
      </div>

      <div class="kui-settings-form__actions">
        <Button type="submit" variant="primary">
          <Save class="kui-icon" />
          Save changes
        </Button>
      </div>
    </form>
  </section>

  <!-- Account Information Section -->
  <section class="kui-settings-section">
    <div class="kui-settings-section__header">
      <h2>Account information</h2>
      <p class="kui-settings-section__description">Your account details and access level.</p>
    </div>

    <div class="kui-settings-grid">
      <div class="kui-settings-item">
        <div class="kui-settings-item__label">Account ID</div>
        <div class="kui-settings-item__content">
          <code class="kui-settings-code">{accountData?.id || '-'}</code>
          {#if accountData?.id}
            <button 
              class="kui-settings-copy"
              on:click={() => copyToClipboard(accountData.id)}
              aria-label="Copy account ID"
            >
              {#if copiedId}
                <Check class="kui-icon-sm" />
              {:else}
                <Copy class="kui-icon-sm" />
              {/if}
            </button>
          {/if}
        </div>
      </div>

      <div class="kui-settings-item">
        <div class="kui-settings-item__label">Role</div>
        <div class="kui-settings-item__content">
          <Badge variant="primary" size="sm">{accountData?.role || 'member'}</Badge>
        </div>
      </div>

      <div class="kui-settings-item">
        <div class="kui-settings-item__label">Member since</div>
        <div class="kui-settings-item__content">
          <span>{accountData?.created_at ? new Date(accountData.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}</span>
        </div>
      </div>
    </div>
  </section>
</div>

<style>
  .kui-settings-page {
    display: grid;
    gap: 2rem;
  }

  .kui-settings-hero {
    display: flex;
    align-items: flex-start;
    gap: 1.5rem;
    padding-bottom: 1rem;
  }

  .kui-settings-hero__icon {
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 1rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(88, 76, 217, 0.12), rgba(88, 76, 217, 0.08));
    color: var(--kui-color-primary);
    flex-shrink: 0;
  }

  .kui-settings-hero__content h1 {
    margin: 0 0 0.5rem;
    font-size: 2rem;
    font-weight: 700;
    color: var(--kui-color-text);
  }

  .kui-settings-hero__content p {
    margin: 0;
    color: var(--kui-color-muted);
    font-size: 1rem;
  }

  .kui-settings-section {
    background: var(--kui-color-surface);
    border: 1px solid var(--kui-color-border);
    border-radius: var(--kui-radius-lg);
    padding: 1.5rem;
  }

  .kui-settings-section__header {
    margin-bottom: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--kui-color-border);
  }

  .kui-settings-section__header h2 {
    margin: 0 0 0.5rem;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--kui-color-text);
  }

  .kui-settings-section__description {
    margin: 0;
    font-size: 0.95rem;
    color: var(--kui-color-muted);
  }

  .kui-settings-form {
    display: grid;
    gap: 1.5rem;
  }

  .kui-form-row {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }

  .kui-form-control {
    display: grid;
    gap: 0.5rem;
  }

  .kui-label {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--kui-color-text);
  }

  .kui-input {
    width: 100%;
    border-radius: var(--kui-radius-md);
    border: 1px solid var(--kui-color-border);
    padding: 0.65rem 0.9rem;
    background: var(--kui-color-surface);
    font-size: 0.95rem;
    transition: border-color var(--kui-duration-base) ease, box-shadow var(--kui-duration-base) ease;
  }

  .kui-input:focus {
    border-color: var(--kui-color-primary);
    outline: none;
    box-shadow: 0 0 0 3px rgba(88, 76, 217, 0.1);
  }

  .kui-settings-form__actions {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    gap: 1rem;
  }

  .kui-settings-grid {
    display: grid;
    gap: 1.5rem;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }

  .kui-settings-item {
    padding: 1rem;
    background: var(--kui-color-surface-muted);
    border-radius: var(--kui-radius-md);
    border: 1px solid var(--kui-color-border);
  }

  .kui-settings-item__label {
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--kui-color-muted);
    font-weight: 600;
    margin-bottom: 0.75rem;
    display: block;
  }

  .kui-settings-item__content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .kui-settings-code {
    background: var(--kui-color-surface);
    padding: 0.5rem 0.75rem;
    border-radius: var(--kui-radius-sm);
    border: 1px solid var(--kui-color-border);
    display: inline-block;
    font-family: 'Monaco', 'Courier New', monospace;
    font-size: 0.85rem;
    color: var(--kui-color-text);
    word-break: break-all;
  }

  .kui-settings-copy {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: var(--kui-radius-sm);
    border: 1px solid var(--kui-color-border);
    background: var(--kui-color-surface);
    cursor: pointer;
    color: var(--kui-color-muted);
    transition: all var(--kui-duration-base) ease;
    padding: 0;
    font-size: 0;
  }

  .kui-settings-copy:hover {
    background: var(--kui-color-primary);
    border-color: var(--kui-color-primary);
    color: #fff;
  }

  .kui-icon {
    width: 1rem;
    height: 1rem;
  }

  .kui-icon-sm {
    width: 0.875rem;
    height: 0.875rem;
  }

  @media (max-width: 768px) {
    .kui-settings-page {
      gap: 1.5rem;
    }

    .kui-settings-hero {
      gap: 1rem;
    }

    .kui-settings-hero__icon {
      width: 3rem;
      height: 3rem;
    }

    .kui-settings-hero__content h1 {
      font-size: 1.5rem;
    }

    .kui-settings-section {
      padding: 1rem;
    }
  }
</style>
