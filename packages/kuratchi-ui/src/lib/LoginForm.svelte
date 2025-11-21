<script lang="ts">
  import type { Snippet } from 'svelte';
  
  interface Props {
    title?: string | Snippet;
    subtitle?: string | Snippet;
    loading?: boolean;
    error?: string;
    showMagicLink?: boolean;
    showCredentials?: boolean;
    showOAuth?: boolean;
    oauthProviders?: Array<{ name: string; label: string; icon?: string }>;
    onSubmitCredentials?: (e: SubmitEvent) => void;
    onSubmitMagicLink?: (e: SubmitEvent) => void;
    onOAuthClick?: (provider: string) => void;
    footer?: Snippet;
  }
  
  let {
    title = 'Sign In',
    subtitle = 'Welcome back! Please sign in to continue.',
    loading = false,
    error = '',
    showMagicLink = false,
    showCredentials = true,
    showOAuth = false,
    oauthProviders = [
      { name: 'google', label: 'Sign in with Google' },
      { name: 'github', label: 'Sign in with GitHub' }
    ],
    onSubmitCredentials,
    onSubmitMagicLink,
    onOAuthClick,
    footer
  }: Props = $props();
  
  let mode = $state<'credentials' | 'magic'>('credentials');
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
    
    {#if showCredentials || showMagicLink}
      <div class="kui-divider" aria-label="Authentication divider">or</div>
    {/if}
  {/if}
  
  {#if showCredentials && showMagicLink}
    <div class="kui-auth-tabs" role="tablist">
      <button
        type="button"
        class={`kui-auth-tabs__item ${mode === 'credentials' ? 'kui-auth-tabs__item--active' : ''}`.trim()}
        onclick={() => mode = 'credentials'}
        role="tab"
        aria-selected={mode === 'credentials'}
      >
        Password
      </button>
      <button
        type="button"
        class={`kui-auth-tabs__item ${mode === 'magic' ? 'kui-auth-tabs__item--active' : ''}`.trim()}
        onclick={() => mode = 'magic'}
        role="tab"
        aria-selected={mode === 'magic'}
      >
        Magic Link
      </button>
    </div>
  {/if}
  
  {#if mode === 'credentials' && showCredentials}
    <form onsubmit={onSubmitCredentials} class="kui-stack">
      <label class="kui-form-control" for="email">
        <span class="kui-label">Email</span>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="email@example.com"
          class="kui-input"
          required
          disabled={loading}
        />
      </label>
      
      <label class="kui-form-control" for="password">
        <span class="kui-label">Password</span>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          class="kui-input"
          required
          disabled={loading}
        />
        <div class="kui-helper-text">
          <a href="/forgot-password" class="kui-link">Forgot password?</a>
        </div>
      </label>
      
      <button
        type="submit"
        class="kui-button kui-button--primary kui-button--block"
        disabled={loading}
      >
        {#if loading}
          <span class="kui-button__spinner" aria-hidden="true"></span>
        {/if}
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  {/if}
  
  {#if mode === 'magic' && showMagicLink}
    <form onsubmit={onSubmitMagicLink} class="kui-stack">
      <label class="kui-form-control" for="email-magic">
        <span class="kui-label">Email</span>
        <input
          id="email-magic"
          name="email"
          type="email"
          placeholder="email@example.com"
          class="kui-input"
          required
          disabled={loading}
        />
        <div class="kui-helper-text">We'll send you a sign-in link</div>
      </label>
      
      <button
        type="submit"
        class="kui-button kui-button--primary kui-button--block"
        disabled={loading}
      >
        {#if loading}
          <span class="kui-button__spinner" aria-hidden="true"></span>
        {/if}
        {loading ? 'Sending...' : 'Send Magic Link'}
      </button>
    </form>
  {/if}
  
  {#if footer}
    <div class="kui-auth-card__footer">
      {@render footer()}
    </div>
  {:else}
    <div class="kui-auth-card__footer">
      <p class="kui-helper-text">
        Don't have an account?
        <a href="/signup" class="kui-link">Sign up</a>
      </p>
    </div>
  {/if}
</section>
