# @kuratchi/auth

Config-driven authentication for Kuratchi apps.

## Install

```bash
npm install @kuratchi/auth @kuratchi/orm
```

## Configure in `kuratchi.config.ts`

```ts
import { defineConfig } from '@kuratchi/js';
import { kuratchiAuthConfig } from '@kuratchi/auth/adapter';

export default defineConfig({
  auth: kuratchiAuthConfig({
    cookieName: 'kuratchi_session',
    sessionEnabled: true,
  }),
});
```

## Common APIs

```ts
import { signUp, signIn, signOut, getCurrentUser } from '@kuratchi/auth';
import { logActivity, getActivity } from '@kuratchi/auth';
import { hasRole, hasPermission, assignRole } from '@kuratchi/auth';
import { startOAuth, handleOAuthCallback } from '@kuratchi/auth';
import { requireAuthGuard } from '@kuratchi/auth';
import { verifyTurnstile } from '@kuratchi/auth';
```

## Feature areas

- Credentials: signup/signin/signout, current user, password reset
- Activity logging
- Roles and permissions
- OAuth providers
- Route guards
- Rate limiting
- Turnstile checks
- Organization helpers

## Secrets

Set auth-related secrets via Worker env/secrets (for example `AUTH_SECRET`, OAuth provider secrets, Turnstile secret).