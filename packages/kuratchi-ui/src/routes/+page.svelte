<script lang="ts">
  import { LoginForm, SignupForm, LogoutButton, Dialog } from '$lib';
  
  let loading = $state(false);
  let error = $state('');
  let dialogOpen = $state(false);
  
  function handleCredentialsSubmit(e: SubmitEvent) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement | null;
    if (!form) return;
    const formData = new FormData(form);
    console.log('Credentials:', {
      email: formData.get('email'),
      password: formData.get('password')
    });
    alert('Check console for form data');
  }
  
  function handleMagicLinkSubmit(e: SubmitEvent) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement | null;
    if (!form) return;
    const formData = new FormData(form);
    console.log('Magic link:', { email: formData.get('email') });
    alert('Check console for email');
  }
  
  function handleOAuthClick(provider: string) {
    console.log('OAuth provider:', provider);
    alert(`OAuth: ${provider}`);
  }
  
  function handleLogout() {
    console.log('Logout clicked');
    alert('Logout clicked - wire your logic here!');
  }
  
  function handleDialogSubmit(e: SubmitEvent) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement | null;
    if (!form) return;
    const formData = new FormData(form);
    console.log('Dialog form:', {
      name: formData.get('name'),
      description: formData.get('description')
    });
    dialogOpen = false;
  }
</script>

<div class="kui-page">
  <div class="kui-container">
    <div class="kui-page__hero">
      <h1 class="kui-hero-title">Kuratchi UI Components</h1>
      <p class="kui-hero-subtitle">Pure presentational components - you wire the logic.</p>
    </div>
    
    <div class="kui-stack">
      <section class="kui-section">
        <div class="kui-section__body">
          <h2 class="kui-card__title">Login Form Component</h2>
          <p class="kui-helper-text">
            Multi-mode auth form with tabs. Check browser console when submitting.
          </p>
          <div class="kui-demo-center">
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
      
      <section class="kui-section">
        <div class="kui-section__body">
          <h2 class="kui-card__title">Signup Form Component</h2>
          <p class="kui-helper-text">
            Registration form with password confirmation. Check browser console when submitting.
          </p>
          <div class="kui-demo-center">
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
      
      <section class="kui-section">
        <div class="kui-section__body">
          <h2 class="kui-card__title">Logout Button Component</h2>
          <p class="kui-helper-text">
            Styled button with variants and sizes. Wire your logout logic.
          </p>
          <div class="kui-demo-button-row">
            <LogoutButton onclick={handleLogout} />
            <LogoutButton variant="primary" onclick={handleLogout} />
            <LogoutButton variant="error" text="Log Out" onclick={handleLogout} />
            <LogoutButton variant="ghost" size="sm" onclick={handleLogout} />
            <LogoutButton variant="link" size="lg" onclick={handleLogout} />
            <LogoutButton loading={true} text="Loading..." />
          </div>
        </div>
      </section>
      
      <section class="kui-section">
        <div class="kui-section__body">
          <h2 class="kui-card__title">Dialog Component (with Snippets)</h2>
          <p class="kui-helper-text">
            Flexible modal using Svelte 5 snippets. Check console when submitting.
          </p>
          
          <div class="kui-stack">
            <!-- Example 1: Using trigger snippet -->
            <Dialog bind:open={dialogOpen} size="md">
              {#snippet trigger(open: () => void)}
                <button class="kui-button kui-button--primary" onclick={open}>
                  Open Dialog with Snippets
                </button>
              {/snippet}
              
              {#snippet header()}
                <h3 class="kui-card__title">Create New Item</h3>
                <p class="kui-helper-text">Fill out the form below</p>
              {/snippet}
              
              <form onsubmit={handleDialogSubmit}>
                <div class="kui-form-control">
                  <label class="kui-label" for="dialog-name">Name</label>
                  <input
                    id="dialog-name"
                    name="name"
                    type="text"
                    class="kui-input"
                    placeholder="Enter name..."
                    required
                  />
                </div>
                
                <div class="kui-form-control">
                  <label class="kui-label" for="dialog-desc">Description</label>
                  <textarea
                    id="dialog-desc"
                    name="description"
                    class="kui-textarea"
                    placeholder="Enter description..."
                    required
                  ></textarea>
                </div>
                
                {#snippet actions(close: () => void)}
                  <button type="button" class="kui-button kui-button--ghost" onclick={close}>Cancel</button>
                  <button type="submit" class="kui-button kui-button--primary">Create</button>
                {/snippet}
              </form>
            </Dialog>
            
            <!-- Example 2: Manual open/close -->
            <button class="kui-button kui-button--secondary" onclick={() => dialogOpen = true}>
              Open via State Binding
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</div>
