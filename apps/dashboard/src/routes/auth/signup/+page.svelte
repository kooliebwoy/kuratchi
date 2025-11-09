<script lang="ts">
  import { goto } from '$app/navigation';
	import { signUp } from '$lib/api/auth.remote';
  import { FormField, FormInput } from '@kuratchi/ui';
  import { Building2 } from 'lucide-svelte';
  
  // Redirect to signin after successful signup
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
</svelte:head>

<div class="min-h-screen bg-base-200 flex items-center justify-center p-4">
  <div class="card w-full max-w-md bg-base-100 shadow-xl">
    <div class="card-body">
      <!-- Header with icon -->
      <div class="flex items-center gap-3 mb-2">
        <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Building2 class="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 class="text-2xl font-bold">Create Your Organization</h2>
        </div>
      </div>
      <p class="text-sm text-base-content/70 mb-6">
        Get started with Kuratchi in seconds
      </p>
      
      {#if signUp.result?.success}
        <div class="alert alert-success">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>Organization created! Redirecting to login...</span>
        </div>
      {/if}
      
      <form {...signUp} class="space-y-4">
        <FormField 
          label="Organization Name *" 
          issues={signUp.fields.organizationName.issues()}
        >
          <FormInput 
            field={signUp.fields.organizationName}
            placeholder="Acme Corp"
          />
        </FormField>
        
        <FormField 
          label="Your Name" 
          issues={signUp.fields.userName.issues()}
          hint="Optional - defaults to organization name"
        >
          <FormInput 
            field={signUp.fields.userName}
            placeholder="John Doe"
          />
        </FormField>
        
        <FormField 
          label="Email *" 
          issues={signUp.fields.email.issues()}
        >
          <FormInput 
            field={signUp.fields.email}
            type="email"
            placeholder="you@company.com"
          />
        </FormField>
        
        <FormField 
          label="Password *" 
          issues={signUp.fields.password.issues()}
          hint="Minimum 8 characters"
        >
          <FormInput 
            field={signUp.fields.password}
            type="password"
            placeholder="••••••••"
          />
        </FormField>
        
        <div class="form-control mt-6">
          <button
            type="submit"
            class="btn btn-primary w-full"
            aria-busy={!!signUp.pending}
            disabled={!!signUp.pending || !!signUp.result?.success}
          >
            {#if signUp.pending}
              <span class="loading loading-spinner"></span>
              Creating Organization...
            {:else if signUp.result?.success}
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
              Success!
            {:else}
              Create Organization
            {/if}
          </button>
        </div>
      </form>
      
      <div class="divider">OR</div>
      
      <!-- OAuth -->
      <div class="space-y-2">
        <button
          type="button"
          class="btn btn-outline w-full"
          onclick={() => handleOAuthClick('google')}
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>
      </div>
      
      <div class="divider"></div>
      
      <div class="text-center">
        <p class="text-sm text-base-content/70">
          Already have an account?
          <a href="/auth/signin" class="link link-primary">Sign in</a>
        </p>
      </div>
    </div>
  </div>
</div>
