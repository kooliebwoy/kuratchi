<script lang="ts">
  import { goto } from '$app/navigation';
	import { signUp } from '$lib/functions/auth.remote';
  import { Button, Card, FormField, FormInput, Loading } from '@kuratchi/ui';

  const { data } = $props();
  const turnstile = data.turnstile;
  const turnstileEnabled = !!turnstile?.siteKey && !turnstile?.devDisabled && turnstile?.enabled !== false;
  const turnstileScriptUrl = turnstile?.scriptUrl || 'https://challenges.cloudflare.com/turnstile/v0/api.js';
  const turnstileAction = 'dashboard-signup';
  
  $effect(() => {
    if (signUp.result?.success) {
      setTimeout(() => goto('/auth/signin'), 2000);
    }
  });

  function handleOAuthClick(provider: string) {
    window.location.href = `/auth/oauth/${provider}/start?redirectTo=/`;
  }
</script>

<svelte:head>
  <title>Sign Up - Kuratchi Dashboard</title>
  {#if turnstileEnabled}
    <script src={turnstileScriptUrl} async defer></script>
  {/if}
</svelte:head>

<div class="auth-page">
  <Card class="auth-card">
    <div class="auth-header">
      <div>
        <p class="kui-eyebrow">Create your workspace</p>
        <h1>Start with Kuratchi</h1>
        <p class="kui-subtext">Spin up your organization in seconds.</p>
      </div>
    </div>

    <div class="auth-oauth">
      <Button variant="outline" class="auth-oauth__btn" onclick={() => handleOAuthClick('google')}>
        <svg class="auth-oauth__icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </Button>

      <Button variant="outline" class="auth-oauth__btn" onclick={() => handleOAuthClick('github')}>
        <svg class="auth-oauth__icon" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
        Continue with GitHub
      </Button>
    </div>

    <div class="auth-divider">
      <span>Or continue with email</span>
    </div>
    
    <form {...signUp} class="auth-form">
      <FormField 
        label="First Name" 
        issues={signUp.fields.firstName.issues()}
      >
        <FormInput field={signUp.fields.firstName} placeholder="Ada" />
      </FormField>

      <FormField 
        label="Last Name" 
        issues={signUp.fields.lastName.issues()}
      >
        <FormInput field={signUp.fields.lastName} placeholder="Lovelace" />
      </FormField>

      <FormField 
        label="Organization Name" 
        issues={signUp.fields.organizationName.issues()}
      >
        <FormInput field={signUp.fields.organizationName} placeholder="My Workspace" />
      </FormField>

      <FormField 
        label="Email" 
        issues={signUp.fields.email.issues()}
      >
        <FormInput field={signUp.fields.email} type="email" placeholder="you@example.com" />
      </FormField>

      <FormField 
        label="Password" 
        issues={signUp.fields.password.issues()}
      >
        <FormInput field={signUp.fields.password} type="password" placeholder="••••••••" />
      </FormField>

      {#if turnstileEnabled}
        <div class="turnstile-wrap">
          <div
            class="cf-turnstile"
            data-sitekey={turnstile.siteKey}
            data-action={turnstileAction}
          ></div>
        </div>
      {/if}
      
      <Button
        type="submit"
        variant="primary"
        class="auth-submit"
        disabled={!!signUp.pending}
        aria-busy={!!signUp.pending}
      >
        {#if signUp.pending}
          <Loading size="sm" /> Creating account...
        {:else}
          Create account
        {/if}
      </Button>

      {#if signUp.result?.success}
        <p class="kui-subtext success">Account created! Redirecting…</p>
      {/if}
    </form>

    <div class="auth-footer">
      <p class="kui-subtext">
        Already have an account?
        <a href="/auth/signin">Sign in</a>
      </p>
    </div>
  </Card>
</div>

<style>
  .auth-page {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 16px;
    background: linear-gradient(135deg, #f8fafc, #e5e7eb);
  }

  .auth-card {
    width: min(480px, 100%);
    display: grid;
    gap: 14px;
    padding: 18px;
  }

  .auth-header h1 {
    margin: 0;
  }

  .auth-oauth {
    display: grid;
    gap: 8px;
  }

  .auth-oauth__btn {
    justify-content: center;
    gap: 8px;
  }

  .auth-oauth__icon {
    width: 16px;
    height: 16px;
  }

  .auth-divider {
    text-align: center;
    color: #6b7280;
    font-size: 13px;
    position: relative;
  }

  .auth-divider::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 1px;
    background: #e5e7eb;
    z-index: 0;
  }

  .auth-divider span {
    position: relative;
    padding: 0 8px;
    background: white;
    z-index: 1;
  }

  .auth-form {
    display: grid;
    gap: 12px;
  }

  .auth-submit {
    width: 100%;
    justify-content: center;
  }

  .auth-footer {
    text-align: center;
  }

  .auth-footer a {
    font-weight: 600;
  }

  .turnstile-wrap {
    display: flex;
    justify-content: center;
  }

  .success {
    color: #16a34a;
  }
</style>
