---
layout: docs
---

# Simple Auth Example

Basic authentication with magic links - no database setup required.

## What You Get

- ✅ Session management
- ✅ Magic link authentication
- ✅ Automatic route handling
- ❌ No storage dependencies
- ❌ No multi-tenancy

## Setup

### 1. Configure Auth

The SDK handles everything - routes, sessions, cookies:

```typescript
// src/hooks.server.ts
import { createAuthHandle, sessionPlugin, emailAuthPlugin } from 'kuratchi-sdk/auth';

export const handle = createAuthHandle({
  plugins: [
    sessionPlugin(),
    emailAuthPlugin({
      provider: 'resend',
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM
    })
  ]
});
```

That's it! The SDK automatically creates these routes:
- `POST /auth/magic/send` - Send magic link
- `GET /auth/magic/callback?token=xxx` - Verify and sign in

### 2. Environment Variables

```bash
# .env
KURATCHI_AUTH_SECRET=your-secret-key-min-32-chars
EMAIL_FROM=noreply@example.com
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

## Login Page

The SDK handles the magic link flow automatically - just POST to the route:

```svelte
<!-- src/routes/login/+page.svelte -->
<script>
  import { enhance } from '$app/forms';
  let sent = false;
</script>

<form method="POST" use:enhance={() => {
  return async ({ result }) => {
    if (result.type === 'success') sent = true;
  };
}}>
  {#if !sent}
    <input 
      type="email" 
      name="email" 
      placeholder="Enter your email"
      class="input input-bordered"
      required 
    />
    <button type="submit" class="btn btn-primary">
      Send Magic Link
    </button>
  {:else}
    <div class="alert alert-success">
      <p>Check your email for a magic link!</p>
    </div>
  {/if}
</form>
```

```typescript
// src/routes/login/+page.server.ts
export const actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    const email = data.get('email');

    // The SDK's emailAuthPlugin handles this route automatically
    // Just forward the request to the built-in route
    const response = await fetch('http://localhost:5173/auth/magic/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    if (!response.ok) {
      return { success: false, error: 'Failed to send magic link' };
    }

    return { success: true };
  }
};
```

**Even simpler:** Just use a form action that posts directly to `/auth/magic/send`:

```svelte
<!-- src/routes/login/+page.svelte -->
<form method="POST" action="/auth/magic/send">
  <input type="email" name="email" required />
  <button type="submit">Send Magic Link</button>
</form>
```

The SDK handles everything else!

## Protected Route

```typescript
// src/routes/dashboard/+page.server.ts
import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
  // Session automatically available via sessionPlugin
  if (!locals.session) {
    throw redirect(302, '/login');
  }
  
  return {
    user: locals.user
  };
}
```

## Access Session Data

```svelte
<!-- src/routes/+layout.server.ts -->
<script>
  export let data;
</script>

{#if data.user}
  <p>Welcome, {data.user.email}!</p>
  <form method="POST" action="/auth/logout">
    <button class="btn btn-ghost">Sign Out</button>
  </form>
{:else}
  <a href="/login" class="btn btn-primary">Sign In</a>
{/if}
```

```typescript
// src/routes/+layout.server.ts
export async function load({ locals }) {
  return {
    user: locals.user,
    session: locals.session
  };
}
```

## How It Works

The `emailAuthPlugin` automatically:
1. ✅ Creates `/auth/magic/send` route
2. ✅ Generates secure tokens
3. ✅ Sends emails via Resend
4. ✅ Creates `/auth/magic/callback` route
5. ✅ Verifies tokens
6. ✅ Creates sessions
7. ✅ Sets cookies

You just configure it once and it works!

## With OAuth

Add OAuth providers just as easily:

```typescript
export const handle = createAuthHandle({
  plugins: [
    sessionPlugin(),
    emailAuthPlugin({
      provider: 'resend',
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM
    }),
    oauthPlugin({
      providers: {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET
        },
        github: {
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET
        }
      }
    })
  ]
});
```

Now you have:
- Magic links
- Google OAuth
- GitHub OAuth

All with automatic route handling!

[Next: Add storage →](/docs/auth/examples/storage)
