<script>
  import { LoginForm, SignupForm, LogoutButton, Dialog } from '$lib';
  
  let loading = $state(false);
  let error = $state('');
  let dialogOpen = $state(false);
  
  function handleCredentialsSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    console.log('Credentials:', {
      email: formData.get('email'),
      password: formData.get('password')
    });
    alert('Check console for form data');
  }
  
  function handleMagicLinkSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    console.log('Magic link:', { email: formData.get('email') });
    alert('Check console for email');
  }
  
  function handleOAuthClick(provider) {
    console.log('OAuth provider:', provider);
    alert(`OAuth: ${provider}`);
  }
  
  function handleLogout() {
    console.log('Logout clicked');
    alert('Logout clicked - wire your logic here!');
  }
  
  function handleDialogSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    console.log('Dialog form:', {
      name: formData.get('name'),
      description: formData.get('description')
    });
    dialogOpen = false;
  }
</script>

<div class="min-h-screen bg-base-200 p-8">
  <div class="container mx-auto">
    <div class="mb-8">
      <h1 class="text-4xl font-bold">Kuratchi UI Components</h1>
      <p class="text-base-content/70 mt-2">Pure presentational components - you wire the logic!</p>
    </div>
    
    <div class="grid gap-8">
      <section class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title">Login Form Component</h2>
          <p class="text-sm text-base-content/70 mb-4">
            Multi-mode auth form with tabs. Check browser console when submitting.
          </p>
          <div class="flex justify-center p-8">
            <LoginForm
              showCredentials={true}
              showMagicLink={true}
              showOAuth={true}
              {loading}
              {error}
              onSubmitCredentials={handleCredentialsSubmit}
              onSubmitMagicLink={handleMagicLinkSubmit}
              onOAuthClick={handleOAuthClick}
            />
          </div>
        </div>
      </section>
      
      <section class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title">Signup Form Component</h2>
          <p class="text-sm text-base-content/70 mb-4">
            Registration form with password confirmation. Check browser console when submitting.
          </p>
          <div class="flex justify-center p-8">
            <SignupForm
              showOAuth={true}
              {loading}
              {error}
              onSubmit={handleCredentialsSubmit}
              onOAuthClick={handleOAuthClick}
            />
          </div>
        </div>
      </section>
      
      <section class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title">Logout Button Component</h2>
          <p class="text-sm text-base-content/70 mb-4">
            Styled button with variants and sizes. Wire your logout logic.
          </p>
          <div class="flex gap-4 flex-wrap">
            <LogoutButton onclick={handleLogout} />
            <LogoutButton variant="primary" onclick={handleLogout} />
            <LogoutButton variant="error" text="Log Out" onclick={handleLogout} />
            <LogoutButton variant="ghost" size="sm" onclick={handleLogout} />
            <LogoutButton variant="link" size="lg" onclick={handleLogout} />
            <LogoutButton loading={true} text="Loading..." />
          </div>
        </div>
      </section>
      
      <section class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title">Dialog Component (with Snippets)</h2>
          <p class="text-sm text-base-content/70 mb-4">
            Flexible modal using Svelte 5 snippets. Check console when submitting.
          </p>
          
          <div class="space-y-4">
            <!-- Example 1: Using trigger snippet -->
            <Dialog bind:open={dialogOpen} size="md">
              {#snippet trigger(open)}
                <button class="btn btn-primary" onclick={open}>
                  Open Dialog with Snippets
                </button>
              {/snippet}
              
              {#snippet header()}
                <h3 class="text-lg font-bold">Create New Item</h3>
                <p class="text-sm text-base-content/70">Fill out the form below</p>
              {/snippet}
              
              <form onsubmit={handleDialogSubmit}>
                <div class="form-control mb-4">
                  <label class="label" for="dialog-name">
                    <span class="label-text">Name</span>
                  </label>
                  <input
                    id="dialog-name"
                    name="name"
                    type="text"
                    class="input input-bordered"
                    placeholder="Enter name..."
                    required
                  />
                </div>
                
                <div class="form-control">
                  <label class="label" for="dialog-desc">
                    <span class="label-text">Description</span>
                  </label>
                  <textarea
                    id="dialog-desc"
                    name="description"
                    class="textarea textarea-bordered"
                    placeholder="Enter description..."
                    required
                  ></textarea>
                </div>
                
                {#snippet actions(close)}
                  <button type="button" class="btn" onclick={close}>Cancel</button>
                  <button type="submit" class="btn btn-primary">Create</button>
                {/snippet}
              </form>
            </Dialog>
            
            <!-- Example 2: Manual open/close -->
            <button class="btn btn-secondary" onclick={() => dialogOpen = true}>
              Open via State Binding
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</div>
