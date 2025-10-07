<script lang="ts">
  import { LoginForm } from '@kuratchi/ui';
  
  let loading = $state(false);
  let error = $state('');
  
  async function handleCredentialsSubmit(e: SubmitEvent) {
    e.preventDefault();
    loading = true;
    error = '';
    
    const formData = new FormData(e.target as HTMLFormElement);
    const email = formData.get('email');
    const password = formData.get('password');
    
    try {
      const response = await fetch('/auth/credentials/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      if (response.ok) {
        window.location.href = '/database';
      } else {
        const result = await response.json();
        error = result.error || 'Login failed';
      }
    } catch (e) {
      error = 'Network error';
    } finally {
      loading = false;
    }
  }
  
  async function handleMagicLinkSubmit(e: SubmitEvent) {
    e.preventDefault();
    loading = true;
    error = '';
    
    const formData = new FormData(e.target as HTMLFormElement);
    const email = formData.get('email');
    
    try {
      const response = await fetch('/auth/magic/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirectTo: '/database' })
      });
      
      if (response.ok) {
        alert('Check your email for the sign-in link!');
      } else {
        error = 'Failed to send magic link';
      }
    } catch (e) {
      error = 'Network error';
    } finally {
      loading = false;
    }
  }
  
  function handleOAuthClick(provider: string) {
    window.location.href = `/auth/oauth/${provider}/start?redirectTo=/database`;
  }
</script>

<svelte:head>
  <title>Sign In - Kuratchi Dashboard</title>
</svelte:head>

<div class="min-h-screen bg-base-200 flex items-center justify-center p-4">
  <LoginForm
    title="Sign In to Kuratchi"
    subtitle="Access your database management console"
    showCredentials={true}
    showMagicLink={true}
    showOAuth={true}
    oauthProviders={[
      { name: 'google', label: 'Continue with Google' },
      { name: 'github', label: 'Continue with GitHub' }
    ]}
    {loading}
    {error}
    onSubmitCredentials={handleCredentialsSubmit}
    onSubmitMagicLink={handleMagicLinkSubmit}
    onOAuthClick={handleOAuthClick}
  >
    {#snippet footer()}
      <div class="text-center">
        <p class="text-sm text-base-content/70">
          Don't have an account?
          <a href="/auth/connect" class="link link-primary">Sign up</a>
        </p>
      </div>
    {/snippet}
  </LoginForm>
</div>
