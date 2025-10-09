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
      
      {#if showCredentials || showMagicLink}
        <div class="divider">OR</div>
      {/if}
    {/if}
    
    {#if showCredentials && showMagicLink}
      <div class="tabs tabs-boxed mb-4">
        <button
          type="button"
          class="tab"
          class:tab-active={mode === 'credentials'}
          onclick={() => mode = 'credentials'}
        >
          Password
        </button>
        <button
          type="button"
          class="tab"
          class:tab-active={mode === 'magic'}
          onclick={() => mode = 'magic'}
        >
          Magic Link
        </button>
      </div>
    {/if}
    
    {#if mode === 'credentials' && showCredentials}
      <form onsubmit={onSubmitCredentials} class="space-y-4">
        <div class="form-control">
          <label class="label" for="email">
            <span class="label-text">Email</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="email@example.com"
            class="input input-bordered w-full"
            required
            disabled={loading}
          />
        </div>
        
        <div class="form-control">
          <label class="label" for="password">
            <span class="label-text">Password</span>
          </label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            class="input input-bordered w-full"
            required
            disabled={loading}
          />
          <div class="label">
            <a href="/forgot-password" class="label-text-alt link link-hover">Forgot password?</a>
          </div>
        </div>
        
        <button type="submit" class="btn btn-primary w-full" disabled={loading}>
          {#if loading}
            <span class="loading loading-spinner"></span>
          {/if}
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    {/if}
    
    {#if mode === 'magic' && showMagicLink}
      <form onsubmit={onSubmitMagicLink} class="space-y-4">
        <div class="form-control">
          <label class="label" for="email-magic">
            <span class="label-text">Email</span>
          </label>
          <input
            id="email-magic"
            name="email"
            type="email"
            placeholder="email@example.com"
            class="input input-bordered w-full"
            required
            disabled={loading}
          />
          <div class="label">
            <span class="label-text-alt">We'll send you a sign-in link</span>
          </div>
        </div>
        
        <button type="submit" class="btn btn-primary w-full" disabled={loading}>
          {#if loading}
            <span class="loading loading-spinner"></span>
          {/if}
          {loading ? 'Sending...' : 'Send Magic Link'}
        </button>
      </form>
    {/if}
    
    {#if footer}
      <div class="mt-4">
        {@render footer()}
      </div>
    {:else}
      <div class="text-center mt-4">
        <p class="text-sm text-base-content/70">
          Don't have an account?
          <a href="/signup" class="link link-primary">Sign up</a>
        </p>
      </div>
    {/if}
  </div>
</div>
