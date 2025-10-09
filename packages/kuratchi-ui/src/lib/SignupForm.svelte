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

<div class="card w-full max-w-md bg-base-100 shadow-xl">
  <div class="card-body">
    {#if typeof title === 'string'}
      <h2 class="card-title text-2xl font-bold">{title}</h2>
    {:else}
      {@render title()}
    {/if}
    
    {#if subtitle}
      {#if typeof subtitle === 'string'}
        <p class="text-base-content/70 text-sm">{subtitle}</p>
      {:else}
        {@render subtitle()}
      {/if}
    {/if}
    
    {#if error}
      <div class="alert alert-error mt-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{error}</span>
      </div>
    {/if}
    
    {#if showOAuth}
      <div class="space-y-2 mt-4">
        {#each oauthProviders as provider}
          <button
            type="button"
            class="btn btn-outline w-full"
            onclick={() => onOAuthClick?.(provider.name)}
            disabled={loading}
          >
            {provider.label}
          </button>
        {/each}
      </div>
      
      <div class="divider">OR</div>
    {/if}
    
    <form {onSubmit} class="space-y-4">
      <div class="form-control">
        <label class="label" for="signup-name">
          <span class="label-text">Name</span>
        </label>
        <input
          id="signup-name"
          name="name"
          type="text"
          placeholder="John Doe"
          class="input input-bordered w-full"
          required
          disabled={loading}
        />
      </div>
      
      <div class="form-control">
        <label class="label" for="signup-email">
          <span class="label-text">Email</span>
        </label>
        <input
          id="signup-email"
          name="email"
          type="email"
          placeholder="email@example.com"
          class="input input-bordered w-full"
          required
          disabled={loading}
        />
      </div>
      
      <div class="form-control">
        <label class="label" for="signup-password">
          <span class="label-text">Password</span>
        </label>
        <input
          id="signup-password"
          name="password"
          type="password"
          placeholder="••••••••"
          class="input input-bordered w-full"
          required
          disabled={loading}
          minlength="8"
        />
        <div class="label">
          <span class="label-text-alt">Minimum 8 characters</span>
        </div>
      </div>
      
      <div class="form-control">
        <label class="label" for="signup-password-confirm">
          <span class="label-text">Confirm Password</span>
        </label>
        <input
          id="signup-password-confirm"
          name="passwordConfirm"
          type="password"
          placeholder="••••••••"
          class="input input-bordered w-full"
          required
          disabled={loading}
          minlength="8"
        />
      </div>
      
      <button type="submit" class="btn btn-primary w-full" disabled={loading}>
        {#if loading}
          <span class="loading loading-spinner"></span>
        {/if}
        {loading ? 'Creating Account...' : 'Sign Up'}
      </button>
    </form>
    
    {#if footer}
      <div class="mt-4">
        {@render footer()}
      </div>
    {:else}
      <div class="text-center mt-4">
        <p class="text-sm text-base-content/70">
          Already have an account?
          <a href="/auth/start" class="link link-primary">Sign in</a>
        </p>
      </div>
    {/if}
  </div>
</div>
