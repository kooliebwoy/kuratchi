# Database Guide

The `database` namespace provisions Cloudflare D1 databases with dedicated Durable Object workers and ships helpers for schema-managed ORM clients or raw SQL access. Everything routes through signed per-database tokens generated with your gateway key.

---

## Environment Requirements

Set these variables before instantiating the database API (for example in `.env`).

| Key | Purpose |
| --- | --- |
| `CF_WORKERS_SUBDOMAIN` / `CLOUDFLARE_WORKERS_SUBDOMAIN` | Workers subdomain that hosts the Durable Object worker |
| `CF_ACCOUNT_ID` / `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID used for Worker deployments |
| `CF_API_TOKEN` / `CLOUDFLARE_API_TOKEN` | API token with permissions to deploy Workers and access D1 |
| `KURATCHI_GATEWAY_KEY` | Gateway key used to sign per-database tokens |
| `KURATCHI_ADMIN_DB_TOKEN` | Token for the admin database (used by `database.connect()`) |
| `KURATCHI_ADMIN_DB_NAME` | Admin database name (defaults to `kuratchi-admin`) |
| `KURATCHI_DO_SCRIPT_NAME` | Optional override for the Durable Object worker name (defaults to `kuratchi-do-internal`) |

---

## Instantiate `KuratchiDatabase`

Most applications can rely on the convenience namespace:

```ts
import { database } from 'kuratchi-sdk';

const instance = database.instance();
```

`database.instance()` reads the environment variables above. Override specific fields as needed:

```ts
const instance = database.instance({
  workersSubdomain: 'custom-subdomain',
  scriptName: 'custom-do-script'
});
```

You can also construct the class directly when you want to supply credentials explicitly:

```ts
import { KuratchiDatabase } from 'kuratchi-sdk/database';

const instance = new KuratchiDatabase({
  apiToken: process.env.CF_API_TOKEN!,
  accountId: process.env.CF_ACCOUNT_ID!,
  workersSubdomain: process.env.CF_WORKERS_SUBDOMAIN!,
  scriptName: 'kuratchi-do-internal'
});
```

---

## Provision a Database

`database.create()` provisions a D1 database, deploys a dedicated worker, and optionally applies the initial schema:

```ts
import { database } from 'kuratchi-sdk';
import { organizationSchema } from '$lib/schema/organization';

const { databaseName, token, workerName } = await database.create({
  name: 'org-acme-db',
  migrate: true,
  schema: organizationSchema,
  r2: true // optional: also provision and bind an R2 bucket
});
```

- Requires `KURATCHI_GATEWAY_KEY` in the environment.
- `migrate: true` runs `synchronizeSchema` against the worker using the provided schema (DSL or normalized schema object). You can scope migrations to a folder name via `schemaName` when bundling assets.
- The return payload includes the database token. Persist it in your admin database for future connections.

`database.delete()` currently throws because delete flows are not implemented yet.

---

## Get a Typed ORM Client

Use `database.client()` to create a schema-aware ORM client for an existing database.

```ts
import { database } from 'kuratchi-sdk';
import { organizationSchema } from '$lib/schema/organization';

const orm = await database.client({
  databaseName: 'org-acme-db',
  dbToken: 'token-from-admin-db',
  schema: organizationSchema,
  skipMigrations: false // set true when you manage migrations yourself
});
```

- The helper injects `KURATCHI_GATEWAY_KEY` from the environment unless you override it.
- The client auto-detects the best transport: direct D1 bindings when present (`wrangler dev`/Worker runtime) or HTTP via the deployed worker otherwise.
- Schema synchronization runs by default; opt out with `skipMigrations` if you run migrations elsewhere.
- KV helpers are not provided in D1 mode; the client focuses on relational tables plus JSON column hydration.

If you only want the ORM layer and already have a `D1Client`, import `createOrmClient()` from `kuratchi-sdk/database` instead of using the namespace helper.

---

## Raw SQL Access

For SQL utilities without the ORM surface, use `database.forDatabaseHttpClient()`:

```ts
const sql = database.forDatabaseHttpClient({
  databaseName: 'org-acme-db',
  dbToken: 'token-from-admin-db'
});

await sql.exec('PRAGMA journal_mode = WAL;');
const rows = await sql.query('SELECT * FROM users WHERE status = ?', ['active']);
```

The returned object exposes `query`, `exec`, `batch`, `raw`, and `first`, all authenticated with the per-database token and gateway key.

---

## Admin Helper

`database.connect()` uses the admin environment variables to return an admin connection with both ORM and SQL helpers:

```ts
const { instance, orm, query, exec, batch, raw, first } = await database.connect({
  databaseName: 'ignored', // admin values are read from env
  dbToken: 'ignored',
  gatewayKey: 'ignored',
  schema: {} as any // ignored; admin schema is bundled internally
});
```

Supply the placeholder arguments to satisfy TypeScript; at runtime the helper automatically reads `KURATCHI_GATEWAY_KEY`, `KURATCHI_ADMIN_DB_TOKEN`, and `KURATCHI_ADMIN_DB_NAME`.

---

## Worker Deployment & Migration Notes

- `KuratchiDatabase` deploys a dedicated worker per database (name derived from the database) and waits for readiness before applying migrations.
- When an R2 bucket is requested via `r2`, it is provisioned and bound to the worker automatically.
- Bundle migration assets under `/migrations-<schema>` for production Workers. When absent, the runtime generates the initial migration from the provided schema.

---

## Module Map

- `src/lib/database/core/` — configuration, types, and the `KuratchiDatabase` class
- `src/lib/database/clients/` — HTTP and ORM client factories
- `src/lib/database/deployment/` — worker deployment and readiness checks
- `src/lib/database/migrations/` — schema normalization, migration utilities, and runner
- `src/lib/database/index.ts` — public exports and the `database` convenience namespace

---

## Troubleshooting

- **Missing gateway key**: provide `KURATCHI_GATEWAY_KEY` (or `GATEWAY_KEY`) in your environment.
- **Schema sync errors**: build or bundle migration assets and confirm the schema matches your database name; set `skipMigrations` when you handle migrations separately.
- **HTTP vs D1 binding**: in `wrangler dev`, ensure the binding name matches the database name (or pass `bindingName` when creating the ORM client) so the adapter selects the direct binding.
- **Worker readiness**: provisioning waits for the worker endpoint; if you see timeouts, retry with a higher timeout or verify the Workers subdomain and script name.
