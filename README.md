# Kuratchi

Multi-tenant Cloudflare D1 toolkit with read replication support and a lightweight client for dynamic databases. Ships a small Cloudflare REST client to provision D1/Workers and an HTTP client to run queries through your Workers endpoint with optional D1 Sessions bookmarks.

• Lightweight: fetch-based, no heavy SDKs
• TypeScript-first: exported types and JSDoc
• Testable: Vitest unit tests with mocked fetch

## Installation

```sh
npm install kuratchi
```

## Quick Start

### 1) Provision D1 and Workers

```ts
import { CloudflareClient, type PrimaryLocationHint } from 'kuratchi';

const cf = new CloudflareClient({
  apiToken: process.env.CF_API_TOKEN!,
  accountId: process.env.CF_ACCOUNT_ID!,
});

// Create D1 database
await cf.createDatabase('acme_prod', 'weur' satisfies PrimaryLocationHint);

// List databases
const list = await cf.listDatabases();
console.log(list.result);

// (If you provision via the SDK, read replication is enabled automatically.)
// When using the low-level client directly, you can enable it explicitly:
await cf.enableReadReplication('<database_id>');

// Upload Workers script (module)
await cf.uploadWorkerModule('acme-db', `export default { fetch(){ return new Response('ok') } }`, [
  // add your bindings metadata here
]);

// Enable workers.dev subdomain
await cf.enableWorkerSubdomain('acme-db');
```

### 2) Query via the public SDK (stateless, bookmark-aware)

```ts
import { Kuratchi } from 'kuratchi';

// SDK config (Cloudflare account + workers subdomain)
const sdk = new Kuratchi({
  apiToken: process.env.CF_API_TOKEN!,
  accountId: process.env.CF_ACCOUNT_ID!,
  workersSubdomain: 'your-subdomain.workers.dev',
});

// Create a per-database handle (token REQUIRED per database)
const db = sdk.db({
  databaseName: 'acme-db',
  apiToken: process.env.WORKER_BEARER_TOKEN!,
  // optional initial bookmark for read-replication session continuity
  // bookmark: 'bm-123',
});

// Provision via SDK (creates DB, deploys default Worker, enables read replication)
const { database, apiToken } = await sdk.createDatabase('acme-db', { location: 'weur' as const });
// Keep apiToken secret; use it server-side only.

// Query
const result = await db.query('SELECT 1 as one');
console.log(result.success, result.results);

// Drizzle adapter (sqlite-proxy style)
const drizzle = db.drizzle();
const rows = await drizzle('SELECT * FROM users LIMIT 10', [], 'all');

// Read-replication sessions: bookmark is auto-captured/updated via headers.
// To start with a specific bookmark:
const dbWithSession = sdk.db({ databaseName: 'acme-db', apiToken: process.env.WORKER_BEARER_TOKEN!, bookmark: 'bm-123' });
await dbWithSession.query('SELECT 1');
```

## API Reference (Summary)

### Provisioning via SDK
`src/lib/sdk.ts`

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
sdk.db({ databaseName, apiToken, bookmark? }) // -> { query, drizzle, migrate, migrateWithLoader, getClient }

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
- The default Worker template sets a permissive CORS policy (`*`) for development convenience. For production, restrict allowed origins in `src/lib/worker-template.ts` and redeploy.
- Avoid logging secrets. The manual E2E script redacts newly created tokens, but you should still handle them carefully in your own scripts.
- Ensure your Cloudflare API token has the minimum required permissions.
