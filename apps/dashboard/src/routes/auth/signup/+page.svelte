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

<div class="min-h-screen bg-gradient-to-br from-base-100 to-base-200 flex items-center justify-center p-4">
  <div class="w-full max-w-md">
    <!-- Card with subtle border and shadow -->
    <div class="rounded-lg border border-base-300 bg-base-100 shadow-lg overflow-hidden">
      <div class="px-6 py-8">
        <!-- Header -->
        <div class="mb-6">
          <h1 class="text-2xl font-bold tracking-tight">Create Your Organization</h1>
          <p class="text-sm text-base-content/60 mt-2">Get started with Kuratchi in seconds</p>
        </div>

        {#if signUp.result?.success}
          <div class="mb-6 p-4 rounded-md bg-green-50 border border-green-200">
            <div class="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
              <span class="text-sm text-green-700">Organization created! Redirecting to login...</span>
            </div>
          </div>
        {/if}
        
        <!-- OAuth Buttons -->
        <div class="space-y-2 mb-6">
          <button
            type="button"
            class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-base-300 bg-base-100 hover:bg-base-200/50 transition-colors text-sm font-medium"
            onclick={() => handleOAuthClick('google')}
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <button
            type="button"
            class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-base-300 bg-base-100 hover:bg-base-200/50 transition-colors text-sm font-medium"
            onclick={() => handleOAuthClick('github')}
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            Continue with GitHub
          </button>
        </div>

        <!-- Divider -->
        <div class="relative mb-6">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-base-300"></div>
          </div>
          <div class="relative flex justify-center text-xs">
            <span class="px-2 bg-base-100 text-base-content/50">Or continue with email</span>
          </div>
        </div>
        
        <!-- Form -->
        <form {...signUp} class="space-y-4">
          <FormField 
            label="Organization Name *" 
            issues={signUp.fields.organizationName.issues()}
          >
            <FormInput 
              field={signUp.fields.organizationName}
              placeholder="Acme Corp"
              class="w-full rounded-md border border-base-300 bg-base-100 px-3 py-2 text-sm placeholder:text-base-content/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
              class="w-full rounded-md border border-base-300 bg-base-100 px-3 py-2 text-sm placeholder:text-base-content/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
              class="w-full rounded-md border border-base-300 bg-base-100 px-3 py-2 text-sm placeholder:text-base-content/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
              class="w-full rounded-md border border-base-300 bg-base-100 px-3 py-2 text-sm placeholder:text-base-content/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </FormField>
          
          <button
            type="submit"
            class="w-full px-4 py-2 rounded-md bg-base-content text-base-100 text-sm font-medium hover:bg-base-content/90 transition-colors mt-6"
            aria-busy={!!signUp.pending}
            disabled={!!signUp.pending || !!signUp.result?.success}
          >
            {#if signUp.pending}
              <span class="loading loading-spinner loading-sm"></span>
              Creating Organization...
            {:else if signUp.result?.success}
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
              Success!
            {:else}
              Create Organization
            {/if}
          </button>
        </form>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-base-300 bg-base-200/30 text-center">
        <p class="text-sm text-base-content/70">
          Already have an account?
          <a href="/auth/signin" class="font-medium text-base-content hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  </div>
</div>
