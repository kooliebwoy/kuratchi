# Auth Guide

The Kuratchi auth module handles session management, organization-aware user flows, and SvelteKit integration. This guide explains how to configure the environment, initialize auth, and tap into the helper APIs for admin and per-organization operations.

---

## Environment Requirements

Set these variables in `.env` before instantiating auth. The defaults assume you have already provisioned the admin database via the CLI.

| Key | Purpose |
| --- | --- |
| `KURATCHI_AUTH_SECRET` | Server-side secret used for password hashing pepper & cookie encryption |
| `KURATCHI_GATEWAY_KEY` | Master key for the Durable Object gateway (needed for org database access) |
| `KURATCHI_ADMIN_DB_NAME` | Admin database name (defaults to `kuratchi-admin`) |
| `KURATCHI_ADMIN_DB_TOKEN` | Admin database token returned by `init-admin-db` |
| `CLOUDFLARE_WORKERS_SUBDOMAIN` | Cloudflare workers subdomain that hosts the Durable Object worker |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID with D1 access |
| `CLOUDFLARE_API_TOKEN` | API token with Workers + D1 permissions |
| `EMAIL_FROM` | Email sender used in magic link flows |
| `RESEND_API_KEY` | Required to send transactional emails (magic link, verification) |
| `ORIGIN` | Base URL for building magic link and OAuth callback URLs |
| `GOOGLE_CLIENT_ID/SECRET` | Optional: enable Google OAuth |

Additional aliases like `KURATCHI_CLOUDFLARE_*` are also supported (see `auth.instance()` implementation).

---

## Quickstart: SvelteKit Handle

Add the SDK handle to `src/hooks.server.ts` to automatically manage sessions, cookies, and org resolution:

```ts
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { auth } from 'kuratchi-sdk';

export const handle: Handle = auth.handle();
```

This sets `locals.session`, `locals.user`, and `locals.kuratchi` for use in server loads/actions. It also exposes magic link & OAuth endpoints (see below).

---

## Programmatic Auth Access

### Create an auth instance

```ts
import { auth } from 'kuratchi-sdk';

// Reads env by default. Override with partial config.
const authInstance = auth.instance({
  origin: 'https://app.example.com', // optional override
});
```

`auth.instance()` validates required env vars and constructs `KuratchiAuth` with a Durable Object-backed admin client.

### Admin helper (organization provisioning)

```ts
import { auth } from 'kuratchi-sdk';

const admin = await auth.admin();

// Create an organization + org database + seed user (if email/password provided)
await admin.createOrganization({
  organizationName: 'Acme Corp',
  organizationSlug: 'acme',
  email: 'founder@acme.test',
  password: 'welcome-acme'
});

// List organizations
const orgs = await admin.listOrganizations();

// Fetch an organization + soft delete
const org = await admin.getOrganization(orgs[0].id);
await admin.deleteOrganization(org.id);
```

The admin helper exposes:

- `createOrganization(data, options?)`
- `listOrganizations()`
- `getOrganization(id)`
- `deleteOrganization(id)`
- `authenticate(email, password)`
- `forOrganization(organizationId)` → returns `AuthService`
- `getOrganizationDb(organizationId)` → typed ORM client for org DB
- `client()` → admin ORM client

### Organization-scoped AuthService

```ts
const orgAuth = await admin.forOrganization('org-id');

const user = await orgAuth.createUser({
  email: 'user@example.com',
  password: 'strong-password',
  name: 'Example User'
});

const session = await orgAuth.createAuthSession('user@example.com', 'strong-password');
await orgAuth.verifyMagicLink({ token: '...', organizationId: 'org-id' });
```

`AuthService` exposes methods such as `createUser`, `createAuthSession`, `validateSessionToken`, `refreshSession`, `createMagicLinkToken`, `verifyMagicLink`, and `deleteOrganization` helpers that use the organization’s ORM client under the hood.

---

## Sign-in Shortcuts

The namespace also exposes high-level sign-in helpers that wrap the instance flows.

```ts
import { auth } from 'kuratchi-sdk';

// Magic link (auto resolves organization by email when not provided)
await auth.signIn.magicLink('user@example.com', {
  redirectTo: '/dashboard'
});

// Credentials
const signIn = await auth.signIn.credentials('user@example.com', 'password');
if (signIn.success) {
  const { cookie, user, session } = signIn;
  // Set cookie on response, etc.
}

// Google OAuth start url
const href = auth.signIn.oauth.google.startUrl({
  organizationId: 'org-id',
  redirectTo: '/dashboard'
});
```

---

## Magic Link & OAuth Endpoints

With `auth.handle()` wired, these endpoints are available automatically:

- `POST /auth/magic/send` — body `{ email, organizationId?, redirectTo? }`
- `GET /auth/magic/callback` — query `token` & `org`
- `GET /auth/oauth/google/start`
- `GET /auth/oauth/google/callback`

They use `Resend` for emails and Google OAuth credentials when provided.

---

## Accessing ORM Clients from SvelteKit Locals

Inside a server `load` or `action`, use the helpers attached to `locals.kuratchi`:

```ts
export const load = async ({ locals }) => {
  const user = locals.user;
  const session = locals.session;
  const orgClient = await locals.kuratchi.orgDatabaseClient();

  const users = await orgClient.users.many();
  return { user, session, users };
};
```

`locals.kuratchi.orgDatabaseClient(orgId?)` returns a JSON-schema typed client for the active or specified organization.

---

## Error Handling Tips

- Ensure `KURATCHI_GATEWAY_KEY`, `KURATCHI_ADMIN_DB_TOKEN`, and `EMAIL_FROM` are set; missing secrets cause instantiation errors.
- `createOrganization()` expects the admin schema tables (`organizations`, `databases`, `dbApiTokens`, `organizationUsers`). Run `init-admin-db` first.
- Durable Object provisioning is idempotent; re-running `createOrganization()` with the same slug/email reuses the existing database.
- Prefer typed schemas: pass `organizationSchema`/`adminSchema` in `auth.instance()` when using custom tables.
