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

### SvelteKit‑first (recommended)

- Kuratchi.auth.handle({ getAdminDb?, getEnv?, cookieName? })
  - Wires built‑in `/auth/*` routes and sets `locals`
  - Requires the Kuratchi admin HTTP client shape for the admin DB (query; drizzleProxy optional)
- After the handle runs on each request:
  - `locals.kuratchi`: admin/org operations (create/list/delete orgs)
  - `locals.auth`: org‑scoped AuthService (create user, sessions, etc.)
  - `locals.user`, `locals.session`: current authenticated user/session
- Convenience client calls built on the routes:
  - `Kuratchi.auth.signIn.magicLink.send(email, { organizationId?, redirectTo?, fetch? })`
  - `Kuratchi.auth.signIn.oauth.google.startUrl({ organizationId, redirectTo? })`

Quick examples

```ts
// src/hooks.server.ts
import { Kuratchi } from 'kuratchi';
export const handle = Kuratchi.auth.handle();
```

```ts
// create an organization from a protected route action
export const actions = {
  createOrg: async ({ locals, request }) => {
    const data = await request.formData();
    const organizationName = String(data.get('name') || '').trim();
    if (!locals.kuratchi) return { error: 'not_initialized' };
    const org = await locals.kuratchi.createOrganization({ organizationName });
    return { ok: true, org };
  }
};
```

```ts
// use the org‑scoped auth service
export const actions = {
  invite: async ({ locals, request }) => {
    if (!locals.auth) return { error: 'unauthorized' };
    const data = await request.formData();
    const email = String(data.get('email') || '').trim();
    await locals.auth.sendMagicLink(email, 'https://your.app/auth/magic/callback');
    return { ok: true };
  }
};
```

### Advanced (non‑SvelteKit scripts)

If you need to provision outside of SvelteKit (e.g., a Node script), you can instantiate:

```ts
import { Kuratchi } from 'kuratchi';
const kuratchi = new Kuratchi({ apiToken, accountId, workersSubdomain, /* optional: auth */ });

await kuratchi.d1.createDatabase('org‑db');
// If constructed with `auth`, you can also call kuratchi.auth.createOrganization(...)
```

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

- KURATCHI_AUTH_SECRET
- CLOUDFLARE_WORKERS_SUBDOMAIN
- CLOUDFLARE_ACCOUNT_ID
- CLOUDFLARE_API_TOKEN

- KURATCHI_ADMIN_DB_NAME
- KURATCHI_ADMIN_DB_TOKEN

- ORIGIN
- RESEND_API_KEY or RESEND_EMAIL_API_KEY
- EMAIL_FROM or KURATCHI_EMAIL_FROM

## CLI (Admin D1 provisioning)

Kuratchi includes a small CLI to create and delete the admin D1 database via Cloudflare.

- __Create__: `kuratchi admin create [--name <db>] [--no-spinner] --account-id <id> --api-token <token> --workers-subdomain <sub>`
- __Destroy__: `kuratchi admin destroy --id <dbuuid> [--no-spinner] --account-id <id> --api-token <token>`
- __Env fallbacks__: CF_ACCOUNT_ID | CLOUDFLARE_ACCOUNT_ID, CF_API_TOKEN | CLOUDFLARE_API_TOKEN, CF_WORKERS_SUBDOMAIN | CLOUDFLARE_WORKERS_SUBDOMAIN
  - __Config discovery__: kuratchi.config.json | kuratchi.config.mjs | kuratchi.config.js | kuratchi.config.example.mjs or package.json { kuratchi: { accountId, apiToken, workersSubdomain } }
    - Use .mjs/.js to reference `process.env` for secrets. JSON cannot reference env.
    - You can copy `kuratchi.config.example.mjs` to `kuratchi.config.mjs` as a starting point.
  - __Defaults__: If `--name` is omitted, the database will be created as `kuratchi-admin`.
  - __Spinner__: Shows a progress spinner on TTY by default; pass `--no-spinner` to disable. Spinner writes to stderr and will not affect JSON output on stdout.

Examples:

```sh
# Create admin DB (name defaults to kuratchi-admin)
kuratchi admin create \
  --account-id "$CLOUDFLARE_ACCOUNT_ID" \
  --api-token "$CLOUDFLARE_API_TOKEN" \
  --workers-subdomain "$CLOUDFLARE_WORKERS_SUBDOMAIN"

# Delete by database UUID
kuratchi admin destroy \
  --id <dbuuid> \
  --account-id "$CF_ACCOUNT_ID" \
  --api-token "$CF_API_TOKEN"
```

## SvelteKit auth quickstart (strict env-only)

Kuratchi ships a SvelteKit handle that wires up session cookies, magic link, and Google OAuth endpoints for you. It is configured strictly via environment variables read from `$env/dynamic/private` — there is no fallback to Workers bindings. The admin DB is accessed via the Kuratchi admin HTTP client only (`KURATCHI_ADMIN_DB_NAME`/`KURATCHI_ADMIN_DB_TOKEN` + `CLOUDFLARE_WORKERS_SUBDOMAIN`).

1) hooks.server.ts

```ts
import { Kuratchi } from 'kuratchi';

// Strict env-only setup. Reads all required values from $env/dynamic/private
export const handle = Kuratchi.auth.handle();
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
  - Admin DB support: only the Kuratchi admin HTTP client is supported; Workers D1 bindings and sqlite‑proxy function shapes are not supported for the admin DB.

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
    // Exposed KuratchiAuth instance for this request
    kuratchi?: unknown;
    // Organization-scoped AuthService, set when a valid session is present
    auth: unknown | null;
    // Current authenticated user (shape depends on your schema)
    user: any | null;
    // Session data parsed from cookie
    session: any | null;
    setSessionCookie: (value: string, opts?: { expires?: Date }) => void;
    clearSessionCookie: () => void;
  }
}
```

### Complete SvelteKit example (copy‑paste)

1) .env

```env
# Core
KURATCHI_AUTH_SECRET=dev_super_secret
CLOUDFLARE_WORKERS_SUBDOMAIN=your-workers-subdomain
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token

# Admin DB (provision with the CLI)
KURATCHI_ADMIN_DB_NAME=kuratchi-admin
KURATCHI_ADMIN_DB_TOKEN=your-admin-db-token

# Email + origin
RESEND_EMAIL_API_KEY=your-resend-key
KURATCHI_EMAIL_FROM="Acme <noreply@acme.com>"
ORIGIN=http://localhost:5173

# Optional: Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

2) src/hooks.server.ts

```ts
import { Kuratchi } from 'kuratchi';

// Strict env-only; reads from $env/dynamic/private
export const handle = Kuratchi.auth.handle();
```

3) src/routes/login/+page.svelte

```svelte
<script lang="ts">
  export let data;
</script>

<form method="post">
  <input name="email" type="email" placeholder="you@example.com" required />
  <button type="submit">Email me a magic link</button>
  {#if data?.error}<p style="color:red">{data.error}</p>{/if}
</form>

<p><a href="/auth/oauth/google/start?redirectTo=/">Continue with Google</a></p>
```

4) src/routes/login/+page.server.ts

```ts
import { Kuratchi } from 'kuratchi';

export const actions = {
  default: async ({ request, fetch, url }) => {
    const form = await request.formData();
    const email = String(form.get('email') || '').trim();
    const redirectTo = url.searchParams.get('redirectTo') || '/';
    const res = await Kuratchi.auth.signIn.magicLink.send(email, { redirectTo, fetch });
    if (!res.ok) return { error: res.error };
    return { ok: true };
  }
};
```

5) Optional: use locals in +layout.server.ts

```ts
import { redirect } from '@sveltejs/kit';

export const load = async ({ locals }) => {
  if (!locals.user) throw redirect(302, '/login');
  return { user: locals.user };
};
```

Note: The handle lazily initializes its internals. You must set all required env vars before using flows that need them (e.g., admin DB for magic link/org lookup), but not every route touches every service. The admin DB is connected using the Kuratchi admin HTTP client; Workers D1 bindings are not supported.

Required env for the SvelteKit handle (strict env-only via `$env/dynamic/private`):

- KURATCHI_AUTH_SECRET
- KURATCHI_ADMIN_DB_NAME
- KURATCHI_ADMIN_DB_TOKEN
- CLOUDFLARE_WORKERS_SUBDOMAIN
- CLOUDFLARE_ACCOUNT_ID
- CLOUDFLARE_API_TOKEN

Email + app origin (required for magic link and OAuth):

- RESEND_EMAIL_API_KEY or RESEND_API_KEY
- KURATCHI_EMAIL_FROM or EMAIL_FROM
- ORIGIN

Optional:

- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
- AUTH_WEBHOOK_SECRET

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

### Practical: Using locals.auth and locals.user

The SvelteKit handle sets `locals.user`, `locals.session`, and an organization‑scoped `locals.auth` (an `AuthService`). Here are common patterns:

- Update a profile in a protected page

```ts
// src/routes/settings/+page.server.ts
import { redirect } from '@sveltejs/kit';

export const load = async ({ locals }) => {
  if (!locals.user) throw redirect(302, '/login');
  return { user: locals.user };
};

export const actions = {
  updateProfile: async ({ locals, request }) => {
    if (!locals.user || !locals.auth) throw redirect(302, '/login');
    const data = await request.formData();
    const name = String(data.get('name') ?? '').trim() || null;
    const firstName = String(data.get('firstName') ?? '').trim() || null;
    const lastName = String(data.get('lastName') ?? '').trim() || null;
    await locals.auth.updateUser(locals.user.id, { name, firstName, lastName });
    return { ok: true };
  }
};
```

- Logout current session (invalidate in DB + clear cookie)

```ts
// src/routes/logout/+server.ts
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, cookies }) => {
  const cookie = cookies.get('kuratchi_session'); // default cookie name
  if (cookie && locals.auth) {
    await locals.auth.invalidateSession(cookie);
  }
  locals.clearSessionCookie();
  return new Response(null, { status: 303, headers: { Location: '/' } });
};
```

- Logout all sessions for the user

```ts
// src/routes/logout-all/+server.ts
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
  if (!locals.user || !locals.auth) return new Response('Unauthorized', { status: 401 });
  await locals.auth.invalidateAllSessions(locals.user.id);
  locals.clearSessionCookie();
  return new Response(null, { status: 303, headers: { Location: '/' } });
};
```

- Customize the session cookie name (optional)

```ts
// src/hooks.server.ts
import { Kuratchi } from 'kuratchi';

export const handle = Kuratchi.auth.handle({ cookieName: 'my_app_session' });
// If you change this, also update cookies.get('<name>') in your logout route
```

## License

MIT

## Security considerations

- Do not expose `CLOUDFLARE_API_TOKEN` to browsers or client-side bundles.
- Restrict CORS in production (`src/lib/worker-template.ts`).
- Use least-privilege API tokens.
