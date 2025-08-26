# Auth (SvelteKit)

Kuratchi provides a batteries‑included auth layer for SvelteKit with:

- Magic link sign‑in
- Google OAuth (opt‑in)
- Session cookies with HMAC integrity
- Organization‑scoped auth using your Kuratchi Admin DB to resolve org databases

This page shows how to wire it up quickly and what routes/APIs are available.

## Quickstart

1) Install the SvelteKit handle in your `src/hooks.server.ts`:

```ts
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { kuratchi } from 'kuratchi';

export const handle: Handle = kuratchi.handle();
```

2) Set required environment variables (see next section). Start your app.

3) Use the built‑in endpoints to sign in via magic link or Google OAuth, or call the high‑level `signIn` helpers.

## Required environment

The handle reads env via `$env/dynamic/private` by default. You can override with `getEnv`, but the following are expected:

- KURATCHI_AUTH_SECRET
- CLOUDFLARE_WORKERS_SUBDOMAIN
- CLOUDFLARE_ACCOUNT_ID
- CLOUDFLARE_API_TOKEN
- KURATCHI_ADMIN_DB_NAME
- KURATCHI_ADMIN_DB_TOKEN
- KURATCHI_GATEWAY_KEY

Email (magic link) configuration:
- RESEND_API_KEY
- EMAIL_FROM

App origin (used to build OAuth and magic link URLs):
- ORIGIN (e.g. https://app.example.com)

Google OAuth (if you enable OAuth):
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET

Notes:
- The handle fails fast with a 500 if `KURATCHI_AUTH_SECRET` is missing.
- When needed (first auth usage), it lazily constructs an admin HTTP client from `KURATCHI_ADMIN_DB_NAME` + `KURATCHI_ADMIN_DB_TOKEN` + `KURATCHI_GATEWAY_KEY` + `CLOUDFLARE_WORKERS_SUBDOMAIN`.
- Admin DB is expected to be a Kuratchi HTTP client; the SDK validates its schema contract automatically.

## What `locals.kuratchi` exposes

During requests, the handle initializes `event.locals.kuratchi` with:

- user: null | current user
- session: null | current session data
- setSessionCookie(value, { expires? })
- clearSessionCookie()
- auth: KuratchiAuth (lazy‑attached when first used)
- auth.org: AuthService scoped to the current organization when a valid session cookie is present

You can access `locals.kuratchi` in your server load functions and actions.

## Built‑in routes

The handle implements the following endpoints:

- POST `/auth/magic/send`
  - Body: `{ email: string, redirectTo?: string, organizationId?: string }`
  - If `organizationId` is not provided, it attempts to resolve it from the admin DB by email.
  - Sends an email via Resend with a login link to `/auth/magic/callback`.
  - Returns `{ success: true }` on success, otherwise `{ success: false, error }`.

- GET `/auth/magic/callback`
  - Query: `token`, `org`, optional `redirectTo`
  - Verifies the token, sets a session cookie (30 days), and redirects (303) to `redirectTo` or `/`.

- GET `/auth/oauth/google/start`
  - Query: `org` (organizationId), optional `redirectTo`
  - Requires GOOGLE_* and ORIGIN env vars.
  - Redirects to Google OAuth with a signed state.

- GET `/auth/oauth/google/callback`
  - Handles code exchange, user linking/creation, session creation, and 303 redirect.

## High‑level sign‑in API

You can also trigger sign‑in flows programmatically through `KuratchiAuth` which is attached under `locals.kuratchi.auth` once initialized:

```ts
// Send magic link (server action)
const res = await locals.kuratchi.auth.signIn.magicLink.send('user@acme.com', {
  redirectTo: '/',
  organizationId: 'org_...' // optional; will be resolved by email if omitted
});

// Build Google OAuth start URL (server or load)
const url = locals.kuratchi.auth.signIn.oauth.google.startUrl({
  organizationId: 'org_...',
  redirectTo: '/dashboard'
});
```

## Customization hooks

`createAuthHandle()` accepts options to customize cookie name and how env/admin DB are resolved:

```ts
createAuthHandle({
  cookieName: 'my_session',
  getEnv: async (event) => ({
    ...event.platform?.env, // or custom source
    KURATCHI_AUTH_SECRET: process.env.KURATCHI_AUTH_SECRET!
  }),
  getAdminDb: async (_event) => {
    // Return a Kuratchi HTTP client instance that implements query() and getDrizzleProxy()/drizzleProxy()
    const { KuratchiHttpClient } = await import('$lib/d1/internal-http-client.js');
    return new KuratchiHttpClient({
      databaseName: process.env.KURATCHI_ADMIN_DB_NAME!,
      workersSubdomain: process.env.CLOUDFLARE_WORKERS_SUBDOMAIN!,
      dbToken: process.env.KURATCHI_ADMIN_DB_TOKEN!,
      gatewayKey: process.env.KURATCHI_GATEWAY_KEY!
    });
  }
});
```

## Server‑side usage examples

Read the current user/session in a +page.server.ts:

```ts
export const load = async ({ locals }) => {
  return {
    user: locals.kuratchi.user,
    session: locals.kuratchi.session
  };
};
```

Sign out (invalidate cookie) in an action:

```ts
export const actions = {
  signout: async ({ locals }) => {
    locals.kuratchi.clearSessionCookie();
    return { success: true } as const;
  }
};
```

## Notes on organizations

- Each user belongs to an organization. The admin DB stores the mapping and database metadata.
- `KuratchiAuth` automatically resolves the organization’s database and token and validates the org DB schema before performing auth operations.
- Sessions are organization‑scoped. The handle will attach `locals.kuratchi.auth.org` only when a valid session cookie is present and parsed.
