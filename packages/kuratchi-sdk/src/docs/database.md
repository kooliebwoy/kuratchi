# Database Guide

The `database` namespace provides Durable Object–backed SQLite provisioning and typed runtime clients. Use it to create logical databases for each organization, connect to them with JSON-schema ORM clients, and run SQL when needed.

## Architecture

The database module uses a **modular, plugin-based architecture** with clear separation of concerns:

- **Core**: Main orchestration class and type definitions
- **Clients**: HTTP, KV, and ORM client implementations
- **Deployment**: Worker deployment and readiness checks
- **Migrations**: Schema management and migration application

This modular design provides better testability, maintainability, and tree-shaking while maintaining 100% backward compatibility.

---

## Environment Requirements

Before instantiating the database API, set these environment variables (typically via `.env`).

| Key | Purpose |
| --- | --- |
| `CLOUDFLARE_WORKERS_SUBDOMAIN` | Workers subdomain hosting the Kuratchi Durable Object worker |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID used for Worker deployments |
| `CLOUDFLARE_API_TOKEN` | API token with permissions to deploy Workers and access D1 |
| `KURATCHI_GATEWAY_KEY` | Master gateway key injected into the worker (needed for per-database tokens) |
| `KURATCHI_ADMIN_DB_TOKEN` | Token for the admin database if you plan to call `database.admin()` |
| `KURATCHI_ADMIN_DB_NAME` | Admin database name (default `kuratchi-admin`) |

The CLI `init-admin-db` command returns both the admin database token and confirms the name. Store them in your secrets manager and `.env`.

---

## Instantiate KuratchiDatabase

### Option 1: Convenience Namespace (Recommended for Most Cases)

```ts
import { database } from 'kuratchi-sdk';

const db = database.instance();
```

`database.instance()` reads the environment automatically and returns a `KuratchiDatabase` class. Override any field by passing a partial config:

```ts
const db = database.instance({
  workersSubdomain: 'custom-subdomain',
  scriptName: 'custom-do-script'
});
```

### Option 2: Direct Class Import

```ts
import { KuratchiDatabase } from 'kuratchi-sdk/database';

const db = new KuratchiDatabase({
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  workersSubdomain: process.env.CLOUDFLARE_WORKERS_SUBDOMAIN!,
  scriptName: 'kuratchi-do-internal' // optional
});
```

### Option 3: Modular Functions (Advanced)

For maximum flexibility, import individual functions:

```ts
import { 
  createHttpClient,
  createOrmClient,
  deployWorker,
  applyMigrations 
} from 'kuratchi-sdk/database';

// Create HTTP client
const httpClient = createHttpClient({
  databaseName: 'org-acme-db',
  dbToken: 'token',
  gatewayKey: process.env.KURATCHI_GATEWAY_KEY!,
  workersSubdomain: process.env.CLOUDFLARE_WORKERS_SUBDOMAIN!
});

// Create ORM client
const orm = await createOrmClient({
  httpClient,
  schema: organizationSchema,
  databaseName: 'org-acme-db'
});
```

This modular approach is useful for:
- Testing individual components
- Custom integration scenarios
- Fine-grained control over initialization

---

## Provisioning a Logical Database

Use `database.create()` to provision a new Durable Object–backed database and optionally run initial migrations from a schema.

```ts
import { database } from 'kuratchi-sdk';
import { organizationSchema } from '$lib/schema/organization';

const created = await database.create({
  name: 'org-acme-db',
  migrate: true,
  schema: organizationSchema
});

console.log(created.databaseName, created.token);
```

- Requires `KURATCHI_GATEWAY_KEY` to be present.
- When `migrate: true`, a JSON schema is required (`DatabaseSchema` or DSL). The method applies the generated SQL to the new database.
- Returns `{ databaseName, token }`. Persist the token in the admin database so future requests can authenticate.

---

## Typed ORM Client

Use `database.client()` to obtain a JSON-schema ORM client for an existing database.

```ts
import { database } from 'kuratchi-sdk';
import { organizationSchema } from '$lib/schema/organization';

const orm = await database.client({
  databaseName: 'org-acme-db',
  dbToken: 'token-from-admin-db',
  schema: organizationSchema
});

const users = await orm.users.many();

// Optional: store metadata alongside relational data
if (users.data?.length) {
  await orm.kv?.put({ key: `org:${users.data[0].id}:settings`, value: { theme: 'light' } });
  const settings = await orm.kv?.get({ key: `org:${users.data[0].id}:settings` });
  console.log(settings?.value?.theme); // 'light'
}
```

- Accepts an optional `instance` parameter if you want to reuse a specific `KuratchiDatabase` instance.
- Auto-applies bundled migrations using `loadMigrations(dirName)` (expects Vite-built assets such as `/migrations-organization`). When not available, falls back to generating the initial migration bundle from the schema.
- `orm.kv` mirrors the Durable Object synchronous KV API (`get`, `put`, `delete`, `list`). Values are returned exactly as stored; binary payloads come back as `Uint8Array`. See [Cloudflare’s docs](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/#synchronous-kv-api) for detailed options (`metadata`, `expiration`, cursors, and so on).
- The client also exposes raw helpers via `database.instance().connect()` described below.

---

## Combined ORM + SQL Helpers

```ts
const instance = database.instance();
const { orm, query, exec, batch, kv } = await instance.connect({
  databaseName: 'org-acme-db',
  dbToken: 'token',
  gatewayKey: process.env.KURATCHI_GATEWAY_KEY!,
  schema: organizationSchema
});

await exec('INSERT INTO logs(message) VALUES (?)', ['hello from DO']);
const active = await orm.users.where({ deleted_at: { is: null } }).many();

// Direct KV access via the standalone helper returned by connect()
await kv.put({ key: 'cache:activeUsers', value: active.data });
const cached = await kv.get({ key: 'cache:activeUsers' });
```

---

## Admin Database Helper

`database.admin()` constructs a connection to the admin database and returns:

```ts
const { instance, orm, query, exec, batch, raw, first } = await database.admin();
```

- `orm`: typed client based on the built-in admin schema (`organizations`, `databases`, `dbApiTokens`, etc.).
- `query/exec/batch/raw/first`: direct SQL helpers against the admin database.
- Requires `KURATCHI_GATEWAY_KEY`, `KURATCHI_ADMIN_DB_TOKEN`, and `KURATCHI_ADMIN_DB_NAME`.

Use this helper when building custom admin utilities (for example, dashboards or automated cleanup jobs).

---

## Direct SQL Access

If you only need SQL helpers without ORM features, call `database.forDatabase()`.

```ts
const sql = database.forDatabase({
  databaseName: 'org-acme-db',
  dbToken: 'token'
});

await sql.exec('PRAGMA journal_mode = WAL;');
const result = await sql.query('SELECT * FROM users WHERE status = ?', ['active']);
```

This still enforces authentication via the per-database token and gateway key.

---

## Worker Deployment Notes

- `KuratchiDatabase` ensures the Durable Object worker (`kuratchi-do-internal` by default) is deployed before creating databases.
- When the worker already exists, the upload is idempotent. Migration errors trigger a second attempt with DO migrations skipped.
- After provisioning a database, `waitForWorkerEndpoint()` polls the worker endpoint to improve first-run reliability.

---

## Module Structure

The database package is organized into focused modules:

### Core (`src/lib/database/core/`)
- **types.ts**: All TypeScript type definitions
- **config.ts**: Environment variable resolution and validation
- **database.ts**: Main `KuratchiDatabase` orchestration class

### Clients (`src/lib/database/clients/`)
- **http-client.ts**: HTTP communication with DO worker
- **kv-client.ts**: KV operations (get, put, delete, list)
- **orm-client.ts**: ORM client creation and adapter selection

### Deployment (`src/lib/database/deployment/`)
- **worker-deployment.ts**: DO worker script upload and configuration
- **worker-wait.ts**: Endpoint readiness checks and retry logic

### Migrations (`src/lib/database/migrations/`)
- **migration-utils.ts**: Schema normalization and SQL splitting
- **migration-runner.ts**: Migration application with history tracking

### Public API (`src/lib/database/index.ts`)
Clean exports of all public functions, types, and the convenience `database` namespace.

This modular structure allows you to:
- Import only what you need (tree-shaking)
- Test individual components in isolation
- Extend functionality without modifying core code
- Understand the codebase more easily

---

## Troubleshooting

- **`KURATCHI_GATEWAY_KEY/GATEWAY_KEY is required`** — provide the gateway key via env or passthrough config.
- **`normalizeSchema not available`** — build the package (`npm run build`) so the CLI/runtime can import compiled helpers.
- **`Missing migration loader`** — ensure `migrations-<schema>` assets are bundled in your deployment. For Workers, use Vite bundling or fall back to runtime-generated initial migrations.
- **Slow endpoint warm-up** — the helper already retries, but you can add additional `await` loops before hitting the database for the first time in production workflows.

---

## Migration from Legacy API

All existing code continues to work! The refactored module maintains 100% backward compatibility.

### Import
```ts
import { KuratchiDatabase, database } from 'kuratchi-sdk/database';
```

### New Method Names
The class now has clearer method names:
- ✅ `ormClient()` - Get ORM client (recommended)
- ⚠️ `client()` - Legacy alias for `ormClient()` (still works)

Both methods are identical; `ormClient()` is just more explicit about what it returns.
