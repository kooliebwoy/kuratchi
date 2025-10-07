<script lang="ts">
  import { SignupForm } from '@kuratchi/ui';
  
  let loading = $state(false);
  let error = $state('');
  
  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    loading = true;
    error = '';
    
    const formData = new FormData(e.target as HTMLFormElement);
    const name = formData.get('name');
    const email = formData.get('email');
    const password = formData.get('password');
    const passwordConfirm = formData.get('passwordConfirm');
    
    // Client-side validation
    if (password !== passwordConfirm) {
      error = 'Passwords do not match';
      loading = false;
      return;
    }
    
    try {
      const response = await fetch('/auth/credentials/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      
      if (response.ok) {
        // Redirect to dashboard or login
        window.location.href = '/database';
      } else {
        const result = await response.json();
        error = result.error || 'Sign up failed';
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
  <title>Sign Up - Kuratchi Dashboard</title>
</svelte:head>

<div class="min-h-screen bg-base-200 flex items-center justify-center p-4">
  <SignupForm
    title="Create Your Account"
    subtitle="Join Kuratchi and start managing your databases"
    showOAuth={true}
    oauthProviders={[
      { name: 'google', label: 'Sign up with Google' },
      { name: 'github', label: 'Sign up with GitHub' }
    ]}
    {loading}
    {error}
    onSubmit={handleSubmit}
    onOAuthClick={handleOAuthClick}
  >
    {#snippet footer()}
      <div class="text-center">
        <p class="text-sm text-base-content/70">
          Already have an account?
          <a href="/auth/start" class="link link-primary">Sign in</a>
        </p>
      </div>
    {/snippet}
  </SignupForm>
</div>
