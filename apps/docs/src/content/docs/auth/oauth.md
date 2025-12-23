---
title: OAuth Authentication
description: Configure Google, Microsoft, and custom OAuth providers.
---

Kuratchi provides built-in OAuth support for popular providers with automatic user creation and invite acceptance.

## Quick Start

```typescript
import { oauthPlugin } from '@kuratchi/sdk/auth';

oauthPlugin({
  providers: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET
    },
    microsoft: {
      clientId: env.MICROSOFT_CLIENT_ID,
      clientSecret: env.MICROSOFT_CLIENT_SECRET,
      tenantId: env.MICROSOFT_TENANT_ID  // Optional, defaults to 'common'
    }
  },
  callbackUrl: '/auth/callback'
})
```

## Supported Providers

| Provider | Scopes | Email Verified |
|----------|--------|----------------|
| Google | `openid email profile` | ✅ Auto-verified |
| Microsoft | `openid email profile User.Read` | ✅ Auto-verified |

## Configuration

### Google OAuth

```typescript
google: {
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  scopes: ['openid', 'email', 'profile']  // Optional, these are defaults
}
```

**Google Cloud Console Setup:**
1. Create OAuth 2.0 credentials
2. Add authorized redirect URI: `https://your-app.com/auth/callback/google`
3. Enable Google+ API (for profile access)

### Microsoft OAuth

```typescript
microsoft: {
  clientId: env.MICROSOFT_CLIENT_ID,
  clientSecret: env.MICROSOFT_CLIENT_SECRET,
  tenantId: 'common',  // 'common', 'organizations', 'consumers', or specific tenant
  scopes: ['openid', 'email', 'profile', 'User.Read']  // Optional
}
```

**Azure Portal Setup:**
1. Register application in Azure AD
2. Add redirect URI: `https://your-app.com/auth/callback/microsoft`
3. Create client secret
4. Add API permissions: `User.Read`

## OAuth Flow

```
1. User clicks "Sign in with Google"
   ↓
2. Redirect to /auth/oauth/google
   ↓
3. Google OAuth consent screen
   ↓
4. Callback to /auth/callback/google
   ↓
5. SDK validates token, creates/updates user
   ↓
6. Session created, redirect to app
```

## API

### Initiate OAuth

```typescript
// In your sign-in page
<a href="/auth/oauth/google">Sign in with Google</a>
<a href="/auth/oauth/microsoft">Sign in with Microsoft</a>
```

### OAuth Callback

The SDK handles callbacks automatically at `/auth/callback/{provider}`.

### Programmatic Access

```typescript
const { signInUrl } = ctx.locals.kuratchi.auth.oauth.getSignInUrl('google', {
  redirectTo: '/dashboard',
  organizationId: 'org-123'  // Optional, for multi-org
});
```

## User Creation

When a user signs in via OAuth:

1. **New user**: Created with `emailVerified: true` (provider confirmed)
2. **Existing user**: Updated with latest profile info
3. **Invited user**: Invite automatically accepted, status set to active

```typescript
// User record after OAuth sign-in
{
  id: 'uuid',
  email: 'user@example.com',
  name: 'John Doe',
  image: 'https://...',  // Profile picture
  emailVerified: 1703347200000,  // Timestamp
  status: true,  // Active
  role: 'member'  // Or 'owner' if first user
}
```

## Invite Acceptance

OAuth automatically accepts pending invites:

```typescript
// Before OAuth sign-in
{
  status: 'invited',
  invite_token: 'abc123',
  invite_expires_at: 1703433600000
}

// After OAuth sign-in
{
  status: true,  // Active
  invite_token: null,
  invite_expires_at: null,
  emailVerified: 1703347200000
}
```

## Multi-Organization

For users with multiple organizations:

```typescript
// Pass organizationId in OAuth state
<a href="/auth/oauth/google?org=org-123">Sign in to Acme Corp</a>
```

The SDK will:
1. Authenticate with Google
2. Look up user in specified organization
3. Create session for that organization

## Callbacks

```typescript
oauthPlugin({
  providers: { ... },
  onSuccess: async (user, provider) => {
    console.log(`User ${user.email} signed in via ${provider}`);
    // Track analytics, send welcome email, etc.
  },
  onError: async (error, provider) => {
    console.error(`OAuth error with ${provider}:`, error);
  }
})
```

## Environment Variables

```bash
# Google
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Microsoft
MICROSOFT_CLIENT_ID=your-application-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_TENANT_ID=common  # Optional
```
