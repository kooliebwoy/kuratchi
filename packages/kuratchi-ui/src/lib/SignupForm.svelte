<script lang="ts">
  import type { Snippet } from 'svelte';
  
  interface Props {
    title?: string | Snippet;
    subtitle?: string | Snippet;
    loading?: boolean;
    error?: string;
    showOAuth?: boolean;
    oauthProviders?: Array<{ name: string; label: string; icon?: string }>;
    onSubmit?: (e: SubmitEvent) => void;
    onOAuthClick?: (provider: string) => void;
    footer?: Snippet;
  }
  
  let {
    title = 'Create Account',
    subtitle = 'Sign up to get started',
    loading = false,
    error = '',
    showOAuth = false,
    oauthProviders = [
      { name: 'google', label: 'Sign up with Google' },
      { name: 'github', label: 'Sign up with GitHub' }
    ],
    onSubmit,
    onOAuthClick,
    footer
  }: Props = $props();
</script>

<section class="kui-auth-card">
  <div class="kui-auth-card__header">
    {#if typeof title === 'string'}
      <h2 class="kui-auth-card__title">{title}</h2>
    {:else}
      {@render title()}
    {/if}
    
    {#if subtitle}
      {#if typeof subtitle === 'string'}
        <p class="kui-auth-card__subtitle">{subtitle}</p>
      {:else}
        {@render subtitle()}
      {/if}
    {/if}
  </div>
  
  {#if error}
    <div class="kui-alert kui-alert--error" role="alert">
      <div class="kui-alert__content">{error}</div>
    </div>
  {/if}
  
  {#if showOAuth}
    <div class="kui-stack" style="margin-top: var(--kui-spacing-sm);">
      {#each oauthProviders as provider}
        <button
          type="button"
          class="kui-button kui-button--neutral kui-button--outline kui-button--block"
          onclick={() => onOAuthClick?.(provider.name)}
          disabled={loading}
        >
          {provider.label}
        </button>
      {/each}
    </div>
    
    <div class="kui-divider" aria-label="Authentication divider">or</div>
  {/if}
  
  <form onsubmit={onSubmit} class="kui-stack">
    <label class="kui-form-control" for="signup-name">
      <span class="kui-label">Name</span>
      <input
        id="signup-name"
        name="name"
        type="text"
        placeholder="John Doe"
        class="kui-input"
        required
        disabled={loading}
      />
    </label>
    
    <label class="kui-form-control" for="signup-email">
      <span class="kui-label">Email</span>
      <input
        id="signup-email"
        name="email"
        type="email"
        placeholder="email@example.com"
        class="kui-input"
        required
        disabled={loading}
      />
    </label>
    
    <label class="kui-form-control" for="signup-password">
      <span class="kui-label">Password</span>
      <input
        id="signup-password"
        name="password"
        type="password"
        placeholder="••••••••"
        class="kui-input"
        required
        disabled={loading}
        minlength="8"
      />
      <div class="kui-helper-text">Minimum 8 characters</div>
    </label>
    
    <label class="kui-form-control" for="signup-password-confirm">
      <span class="kui-label">Confirm Password</span>
      <input
        id="signup-password-confirm"
        name="passwordConfirm"
        type="password"
        placeholder="••••••••"
        class="kui-input"
        required
        disabled={loading}
        minlength="8"
      />
    </label>
    
    <button type="submit" class="kui-button kui-button--primary kui-button--block" disabled={loading}>
      {#if loading}
        <span class="kui-button__spinner" aria-hidden="true"></span>
      {/if}
      {loading ? 'Creating Account...' : 'Sign Up'}
    </button>
  </form>
  
  {#if footer}
    <div class="kui-auth-card__footer">
      {@render footer()}
    </div>
  {:else}
    <div class="kui-auth-card__footer">
      <p class="kui-helper-text">
        Already have an account?
        <a href="/auth/start" class="kui-link">Sign in</a>
      </p>
    </div>
  {/if}
</section>
