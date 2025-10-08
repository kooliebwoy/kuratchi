<script lang="ts">
  import { goto } from '$app/navigation';
  import { createOrganization } from '../remote';
  
  let confirmPassword = $state('');
  let clientError = $state('');
  
  function validatePasswordMatch(e: Event) {
    const form = e.target as HTMLFormElement;
    const password = form.password.value;
    const confirm = form.confirmPassword.value;
    
    if (password !== confirm) {
      clientError = 'Passwords do not match';
      e.preventDefault();
      return false;
    }
    clientError = '';
    return true;
  }
  
  $effect(() => {
    if (createOrganization.result?.success) {
      setTimeout(() => goto('/auth/start'), 2000);
    }
  });
</script>

<svelte:head>
  <title>Sign Up - Kuratchi Dashboard</title>
</svelte:head>

<div class="min-h-screen bg-base-200 flex items-center justify-center p-4">
  <div class="card w-full max-w-md bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title text-2xl font-bold mb-2">Create Your Organization</h2>
      <p class="text-sm text-base-content/70 mb-6">
        Get started with Kuratchi in seconds
      </p>
      
      {#if createOrganization.result?.success}
        <div class="alert alert-success">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>Organization created! Redirecting to login...</span>
        </div>
      {/if}
      
      {#if clientError}
        <div class="alert alert-error">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{clientError}</span>
        </div>
      {/if}
      
      <form {...createOrganization} onsubmit={validatePasswordMatch} class="space-y-4">
        <!-- Organization Name -->
        <div class="form-control">
          <label class="label" for="orgName">
            <span class="label-text">Organization Name *</span>
          </label>
          <input
            id="orgName"
            name="organizationName"
            type="text"
            placeholder="Acme Corp"
            class="input input-bordered"
            disabled={createOrganization.pending > 0 || createOrganization.result?.success}
            required
          />
        </div>
        
        <!-- Your Name -->
        <div class="form-control">
          <label class="label" for="userName">
            <span class="label-text">Your Name</span>
          </label>
          <input
            id="userName"
            name="userName"
            type="text"
            placeholder="John Doe"
            class="input input-bordered"
            disabled={createOrganization.pending > 0 || createOrganization.result?.success}
          />
        </div>
        
        <!-- Email -->
        <div class="form-control">
          <label class="label" for="email">
            <span class="label-text">Email *</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="you@company.com"
            class="input input-bordered"
            disabled={createOrganization.pending > 0 || createOrganization.result?.success}
            required
          />
        </div>
        
        <!-- Password -->
        <div class="form-control">
          <label class="label" for="password">
            <span class="label-text">Password *</span>
          </label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            class="input input-bordered"
            minlength="8"
            disabled={createOrganization.pending > 0 || createOrganization.result?.success}
            required
          />
          <label class="label">
            <span class="label-text-alt">Minimum 8 characters</span>
          </label>
        </div>
        
        <!-- Confirm Password -->
        <div class="form-control">
          <label class="label" for="confirmPassword">
            <span class="label-text">Confirm Password *</span>
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="••••••••"
            class="input input-bordered"
            bind:value={confirmPassword}
            disabled={createOrganization.pending > 0 || createOrganization.result?.success}
            required
          />
        </div>
        
        <!-- Submit Button -->
        <div class="form-control mt-6">
          <button
            type="submit"
            class="btn btn-primary"
            disabled={createOrganization.pending > 0 || createOrganization.result?.success}
          >
            {#if createOrganization.pending > 0}
              <span class="loading loading-spinner"></span>
              Creating Organization...
            {:else if createOrganization.result?.success}
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
          <a href="/auth/start" class="link link-primary">Sign in</a>
        </p>
      </div>
    </div>
  </div>
</div>
