# Organization Guide

This guide documents the Organization database schema and how to work with it using Kuratchi’s minimal runtime ORM.

- Schema JSON: `src/lib/schema-json/organization.json`
- Typed client: `KuratchiD1.client(..., { schema: 'organization' })`
- Migrations: generated via CLI alias `kuratchi org generate-migrations`

## Tables overview

- users
  - id (pk), email (unique, required), name, firstName, lastName, phone, image
  - role: 'owner' | 'editor' | 'member'
  - emailVerified (timestamp_ms), status (boolean), password_hash
  - accessAttempts, tenantId, organization
  - created_at, updated_at, deleted_at
- session
  - sessionToken (pk), userId (fk → users.id, cascade delete), expires (timestamp_ms)
  - created_at, updated_at, deleted_at
- passwordResetTokens
  - id (pk), token, email, expires (timestamp_ms)
  - created_at, updated_at, deleted_at
- emailVerificationToken
  - id (pk), token, email, userId, expires (timestamp_ms)
  - created_at, updated_at, deleted_at
- magicLinkTokens
  - id (pk), token, email, redirectTo, consumed_at (timestamp_ms), expires (timestamp_ms)
  - created_at, updated_at, deleted_at
- activity
  - id (pk), userId, action (required), data (json), status (boolean), ip, userAgent
  - created_at, updated_at, deleted_at
- roles
  - id (pk), name (required), description, permissions (json)
  - created_at, updated_at, deleted_at
- oauthAccounts
  - id (pk), userId (fk → users.id, cascade delete)
  - provider, providerAccountId (required), access_token, refresh_token, expires_at (timestamp_ms), scope, token_type, id_token
  - created_at, updated_at, deleted_at

Notes:
- json columns are stored as TEXT in SQLite; caller serializes/parses as needed.
- boolean columns are INTEGER (0/1). timestamp_ms columns are INTEGER epoch millis. created_at/updated_at use TEXT with `CURRENT_TIMESTAMP` default.

## Generate migrations (CLI)

Use the org alias. Snapshotting is automatic inside the output directory.

```sh
# Initial bundle
kuratchi org generate-migrations \
  --schema-json-file ./src/lib/schema-json/organization.json \
  --tag initial

# Incremental diff after editing the schema JSON
kuratchi org generate-migrations \
  --schema-json-file ./src/lib/schema-json/organization.json \
  --tag add-sessions
```

- Output: `./migrations-org/`
  - SQL files: `<tag>.sql`
  - Journal: `meta/_journal.json`
  - Snapshot: `meta/_schema.json` (used as baseline if `--from-schema-json-file` is omitted)

## Apply migrations at runtime (SvelteKit/Vite)

```ts
const db = kuratchi.d1.database({ databaseName, apiToken });
await db.migrate('org'); // expects /migrations-org
```

Requires Vite so the loader can locate `/migrations-<dir>` via `import.meta.glob`.

## Get a typed client

```ts
const org = kuratchi.d1.database({ databaseName, apiToken }).client({ schema: 'organization' });
```

Exposed tables on `org`:
- `users`, `session`, `passwordResetTokens`, `emailVerificationToken`,
  `magicLinkTokens`, `activity`, `roles`, `oauthAccounts`

Each table supports:
- chainable reads: `where()`, `orWhere()`, `orderBy()`, `select()`, `limit()`, `offset()`, `include()`, then `findMany()` / `findFirst()`
- writes/utilities: `insert(values | values[])`, `update(where, values)`, `delete(where)`, `count(where?)`

## Examples

Create and query a user:
```ts
await org.users.insert({ id: 'u1', email: 'a@acme.com', role: 'member' });
const user = await org.users
  .where({ email: { like: '%@acme.com' } })
  .findFirst();
if (!user.success) throw new Error(user.error);
```

Attach child relations using `include()` (one‑to‑many):
```ts
// Load users with their oauth accounts
const res = await org.users
  .where({ role: 'member' })
  .include({ oauthAccounts: true })
  .findMany();
```

Attach parent relations using `include()` (many‑to‑one):
```ts
// Load sessions with the user row under .user
const res = await org.session
  .where({ expires: { gt: Date.now() } })
  .include({ users: { as: 'user' } })
  .findMany();
```

Update and delete:
```ts
await org.users.update({ id: 'u1' }, { name: 'Acme Admin' });
await org.session.delete({ userId: 'u1' });
```

Count:
```ts
const c = await org.users.count({ role: 'member' });
```

## Tips
- Use narrow `select()` and `orderBy()` with `findMany()` for performance where needed.
- For custom schemas, you can generate a client from a JSON schema using `createClientFromJsonSchema`.
- See `src/docs/migrations.md` for full migration details and snapshotting.
