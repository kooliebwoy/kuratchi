# Kuratchi

Multi-tenant Cloudflare D1 toolkit with read replication support and a lightweight client for dynamic databases. Ships a small Cloudflare REST client to provision D1/Workers and an HTTP client to run queries through your Workers endpoint with optional D1 Sessions bookmarks.

• Lightweight: fetch-based, no heavy SDKs
• TypeScript-first: exported types and JSDoc
• Testable: Vitest unit tests with mocked fetch

## Opinionated scope & requirements

- This library is opinionated and originally built for personal use. It can be a solid foundation or a source of core functions for building multi‑tenancy on D1 (think dynamic D1 bindings per tenant).
- It targets Cloudflare Workers and D1. A Cloudflare API Token and Account ID are required.
- It provisions and uses a Worker per database; be aware this can bloat your Workers/Pages list in larger deployments.
- The API SDK (HTTP client) is transport-agnostic and may be used from anywhere (e.g., server, Workers, edge environments).
- The Sessions API integration is present but not heavily tested yet. Feedback and fixes are welcome.
- The repo is public—feel free to contribute.

## Installation

```sh
npm install kuratchi
```

## Quick Start

### Public SDK (provision + query)

```ts
import { Kuratchi } from 'kuratchi';

// SDK config (Cloudflare account + workers subdomain)
const sdk = new Kuratchi({
  apiToken: process.env.CF_API_TOKEN!,
  accountId: process.env.CF_ACCOUNT_ID!,
  workersSubdomain: 'your-subdomain.workers.dev',
});

// Provision via SDK (creates DB, deploys default Worker, enables read replication)
const { database, apiToken } = await sdk.createDatabase('acme-db', { location: 'weur' as const });
// Keep apiToken secret; use it server-side only.

// Create a per-database handle (token REQUIRED per database)
const db = sdk.database({
  databaseName: database.name, // use the name returned from provisioning
  apiToken,                    // use the Worker bearer token returned above
  // optional initial bookmark for read-replication session continuity
  // bookmark: 'bm-123',
});

// Query
const result = await db.query('SELECT 1 as one');
console.log(result.success, result.results);

// Drizzle adapter (sqlite-proxy style)
const proxy = db.drizzleProxy();
const drizzleClient = drizzle(proxy, { schema }); // uses sqlite-proxy from drizzle
const rows = await drizzleClient.insert(schema.Users).values({ ...userData, id: crypto.randomUUID() }).returning().get();

// Read-replication sessions: bookmark is auto-captured/updated via headers.
// To start with a specific bookmark:
const dbWithSession = sdk.database({ databaseName: 'acme-db', apiToken: process.env.WORKER_BEARER_TOKEN!, bookmark: 'bm-123' });
await dbWithSession.query('SELECT 1');

// Vite/SvelteKit: run migrations from /migrations-<dirName>/
// Directory layout example at project root:
//   migrations-client/meta/_journal.json
//   migrations-client/001_init.sql
//   migrations-client/002_add_users.sql
await db.migrateAuto('client');
```

## API Reference (Summary)

### Provisioning (public)
`src/lib/kuratchi.ts`

```ts
// Instantiate SDK
const sdk = new Kuratchi({ apiToken, accountId, workersSubdomain, endpointBase? });

// Create D1 + deploy default Worker (returns { database, apiToken })
await sdk.createDatabase('acme_prod', { location: 'weur' });

// Delete D1 by id
await sdk.deleteDatabase('<database_id>');

// Types
type PrimaryLocationHint = 'wnam' | 'enam' | 'weur' | 'eeur' | 'apac' | 'oc';
```

### Public SDK (stateless)
`src/lib/kuratchi.ts`

```ts
new Kuratchi({ apiToken, accountId, workersSubdomain, endpointBase? })

// Per-database operations (token REQUIRED per database)
sdk.getClient({ databaseName, apiToken, bookmark? })
sdk.getDrizzleClient({ databaseName, apiToken, bookmark? })
sdk.database({ databaseName, apiToken, bookmark? }) // -> { query, drizzleProxy, migrate, migrateWithLoader, getClient }

// Vite/SvelteKit one-call migration (uses import.meta.glob)
sdk.database({ databaseName, apiToken }).migrateAuto(dirName)

// Migrations (runtime-agnostic loader)
type MigrationJournal = { entries: { idx: number; tag: string }[] }
type MigrationLoader = { loadJournal(dir: string): Promise<MigrationJournal>; loadSql(dir: string, tag: string): Promise<string> }
sdk.migrate({ databaseName, apiToken }, { journal, migrations })
sdk.migrateWithLoader({ databaseName, apiToken }, 'dir', loader)

// Return types
type QueryResult<T> = { success: boolean; data?: T; error?: string; results?: any; schema?: any }
```

## Read Replication

Uses Cloudflare D1 REST endpoints. See official docs:
- Enable: https://developers.cloudflare.com/d1/best-practices/read-replication/#enable-read-replication-via-rest-api
- Disable: https://developers.cloudflare.com/d1/best-practices/read-replication/#disable-read-replication-via-rest-api

Notes:
- Worker endpoint requires a per-database bearer token; pass it via `sdk.db({ apiToken })`.
- Read-replication continuity uses the `x-d1-bookmark` header; the client auto-sends/updates it.
- Disabling may take time to drain replicas; bookmarks remain safe to use during transitions.

When provisioning via `sdk.createDatabase()`, Kuratchi enables read replication automatically.

## Migrations (runtime-agnostic)

Provide a loader that returns the journal and SQL text for your runtime. Example:

```ts
import { Kuratchi, type MigrationLoader } from 'kuratchi';

const loader: MigrationLoader = {
  async loadJournal(dir) { return { entries: [ { idx: 1, tag: '001_init' } ] } },
  async loadSql(dir, tag) { return MIGRATIONS_MAP[`${dir}/${tag}.sql`]; },
};

const sdk = new Kuratchi({ apiToken: CF_API_TOKEN, accountId: CF_ACCOUNT_ID, workersSubdomain: 'your-subdomain.workers.dev' });
await sdk.migrateWithLoader({ databaseName: 'acme-db', apiToken: WORKER_TOKEN }, 'site', loader);

### Vite/SvelteKit zero-friction migrations

If your app runs under Vite (e.g., SvelteKit on Cloudflare Workers), you can place migrations at the project root:

```
migrations-client/
  meta/_journal.json
  001_init.sql
  002_add_tables.sql
```

Then call:

```ts
await sdk.database({ databaseName: 'acme-db', apiToken: WORKER_TOKEN }).migrateAuto('client');
```

Under the hood this uses `import.meta.glob` via `src/lib/migrations-vite.ts` to load the journal and SQL lazily.

#### Drizzle Durable Object alignment

These migrations are designed to mimic Drizzle's Durable Object + sqlite storage workflow. If you generate migrations the same way, they should apply cleanly via Kuratchi. Example `drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    out: './migrations-tenant',
    schema: '../schemas/client-schema.ts',
    dialect: 'sqlite',
    driver: 'durable-sqlite',
});
```

- A migrations folder is created per logical database/tenant, e.g. `migrations-tenant/`. You can have multiple such folders (`migrations-client/`, `migrations-admin/`, etc.) and pick one via `migrateAuto('<dirName>')`.

### Non‑Vite environments

- Use `sdk.db(...).migrateWithLoader(dir, loader)` with your own loader, or
- Build a bundle and call `sdk.db(...).migrate({ journal, migrations })` directly.

`migrateAuto()` throws a helpful error if `import.meta.glob` is not available.
```

## Typescript and Exports

- All public classes and types are exported from `src/lib/index.ts` (internal HTTP client is private API).
- TypeScript types are emitted in `dist/index.d.ts` during packaging (`npm run build`).
- Key types: `CloudflareAPIResponse`, `PrimaryLocationHint`, `KuratchiConfig`, `QueryResult`.

## Testing

```sh
npm test
```

Structure:
- `tests/setup/test-setup.ts` — global Vitest setup
- `tests/unit/cloudflare.test.ts` — unit tests for Cloudflare client

## Contributing

PRs welcome! Please include tests for new features and keep the public API typed. Run:

```sh
npm run check && npm test && npm run build
```

## License

MIT

## Security considerations

- Do not expose `WORKER_BEARER_TOKEN` to browsers or client-side bundles. Treat it like a database password and keep it server-side only.
- The default Worker template sets a permissive CORS policy (`*`) for development convenience. For production, restrict allowed origins in `src/lib/worker-template.ts` and redeploy..
- Ensure your Cloudflare API token has the minimum required permissions.
