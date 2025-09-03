# Kuratchi SDK for SvelteKit

End-to-end auth and multi-tenant org databases backed by Cloudflare (Workers + D1 via Durable Objects gateway). This package provides clean namespace APIs for:

- __Database operations__ via `database` namespace with schema-less and ORM clients
- __Authentication__ via `auth` namespace with magic links, credentials, and OAuth
- __SvelteKit integration__ with automatic cookie/session management
- __Admin DB provisioning CLI__ to create the admin database and token
- __Organization-aware APIs__ to create orgs and sign users in to the correct org

Below is a quickstart for SvelteKit, required environment variables, admin DB setup, migrations, and how organizations work.

## Quickstart (SvelteKit)

1) __Install and build__

```sh
npm install
npm run build
```

2) __Configure .env__ (at your app root)

Required for auth and DO access:

```
# Auth + email
KURATCHI_AUTH_SECRET=your-long-random-secret
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM="Acme <auth@acme.test>"
ORIGIN=https://your-app.example.com # needed for OAuth callback URLs

# Cloudflare / DO access
CLOUDFLARE_WORKERS_SUBDOMAIN=your-subdomain
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
KURATCHI_GATEWAY_KEY=your-gateway-key

# Admin DB (filled in after provisioning step)
KURATCHI_ADMIN_DB_NAME=kuratchi-admin
KURATCHI_ADMIN_DB_TOKEN=to-be-set-after-cli

# Optional: Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Aliases the CLI also understands (if you already have these set): `GATEWAY_KEY`, `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `WORKERS_SUBDOMAIN`, and `KURATCHI_CLOUDFLARE_*` variants.

3) __Wire the SvelteKit handle__

Create `src/hooks.server.ts`:

```ts
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { auth } from 'kuratchi-sdk';

export const handle: Handle = auth.handle();
```

You now get:

- Cookies managed under `locals.kuratchi` with mirrors as `locals.user` and `locals.session`.
- Magic link endpoints: `/auth/magic/send` and `/auth/magic/callback`.
- Google OAuth: `/auth/oauth/google/start` and `/auth/oauth/google/callback`.
- Server helper: `locals.kuratchi.orgDatabaseClient(orgId?)` to get an org DB ORM client.

4) __Use in routes__ (examples)

```ts
// src/routes/+layout.server.ts
export const load = async ({ locals }) => {
  return { user: locals.user, session: locals.session };
};

// Protect a page
// src/routes/app/+page.server.ts
export const load = async ({ locals }) => {
  if (!locals.session) return { status: 302, redirect: '/login' } as any;
  return {};
};

// Magic link send (client fetch to this endpoint expected)
// POST /auth/magic/send with { email, organizationId?, redirectTo? }

// Google OAuth start URL (server)
import { redirect } from '@sveltejs/kit';
import { auth } from 'kuratchi-sdk';
export const GET = async ({ url }) => {
  const orgId = url.searchParams.get('org')!; // resolve per your app
  const href = auth.signIn.oauth.google.startUrl({ organizationId: orgId, redirectTo: '/' });
  throw redirect(302, href);
};
```

## Provision the Admin Database

The admin DB stores organizations, users, and per-org database metadata. Use the CLI from this repo root (it auto-loads `.env`):

```sh
# Try with migrate=true; on failure it falls back to migrate=false
node bin/kuratchi-sdk.mjs init-admin-db --debug
```

Output includes a token. Add it to your `.env`:

```
KURATCHI_ADMIN_DB_TOKEN=... # from CLI output
```

If envs are not picked up, pass flags explicitly:

```sh
node bin/kuratchi-sdk.mjs init-admin-db \
  --gatewayKey "$KURATCHI_GATEWAY_KEY" \
  --workersSubdomain "$CLOUDFLARE_WORKERS_SUBDOMAIN" \
  --accountId "$CLOUDFLARE_ACCOUNT_ID" \
  --apiToken "$CLOUDFLARE_API_TOKEN" \
  --debug
```

## Migrations

- The SDK ships admin schema DSL internally; `init-admin-db` applies it when creating the admin DB (with automatic fallback if migration fails).
- For organization databases, the SDK uses an organization schema. Migrations are applied when new org databases are created via the SDK.

Generate migrations from a schema file if you maintain your own DSL:

```sh
node bin/kuratchi-sdk.mjs generate-migrations --schema path/to/schema.ts --outDir migrations --tag init
```

Builds will package your library (`dist/`). At runtime the SDK applies the required migrations during DB creation flows.

## API Reference

### Database Namespace

```ts
import { database } from 'kuratchi-sdk';

// Create a database instance (auto-reads env)
const instance = database.instance();

// Schema-less database access - direct SQL operations
const orgDb = database.forDatabase({
  databaseName: 'my-org-db',
  dbToken: 'token-here'
});

// Use HTTP client methods
const users = await orgDb.query('SELECT * FROM users WHERE active = ?', [true]);
await orgDb.exec('UPDATE users SET last_login = ? WHERE id = ?', [new Date(), userId]);
await orgDb.batch([
  { query: 'INSERT INTO logs (message) VALUES (?)', params: ['User logged in'] },
  { query: 'UPDATE users SET login_count = login_count + 1 WHERE id = ?', params: [userId] }
]);

// ORM client with schema (for type safety)
const ormClient = await database.client({
  databaseName: 'my-org-db',
  dbToken: 'token-here',
  schema: mySchema
});

// Admin database helper (auto-configured from env)
const admin = await database.admin();
const orgs = await admin.orm.organizations.many();

// Create new database
const result = await database.create({
  name: 'new-org-db',
  migrate: true,
  schema: orgSchema
});
```

### Auth Namespace

```ts
import { auth } from 'kuratchi-sdk';

// Create auth instance (auto-reads env)
const authInstance = auth.instance();

// Admin operations
const adminAuth = await auth.admin();
const newOrg = await adminAuth.createOrganization({
  organizationName: 'Acme Corp',
  organizationSlug: 'acme',
  email: 'admin@acme.com',
  password: 'secure-password'
});

// Sign-in helpers
await auth.signIn.magicLink('user@example.com', {
  organizationId: 'org-123',
  redirectTo: '/dashboard'
});

const result = await auth.signIn.credentials('user@example.com', 'password', {
  organizationId: 'org-123'
});

// OAuth URLs
const googleUrl = auth.signIn.oauth.google.startUrl({
  organizationId: 'org-123',
  redirectTo: '/dashboard'
});

// SvelteKit handle
export const handle = auth.handle();
```

## Organizations Model

- Each __organization__ has its own database. Users belong to one or more orgs via admin DB relations.
- Session cookies include an `organizationId` and are validated per org.
- Server helper `locals.kuratchi.orgDatabaseClient()` returns an ORM client for the active org (from cookie) or for a provided `orgId`.
- Creating an organization with the Auth API sets up its database and issues a usable API token.

Typical flows:

- Admin signs up and __creates an organization__; receives a session cookie scoped to that org.
- Users sign in via magic link, credentials, or Google OAuth; the SDK resolves org by email mapping in the admin DB.


