---
title: Email Verification
description: Built-in email verification flow with customizable templates.
---

The email verification plugin provides a batteries-included verification flow that handles routes internally.

## Quick Start

```typescript
import { emailVerificationPlugin } from '@kuratchi/sdk/auth';

emailVerificationPlugin({
  successRedirect: '/?verified=true',
  errorRedirect: '/auth/verify-email?error='
})
```

## Routes Handled

The plugin automatically handles these routes:

| Route | Method | Description |
|-------|--------|-------------|
| `/auth/verify-email/callback` | GET | Verifies token from email link |
| `/auth/verify-email/resend` | POST | Resends verification email |

## Configuration

```typescript
emailVerificationPlugin({
  tokenExpiry: 24 * 60 * 60 * 1000,  // 24 hours (default)
  resendCooldown: 60 * 1000,          // 60 seconds (default)
  callbackRoute: '/auth/verify-email/callback',
  resendRoute: '/auth/verify-email/resend',
  successRedirect: '/?verified=true',
  errorRedirect: '/auth/verify-email?error=',
  
  // Custom email template
  emailTemplate: (verifyLink, email) => ({
    subject: 'Verify your email',
    html: `<a href="${verifyLink}">Click to verify</a>`
  }),
  
  // Callbacks
  onBeforeSend: async (email, userId) => {
    console.log(`Sending verification to ${email}`);
  },
  onVerified: async (email, userId) => {
    console.log(`${email} verified!`);
  }
})
```

## API

### Send Verification Email

```typescript
await ctx.locals.kuratchi.auth.emailVerification.send(userId, email, redirectTo);
```

### Verify Token

```typescript
const result = await ctx.locals.kuratchi.auth.emailVerification.verify(token, organizationId);
// { success: true } or { success: false, error: 'invalid_token' }
```

### Resend Email

```typescript
await ctx.locals.kuratchi.auth.emailVerification.resend(userId);
```

### Check Verification Status

```typescript
const isVerified = await ctx.locals.kuratchi.auth.emailVerification.isVerified(userId);
```

## Session Integration

The session includes `isEmailVerified`:

```typescript
// In +layout.server.ts
export const load = async ({ locals }) => {
  const session = await locals.kuratchi.auth.session.get();
  return {
    user: session?.user,
    isEmailVerified: session?.user?.emailVerified != null
  };
};
```

## UI Component

```svelte
<!-- EmailVerificationBanner.svelte -->
<script>
  export let isEmailVerified = false;
  let sending = false;
  
  async function resend() {
    sending = true;
    await fetch('/auth/verify-email/resend', { method: 'POST' });
    sending = false;
  }
</script>

{#if !isEmailVerified}
  <div class="banner">
    Please verify your email.
    <button on:click={resend} disabled={sending}>
      {sending ? 'Sending...' : 'Resend'}
    </button>
  </div>
{/if}
```

## OAuth Integration

When users sign in via OAuth (Google, Microsoft), their email is automatically verified if the provider confirms it:

```typescript
// After Google OAuth sign-in
{
  emailVerified: 1703347200000  // Timestamp from provider
}
```

## Database Schema

The plugin expects these columns in your users table:

```typescript
{
  emailVerified: { type: 'integer', nullable: true },  // Timestamp or null
  emailVerificationToken: { type: 'text', nullable: true },
  emailVerificationExpires: { type: 'integer', nullable: true }
}
```
