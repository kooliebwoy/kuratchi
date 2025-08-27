# Kuratchi SDK

Toolkit for multi-organization SvelteKit apps. Opinionated. Batteries included.

- SvelteKit-first: one handle wires sessions + helpers into `locals`
- Multi-tenant auth scoped per-organization
- Org databases on D1 or Durable Objects (DO) with a toggle
- Built-in lightweight ORM, JSON-schema migrations, and CLI (with schema snapshotting)

## Documentation

- ORM: ./src/docs/orm.md
- CLI: ./src/docs/cli.md
- Auth: ./src/docs/auth.md
- KV: ./src/docs/kv.md
- R2: ./src/docs/r2.md
- Queues: ./src/docs/queues.md
- Docs index: ./src/docs/README.md

## Install

```sh
npm install kuratchi-sdk
```

## Quickstart
SvelteKit setup and end-to-end org flow in minutes.

1) Add env vars (server-only):

```bash
# Required
KURATCHI_AUTH_SECRET=...                # encryption/pepper for sessions
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_WORKERS_SUBDOMAIN=...        # e.g. yourname.workers.dev

# Admin DB (Kuratchi admin HTTP client)
KURATCHI_ADMIN_DB_NAME=kuratchi-admin   # or your chosen admin DB
KURATCHI_ADMIN_DB_TOKEN=...

# If you want DO-backed org DBs
KURATCHI_GATEWAY_KEY=...
```

2) Add the Kuratchi SvelteKit handle (it auto-reads env and builds the admin client):

```ts
// src/hooks.server.ts
import { Kuratchi } from 'kuratchi-sdk';
export const handle = Kuratchi.auth.handle();
```

### CLI Quickstart (minimal)

```sh
# Create Admin DB (defaults to name: kuratchi-admin)
kuratchi-sdk admin create

# Generate migrations for Admin DB
kuratchi-sdk admin generate-migrations

# Migrate Admin DB (uses local migrations if present, else JSON schema fallback)
kuratchi-sdk admin migrate
```

See `src/docs/cli.md` for full CLI reference.

Set env (server):
- KURATCHI_AUTH_SECRET
- CLOUDFLARE_WORKERS_SUBDOMAIN
- CLOUDFLARE_ACCOUNT_ID
- CLOUDFLARE_API_TOKEN
- KURATCHI_ADMIN_DB_NAME
- KURATCHI_ADMIN_DB_TOKEN
- KURATCHI_GATEWAY_KEY
- ORIGIN (e.g. https://app.example.com)
- Optional for magic link: RESEND_API_KEY, EMAIL_FROM
- Optional for Google OAuth: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

See `src/docs/auth.md` for details.
See `src/docs/orm.md` for details.
See `src/docs/migrations.md` for details.
See `src/docs/cli.md` for details.

> For full guides and examples (Auth, CLI, migrations, environment), see `src/docs/`.

## Quickstart: CLI + Migrations

- __Admin DB__ (stores org metadata and issued tokens)

```sh
# Generate admin migrations (writes to ./migrations-admin and snapshots schema)
kuratchi-sdk admin generate-migrations

# Apply migrations to the admin DB (expects KURATCHI_ADMIN_DB_TOKEN)
kuratchi-sdk admin migrate
```

- __Organization DB schema__ (generate SQL bundle from your org schema DSL)

```sh
# Generate org migrations (writes to ./migrations-org and snapshots schema)
kuratchi-sdk org generate-migrations

# Apply org migrations at runtime (example: D1)
// inside a server route or script
import { Kuratchi } from 'kuratchi-sdk';

const k = new Kuratchi({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  workersSubdomain: process.env.CLOUDFLARE_WORKERS_SUBDOMAIN!,
});

const db = k.d1.database({ databaseName: 'org-acme', apiToken: 'ORG_DB_TOKEN' });
await db.migrate('org'); // reads ./migrations-org
```

> Tip: passing `{ migrate: true }` to `createOrganization()` will auto-run the initial migration (D1/DO) using the built-in schemas.

## Durable Objects quickstart (gateway + worker bootstrap)

Kuratchi can provision DO-backed org databases. The DO worker is deployed automatically with the provided gateway key.

- __Environment__
  - `KURATCHI_GATEWAY_KEY` set on your server (master gateway for signing database tokens)

- __Create an org on DO + migrate__

```ts
// in a server route: src/routes/admin/create-org/+server.ts
const kuratchi = locals.kuratchi;
const res = await kuratchi?.auth?.createOrganization(
  {
    organizationName: 'Acme Inc',
    organizationSlug: 'acme',
    email: 'owner@acme.dev',
    password: 'passw0rd!'
  },
  {
    do: true,        // switch engine to Durable Objects
    migrate: true    // run initial migration with the built-in org schema
  }
);

// BUILT IN ORM AND METHODS EXAMPLE
const org = await kuratchi?.auth?.forOrganization(session?.organizationId);
const user = await org?.getUser(session?.user.id); // built in org methods using the built in orm

// BUILT IN ORM EXAMPLE
const orgDBwithORM = await kuratchi?.orgDatabaseClient({ schema }); // org db client with orm
const user = await orgDBwithORM.users.where({ id: session?.user.id }).findFirst(); // build your own queries

// DRIZZLE EXAMPLE
const drizzleProxy = await kuratchi?.do.getDrizzleProxy();
const db = drizzle(drizzleProxy, { schema });
const result = await db.query.users.findFirst({
	with: {
		posts: true			
	},
});
```

## License

MIT

## Security considerations

- Do not expose `CLOUDFLARE_API_TOKEN` to browsers or client-side bundles.
- Restrict CORS in production (`src/lib/worker-template.ts`).
- Use least-privilege API tokens.
