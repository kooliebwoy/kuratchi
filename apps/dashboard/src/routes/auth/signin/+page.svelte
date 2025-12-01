<script lang="ts">
  import { signInWithCredentials, acceptInvite, getUserOrganizations } from '$lib/functions/auth.remote';
  import { Button, Card, FormField, FormInput, FormSelect, Loading } from '@kuratchi/ui';
  import { goto } from '$app/navigation';
  import { LogIn, Building2, Mail, AlertCircle, CheckCircle, Users } from '@lucide/svelte';
  import { page } from '$app/state';

  const { data } = $props();
  const turnstile = data.turnstile;
  const invite = data.invite;
  const turnstileEnabled = !!turnstile?.siteKey && !turnstile?.devDisabled && turnstile?.enabled !== false;
  const turnstileScriptUrl = turnstile?.scriptUrl || 'https://challenges.cloudflare.com/turnstile/v0/api.js';
  const turnstileAction = 'dashboard-signin';
  
  // Multi-org state
  let showOrgSelector = $state(false);
  let selectedOrgId = $state('');
  let userOrgs = $state<any[]>([]);
  let checkingOrgs = $state(false);
  let emailForOrgCheck = $state('');
  
  // Invite acceptance state
  let invitePassword = $state('');
  let acceptingInvite = $state(false);
  let inviteAccepted = $state(false);
  
  $effect(() => {
    if (signInWithCredentials.result?.success) {
      goto('/');
    }
  });
  
  $effect(() => {
    if (acceptInvite.result?.success) {
      inviteAccepted = true;
      if (acceptInvite.result.signedIn) {
        // Auto-redirect after a moment
        setTimeout(() => goto('/'), 1500);
      }
    }
  });
  
  // Check for multi-org when email is entered
  async function checkUserOrganizations(email: string) {
    if (!email || email === emailForOrgCheck) return;
    emailForOrgCheck = email;
    checkingOrgs = true;
    showOrgSelector = false;
    userOrgs = [];
    
    try {
      const formData = new FormData();
      formData.set('email', email);
      
      const response = await fetch('?/checkOrganizations', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      const data = result?.data;
      
      if (data?.hasMultiple && data?.organizations?.length > 1) {
        userOrgs = data.organizations;
        showOrgSelector = true;
      }
    } catch (e) {
      console.error('Failed to check organizations:', e);
    } finally {
      checkingOrgs = false;
    }
  }
  
  // Debounced email check
  let emailCheckTimeout: ReturnType<typeof setTimeout>;
  function handleEmailBlur(event: FocusEvent) {
    const input = event.target as HTMLInputElement;
    clearTimeout(emailCheckTimeout);
    emailCheckTimeout = setTimeout(() => {
      checkUserOrganizations(input.value);
    }, 300);
  }
  
  function handleOAuthClick(provider: string) {
    // Include invite context in OAuth redirect if present
    let redirectTo = '/database';
    if (invite?.valid) {
      redirectTo = `/?invite_accepted=true&org=${invite.organizationId}`;
    }
    
    const params = new URLSearchParams({ redirectTo });
    if (invite?.valid) {
      params.set('invite', invite.token);
      params.set('org', invite.organizationId);
    }
    
    window.location.href = `/auth/oauth/${provider}/start?${params.toString()}`;
  }
  
  function handleAcceptInvite() {
    acceptingInvite = true;
  }
</script>

<svelte:head>
  <title>Sign In - Kuratchi Dashboard</title>
  {#if turnstileEnabled}
    <script src={turnstileScriptUrl} async defer></script>
  {/if}
</svelte:head>

<div class="auth-page">
  <Card class="auth-card">
    {#if invite?.valid && !inviteAccepted}
      <!-- Invite Banner -->
      <div class="invite-banner">
        <Mail class="invite-banner__icon" />
        <div>
          <p class="invite-banner__title">You're invited to join <strong>{invite.organizationName}</strong></p>
          <p class="invite-banner__subtitle">Sign in or create an account to accept the invitation as <strong>{invite.role}</strong>.</p>
        </div>
      </div>
    {:else if invite?.expired}
      <div class="invite-banner invite-banner--error">
        <AlertCircle class="invite-banner__icon" />
        <div>
          <p class="invite-banner__title">Invitation expired</p>
          <p class="invite-banner__subtitle">This invitation has expired. Please contact the organization admin for a new one.</p>
        </div>
      </div>
    {:else if invite && !invite.valid}
      <div class="invite-banner invite-banner--error">
        <AlertCircle class="invite-banner__icon" />
        <div>
          <p class="invite-banner__title">Invalid invitation</p>
          <p class="invite-banner__subtitle">This invitation link is invalid or has already been used.</p>
        </div>
      </div>
    {:else if inviteAccepted}
      <div class="invite-banner invite-banner--success">
        <CheckCircle class="invite-banner__icon" />
        <div>
          <p class="invite-banner__title">Invitation accepted!</p>
          <p class="invite-banner__subtitle">
            {#if acceptInvite.result?.signedIn}
              Redirecting to dashboard...
            {:else}
              Please sign in to continue.
            {/if}
          </p>
        </div>
      </div>
    {/if}

    <div class="auth-header">
      <div>
        <p class="kui-eyebrow">Welcome back</p>
        <h1>{invite?.valid ? 'Accept Invitation' : 'Sign in to Kuratchi'}</h1>
        <p class="kui-subtext">
          {#if invite?.valid}
            Sign in with your existing account or use OAuth to join {invite.organizationName}.
          {:else}
            Access your dashboard and databases.
          {/if}
        </p>
      </div>
      <LogIn class="kui-icon-lg" />
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
    
    {#if invite?.valid && !inviteAccepted}
      <!-- Accept invite with optional password setup -->
      <form {...acceptInvite} class="auth-form">
        <input type="hidden" name="inviteToken" value={invite.token} />
        <input type="hidden" name="organizationId" value={invite.organizationId} />
        
        <div class="invite-info">
          <p><strong>Email:</strong> {invite.email}</p>
          <p><strong>Name:</strong> {invite.name}</p>
        </div>
        
        <FormField 
          label="Set Password (Optional)" 
          issues={acceptInvite.fields.password?.issues?.()}
          hint="Set a password to sign in with email, or use OAuth above"
        >
          <FormInput 
            field={acceptInvite.fields.password}
            type="password"
            placeholder="••••••••"
          />
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
          disabled={!!acceptInvite.pending}
        >
          {#if acceptInvite.pending}
            <Loading size="sm" /> Accepting...
          {:else}
            Accept Invitation
          {/if}
        </Button>
      </form>
    {:else}
      <!-- Normal sign in form -->
      <form {...signInWithCredentials} class="auth-form">
        <FormField 
          label="Email" 
          issues={signInWithCredentials.fields.email.issues()}
        >
          <FormInput 
            field={signInWithCredentials.fields.email} 
            type="email"
            placeholder="you@example.com"
            onblur={handleEmailBlur}
          />
        </FormField>

        {#if showOrgSelector && userOrgs.length > 1}
          <!-- Multi-org selector -->
          <div class="org-selector">
            <div class="org-selector__header">
              <Building2 class="org-selector__icon" />
              <div>
                <p class="org-selector__title">Multiple organizations found</p>
                <p class="org-selector__subtitle">Select which organization to sign into:</p>
              </div>
            </div>
            <div class="org-selector__list">
              {#each userOrgs as org}
                <label class="org-selector__item">
                  <input 
                    type="radio" 
                    name="organizationId" 
                    value={org.id}
                    bind:group={selectedOrgId}
                    class="org-selector__radio"
                  />
                  <div class="org-selector__info">
                    <span class="org-selector__name">{org.name}</span>
                    {#if org.slug}
                      <span class="org-selector__slug">{org.slug}</span>
                    {/if}
                  </div>
                </label>
              {/each}
            </div>
          </div>
        {/if}

        <FormField 
          label="Password" 
          issues={signInWithCredentials.fields.password.issues()}
        >
          <FormInput 
            field={signInWithCredentials.fields.password}
            type="password"
            placeholder="••••••••"
          />
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
          disabled={!!signInWithCredentials.pending || (showOrgSelector && !selectedOrgId)}
        >
          {#if signInWithCredentials.pending}
            <Loading size="sm" /> Signing in...
          {:else if checkingOrgs}
            <Loading size="sm" /> Checking...
          {:else}
            Sign In
          {/if}
        </Button>
      </form>
    {/if}

    <div class="auth-footer">
      <p class="kui-subtext">
        Don't have an account?
        <a href="/auth/signup">Sign up</a>
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
    width: min(440px, 100%);
    display: grid;
    gap: 14px;
    padding: 18px;
  }

  .auth-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  h1 {
    margin: 0;
  }

  .kui-icon-lg {
    width: 28px;
    height: 28px;
    color: #4338ca;
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

  /* Invite Banner Styles */
  .invite-banner {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px;
    border-radius: 8px;
    background: linear-gradient(135deg, #dbeafe, #ede9fe);
    border: 1px solid #93c5fd;
  }

  .invite-banner__icon {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    color: #3b82f6;
  }

  .invite-banner__title {
    margin: 0 0 4px;
    font-weight: 600;
    color: #1e40af;
  }

  .invite-banner__subtitle {
    margin: 0;
    font-size: 13px;
    color: #3730a3;
  }

  .invite-banner--error {
    background: linear-gradient(135deg, #fee2e2, #fef2f2);
    border-color: #fca5a5;
  }

  .invite-banner--error .invite-banner__icon {
    color: #dc2626;
  }

  .invite-banner--error .invite-banner__title {
    color: #991b1b;
  }

  .invite-banner--error .invite-banner__subtitle {
    color: #b91c1c;
  }

  .invite-banner--success {
    background: linear-gradient(135deg, #dcfce7, #f0fdf4);
    border-color: #86efac;
  }

  .invite-banner--success .invite-banner__icon {
    color: #16a34a;
  }

  .invite-banner--success .invite-banner__title {
    color: #166534;
  }

  .invite-banner--success .invite-banner__subtitle {
    color: #15803d;
  }

  .invite-info {
    padding: 12px;
    background: #f8fafc;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
  }

  .invite-info p {
    margin: 0;
    font-size: 14px;
    color: #475569;
  }

  .invite-info p + p {
    margin-top: 4px;
  }

  /* Organization Selector Styles */
  .org-selector {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
    background: #f8fafc;
  }

  .org-selector__header {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px;
    background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
    border-bottom: 1px solid #e2e8f0;
  }

  .org-selector__icon {
    width: 20px;
    height: 20px;
    color: #0284c7;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .org-selector__title {
    margin: 0;
    font-weight: 600;
    font-size: 14px;
    color: #0c4a6e;
  }

  .org-selector__subtitle {
    margin: 2px 0 0;
    font-size: 12px;
    color: #0369a1;
  }

  .org-selector__list {
    display: grid;
    gap: 1px;
    background: #e2e8f0;
  }

  .org-selector__item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: white;
    cursor: pointer;
    transition: background 0.15s;
  }

  .org-selector__item:hover {
    background: #f1f5f9;
  }

  .org-selector__item:has(:checked) {
    background: #eff6ff;
  }

  .org-selector__radio {
    width: 16px;
    height: 16px;
    accent-color: #3b82f6;
  }

  .org-selector__info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .org-selector__name {
    font-weight: 500;
    font-size: 14px;
    color: #1e293b;
  }

  .org-selector__slug {
    font-size: 12px;
    color: #64748b;
  }
</style>
