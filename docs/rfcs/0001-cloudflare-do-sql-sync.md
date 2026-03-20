# RFC 0001: Local SQLite Sync to Cloudflare Durable Object SQLite

## Summary

Kuratchi should add a new database product that behaves like a local-first SQLite workflow with Cloudflare Durable Object SQLite as the cloud authority.

The user experience is:

- Open a local SQLite database file through Kuratchi.
- Use the Kuratchi ORM against that local file.
- Work offline or online with low-latency local queries.
- Have writes automatically sync to a Durable Object-backed SQLite database in Cloudflare.
- Use Cloudflare Durable Object APIs and RPC patterns against the cloud copy.

This is not "SQLite as a service" in the D1 sense. It is a replication product between:

- a local SQLite file managed by our SDK/runtime
- a remote Durable Object with `ctx.storage.sql`

## Product Shape

The product should feel like:

```ts
import { openDatabase } from '@kuratchi/sync';
import { appSchema } from './schema';

const db = await openDatabase({
  path: './.kuratchi/app.db',
  project: 'todo-app',
  token: process.env.KURATCHI_TOKEN!,
  schema: appSchema,
});

await db.todos.insert({ id: crypto.randomUUID(), title: 'ship sync', done: 0 });

await db.sync.now();
console.log(db.sync.status());
```

The important constraint is that `db.todos.insert()` writes to the local SQLite file first. Cloud sync is asynchronous and automatic.

## Non-Goals

Not for V1:

- arbitrary third-party writes directly against the SQLite file
- WAL-level replication
- byte-for-byte SQLite file syncing
- perfect multi-writer conflict-free sync across many offline replicas
- full raw SQL write replication without ORM mediation
- D1 compatibility or bookmark semantics as the primary model

Those can come later. The first version should optimize for a controlled, reliable path.

## Why Operation Log Sync

There are three obvious implementation paths:

1. Forward all writes to the Durable Object and keep local as a cache.
2. Ship SQLite pages or WAL segments.
3. Record structured mutations locally and replay them remotely.

We should choose option 3.

Why:

- Option 1 does not give a real local-first product.
- Option 2 is the hardest path operationally and ties us to SQLite internals, runtime-specific file locking, and transport concerns that do not map cleanly onto Durable Object SQLite.
- Option 3 is compatible with our current ORM-first direction and gives us control over conflict handling, idempotency, migrations, and replay.

This does mean V1 must be explicit: sync is guaranteed for writes performed through the Kuratchi ORM or approved mutation APIs, not for arbitrary external SQL tools touching the file.

## Core Decisions

### 1. Keep `@kuratchi/orm` runtime-agnostic

`@kuratchi/orm` is currently zero-dependency and Worker-safe. That is valuable and should stay true.

The package should continue owning:

- schema DSL
- migrations and schema diffs
- query builder semantics
- mutation planning
- adapters for D1, Durable Object `SqlStorage`, and generic executors

It should not become responsible for:

- local file lifecycle
- Node/Bun sqlite drivers
- sync transport
- background sync loops

### 2. Add a new package for local runtime + sync

Introduce a new package:

- `@kuratchi/sync`

This package owns:

- local SQLite driver adapters
- project enrollment
- replica identity
- local metadata tables
- outbox/inbox processing
- push/pull transport to the cloud
- background sync scheduling
- sync status reporting

This avoids contaminating `@kuratchi/orm` with local runtime concerns.

### 3. Durable Objects are the cloud primary

Each logical synced database maps to one Durable Object instance or one sharded namespace pattern if we later need scale.

The Durable Object is authoritative for:

- serialized cloud-side apply
- cloud metadata
- idempotent operation replay
- replica registration
- snapshot production
- alarms for compaction or garbage collection
- Cloudflare-side RPC access

### 4. V1 is single writable replica by default

We should not pretend multi-writer offline sync is easy. The first version should support:

- one writable local replica per database
- optional additional read-only replicas later
- a future path to multi-writer through explicit conflict strategies

This is still useful and dramatically simpler. It preserves the local-first DX while avoiding silent divergence.

## Architecture

### Control Plane

Existing control-plane logic in `apps/web` is D1-centered today. It should grow a second database product type instead of trying to force synced DO databases into the current D1 model.

New control-plane responsibilities:

- create a synced database record
- allocate a Durable Object identity
- issue replica enrollment tokens
- expose sync endpoints and metadata
- track replica health, lag, and last sync time

Suggested records:

- `syncDatabases`
- `syncReplicas`
- `syncTokens`
- `syncSnapshots`

The existing `databases` table can remain D1-specific unless we intentionally generalize it into a storage product registry.

### Cloud Data Plane

Add a Durable Object class, conceptually:

- `SyncedDatabaseDO`

Its local SQLite contains:

- application tables
- `_kuratchi_meta`
- `_kuratchi_replica_lease`
- `_kuratchi_applied_ops`
- `_kuratchi_snapshots`

Responsibilities:

- run migrations for the app schema with `initDO`
- validate and apply inbound operations serially
- reject duplicate or out-of-order operations
- serve pull responses since a remote cursor
- generate compact snapshots for new or stale replicas
- expose RPC/query APIs for other Worker code

### Local Runtime

The local database file contains:

- application tables
- `_kuratchi_local_meta`
- `_kuratchi_outbox`
- `_kuratchi_inbox`
- `_kuratchi_applied_remote_ops`
- `_kuratchi_sync_checkpoint`

Responsibilities:

- open or create the local SQLite file
- run schema migrations locally
- execute ORM mutations inside local transactions
- append deterministic operation records to `_kuratchi_outbox`
- push unacked operations
- pull remote operations or snapshots
- apply remote changes idempotently
- expose sync health to the user

## Write Model

V1 writes should go through mutation APIs that can be deterministically recorded.

Examples:

- `insert`
- `update`
- `delete`
- bulk insert

Each successful local write transaction should:

1. apply the mutation to local application tables
2. append an operation to `_kuratchi_outbox`
3. advance the local sequence

An operation record should contain:

- `opId`
- `replicaId`
- `seq`
- `timestamp`
- `schemaVersion`
- `table`
- `kind`
- `primaryKey`
- `data`
- `precondition`

`precondition` is important. It allows optimistic apply semantics later, even if V1 mostly operates under a single-writer lease.

## Read Model

All reads default to local SQLite.

That means:

- low latency
- offline support
- no network dependency for normal ORM queries

Cloud reads only matter for:

- sync
- management APIs
- external Cloudflare Workers hitting the Durable Object directly

## Sync Protocol

The protocol should be explicit and boring.

### Enrollment

`POST /api/v1/platform/sync-databases/:id/enroll`

Returns:

- `databaseId`
- `replicaId`
- `replicaToken`
- `durableObjectName`
- `schemaVersion`
- optional bootstrap snapshot metadata

### Push

`POST /api/v1/sync/:databaseId/push`

Request:

- `replicaId`
- `baseRemoteCursor`
- `ops[]`

Response:

- `acceptedThrough`
- `remoteCursor`
- `requiresSnapshot`
- `lease`

The cloud Durable Object applies operations in order and records the highest accepted sequence per replica.

### Pull

`POST /api/v1/sync/:databaseId/pull`

Request:

- `replicaId`
- `sinceRemoteCursor`

Response:

- `ops[]`
- `snapshot`
- `remoteCursor`
- `hasMore`

If the server has compacted history, it can force a snapshot instead of replaying a long tail forever.

### Lease

For V1 single-writer semantics, a replica holds a renewable write lease.

Rules:

- only the lease holder may push writes
- reads work without a lease
- lease loss downgrades the local client to read-only until renewed or explicitly transferred

This avoids fake multi-writer support.

## Conflict Model

V1 conflict policy should be:

- single writable replica enforced by lease
- remote apply remains authoritative
- any lease violation or unexpected sequence gap is surfaced as a sync error

Future conflict models can be added later:

- `serverWins`
- `clientWins`
- `failOnConflict`
- table-level merge hooks

But V1 should not silently invent merge behavior.

## Schema and Migration Model

Both local SQLite and DO SQLite should use the same schema DSL from `@kuratchi/orm`.

Requirements:

- the same normalized schema feeds both sides
- migrations run locally first on open
- cloud migrations run inside the DO during initialization or schema upgrade
- sync rejects mismatched schema versions unless a compatible migration path exists

This makes `@kuratchi/orm` the schema source of truth without making it own replication.

## SDK and Package Boundaries

### `@kuratchi/orm`

Add:

- a mutation planner that produces structured operations for ORM writes
- hooks or driver interfaces so sync-aware runtimes can capture writes

Do not add:

- file IO
- timers
- network transport

### `@kuratchi/sync`

Add:

- `openDatabase()`
- local driver adapters for Bun first
- sync engine
- status events
- manual `sync.now()`
- background loop with backoff
- enrollment/bootstrap helpers

### `@kuratchi/sdk`

Keep this as the remote platform client and extend it with:

- synced database management endpoints
- enrollment APIs
- admin observability for replica lag and health

Do not force local sqlite runtime concerns into the current remote SDK entrypoint unless the UX remains clean.

### `apps/web`

Add:

- synced database CRUD APIs
- enrollment/token issuance
- sync proxy routes if needed
- dashboard pages for synced databases, replicas, and lag

## Recommended First Runtime Target

Start with Bun only for the local driver.

Reason:

- this repo already uses Bun heavily
- the user is already working in that environment
- Bun gives us a simpler first-party SQLite story than designing for every Node driver on day one

Node support can come after the protocol is stable.

## Phased Implementation

### Phase 0: RFC and package boundaries

- approve this architecture
- create package scaffolding for `@kuratchi/sync`
- add a synced database product type to the control plane

### Phase 1: Single-writer local-first sync

- Bun local driver
- local schema migration
- ORM mutation capture
- outbox push to DO
- snapshot bootstrap
- write lease enforcement

Success looks like:

- one machine writes locally
- sync catches up automatically
- cloud DO reflects the same rows
- Worker code can query the DO copy

### Phase 2: Recovery and ergonomics

- resume from checkpoint
- snapshot compaction
- status events
- `db.sync.status()`
- dashboard lag metrics
- better auth and enrollment UX

### Phase 3: Raw SQL and multi-replica expansion

- carefully scoped raw SQL mutation support
- read-only replicas
- lease transfer
- explicit conflict strategies

## Concrete First Deliverable

The first thing we should build is not "full sync." It is this thin vertical slice:

1. `@kuratchi/sync` can open a Bun SQLite file.
2. It can run the Kuratchi schema locally.
3. ORM `insert/update/delete` append operations to `_kuratchi_outbox`.
4. A `SyncedDatabaseDO` can accept and apply those operations.
5. A test proves local rows and DO rows converge.

If that slice works, the rest becomes iteration. If it does not, the product idea needs revision before more surface area is added.

## Risks

- local sqlite driver differences across runtimes
- hidden writes outside ORM control
- snapshot design getting too heavy too early
- schema drift between local and cloud if versioning is weak
- trying to support multi-writer before the protocol is stable

The design above intentionally cuts scope to keep those risks manageable.

## Repo Impact

This RFC aligns with the current repo instead of fighting it:

- `packages/kuratchi-orm` already understands D1 and DO SQLite
- `packages/kuratchi-sdk` already owns remote platform access
- `apps/web` already acts as the control plane

What is missing is the local runtime plus the sync protocol. That should be a first-class package, not a side effect bolted onto the ORM.
