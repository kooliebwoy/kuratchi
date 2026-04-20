# Kuratchi

Managed database, key-value, and object storage platform built on Cloudflare. One dashboard, one SDK, three storage primitives.

- **D1 Databases** — SQL (SQLite) via Cloudflare D1
- **KV Namespaces** — Key-value store via Cloudflare Workers KV
- **R2 Buckets** — Object storage via Cloudflare R2

## SDK

The Kuratchi SDK gives you clean APIs for all three resource types. No manual fetch calls, no token juggling.

### Install

```bash
npm install @kuratchi/sdk
```

### Quick Start

```typescript
import { createClient } from '@kuratchi/sdk';

const kuratchi = createClient({
  apiKey: process.env.KURATCHI_API_KEY, // platform token (kdbp_ prefix) or resource-scoped token
  baseUrl: 'https://your-kuratchi-instance.com',
});
```

### Databases (SQL)

```typescript
const db = kuratchi.database('my-db');

// Query
const users = await db.query('SELECT * FROM users WHERE active = ?', [true]);

// Insert / update / delete
await db.query('INSERT INTO users (name, email) VALUES (?, ?)', ['Alice', 'alice@example.com']);

// Batch (transaction)
await db.batch([
  { sql: 'INSERT INTO posts (title) VALUES (?)', params: ['Hello'] },
  { sql: 'INSERT INTO posts (title) VALUES (?)', params: ['World'] },
]);

// DDL
await db.exec('CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY, title TEXT, body TEXT)');

// Raw (array-of-arrays instead of objects)
const raw = await db.raw('SELECT id, name FROM users');
```

#### Drizzle ORM

```typescript
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import * as schema from './schema';

const db = kuratchi.database('my-db');
const drizzleDb = drizzle(db.drizzleProxy(), { schema });

const users = await drizzleDb.select().from(schema.users);
```

#### D1 Session Bookmarks

For read-after-write consistency:

```typescript
const db = kuratchi.database('my-db');

await db.query('INSERT INTO users (name) VALUES (?)', ['Alice']);
// Bookmark is automatically tracked — subsequent reads see the write
const result = await db.query('SELECT * FROM users WHERE name = ?', ['Alice']);

// You can also get/set bookmarks manually
const bookmark = db.getBookmark();
db.setBookmark(bookmark);
```

### KV (Key-Value)

```typescript
const kv = kuratchi.kv('my-cache');

// Put
await kv.put('user:1', JSON.stringify({ name: 'Alice' }));

// Put with TTL and metadata
await kv.put('session:abc', JSON.stringify({ userId: 1 }), {
  expirationTtl: 3600,
  metadata: { type: 'session' },
});

// Get
const value = await kv.get('user:1');

// Get with metadata
const { value: data, metadata } = await kv.getWithMetadata('session:abc');

// List
const keys = await kv.list({ prefix: 'user:', limit: 100 });

// Delete
await kv.delete('user:1');
```

### R2 (Object Storage)

```typescript
const r2 = kuratchi.r2('my-bucket');

// Upload
await r2.put('photos/cat.jpg', imageBuffer, { contentType: 'image/jpeg' });

// Upload with custom metadata
await r2.put('docs/report.pdf', pdfBuffer, {
  contentType: 'application/pdf',
  metadata: { author: 'Alice', version: '2' },
});

// Download
const file = await r2.get('photos/cat.jpg');
// file.body is a ReadableStream
// file.contentType, file.size, file.etag

// List objects
const list = await r2.list({ prefix: 'photos/', limit: 50 });

// Head (metadata without downloading)
const meta = await r2.head('photos/cat.jpg');

// Delete
await r2.delete('photos/cat.jpg');
```

### Platform Management

Use a platform token (`kdbp_` prefix) to manage resources programmatically.

```typescript
const kuratchi = createClient({
  apiKey: 'kdbp_your_platform_token',
  baseUrl: 'https://your-kuratchi-instance.com',
});

// Databases
const databases = await kuratchi.platform.databases.list();
await kuratchi.platform.databases.create({ name: 'my-app', locationHint: 'enam' });
await kuratchi.platform.databases.delete('database-id');

// KV Namespaces
const namespaces = await kuratchi.platform.kv.list();
await kuratchi.platform.kv.create({ name: 'my-cache' });
await kuratchi.platform.kv.delete('namespace-id');

// R2 Buckets
const buckets = await kuratchi.platform.r2.list();
await kuratchi.platform.r2.create({ name: 'my-bucket', locationHint: 'weur' });
await kuratchi.platform.r2.delete('bucket-id');

// Tokens
await kuratchi.platform.tokens.createForDatabase({ name: 'ci', databaseId: 'db-id' });
await kuratchi.platform.tokens.createForKv({ name: 'staging', kvNamespaceId: 'kv-id' });
await kuratchi.platform.tokens.createForR2({ name: 'prod', r2BucketId: 'r2-id' });
await kuratchi.platform.tokens.revoke('token-id');
```

### Location Hints

When creating databases or R2 buckets, you can specify a location hint:

| Value | Region |
|-------|--------|
| `wnam` | Western North America |
| `enam` | Eastern North America |
| `weur` | Western Europe |
| `eeur` | Eastern Europe |
| `apac` | Asia Pacific |
| `oc` | Oceania |
| `afr` | Africa |
| `me` | Middle East |

Omit for automatic placement.

## API Reference

All data-plane endpoints require an `Authorization: Bearer <token>` header.

### D1 — `POST /api/v1/:dbName`

| Body | Description |
|------|-------------|
| `{ sql, params? }` | Query — rows as objects |
| `{ sql, params?, raw: true }` | Query — rows as arrays |
| `{ sql, exec: true }` | DDL/write — no results |
| `{ batch: [{ sql, params? }] }` | Batch (transaction) |

Supports `x-d1-bookmark` header for session consistency.

### KV — `POST /api/v1/kv/:kvName`

| Body | Description |
|------|-------------|
| `{ op: "get", key, type? }` | Get value |
| `{ op: "getWithMetadata", key, type? }` | Get value + metadata |
| `{ op: "put", key, value, expirationTtl?, metadata? }` | Put value |
| `{ op: "delete", key }` | Delete key |
| `{ op: "list", prefix?, limit?, cursor? }` | List keys |

### R2 — `/api/v1/r2/:r2Name`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List objects (`?prefix=&limit=&cursor=`) |
| `GET` | `/:key` | Download object |
| `PUT` | `/:key` | Upload object |
| `DELETE` | `/:key` | Delete object |
| `HEAD` | `/:key` | Object metadata |

### Platform — `/api/v1/platform/*`

Requires platform token (`kdbp_` prefix).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/platform/databases` | List databases |
| `POST` | `/platform/databases` | Create database |
| `GET` | `/platform/databases/:id` | Get database |
| `DELETE` | `/platform/databases/:id` | Delete database |
| `GET` | `/platform/kv` | List KV namespaces |
| `POST` | `/platform/kv` | Create KV namespace |
| `DELETE` | `/platform/kv/:id` | Delete KV namespace |
| `GET` | `/platform/r2` | List R2 buckets |
| `POST` | `/platform/r2` | Create R2 bucket |
| `DELETE` | `/platform/r2/:id` | Delete R2 bucket |
| `POST` | `/platform/tokens/database` | Create DB token |
| `POST` | `/platform/tokens/kv` | Create KV token |
| `POST` | `/platform/tokens/r2` | Create R2 token |
| `DELETE` | `/platform/tokens/:id` | Revoke token |

## Authentication

**Resource-scoped tokens** grant access to a single database, KV namespace, or R2 bucket. Created from the dashboard or via the platform API.

**Platform tokens** (`kdbp_` prefix) grant access to all resources and the management API. Created from Settings > API Tokens in the dashboard.

## Development

```bash
bun run dev    # Start dev server
bun run build  # Build for production
```

## CLI — `kuratchi dev`

`kuratchi dev` compiles your project, starts a file watcher, and spawns `wrangler dev` in a single command.

### Interactive Wrangler

By default, `kuratchi dev` auto-detects whether it's running in a terminal (TTY). When a TTY is present, Wrangler's stdin is inherited so interactive flows — like Cloudflare Access authentication — work normally. In non-TTY environments (CI, piped scripts), stdin is piped to preserve backward compatibility.

You can override the auto-detection with explicit flags:

| Flag | Behavior |
|------|----------|
| *(none)* | Auto-detect: inherit stdin if TTY, pipe otherwise |
| `--interactive-wrangler` | Force inherit stdin (always interactive) |
| `--non-interactive-wrangler` | Force pipe stdin (always non-interactive) |

These flags are consumed by Kuratchi and **not** passed through to Wrangler.

```bash
# Auto (recommended — works in terminal and CI)
kuratchi dev

# Force interactive (e.g. when auth prompts are needed)
kuratchi dev --interactive-wrangler

# Force non-interactive (e.g. CI with CLOUDFLARE_API_TOKEN)
kuratchi dev --non-interactive-wrangler
```

All other arguments are passed through to `wrangler dev`:

```bash
kuratchi dev --port 8788 --remote
```

