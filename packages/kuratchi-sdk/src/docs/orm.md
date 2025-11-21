# ORM Guide

Kuratchi includes a lightweight JSON schema–driven ORM optimized for Cloudflare Workers and Durable Objects. It builds parameterized SQL, hydrates JSON columns, and keeps schemas synchronized through the same helpers the database module uses.

---

## Define a Schema

Schemas are plain objects that describe tables, columns, indexes, and relations. Import the DSL types from the SDK and co-locate schema files with your app code.

```ts
// src/lib/schema/organization.ts
import type { SchemaDsl } from 'kuratchi-sdk';

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
        metadata: { type: 'json' },
        created_at: { type: 'integer', mode: 'timestamp_ms', default: { kind: 'raw', sql: 'strftime("%s","now")*1000' } }
      }
    },
    sessions: {
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

- Relationships declared via `references` power `.include()` joins.
- JSON columns are automatically stringified on write and parsed on read.
- Use the same schema for both migrations and runtime clients to avoid drift.

---

## Generate Migrations

Use the CLI documented in [`./cli.md`](./cli.md) to keep D1 in sync with your schema:

```sh
npx kuratchi-sdk generate-migrations \
  --schema src/lib/schema/organization.ts \
  --outDir migrations-organization
```

- The CLI normalizes the schema, emits SQL, and writes a snapshot under `meta/_schema.json` for future diffs.
- Re-run after schema changes; only new migrations are emitted when the snapshot already exists.
- Bundle the generated `migrations-organization` folder with your Worker so the runtime loader can apply them without regenerating.

---

## Create a Typed Client

The database namespace builds an ORM client tied to your schema and database token:

```ts
import { database } from 'kuratchi-sdk';
import { organizationSchema } from '$lib/schema/organization';

const orm = await database.client({
  databaseName: 'org-acme',
  dbToken: 'token-from-admin-db',
  schema: organizationSchema
});
```

- The adapter auto-detects D1 bindings (for `wrangler dev`/Workers) and falls back to the HTTP worker client.
- Migrations run by default unless you pass `skipMigrations: true`.
- The returned client exposes each table as a property; optional KV helpers are only present if you provide a KV implementation when constructing the client manually.

If you already have a `D1Client`, you can import `createOrmClient()` directly from `kuratchi-sdk/database` or call `createClientFromJsonSchema()` from `kuratchi-sdk/orm` to build a client around your own executor.

---

## Query Basics

Each table exposes a fluent API for common patterns:

```ts
const users = await orm.users
  .where({ deleted_at: { is: null } })
  .orderBy({ created_at: 'desc' })
  .limit(20)
  .offset(2) // when limit is set, treated as page number (page 2 => offset 20)
  .many();

const firstUser = await orm.users.where({ id: 'user_123' }).first();
const activeCount = await orm.users.count({ status: 'active' });
```

- `.many()` returns `{ success, data }` with hydrated JSON columns; `.first()` and `.one()` return a single row.
- `.where()` accepts primitives or operator objects (`eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `like`, `in`, `notIn`, `is`, `isNull`, `isNullish`).
- `.offset(n)` is a page number when `limit` is present; without a limit it becomes a raw row offset.
- Raw fragments can be added with `.sql({ query, params })` and combined with existing filters.

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

- `update()` fetches the first matching row and performs an `UPDATE ... WHERE id = ?` when an `id` column exists; otherwise it falls back to `updateMany()`.
- `updateMany()` applies a single statement to all matching rows.
- JSON columns are serialized automatically before writes and parsed on reads.

---

## Includes & Relations

Eager-load relations declared in your schema with `.include()`:

```ts
const sessions = await orm.sessions
  .include({ users: { select: ['id', 'email'], as: 'owner', single: true } })
  .where({ created_at: { gt: Date.now() - 7 * 24 * 3600 * 1000 } })
  .many();

const ownerEmail = sessions.data?.[0]?.owner?.email;
```

- Parent relations attach the referenced row; child relations attach arrays.
- Use `as` to alias the nested property and `select` to project columns.

---

## Raw Helpers

Every table API exposes `sql()` for ad-hoc fragments and the client inherits `query`, `exec`, `batch`, `raw`, and `first` from the underlying adapter via the database namespace. Combine them when you need specialized SQL outside the fluent builder.

---

## Troubleshooting

- **Missing migrations**: bundle the `migrations-<schema>` folder or run with `skipMigrations: true` only when you manage migrations yourself.
- **Unexpected transport**: pass `bindingName` when constructing the ORM client if your D1 binding name differs from the database name so the adapter prefers the direct binding.
- **JSON parse errors**: ensure columns marked as `json` store valid JSON strings; malformed data will be returned as-is without parsing.
