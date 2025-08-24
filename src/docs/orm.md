# ORM

Kuratchi ships 2 complementary pieces:

- Runtime ORM: a tiny query builder to run SQL against D1 via the Kuratchi HTTP client.
- JSON‑schema ORM & migrations: define your SQLite schema in JSON, generate SQL, and apply migrations.

## Runtime ORM (experimental)

You typically won’t import the runtime module directly. Use the high‑level clients:

```ts
import { Kuratchi } from 'kuratchi';

const kuratchi = new Kuratchi({ apiToken, accountId, workersSubdomain });

// Option A: property-based client without calling database()
const admin = kuratchi.d1.client({ databaseName, apiToken }, { schema: 'admin' });
await admin.users.insert({ id: 'u1', email: 'a@acme.com' });
const first = await admin.users
  .where({ email: { like: '%@acme.com' } })
  .findFirst();
if (!first.success) throw new Error(first.error);
console.log(first.data);

// Option B: via a database handle
const db = kuratchi.d1.database({ databaseName, apiToken });
const org = db.client({ schema: 'organization' });
await org.session.delete({ sessionToken: 'deadbeef' });

```

### Table API (chainable)

Each table exposes a chainable query builder plus mutations:

- where(filter) -> this
- orWhere(filter) -> this
- sql({ query, params }) -> this  
  - query uses `?` placeholders; provide parameters via `params`.
- orderBy(order) -> this
- select(columns: string[]) -> this
- limit(n: number) -> this
- offset(n: number) -> this
- include(spec) -> this
- findMany() -> { success, data?: Row[] | undefined, error? }
- findFirst() -> { success, data?: Row | undefined, error? }
- insert(values | values[]) -> { success, ... }
- update(where, values) -> { success, ... }
- delete(where) -> { success, ... }
- count(where?) -> { success, data: { count: number }[] }

Where shape:

- Column -> value or operators: { eq, ne, gt, gte, lt, lte, like, in, notIn, is }
- Example: { email: { like: '%@acme.com' }, id: { in: ['u1','u2'] } }

OrderBy shape:

- 'column' | [{ column: 'asc' | 'desc' }, ...]

Result shape:

- All operations return a QueryResult: { success: boolean, data?: any, error?: string }

Under the hood this compiles SQL like `SELECT ... FROM table WHERE ... ORDER BY ... LIMIT ...` and calls the D1 HTTP endpoint via the Kuratchi client.

### Chainable query builder

```ts
// Example: admin typed client
const admin = kuratchi.d1.client({ databaseName, apiToken }, { schema: 'admin' });

// WHERE ... OR ... extra SQL ... ORDER BY ... LIMIT ...
const res = await admin.users
  .where({ email: '%@acme.com' })          // strings with %/_ use LIKE automatically
  .orWhere({ status: { in: [1, 2] } })
  .sql({ query: 'created_at BETWEEN ? AND ?', params: [start, end] })
  .orderBy({ id: 'desc' })
  .limit(10)
  .offset(3) // with LIMIT, offset(n) treats n as 1-based page number => OFFSET (n-1)*LIMIT
  .findMany();
```

#### Selecting specific columns

Use `select()` to choose columns and reduce row size/transfer costs:

```ts
const emails = await admin.users
  .select(['id', 'email'])
  .where({ email: { like: '%@acme.com' } })
  .orderBy({ id: 'asc' })
  .findMany();
```

Notes:

- When `select()` is omitted, `SELECT *` is used.
- With `select([...])`, only those columns are returned by `findMany()`/`findFirst()`.

#### Raw SQL fragments with safety guards

For cases not covered by the `where()` shape, use `sql({ query, params })` to add extra conditions to the current WHERE group.

```ts
// Adds: AND (name LIKE ?)
await admin.users
  .where({ active: true })
  .sql({ query: 'name LIKE ?', params: [`%${needle}%`] })
  .findMany();
```

Safety guard behavior:

- Throws on template interpolation or concatenation in `query` (e.g., `` `name = ${input}` `` or `'name = ' + input`).
- Throws on attempts to send multiple statements or dangerous keywords after `;`.
- Warns when no `params` and hardcoded values are detected; prefer placeholders.

Migration note: `whereRaw` has been removed in favor of `sql({ query, params })`.

#### Pagination helpers

Use `limit(n)` and `offset(n)` together for simple pagination. When used with `limit`, `offset(n)` treats `n` as a 1-based page number and the ORM computes the SQL `OFFSET (n-1)*limit` for you. Without `limit`, `offset(n)` is treated as a raw row offset.

```ts
const page = 3;
const pageSize = 20;
await admin.activity
  .orderBy({ created_at: 'desc' })
  .limit(pageSize)
  .offset(page) // computed OFFSET = (page-1) * pageSize
  .findMany();
```

### include() eager loading

Basic eager loading is supported via naming conventions:

- Parent include: if the base rows have `<related>Id`, `.include({ related: true })` loads parents by `id` and attaches one object.
- Child include: if the related table has `<singular(base)>Id`, `.include({ related: true })` loads children and attaches an array.

Examples:

```ts
// Parent: orders.userId -> users.id
const withUsers = await admin.orders
  .include({ users: true })
  .findMany();
// rows[i].users is the user object for orders[i].userId

// Child: sessions.userId -> users.id
const withSessions = await admin.users
  .include({ sessions: true })
  .findMany();
// rows[i].sessions is an array of sessions for users[i].id
```

You can customize the include behavior per key:

```ts
await admin.orders
  .include({
    users: { as: 'user', table: 'users' }, // rename property and/or target table
    items: { localKey: 'id', foreignKey: 'orderId', table: 'orderItems' }, // child side
  })
  .findMany();
```


## JSON‑schema ORM & migrations

Define your schema using Kuratchi’s JSON‑schema format and generate SQL migration bundles.

- Files: `src/lib/orm/json-schema.ts`, `src/lib/orm/sqlite-generator.ts`, `src/lib/orm/diff.ts`, `src/lib/orm/migrator.ts`
- Migration bundle layout:

```
migrations-<dir>/
  meta/_journal.json     # { entries: [{ idx: number, tag: string }, ...] }
  <tag>.sql              # One file per journal entry
```

### Generate migrations (CLI)

- Initial bundle: `kuratchi admin generate-migrations --schema-json-file ./schema-json/admin.json --out-dir ./migrations-admin --tag initial`
- Incremental diff: add `--from-schema-json-file ./schema-json/admin.prev.json`

### Apply migrations at runtime (Vite/SvelteKit)

```ts
import { Kuratchi } from 'kuratchi';

const kuratchi = new Kuratchi({ apiToken, accountId, workersSubdomain });
const db = kuratchi.d1.database({ databaseName, apiToken });
await db.migrate('admin'); // or 'org'
```

Notes:

- Uses Vite `import.meta.glob` under the hood to discover local bundles.
- For the admin DB, `kuratchi admin migrate` can generate an initial bundle automatically from your JSON schema if none exists.

### Limitations

- Diff generator is additive-only (new tables/columns/indexes). Drops/renames/type changes aren’t auto-generated.
- Adding NOT NULL columns without a DEFAULT may fail if existing rows violate constraints.
- Build before running CLI that imports compiled files (e.g., `admin generate-migrations`).
