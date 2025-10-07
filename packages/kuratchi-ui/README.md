# @kuratchi/ui

Reusable UI component library for Kuratchi, built with Svelte 5, Tailwind CSS 4, and DaisyUI.

## Installation

```bash
pnpm add @kuratchi/ui
```

## Setup

### 1. Add Tailwind CSS 4 plugin to Vite

In your `vite.config.ts`:

```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()]
});
```

### 2. Import styles

In your app's root layout or CSS file:

```css
/* src/app.css */
@import "tailwindcss";
@plugin "daisyui";

@theme {
  /* Your custom theme tokens here */
}
```

**Note:** Tailwind CSS 4 uses CSS-based configuration. No separate `tailwind.config.ts` file is needed!

## Components

### Auth Components

#### LoginForm

A flexible, styled login form supporting multiple authentication methods. **Pure presentational component** - you wire up the logic.

```svelte
<script>
  import { LoginForm } from '@kuratchi/ui';
  
  async function handleCredentialsSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');
    
    // Your login logic here
    const res = await fetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    
    if (res.ok) {
      window.location.href = '/dashboard';
    }
  }
  
  function handleOAuthClick(provider) {
    window.location.href = `/auth/oauth/${provider}/start`;
  }
</script>

<LoginForm
  title="Sign In"
  subtitle="Welcome back!"
  showCredentials={true}
  showMagicLink={false}
  showOAuth={true}
  oauthProviders={[
    { name: 'google', label: 'Sign in with Google' },
    { name: 'github', label: 'Sign in with GitHub' }
  ]}
  onSubmitCredentials={handleCredentialsSubmit}
  onOAuthClick={handleOAuthClick}
/>
```

**Props:**
- `title` (string): Form title (default: "Sign In")
- `subtitle` (string): Form subtitle
- `loading` (boolean): Show loading state and disable inputs
- `error` (string): Error message to display
- `showMagicLink` (boolean): Show magic link tab
- `showCredentials` (boolean): Show email/password form (default: true)
- `showOAuth` (boolean): Show OAuth buttons
- `oauthProviders` (array): List of OAuth providers `[{ name, label }]`
- `onSubmitCredentials` (function): Credentials form submit handler `(e: SubmitEvent) => void`
- `onSubmitMagicLink` (function): Magic link form submit handler `(e: SubmitEvent) => void`
- `onOAuthClick` (function): OAuth button click handler `(provider: string) => void`

**Note:** Form fields use `name="email"` and `name="password"` - use `FormData` to extract values.

#### SignupForm

A registration form with password confirmation. **Pure presentational component** - you wire up the logic.

```svelte
<script>
  import { SignupForm } from '@kuratchi/ui';
  
  async function handleSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const name = formData.get('name');
    const email = formData.get('email');
    const password = formData.get('password');
    const passwordConfirm = formData.get('passwordConfirm');
    
    // Validate passwords match
    if (password !== passwordConfirm) {
      alert('Passwords do not match');
      return;
    }
    
    // Your signup logic here
    const res = await fetch('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    
    if (res.ok) {
      window.location.href = '/dashboard';
    }
  }
  
  function handleOAuthClick(provider) {
    window.location.href = `/auth/oauth/${provider}/start`;
  }
</script>

<SignupForm
  title="Create Account"
  subtitle="Sign up to get started"
  showOAuth={true}
  oauthProviders={[
    { name: 'google', label: 'Sign up with Google' },
    { name: 'github', label: 'Sign up with GitHub' }
  ]}
  onSubmit={handleSubmit}
  onOAuthClick={handleOAuthClick}
/>
```

**Props:**
- `title` (string | Snippet): Form title (default: "Create Account")
- `subtitle` (string | Snippet): Form subtitle
- `loading` (boolean): Show loading state and disable inputs
- `error` (string): Error message to display
- `showOAuth` (boolean): Show OAuth buttons
- `oauthProviders` (array): List of OAuth providers `[{ name, label }]`
- `onSubmit` (function): Form submit handler `(e: SubmitEvent) => void`
- `onOAuthClick` (function): OAuth button click handler `(provider: string) => void`
- `footer` (Snippet): Custom footer content

**Note:** Form fields use `name="name"`, `name="email"`, `name="password"`, and `name="passwordConfirm"` - use `FormData` to extract values.

#### LogoutButton

A styled button with loading state. **Pure presentational component** - you wire up the logic.

```svelte
<script>
  import { LogoutButton } from '@kuratchi/ui';
  
  async function handleLogout() {
    await fetch('/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }
</script>

<LogoutButton
  text="Sign Out"
  variant="ghost"
  size="md"
  onclick={handleLogout}
/>
```

**Props:**
- `text` (string): Button text (default: "Sign Out")
- `variant` (string): DaisyUI button variant (primary, secondary, accent, ghost, link, error)
- `size` (string): Button size (xs, sm, md, lg)
- `loading` (boolean): Show loading spinner and disable button
- `class` (string): Additional CSS classes
- `onclick` (function): Click handler `(e: MouseEvent) => void`

### Feedback Components

#### Dialog

A flexible modal component using **Svelte 5 snippets** for maximum customization. Pure presentational - you control the state and logic.

```svelte
<script>
  import { Dialog } from '@kuratchi/ui';
  
  let open = $state(false);
  
  function handleSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    // Your logic here
    open = false; // Close dialog
  }
</script>

<Dialog bind:open size="md">
  {#snippet trigger(openFn)}
    <button class="btn btn-primary" onclick={openFn}>
      Create New
    </button>
  {/snippet}
  
  {#snippet header()}
    <h3 class="text-lg font-bold">Create Item</h3>
    <p class="text-sm opacity-70">Fill out the form</p>
  {/snippet}
  
  <form onsubmit={handleSubmit}>
    <div class="form-control">
      <label class="label" for="name">
        <span class="label-text">Name</span>
      </label>
      <input id="name" name="name" type="text" class="input input-bordered" required />
    </div>
    
    {#snippet actions(close)}
      <button type="button" class="btn" onclick={close}>Cancel</button>
      <button type="submit" class="btn btn-primary">Create</button>
    {/snippet}
  </form>
</Dialog>
```

**Props:**
- `id` (string): Dialog element ID (auto-generated by default)
- `open` (boolean, bindable): Dialog open state - use `bind:open={myState}`
- `size` (string): Dialog size (sm, md, lg, xl, full) - default: md
- `class` (string): Additional CSS classes for modal-box
- `backdropClass` (string): Additional CSS classes for backdrop
- `onOpen` (function): Called when dialog opens
- `onClose` (function): Called when dialog closes

**Snippets:**
- `trigger` (optional): Snippet for trigger button - receives `open()` function as param
- `header` (optional): Snippet for dialog header content
- `children` (required): Main content of the dialog
- `actions` (optional): Snippet for action buttons - receives `close()` function as param

**Flexible Usage:**
```svelte
<!-- Option 1: Trigger snippet -->
<Dialog>
  {#snippet trigger(open)}
    <button onclick={open}>Open</button>
  {/snippet}
  <p>Content here</p>
</Dialog>

<!-- Option 2: Bind state -->
<button onclick={() => dialogOpen = true}>Open</button>
<Dialog bind:open={dialogOpen}>
  <p>Content here</p>
</Dialog>

<!-- Option 3: With all snippets -->
<Dialog bind:open>
  {#snippet header()}
    <h3>Title</h3>
  {/snippet}
  
  <form><!-- Your form --></form>
  
  {#snippet actions(close)}
    <button onclick={close}>Cancel</button>
    <button type="submit">Submit</button>
  {/snippet}
</Dialog>
```

## Development

```bash
# Install dependencies
pnpm install

# Start dev server (component showcase)
pnpm dev

# Build library
pnpm build

# Run linter
pnpm lint
```

## License

MIT
