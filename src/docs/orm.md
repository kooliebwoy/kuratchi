# ORM Guide

Kuratchi ships a lightweight JSON schema–driven ORM tailored for Cloudflare Workers and Durable Objects. This guide shows how to define schemas, generate migrations, and run typed queries without falling back to dynamic SQL.

---

## Define a Schema

Schemas are plain JSON objects (or TypeScript modules) that describe tables, columns, and relations. Use the helpers exported from `src/lib/orm/json-schema.ts` or author objects manually.

```ts
// src/lib/schema/organization.ts
import type { SchemaDsl } from 'kuratchi-sdk/orm';

export const organizationSchema: SchemaDsl = {
  name: 'organization',
  tables: {
    users: {
      primaryKey: 'id',
      columns: {
        id: { type: 'text', notNull: true },
        email: { type: 'text', notNull: true, unique: true },
        password_hash: { type: 'text' },
        name: { type: 'text' },
        created_at: { type: 'integer', mode: 'timestamp_ms', default: { kind: 'raw', sql: 'strftime("%s","now")*1000' } }
      }
    },
    session: {
      primaryKey: 'id',
      columns: {
        id: { type: 'text', notNull: true },
        userId: { type: 'text', notNull: true, references: { table: 'users', column: 'id', onDelete: 'cascade' } },
        created_at: { type: 'integer', mode: 'timestamp_ms' }
      }
    }
  }
};
```

- Each column specifies type, nullability, defaults, and optional foreign key references.
- Relationships drive ORM features such as `.include()`.
- The runtime strongly prefers explicit schemas (no dynamic clients), aligning with the project preference in `src/lib/orm/kuratchi-orm.ts`.

---

## Generate Migrations

Use the CLI command documented in [`src/docs/cli.md`](./cli.md):

```sh
npx kuratchi-sdk generate-migrations \
  --schema src/lib/schema/organization.ts \
  --outDir migrations-organization
```

- The CLI normalizes the schema, produces SQL, and snapshots the structure under `meta/_schema.json`.
- Subsequent runs diff against the snapshot and emit incremental migrations.
- Commit both the schema and migration files to keep deployments synchronized.

Deploy bundled migrations (for Vite builds) under `/migrations-organization` so the runtime loader in `src/lib/orm/loader.ts` can apply them. Without the bundle, the runtime falls back to generating the initial migration only.

---

## Create a Typed Client

```ts
import { database } from 'kuratchi-sdk';
import { organizationSchema } from '$lib/schema/organization';

const orm = await database.client({
  databaseName: 'org-acme',
  dbToken: 'token-from-admin-db',
  schema: organizationSchema
});
```

The client exposes tables as properties and ensures request/response types match the schema definition. JSON columns are automatically serialized and hydrated.

For admin flows, `auth.admin()` returns `getOrganizationDb(orgId)` which internally reuses `createClientFromJsonSchema()` from `src/lib/orm/kuratchi-orm.ts`.

---

## Query Basics

Every table exposes chainable helpers:

```ts
const users = await orm.users
  .where({ deleted_at: { is: null } })
  .orderBy({ created_at: 'desc' })
  .limit(20)
  .offset(1)          // page number when used with limit (see `src/lib/orm/runtime.ts`)
  .many();            // fetch array of results

const oneUser = await orm.users.where({ id: 'user_123' }).first();
const count = await orm.users.count({ status: 'active' });
```

- `.many()` returns `{ data, meta }` objects; `.first()` returns a single row.
- `.limit(n)` + `.offset(page)` treat `offset` as `(page-1)*limit` (memory `26532eeb-16ff-4329-a282-37412bbadece`). Without a limit, `offset` is a raw row offset.
- `.select([...])` narrows columns; `.where({ column: value })` performs structural comparisons including nested operators like `{ is: null }`.

---

## Mutations

```ts
await orm.users.insert({
  id: crypto.randomUUID(),
  email: 'owner@acme.co',
  name: 'Owner'
});

await orm.users.where({ id: 'user_123' }).update({ name: 'Updated User' });
await orm.users.where({ status: 'invited' }).updateMany({ status: 'active' });
await orm.users.delete({ id: 'user_123' });
```

- `update()` affects the first matching row (prefers `id` when present).
- `updateMany()` updates all matching rows in a single statement.
- Deletions respect your schema constraints (for example, cascading via foreign keys).

---

## Includes & Relations

`.include()` performs eager joins based on foreign keys declared in the schema.

```ts
const sessions = await orm.session
  .include({ users: true })
  .where({ created_at: { gt: Date.now() - 7 * 24 * 3600 * 1000 } })
  .many();

// Access parent row: sessions.data[0].users
```

- Parent include (`posts` referencing `users`) attaches the parent row as `{ users: { ... } }`.
- Child include (`users` with `session`) attaches arrays of related rows.
- Use projections: `.include({ users: { select: ['id', 'email'], as: 'owner' } })`.

---

## JSON Columns

Declare JSON types to automatically encode/decode objects.

```ts
await orm.organizations.where({ id: 'org_1' }).update({
  metadata: { theme: 'dark', plan: 'pro' }
});

const org = await orm.organizations.where({ id: 'org_1' }).first();
org?.data?.metadata?.plan; // 'pro'
```

The ORM transparently stringifies values on write and parses on read using schema metadata.

---

## Best Practices

- Stick to typed clients—avoid dynamic schema usage (memory `1f38e360-99fe-4fee-a9ec-47687a0ddea6`).
- Reuse schema modules between CLI migrations and runtime clients to keep drift minimal.
- Keep migrations checked into source control and deploy them alongside your Worker bundle.
- For testing, construct clients with `createClientFromJsonSchema()` and an in-memory adapter if desired.

---

## Troubleshooting

- **Missing migrations**: ensure Vite bundles under `/migrations-<schema>` are present; otherwise, only the initial migration applies.
- **Runtime schema mismatch**: regenerate migrations after schema changes to update both SQL and snapshot metadata.
- **Include returns empty**: confirm foreign key definitions in the schema; includes rely on them.
- **`normalizeSchema` errors**: run `npm run build` to populate `dist/` so the CLI/runtime can import compiled helpers (also noted in `src/lib/orm/normalize.ts`).
