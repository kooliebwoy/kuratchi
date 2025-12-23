---
title: Database
description: Manage Cloudflare D1 databases, migrations, and ORM clients through the Kuratchi SDK.
---

## Overview

The Kuratchi SDK exposes a `database` namespace that wraps the full Durable Objects workflow: provisioning D1 databases, generating HTTP clients, and handing back fully-configured ORM clients (schema sync + migrations included). This page documents those helpers and shows how the database + ORM stack works together in production.

```ts
import { database } from 'kuratchi-sdk/database';
```

> The `database` namespace is what powers `locals.kuratchi.orgDatabaseClient()` and the batteries-included auth plugins.

## Namespace API

| Helper | Purpose |
| --- | --- |
| `database.instance()` | Creates a `KuratchiDatabase` instance (reads Cloudflare env automatically). |
| `database.client()` | Returns an ORM client for a specific database, auto-running migrations unless `skipMigrations` is true. |
| `database.forDatabaseHttpClient()` | Gives raw HTTP access (`query`, `exec`, `batch`, etc.) without a schema. |
| `database.connect()` | Bundles ORM + raw HTTP clients when you need both. |
| `database.create()` | Provisions a new D1 database + worker (optional) and can seed the schema. |

All helpers default to environment variables loaded via `getDoEnvironment()` so you usually only pass the pieces that change per database (`databaseName`, `dbToken`, `schema`).

## Batteries-Included Example

The snippet below shows how the real `organizationSchema` pairs with the database namespace inside a SvelteKit endpoint. Every call automatically synchronizes schema state and applies pending migrations before returning the ORM client.

```ts
// src/routes/api/org-user-stats/+server.ts
import { json } from '@sveltejs/kit';
import { database } from 'kuratchi-sdk/database';
import { organizationSchema } from '$lib/schemas/organization';
import { env } from '$env/dynamic/private';

export const GET = async () => {
  const orm = await database.client({
    databaseName: env.KURATCHI_ORG_DB,
    dbToken: env.KURATCHI_ORG_DB_TOKEN,
    schema: organizationSchema,
    // skipMigrations: true // Uncomment to disable auto-sync (CI, read-only jobs, etc.)
  });

  const invites = await orm.users
    .where({ invite_token: { isNull: false } })
    .select(['id', 'email', 'invite_expires_at'])
    .many();

  const activeCount = await orm.users
    .where({ status: true })
    .count();

  return json({
    pendingInvites: invites.success ? invites.data : [],
    activeUsers: activeCount.success ? activeCount.data : 0
  });
};
```

### Raw SQL + ORM Together

When you need raw SQL (for bulk operations or admin dashboards) use `database.connect()`:

```ts
const { orm, query } = await database.connect({
  databaseName: env.KURATCHI_ADMIN_DB,
  dbToken: env.KURATCHI_ADMIN_DB_TOKEN,
  gatewayKey: env.KURATCHI_GATEWAY_KEY,
  schema: organizationSchema
});

const summary = await query(
  'SELECT status, COUNT(*) as count FROM users GROUP BY status'
);

const recentlyCreated = await orm.users
  .where({ 'created_at': { gt: Date.now() - 1000 * 60 * 60 * 24 } })
  .many();
```

## Migrations & Schema Sync

- ORM clients produced by `database.client()` call `synchronizeSchema()` under the hood.
- D1 statements are generated directly from your schema (`organizationSchema` in production). No manual acceptance step is required once the feature flag is on.
- Set `skipMigrations: true` only when you orchestrate migrations elsewhere (CI, manual CLI, read replica jobs).

Refer to [Automatic Migrations](/orm/migrations/) for the full breakdown of how schema hashes, table recreation, and validation work.

## Provisioning Databases

You can bootstrap a new organization database (with optional schema migration) directly through the namespace:

```ts
const { databaseName, token } = await database.create({
  name: 'acme-org-001',
  migrate: true,
  schema: organizationSchema,
  schemaName: 'organization'
});
```

`migrate: true` uploads your schema bundle and applies `m0001` immediately, so the returned `databaseName` is ready for queries.

## Next Steps

- Wire the namespace into `kuratchi({ database: { ... } })` so auth plugins can spin up org databases automatically.
- Point your SvelteKit endpoints and workers at `database.client()` for type-safe access without extra boilerplate.
- Keep your schema definitions in one place (e.g., `apps/dashboard/src/lib/schemas/organization.ts`) so both docs and runtime stay aligned.
