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
      
      <div class="text-center">
        <p class="text-sm text-base-content/70">
          Already have an account?
          <a href="/auth/signin" class="link link-primary">Sign in</a>
        </p>
      </div>
    </div>
  </div>
</div>
