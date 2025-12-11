---
title: Hooks Setup
description: Configure the Kuratchi SDK in your SvelteKit hooks.server.ts file.
---

The SDK integrates with SvelteKit through the `hooks.server.ts` file. This is where you configure authentication, storage, and other features.

## Basic Setup

Create or update your `src/hooks.server.ts`:

```ts
import { kuratchi } from 'kuratchi-sdk';
import {
  sessionPlugin,
  adminPlugin,
  organizationPlugin,
  credentialsPlugin,
  oauthPlugin,
  guardsPlugin,
  requireAuth
} from 'kuratchi-sdk/auth';
import { adminSchema } from '$lib/schemas/admin';
import { organizationSchema } from '$lib/schemas/organization';
import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const { handle }: { handle: Handle } = kuratchi({
  auth: {
    plugins: [
      sessionPlugin(),
      adminPlugin({
        adminSchema,
        organizationSchema,
        adminDatabase: 'ADMIN_DB'
      }),
      organizationPlugin({ organizationSchema }),
      credentialsPlugin(),
      oauthPlugin({
        providers: [
          {
            name: 'google',
            clientId: env.GOOGLE_CLIENT_ID || '',
            clientSecret: env.GOOGLE_CLIENT_SECRET || ''
          },
          {
            name: 'github',
            clientId: env.GITHUB_CLIENT_ID || '',
            clientSecret: env.GITHUB_CLIENT_SECRET || ''
          }
        ]
      }),
      guardsPlugin(
        requireAuth({
          paths: ['*'],
          exclude: ['/auth/*', '/api/*'],
          redirectTo: '/auth/signin'
        })
      )
    ]
  },
  storage: {
    kv: { default: 'KV' },
    r2: { default: 'BUCKET' }
  }
});
```

## Plugin Overview

### sessionPlugin

Manages user sessions with secure cookies. Always include this plugin first.

### adminPlugin

Connects to your admin database for user and organization management.

```ts
adminPlugin({
  adminSchema,        // Your admin DB schema
  organizationSchema, // Your org DB schema
  adminDatabase: 'ADMIN_DB'
})
```

### organizationPlugin

Enables multi-tenant organization support with per-org databases.

### credentialsPlugin

Adds email/password authentication.

### oauthPlugin

Configures OAuth providers. Supported providers: `google`, `github`.

```ts
oauthPlugin({
  providers: [
    {
      name: 'google',
      clientId: env.GOOGLE_CLIENT_ID || '',
      clientSecret: env.GOOGLE_CLIENT_SECRET || ''
    }
  ]
})
```

### guardsPlugin

Protects routes based on authentication status.

```ts
guardsPlugin(
  requireAuth({
    paths: ['*'],           // Protect all routes
    exclude: ['/auth/*'],   // Except auth routes
    redirectTo: '/auth/signin'
  })
)
```

## Storage Bindings

Configure KV and R2 bindings for your app:

```ts
storage: {
  kv: { default: 'KV', sessions: 'SESSION_KV' },
  r2: { default: 'BUCKET', uploads: 'USER_UPLOADS' }
}
```

Access in your routes via `locals.kuratchi.kv` and `locals.kuratchi.r2`.

## What You Get

After setup, your routes have access to:

- `locals.user` - Current authenticated user
- `locals.session` - Current session data
- `locals.kuratchi.kv` - KV storage
- `locals.kuratchi.r2` - R2 storage
- `locals.kuratchi.orgDatabaseClient()` - Org database client

### Example Usage

```ts
// src/routes/+layout.server.ts
export const load = async ({ locals }) => {
  return {
    user: locals.user,
    session: locals.session
  };
};
```
