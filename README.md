# Kuratchi

Auth toolkit for multi-organization with Cloudflare D1. Opinionated. Built to be simple.

- Drizzle-first - This is all I know.
- Patched together all my favorite things.
- Stand up org DBs and auth quickly. Think MVP. For prototyping.

## Install

```sh
npm install kuratchi
```

## API surface (short)

- kuratchi.d1.createDatabase(name, opts?) → { database, apiToken }
- kuratchi.d1.deleteDatabase(databaseId)
- kuratchi.d1.database({ databaseName, apiToken, bookmark? }) → client
  - client.query(sql, params?)
  - client.drizzleProxy()
  - client.migrateAuto(dirName)  // Vite/SvelteKit only
  - kuratchi.d1.migrateWithLoader(db, dir, loader) // non‑Vite

- kuratchi.auth.createOrganization({ organizationName }) → { id, ... }
- kuratchi.auth.deleteOrganization(organizationId)
- kuratchi.auth.forOrganization(organizationId) → orgAuth
  - orgAuth.createUser({ email, password, ... })
  - orgAuth.authenticateUser(email, password)
  - orgAuth.createSession(userId)
  - orgAuth.validateSessionToken(cookie)
  - orgAuth.deleteUser(userId)
  - orgAuth.requestPasswordReset(email)
  - orgAuth.resetPassword(token, newPassword)
  - orgAuth.sendEmailVerification(userId)
  - orgAuth.verifyEmailToken(token)

- Kuratchi.auth.handle({ getAdminDb?, getEnv?, cookieName? }) // SvelteKit handle
- Kuratchi.auth.signIn.magicLink.send(email, { organizationId?, redirectTo?, fetch? })
- Kuratchi.auth.signIn.oauth.google.startUrl({ organizationId, redirectTo? })

## How we expect you to use it (the flow)
- Provision an admin DB - This is where you'll store orgs and map everything (users, databases, api tokens, etc).
- Provision a per‑org D1 - This is where you'll store your org's data.
- Use Drizzle via the sqlite‑proxy to interact with your org DB like a normal drizzle client. You can use query() if you are hard core SQL person.
- Use the Auth module on your org DB to handle auth at the org level. This will handle users, sessions, etc.

## Minimal example

```ts
import { Kuratchi } from 'kuratchi';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import * as schema from './schemas/org-schema';

const kuratchi = new Kuratchi({
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  workersSubdomain: process.env.CLOUDFLARE_WORKERS_SUBDOMAIN!,
});

// 1) Provision org DB (once per org)
const { database, apiToken } = await kuratchi.d1.createDatabase('acme-org');

// 2) Connect + Migrate
const db = kuratchi.d1.database({ databaseName: database.name, apiToken });
await db.migrateAuto('org'); // expects migrations-org/ with meta/_journal.json

// 3) Drizzle
const proxy = db.drizzleProxy();
const orm = drizzle(proxy, { schema }); // this is using the drizzle sqlite proxy

> Note: Kuratchi is SvelteKit + Cloudflare Workers first. Use the SvelteKit handle and built-in `/auth/*` routes below. Programmatic non-SvelteKit usage may be documented later.

## Environment variables

- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ACCOUNT_ID
- CLOUDFLARE_WORKERS_SUBDOMAIN
- KURATCHI_AUTH_SECRET

## SvelteKit auth quickstart

Kuratchi ships a SvelteKit handle that wires up session cookies, magic link, and Google OAuth endpoints for you.

1) hooks.server.ts

```ts
import { Kuratchi } from 'kuratchi';

// Defaults expect Cloudflare Workers (ADMIN_DB binding and env on event.platform.env)
export const handle = Kuratchi.auth.handle();

// If you need to customize how to read env or the ADMIN_DB binding:
// export const handle = Kuratchi.auth.handle({
//   getAdminDb: (event) => (event.platform as any).env.ADMIN_DB,
//   getEnv: (event) => (event.platform as any).env
// });
```

2) Built-in auth routes (no extra code needed)

  - POST `/auth/magic/send` { email, redirectTo?, organizationId? }
  - GET `/auth/magic/callback?token=...&org=...`
  - GET `/auth/oauth/google/start?org=...&redirectTo=/`
  - GET `/auth/oauth/google/callback`

3) Protect pages with locals from the handle

```ts
// src/routes/+layout.server.ts
import { redirect } from '@sveltejs/kit';

export const load = async ({ locals }) => {
  // handle sets: locals.user, locals.session
  if (!locals.user) throw redirect(302, '/login');
  return { user: locals.user, session: locals.session };
};
```

4) Magic link login action via SDK (recommended)

```ts
// src/routes/login/+page.server.ts
import { Kuratchi } from 'kuratchi';

export const actions = {
  default: async ({ request, fetch, url }) => {
    const data = await request.formData();
    const email = String(data.get('email') || '').trim();
    const redirectTo = url.searchParams.get('redirectTo') || '/';
    // Optional: pass organizationId explicitly. If omitted, the handle will
    // attempt to resolve org by email using the admin DB (organizationUsers).
    const result = await Kuratchi.auth.signIn.magicLink.send(email, {
      redirectTo,
      // organizationId: 'YOUR_ORG_ID',
      fetch,
    });
    if (!result.ok) return { error: result.error };
    return { ok: true };
  }
};
```

5) Google OAuth (built-in route)

```svelte
<!-- src/routes/login/+page.svelte -->
<a href="/auth/oauth/google/start">Continue with Google</a>
```

Notes:

- Organization resolution policy:
  - Magic link: org is resolved by the user's email via the admin DB mapping (`organizationUsers`). If no mapping exists, respond with 404; the separate sign-up flow handles creating users/org membership.
  - OAuth (Google): org is resolved at the callback using the email from Google userinfo. The start route does not require `org`. If no mapping exists, fail the request.
  - Optional override: append `?org=<id-or-slug>` (and/or `?redirectTo=/path`) if you want to force a specific org and bypass email-based resolution.

6) Logout

```ts
// src/routes/logout/+server.ts
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
  locals.clearSessionCookie();
  return new Response(null, { status: 303, headers: { Location: '/' } });
};
```

7) Optional: type your App.Locals

```ts
// src/app.d.ts
declare namespace App {
  interface Locals {
    auth: unknown | null;
    user: any | null;
    session: any | null;
    setSessionCookie: (value: string, opts?: { expires?: Date }) => void;
    clearSessionCookie: () => void;
  }
}
```

Required env for the SvelteKit handle (usually via Cloudflare Workers bindings):

- RESEND_API_KEY, EMAIL_FROM, ORIGIN, KURATCHI_AUTH_SECRET
- CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_WORKERS_SUBDOMAIN
- Optional: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, AUTH_WEBHOOK_SECRET

### Auth flow overview (quick mental model)

- SDK -> `Kuratchi.auth.handle()` -> attaches `/auth/*` routes and manages cookies.
- SDK -> `Kuratchi.auth.signIn.magicLink.send()` -> POST `/auth/magic/send`.
- OAuth start: link to `/auth/oauth/google/start` (`?redirectTo` optional; `?org` optional if you want to force one). The org is resolved at callback via the user's email mapping in the admin DB. Optionally build with `Kuratchi.auth.signIn.oauth.google.startUrl()`.
- Callback -> `/auth/magic/callback` or `/auth/oauth/google/callback` -> verifies token/state, creates session, sets cookie, redirects.
- Every request -> handle parses cookie -> sets `locals.auth`, `locals.user`, `locals.session`.

## Single-tenant vs Multi-tenant: how to wire org

### Single-tenant

- Choose one:
  - Pass a constant `organizationId` everywhere you initiate auth:
    - Magic link: `Kuratchi.auth.signIn.magicLink.send(email, { organizationId: ORG_ID, redirectTo, fetch })`
    - OAuth: `Kuratchi.auth.signIn.oauth.google.startUrl({ organizationId: ORG_ID, redirectTo })`
  - Or rely on email mapping in admin DB:
    - Magic link: if you omit `organizationId`, `createAuthHandle()` looks up the org by email in `organizationUsers`.
    - OAuth: you may omit `organizationId`; the callback resolves the org using the email returned by Google.

### Multi-tenant

- Recommended: email-based routing via the admin DB mapping (`organizationUsers`). Users are routed to their organization based on their email; no subdomains required.
- If your UI encodes org context (e.g., via a route segment like `/[org]/login`), you can include `?org=<id-or-slug>` in links to `/auth/*` to force that org. Otherwise, the OAuth callback derives the org by email.

### Tips

- Cookies are set `secure: true`; use HTTPS in dev (or a tunnel) to see them in the browser.
- Google OAuth redirect URI must be `${ORIGIN}/auth/oauth/google/callback` in your Google Console.
- If your binding is not named `ADMIN_DB`, pass `getAdminDb` to `Kuratchi.auth.handle()`.

## License

MIT

## Security considerations

- Do not expose `CLOUDFLARE_API_TOKEN` to browsers or client-side bundles.
- Restrict CORS in production (`src/lib/worker-template.ts`).
- Use least-privilege API tokens.
