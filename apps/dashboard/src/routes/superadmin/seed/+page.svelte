<script lang="ts">
  import { createSuperadmin } from './seed.remote';
</script>

<svelte:head>
  <title>Seed Superadmin - Kuratchi Dashboard</title>
</svelte:head>

<div class="min-h-screen bg-base-200 flex items-center justify-center p-4">
  <div class="card w-full max-w-lg bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title text-2xl font-bold">Create Superadmin</h2>
      <p class="text-sm text-base-content/70 mb-4">
        Add a new superadmin user to the admin database
      </p>
      
      {#if createSuperadmin.result?.success}
        <div class="alert alert-success">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div>
            <div class="font-bold">Superadmin created successfully!</div>
            <div class="text-sm">You can now sign in at <a href="/auth/start" class="link">/auth/start</a></div>
          </div>
        </div>
      {/if}
      
      <div class="alert alert-warning mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        <div>
          <div class="font-bold">Security Warning</div>
          <div class="text-xs">Protected by KURATCHI_SUPERADMIN_KEY. Remove this route in production or restrict to internal network.</div>
        </div>
      </div>
      
      <form {...createSuperadmin} class="space-y-4">
          <div class="form-control">
            <label class="label" for="name">
              <span class="label-text">Name</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="Super Admin"
              class="input input-bordered"
              value="Super Admin"
              disabled={createSuperadmin.pending > 0 || createSuperadmin.result?.success}
            />
          </div>
          
          <div class="form-control">
            <label class="label" for="email">
              <span class="label-text">Email</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="admin@kuratchi.dev"
              class="input input-bordered"
              disabled={createSuperadmin.pending > 0 || createSuperadmin.result?.success}
              required
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
              class="input input-bordered"
              minlength="8"
              disabled={createSuperadmin.pending > 0 || createSuperadmin.result?.success}
              required
            />
          </div>
          
          <div class="form-control">
            <label class="label" for="seedKey">
              <span class="label-text">Seed Key</span>
              <span class="label-text-alt">From KURATCHI_SUPERADMIN_KEY env</span>
            </label>
            <input
              id="seedKey"
              name="seedKey"
              type="password"
              placeholder="Your seed key"
              class="input input-bordered"
              disabled={createSuperadmin.pending > 0 || createSuperadmin.result?.success}
              required
            />
          </div>
          
          <div class="form-control mt-6">
            <button
              type="submit"
              class="btn btn-primary"
              disabled={createSuperadmin.pending > 0 || createSuperadmin.result?.success}
            >
              {#if createSuperadmin.pending > 0}
                <span class="loading loading-spinner"></span>
                Creating Superadmin...
              {:else if createSuperadmin.result?.success}
                ✓ Created
              {:else}
                Create Superadmin
              {/if}
            </button>
          </div>
        </form>
      
      <div class="divider"></div>
      
      <div class="prose prose-sm max-w-none">
        <h3 class="text-sm font-bold">About Superadmins:</h3>
        <ul class="text-xs space-y-1">
          <li>Created in the <strong>admin database</strong> with <code>role='superadmin'</code></li>
          <li>Can sign in and access all organizations</li>
          <li>Perfect for support teams and platform administrators</li>
          <li>You can create multiple superadmins as needed</li>
        </ul>
      </div>
      
      <div class="text-center mt-4">
        <a href="/auth/start" class="link link-primary text-sm">Go to Sign In</a>
      </div>
    </div>
  </div>
</div>
