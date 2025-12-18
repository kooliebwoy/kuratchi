---
title: Credentials Authentication
description: Email/password sign in and sign out example.
---

This example shows how to implement a complete credentials-based authentication flow with sign in and sign out.

## Overview

The credentials plugin provides built-in email/password authentication. It automatically handles:
- User authentication against your database
- Session creation and cookie management
- Rate limiting (lockout after failed attempts)
- Sign in/sign out endpoints

## Backend Setup

### hooks.server.ts

```ts
import { kuratchi } from 'kuratchi-sdk';
import { sessionPlugin, credentialsPlugin } from 'kuratchi-sdk/auth';
import type { Handle } from '@sveltejs/kit';

export const { handle }: { handle: Handle } = kuratchi({
  auth: {
    plugins: [
      sessionPlugin(),
      credentialsPlugin()
    ]
  }
});
```

## Remote Functions Pattern

In Kuratchi apps, we typically implement auth flows using SvelteKit "remote functions":

- Server code lives in `src/lib/functions/*.remote.ts`.
- Pages import those functions directly and use them in `<form {...fn}>`.
- Success/errors are read from `fn.result`.

This matches how the dashboard implements credentials auth.

## Sign In Page

### src/lib/functions/auth.remote.ts

```ts
import { getRequestEvent, form } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';

const signInSchema = v.object({
  email: v.pipe(v.string(), v.email('Invalid email address')),
  password: v.pipe(v.string(), v.nonEmpty('Password is required'))
});

export const signInWithCredentials = form('unchecked', async (data: any) => {
  const parsed = v.safeParse(signInSchema, data);
  if (!parsed.success) {
    error(400, parsed.issues[0]?.message || 'Validation failed');
  }

  const { email, password } = parsed.output;
  const { locals } = getRequestEvent();

  if (!locals.kuratchi?.auth?.credentials?.signIn) {
    error(500, 'Credentials authentication not configured');
  }

  const authResult = await locals.kuratchi.auth.credentials.signIn(email, password);

  if (!authResult.success) {
    const message =
      authResult.error === 'too_many_attempts'
        ? authResult.message
        : 'Invalid email or password';
    error(401, message);
  }

  return {
    success: true,
    user: {
      id: authResult.user.id,
      email: authResult.user.email,
      name: authResult.user.name
    }
  };
});
```

### src/routes/auth/signin/+page.svelte

```svelte
<script lang="ts">
  import { signInWithCredentials } from '$lib/functions/auth.remote';
  import { goto } from '$app/navigation';

  $effect(() => {
    if (signInWithCredentials.result?.success) {
      goto('/');
    }
  });
</script>

<svelte:head>
  <title>Sign In</title>
</svelte:head>

<div class="signin-container">
  <div class="signin-card">
    <h1>Sign In</h1>
    
    {#if signInWithCredentials.result && !signInWithCredentials.result.success}
      <div class="error-message">{signInWithCredentials.result.message}</div>
    {/if}

    <form {...signInWithCredentials}>
      <div class="form-group">
        <label for="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
        />
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          required
        />
      </div>

      <button type="submit">Sign In</button>
    </form>

    <p class="signup-link">
      Don't have an account? <a href="/auth/signup">Sign up</a>
    </p>
  </div>
</div>

<style>
  .signin-container {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 16px;
    background: linear-gradient(135deg, #f8fafc, #e5e7eb);
  }

  .signin-card {
    width: min(400px, 100%);
    background: white;
    border-radius: 8px;
    padding: 32px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  h1 {
    margin: 0 0 24px 0;
    font-size: 24px;
    color: #1f2937;
  }

  .error-message {
    background: #fee;
    color: #c33;
    padding: 12px;
    border-radius: 4px;
    margin-bottom: 16px;
    font-size: 14px;
  }

  .form-group {
    margin-bottom: 16px;
  }

  label {
    display: block;
    margin-bottom: 6px;
    font-size: 14px;
    font-weight: 500;
    color: #374151;
  }

  input {
    width: 100%;
    padding: 10px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 14px;
    font-family: inherit;
  }

  input:focus {
    outline: none;
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }

  input:disabled {
    background: #f3f4f6;
    cursor: not-allowed;
  }

  button {
    width: 100%;
    padding: 10px;
    background: #4f46e5;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  button:hover:not(:disabled) {
    background: #4338ca;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .signup-link {
    text-align: center;
    font-size: 14px;
    color: #6b7280;
    margin-top: 16px;
  }

  .signup-link a {
    color: #4f46e5;
    text-decoration: none;
  }

  .signup-link a:hover {
    text-decoration: underline;
  }
</style>
```

## Sign Out

### src/lib/functions/auth.remote.ts

```ts
import { getRequestEvent, form } from '$app/server';
import { error } from '@sveltejs/kit';

export const signOut = form('unchecked', async () => {
  const { locals } = getRequestEvent();

  if (!locals.kuratchi?.auth?.credentials?.signOut) {
    error(500, 'Sign out not configured');
  }

  const result = await locals.kuratchi.auth.credentials.signOut();
  if (!result.success) {
    error(500, result.error || 'Sign out failed');
  }

  return { success: true };
});
```

### src/routes/+layout.svelte (or any component)

```svelte
<script>
  import { signOut } from '$lib/functions/auth.remote';
  import { goto } from '$app/navigation';

  $effect(() => {
    if (signOut.result?.success) {
      goto('/auth/signin');
    }
  });
</script>

<form {...signOut}>
  <button type="submit">Sign Out</button>
</form>
```

## Check Authentication

On any page, you can access the current user:

### src/routes/+layout.server.ts

```ts
export const load = async ({ locals }) => {
  return {
    user: locals.user,
    session: locals.session
  };
};
```

Then in your layout:

### src/routes/+layout.svelte

```svelte
<script>
  let { data } = $props();
</script>

{#if data.session?.user}
  <p>Welcome, {data.session.user.email}</p>
{:else}
  <p><a href="/auth/signin">Sign in</a></p>
{/if}

<slot />
```

## What's Available

After successful sign in, you have access to:

- `locals.user` - The authenticated user object
- `locals.session` - Session metadata
- `locals.kuratchi.auth.credentials.signOut()` - Sign out function
- `locals.kuratchi.auth.credentials.signIn()` - Sign in function

## Next Steps

Once you have credentials working, you can:
- Add OAuth providers (Google, GitHub)
- Implement magic links
- Add rate limiting configuration
- Set up multi-organization support
