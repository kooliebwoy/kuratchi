# Authentication Setup

## Consolidated Remote Functions

All auth-related remote functions are now in **`/auth/remote.ts`** following the pattern from `database.remote.ts`.

### Structure

```
/routes/auth/
  ├── remote.ts            ← All auth remote functions
  ├── signin/
  │   └── +page.svelte     ← Sign in page
  └── signup/
      └── +page.svelte     ← Signup page
```

### Available Remote Functions

```typescript
// Sign in with email/password
import { signInWithCredentials } from './remote';

// Sign out current user
import { signOut } from './remote';

// Create new organization (signup)
import { createOrganization } from './remote';
```

## How It Works

### 1. Sign In (`signInWithCredentials`)

Uses SDK's `locals.kuratchi.auth.credentials.signIn()` method:

```svelte
<form {...signInWithCredentials}>
  <input name="email" type="email" required />
  <input name="password" type="password" required />
  <button type="submit" disabled={signInWithCredentials.pending > 0}>
    {#if signInWithCredentials.pending > 0}
      Signing in...
    {:else}
      Sign In
    {/if}
  </button>
</form>

<script>
  $effect(() => {
    if (signInWithCredentials.result?.success) {
      goto('/database');
    }
  });
</script>
```

**What the SDK does automatically:**
- Finds organization by email lookup
- Verifies password with pepper
- Creates session in database
- Sets encrypted session cookie
- Sets `locals.session` for immediate access
- Handles rate limiting & lockouts

### 2. Organization Signup (`createOrganization`)

Uses SDK's `locals.kuratchi.auth.admin.createOrganization()` method:

```svelte
<form {...createOrganization} onsubmit={validatePasswordMatch}>
  <input name="organizationName" required />
  <input name="email" type="email" required />
  <input name="password" type="password" required />
  <button type="submit" disabled={createOrganization.pending > 0}>
    Create Organization
  </button>
</form>
```

**What the SDK does automatically:**
- Creates organization record in admin DB
- Provisions dedicated database for the org
- Creates first user with `role='owner'`
- Maps email → organizationId in admin DB
- Hashes password with pepper

### 3. Sign Out (`signOut`)

Uses SDK's `locals.kuratchi.auth.credentials.signOut()` method:

```svelte
<form {...signOut}>
  <button type="submit">Sign Out</button>
</form>
```

**What the SDK does automatically:**
- Invalidates session in database
- Clears session cookie
- Clears `locals.session`

## Validation

All remote functions use **Valibot** for validation:

```typescript
const signInSchema = v.object({
  email: v.pipe(v.string(), v.email('Invalid email address')),
  password: v.pipe(v.string(), v.nonEmpty('Password is required'))
});
```

Errors are automatically thrown as SvelteKit errors with proper status codes.

## Error Handling

The SDK returns specific error codes that are mapped to user-friendly messages:

```typescript
const errorMessages = {
  invalid_credentials: 'Invalid email or password',
  too_many_attempts: 'Too many failed attempts. Please try again later.',
  organization_database_not_found: 'Organization not found',
  // ... etc
};
```

## Routes

- **`/auth/signin`** - Sign in page with email/password + OAuth buttons
- **`/auth/signup`** - Organization signup page
- **`/superadmin/seed`** - Superadmin creation (separate from auth flow)

## Cleanup

You can now **delete** the old file:
- ❌ `/auth/signup/signup.remote.ts` (no longer needed)

Everything is consolidated in `/auth/remote.ts`! ✨
