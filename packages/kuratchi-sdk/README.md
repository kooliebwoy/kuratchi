# Kuratchi SDK for SvelteKit

End-to-end auth and multi-tenant org databases backed by Cloudflare (Workers + D1 via Durable Objects gateway). This package provides:

- 🔐 **Authentication** - Magic links, OAuth (Google, GitHub, Microsoft), email/password
- 🗄️ **Database** - Durable Objects-backed SQLite with HTTP client and typed ORM
- 💾 **Storage** - KV, R2, D1 bindings with unified access
- 🏢 **Multi-tenancy** - Organization management with per-org databases
- 🛠️ **CLI** - Admin DB provisioning and migration generation
- 🎯 **Type-safe ORM** - JSON schema-based with includes, JSON columns, migrations

Below is a quickstart for SvelteKit, required environment variables, admin DB setup, and organization workflows.

> **Full Documentation:** [`src/docs/README.md`](./src/docs/README.md) | [Auth](./src/docs/auth.md) | [Database](./src/docs/database.md) | [ORM](./src/docs/orm.md) | [CLI](./src/docs/cli.md)

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

### Option A: Unified API (Recommended)

Configure everything in one place:

```ts
// src/hooks.server.ts
import { kuratchi } from 'kuratchi-sdk';
import { sessionPlugin, adminPlugin, organizationPlugin, emailAuthPlugin, oauthPlugin } from 'kuratchi-sdk/auth';
import { adminSchema } from '$lib/schemas/admin';
import { organizationSchema } from '$lib/schemas/organization';

const app = kuratchi({
  auth: {
    plugins: [
      sessionPlugin(),
      adminPlugin({ adminSchema }),
      organizationPlugin({ organizationSchema }),
      emailAuthPlugin({
        provider: 'resend',
        apiKey: process.env.RESEND_API_KEY!,
        from: process.env.EMAIL_FROM!
      }),
      oauthPlugin({
        providers: [
          {
            name: 'google',
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!
          }
        ]
      })
    ]
  },
  storage: {
    kv: { default: 'MY_KV' },
    r2: { uploads: 'USER_UPLOADS' },
    d1: { analytics: 'ANALYTICS_DB' }
  }
});

export const handle = app.handle;
```

> **Note:** You must define your own schemas. See `node_modules/kuratchi-sdk/src/lib/schema/*.example.ts` for reference structures.

### Option B: Modular API

Import only what you need:

```ts
// src/hooks.server.ts
import { createAuthHandle, sessionPlugin, adminPlugin, emailAuthPlugin } from 'kuratchi-sdk/auth';

export const handle = createAuthHandle({
  plugins: [
    sessionPlugin(),
    adminPlugin(),
    emailAuthPlugin({
      provider: 'resend',
      apiKey: process.env.RESEND_API_KEY!,
      from: process.env.EMAIL_FROM!
    })
  ],
  // Storage bindings
  kvNamespaces: { default: 'MY_KV' },
  r2Buckets: { uploads: 'USER_UPLOADS' }
});
```

**What You Get:**

- Session cookies managed under `locals.kuratchi`, `locals.user`, and `locals.session`
- Magic link endpoints: `/auth/magic/send` and `/auth/magic/callback`
- OAuth routes: `/auth/oauth/{provider}/start` and `/auth/oauth/{provider}/callback`
- Storage access: `locals.kuratchi.kv`, `locals.kuratchi.r2`, `locals.kuratchi.d1`
- Server helper: `locals.kuratchi.orgDatabaseClient(orgId?)` for org DB ORM client

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
KURATCHI_ADMIN_DB_TOKEN=... # from CLI output (100-year TTL)
```

**Important:** Admin tokens have a 100-year TTL to prevent expiration deadlock. If compromised or expired, regenerate with:
```bash
npx kuratchi-sdk refresh-admin-token
```
See `TOKEN_MANAGEMENT.md` for details.

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

### Import Paths

The SDK supports two import styles:

```ts
// Unified API (all features)
import { kuratchi } from 'kuratchi-sdk';
import type { KuratchiConfig } from 'kuratchi-sdk';

// Modular imports (subpaths)
import { createAuthHandle, sessionPlugin, adminPlugin } from 'kuratchi-sdk/auth';
import { database, KuratchiDatabase } from 'kuratchi-sdk/database';
import { kv } from 'kuratchi-sdk/kv';
import { r2 } from 'kuratchi-sdk/r2';
import { d1 } from 'kuratchi-sdk/d1';

// Legacy namespace imports (backward compatible)
import { auth, database, kv, r2, d1 } from 'kuratchi-sdk';
```

### Database Operations

```ts
import { database } from 'kuratchi-sdk';
import { organizationSchema } from '$lib/schema/organization';

// ORM client with typed schema
const ormClient = await database.client({
  databaseName: 'my-org-db',
  dbToken: 'token-here',
  schema: organizationSchema
});

// Type-safe queries
const { data: users } = await ormClient.users
  .where({ deleted_at: { is: null } })
  .include({ posts: true })
  .many();

// Direct SQL access (schema-less)
const httpClient = database.forDatabase({
  databaseName: 'my-org-db',
  dbToken: 'token-here'
});

const result = await httpClient.query('SELECT * FROM users WHERE active = ?', [true]);

// Admin database helper
const admin = await database.admin();
const { data: orgs } = await admin.orm.organizations.many();

// Create new database
const newDb = await database.create({
  name: 'new-org-db',
  migrate: true,
  schema: organizationSchema
});
```

### Auth Operations (Programmatic)

```ts
import { auth } from 'kuratchi-sdk';

// Admin operations
const adminAuth = await auth.admin();
const newOrg = await adminAuth.createOrganization({
  organizationName: 'Acme Corp',
  organizationSlug: 'acme',
  email: 'admin@acme.com',
  password: 'secure-password'
});

// Magic link (requires email auth plugin in handle)
// POST to /auth/magic/send with { email, organizationId?, redirectTo? }

// Credentials (requires credentials plugin)
// POST to /auth/credentials/login with { email, password, organizationId? }

// OAuth (requires oauth plugin)
// Redirect to /auth/oauth/google/start?org=xxx&redirectTo=/dashboard
```

## Runtime ORM: Quickstart and Includes

The SDK ships a tiny runtime ORM optimized for Workers/DO. You’ll typically obtain a typed client in two ways:

- SvelteKit server: `await locals.kuratchi.orgDatabaseClient()`
- Programmatic admin helper: `const admin = await auth.admin({ organizationSchema }); const db = admin.getOrganizationDb(orgId)`

Both paths create a JSON-schema based client, so JSON columns declared in your schema (`type: 'json'`) are automatically serialized on writes and deserialized on reads.

### Basic operations

```ts
// Insert
await db.users.insert({ id: crypto.randomUUID(), email: 'a@b.co', name: 'Alice' });

// Query many
const users = await db.users
  .where({ deleted_at: { is: null } })
  .orderBy({ created_at: 'desc' })
  .limit(20)
  .offset(1) // page 1 when limit set
  .many();

// Get single
const one = await db.users.where({ id: 'user_1' }).first();

// Count
const cnt = await db.users.count({ status: 'active' });

// Delete
await db.users.delete({ id: 'user_1' });
```

### Chainable updates (single vs many)

```ts
// Single-row update: updates the first matched row (by id when present)
await db.users
  .where({ email: 'a@b.co', deleted_at: { is: null } })
  .update({ status: 'active' });

// Multi-row update: updates all rows that match the filter
await db.users
  .where({ status: 'pending', deleted_at: { is: null } })
  .updateMany({ status: 'active' });
```

### JSON columns

When your schema marks a column with `{ type: 'json' }`, you can pass/receive rich objects:

```ts
// metadata is a JSON column
await db.organizations
  .where({ id: 'org_1' })
  .update({ metadata: { theme: 'dark', features: ['a', 'b'] } });

const res = await db.organizations.where({ id: 'org_1' }).first();
// res.data.metadata is an object, not a JSON string
```

### Includes (schema‑driven, simple)

`include()` lets you eager‑load related tables based on foreign keys defined in your JSON schema. It “just works”:

- If the current table has a foreign key to `users.id`, then `.include({ users: true })` will attach the joined `users` row as `row.users`.
- For 1‑to‑many, use the related table name; it will attach `row.<table>` as an array.

Basic include (parent):

```ts
// posts(userId) -> users(id)
const res = await db.posts
  .where({ published: true })
  .include({ users: true })
  .many();

// res.data[0].users.name -> parent user's name
```

Basic include (children):

```ts
// users(id) <- session(userId)
const res = await db.users
  .where({ deleted_at: { is: null } })
  .include({ session: true })
  .many();

// res.data[0].session -> array of sessions for this user
```

Select specific columns and alias:

```ts
const res = await db.orders
  .include({
    users: { select: ['id', 'name'], as: 'buyer' },
  })
  .many();

// res.data[0].buyer -> { id, name }
```

Notes:

- Includes are resolved from schema foreign keys; no manual key wiring required.
- You can combine `include` with `select`, `orderBy`, `limit`, and `offset` on the base query.

## Organizations Model

- Each __organization__ has its own database. Users belong to one or more orgs via admin DB relations.
- Session cookies include an `organizationId` and are validated per org.
- Server helper `locals.kuratchi.orgDatabaseClient()` returns an ORM client for the active org (from cookie) or for a provided `orgId`.
- Creating an organization with the Auth API sets up its database and issues a usable API token.

Typical flows:

- Admin signs up and __creates an organization__; receives a session cookie scoped to that org.
- Users sign in via magic link, credentials, or Google OAuth; the SDK resolves org by email mapping in the admin DB.


